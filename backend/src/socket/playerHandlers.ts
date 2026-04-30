import type { Server, Socket } from 'socket.io';
import { GameManager } from '../game/GameManager';
import { autoAdvanceIfDone, questionForPlayer, revealForPlayer } from './sessionHelpers';

interface PlayerJoinPayload {
  sessionCode: string;
  nickname: string;
}

interface PlayerAnswerPayload {
  sessionCode: string;
  answers: string[];
}

function sanitizeNickname(input: string | undefined): string {
  if (!input) return '';
  return input
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20);
}

export function registerPlayerHandlers(
  io: Server,
  socket: Socket,
  manager: GameManager
): void {
  socket.on('player:join', (payload: PlayerJoinPayload) => {
    const code = (payload?.sessionCode || '').trim().toUpperCase();
    const nickname = sanitizeNickname(payload?.nickname);
    const session = manager.getSession(code);
    if (!session) {
      socket.emit('session:error', { message: 'Session not found.' });
      return;
    }
    if (!nickname) {
      socket.emit('session:error', { message: 'Nickname is required.' });
      return;
    }

    const result = session.addPlayer(socket.id, nickname);
    if ('error' in result) {
      socket.emit('session:error', { message: result.error });
      return;
    }

    socket.join(session.code);
    const rankings = session.getRankings();
    const myRanking = rankings.find((entry) => entry.nickname === result.nickname);

    socket.emit('session:joined', {
      sessionCode: session.code,
      playerCount: session.connectedPlayerCount(),
      nickname: result.nickname,
      score: result.score,
      rank: myRanking?.rank ?? result.rank,
      streak: result.streak,
      state: session.state
    });

    socket.emit('player:state', {
      score: result.score,
      rank: myRanking?.rank ?? result.rank,
      streak: result.streak,
      answeredCurrentQuestion: session.hasPlayerAnsweredCurrentQuestion(socket.id),
      timeRemaining: session.timeRemainingMs()
    });

    io.to(session.hostSocketId).emit('lobby:update', {
      players: session.listPlayers()
    });
    io.to(session.code).except(session.hostSocketId).emit('lobby:update', {
      playerCount: session.connectedPlayerCount()
    });

    if (session.state === 'active' || session.state === 'paused') {
      const question = session.getCurrentQuestion();
      if (question) {
        socket.emit('game:question', questionForPlayer({
          ...question,
          timeRemaining: session.timeRemainingMs()
        }));
      }
      if (session.state === 'paused') {
        socket.emit('game:paused', { timeRemaining: session.timeRemainingMs() });
      }
    }

    if (session.state === 'between') {
      const answerReveal = session.getCurrentQuestionReveal();
      const playerAnswerReveal = answerReveal ? revealForPlayer(answerReveal) : answerReveal;
      if (answerReveal) {
        socket.emit('question:reveal', playerAnswerReveal);
      }
      socket.emit('leaderboard:show', {
        rankings,
        answerReveal: playerAnswerReveal,
        myRank: myRanking?.rank
      });
    }
  });

  socket.on('player:answer', (payload: PlayerAnswerPayload) => {
    const code = (payload?.sessionCode || '').trim().toUpperCase();
    const session = manager.getSession(code);
    if (!session) return;
    if (session.state !== 'active') return;
    const submitted = Array.isArray(payload?.answers) ? payload.answers : [];
    const result = session.submitAnswer(socket.id, submitted);
    if (!result) return;

    socket.emit('answer:result', result);

    const stats = session.answerStats();
    io.to(session.hostSocketId).emit('question:stats', stats);

    autoAdvanceIfDone(io, session);
  });

  socket.on('player:leave', (payload: { sessionCode?: string }) => {
    const code = (payload?.sessionCode || '').trim().toUpperCase();
    const session = manager.getSession(code);
    if (!session) return;
    if (session.isHost(socket.id)) return;
    if (session.state === 'lobby') {
      session.removePlayer(socket.id);
    } else {
      session.markDisconnected(socket.id);
    }
    socket.leave(session.code);
    io.to(session.hostSocketId).emit('lobby:update', {
      players: session.listPlayers()
    });
    io.to(session.code).except(session.hostSocketId).emit('lobby:update', {
      playerCount: session.connectedPlayerCount()
    });
  });

  socket.on('disconnect', () => {
    for (const session of manager.listSessions()) {
      if (session.isHost(socket.id)) continue;
      const player = session.markDisconnected(socket.id);
      if (player) {
        io.to(session.hostSocketId).emit('lobby:update', {
          players: session.listPlayers()
        });
      }
    }
  });
}
