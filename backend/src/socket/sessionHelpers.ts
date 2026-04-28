import type { Server } from 'socket.io';
import { GameSession } from '../game/GameSession';

export function broadcastQuestion(io: Server, session: GameSession): void {
  const payload = session.getCurrentQuestion();
  if (!payload) return;
  io.to(session.code).emit('game:question', payload);
}

export function broadcastLeaderboard(io: Server, session: GameSession): void {
  const rankings = session.getRankings();
  const answerReveal = session.getCurrentQuestionReveal();
  if (answerReveal) {
    io.to(session.code).emit('question:reveal', answerReveal);
  }
  io.to(session.code).emit('leaderboard:show', { rankings, answerReveal });
  io.to(session.code).emit('leaderboard:snapshot', { rankings, answerReveal });
}

export function scheduleQuestionTimer(io: Server, session: GameSession): void {
  session.clearTimer();
  const remainingMs = session.timeRemainingMs();
  const timer = setTimeout(() => {
    if (session.state !== 'active') return;
    session.finishCurrentQuestion();
    broadcastLeaderboard(io, session);
  }, remainingMs);
  session.setTimer(timer);
}

export function autoAdvanceIfDone(io: Server, session: GameSession): void {
  if (session.state !== 'active') return;
  if (!session.checkAllAnswered()) return;
  session.finishCurrentQuestion();
  broadcastLeaderboard(io, session);
}
