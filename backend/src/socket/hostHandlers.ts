import type { Server, Socket } from 'socket.io';
import { GameManager } from '../game/GameManager';
import { QuizDomain, ScoringMode } from '../game/types';
import {
  broadcastLeaderboard,
  broadcastQuestion,
  scheduleQuestionTimer
} from './sessionHelpers';

interface HostCreatePayload {
  domain: QuizDomain;
  questionCount: number;
  timePerQuestion: number;
  scoringMode?: ScoringMode;
}

const VALID_SCORING_MODES: ScoringMode[] = ['speed', 'points'];

interface SessionCodePayload {
  sessionCode: string;
  hostToken?: string;
}

const VALID_DOMAINS: QuizDomain[] = [
  'all',
  'cloud_concepts',
  'cloud_tech',
  'security_compliance',
  'billing_support'
];

export function registerHostHandlers(
  io: Server,
  socket: Socket,
  manager: GameManager
): void {
  socket.on('host:create', async (payload: HostCreatePayload) => {
    try {
      const domain = (payload?.domain ?? 'all') as QuizDomain;
      const questionCount = Number(payload?.questionCount);
      const timePerQuestion = Number(payload?.timePerQuestion);
      if (!VALID_DOMAINS.includes(domain)) {
        socket.emit('session:error', { message: 'Invalid domain.' });
        return;
      }
      if (!Number.isInteger(questionCount) || questionCount < 5 || questionCount > 65) {
        socket.emit('session:error', { message: 'Question count must be between 5 and 65.' });
        return;
      }
      if (!Number.isInteger(timePerQuestion) || timePerQuestion < 15 || timePerQuestion > 60) {
        socket.emit('session:error', { message: 'Time per question must be between 15 and 60 seconds.' });
        return;
      }
      const requestedMode = (payload?.scoringMode ?? 'speed') as ScoringMode;
      const scoringMode: ScoringMode = VALID_SCORING_MODES.includes(requestedMode)
        ? requestedMode
        : 'speed';
      const session = await manager.createSession(
        socket.id,
        domain,
        questionCount,
        timePerQuestion,
        scoringMode
      );
      socket.join(session.code);
      socket.emit('session:created', {
        sessionCode: session.code,
        hostToken: session.data.hostToken,
        scoringMode: session.data.scoringMode,
        totalQuestions: session.data.totalQuestions
      });
    } catch (err) {
      console.error('[host:create] error', err);
      socket.emit('session:error', { message: 'Failed to create session.' });
    }
  });

  socket.on('host:start', (payload: SessionCodePayload) => {
    const session = manager.getSession(payload?.sessionCode);
    if (!session || !session.isHost(socket.id)) {
      socket.emit('session:error', { message: 'Not authorized to start this session.' });
      return;
    }
    if (session.connectedPlayerCount() === 0) {
      socket.emit('session:error', { message: 'At least one player must join before starting.' });
      return;
    }
    const question = session.startQuiz();
    if (!question) {
      socket.emit('session:error', { message: 'Cannot start session in current state.' });
      return;
    }
    broadcastQuestion(io, session);
    scheduleQuestionTimer(io, session);
  });

  socket.on('host:next', (payload: SessionCodePayload) => {
    const session = manager.getSession(payload?.sessionCode);
    if (!session || !session.isHost(socket.id)) return;
    if (session.state === 'active' || session.state === 'paused') {
      const reveal = session.buildRevealPayload();
      if (reveal) {
        io.to(session.code).emit('question:reveal', reveal);
      }
    }
    const result = session.advanceQuestion();
    if (result.ended) {
      const finalLeaderboard = session.endQuiz();
      io.to(session.code).emit('game:ended', { finalLeaderboard });
      manager.removeSession(session.code);
      return;
    }
    broadcastQuestion(io, session);
    scheduleQuestionTimer(io, session);
  });

  socket.on('host:pause', (payload: SessionCodePayload) => {
    const session = manager.getSession(payload?.sessionCode);
    if (!session || !session.isHost(socket.id)) return;
    const { timeRemaining } = session.pause();
    io.to(session.code).emit('game:paused', { timeRemaining });
  });

  socket.on('host:resume', (payload: SessionCodePayload) => {
    const session = manager.getSession(payload?.sessionCode);
    if (!session || !session.isHost(socket.id)) return;
    const { timeRemaining } = session.resume();
    io.to(session.code).emit('game:resumed', { timeRemaining });
    scheduleQuestionTimer(io, session);
  });

  socket.on('host:end', (payload: SessionCodePayload) => {
    const session = manager.getSession(payload?.sessionCode);
    if (!session || !session.isHost(socket.id)) return;
    const finalLeaderboard = session.endQuiz();
    io.to(session.code).emit('game:ended', { finalLeaderboard });
    manager.removeSession(session.code);
  });

  socket.on('host:reconnect', (payload: SessionCodePayload) => {
    const session = manager.getSession(payload?.sessionCode);
    if (!session) {
      socket.emit('session:error', { message: 'Session no longer exists.' });
      return;
    }
    if (!session.validateHostToken(payload?.hostToken)) {
      socket.emit('session:error', { message: 'This host link is not authorized for the active session.' });
      return;
    }
    const existingHostConnected = session.hostSocketId !== socket.id
      && io.sockets.sockets.has(session.hostSocketId);
    if (existingHostConnected) {
      socket.emit('session:error', { message: 'This session already has an active host.' });
      return;
    }
    const nextHostToken = manager.generateHostToken();
    session.setHost(socket.id, nextHostToken);
    socket.join(session.code);
    io.to(session.code).except(socket.id).emit('host:reconnected', {});
    socket.emit('session:created', {
      sessionCode: session.code,
      hostToken: nextHostToken
    });
    socket.emit('lobby:update', { players: session.listPlayers() });
    socket.emit('host:state', {
      state: session.state,
      question: session.getCurrentQuestion(),
      questionStats: session.answerStats(),
      timeRemaining: session.timeRemainingMs(),
      rankings: session.getRankings(),
      answerReveal: session.getCurrentQuestionReveal()
    });
    if (session.state === 'active' || session.state === 'paused') {
      const question = session.getCurrentQuestion();
      if (question) {
        socket.emit('game:question', {
          ...question,
          timeRemaining: session.timeRemainingMs()
        });
        socket.emit('question:stats', session.answerStats());
      }
      if (session.state === 'paused') {
        socket.emit('game:paused', { timeRemaining: session.timeRemainingMs() });
      }
    }
    if (session.state === 'between') {
      broadcastLeaderboard(io, session);
    }
  });

  socket.on('disconnect', () => {
    const session = manager.getSessionByHost(socket.id);
    if (!session) return;
    io.to(session.code).emit('host:disconnected', {});
    if (session.state === 'active') {
      const { timeRemaining } = session.pause();
      io.to(session.code).emit('game:paused', { timeRemaining });
    }
  });
}
