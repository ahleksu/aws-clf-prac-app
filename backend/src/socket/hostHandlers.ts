import type { Server, Socket } from 'socket.io';
import { GameManager } from '../game/GameManager';
import { QuizDomain } from '../game/types';
import {
  broadcastQuestion,
  scheduleQuestionTimer
} from './sessionHelpers';

interface HostCreatePayload {
  domain: QuizDomain;
  questionCount: number;
  timePerQuestion: number;
}

interface SessionCodePayload {
  sessionCode: string;
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
      const questionCount = Math.max(1, Math.min(65, Number(payload?.questionCount) || 20));
      const timePerQuestion = Math.max(5, Math.min(120, Number(payload?.timePerQuestion) || 30));
      if (!VALID_DOMAINS.includes(domain)) {
        socket.emit('session:error', { message: 'Invalid domain.' });
        return;
      }
      const session = await manager.createSession(socket.id, domain, questionCount, timePerQuestion);
      socket.join(session.code);
      socket.emit('session:created', { sessionCode: session.code });
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
    session.setHost(socket.id);
    socket.join(session.code);
    socket.emit('session:created', { sessionCode: session.code });
    socket.emit('lobby:update', { players: session.listPlayers() });
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
