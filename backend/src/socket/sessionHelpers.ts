import type { Server } from 'socket.io';
import { GameSession } from '../game/GameSession';
import { QuestionPayload, QuestionRevealPayload } from '../game/types';

type TimedQuestionPayload = QuestionPayload & { timeRemaining: number };
type PlayerQuestionPayload = Omit<TimedQuestionPayload, 'questionId' | 'questionKey'>;
type PlayerRevealPayload = Omit<QuestionRevealPayload, 'questionId' | 'questionKey'>;

export function questionForPlayer(payload: TimedQuestionPayload): PlayerQuestionPayload {
  const { questionId: _questionId, questionKey: _questionKey, ...playerPayload } = payload;
  return playerPayload;
}

export function revealForPlayer(payload: QuestionRevealPayload): PlayerRevealPayload {
  const { questionId: _questionId, questionKey: _questionKey, ...playerPayload } = payload;
  return playerPayload;
}

export function broadcastQuestion(io: Server, session: GameSession): void {
  const payload = session.getCurrentQuestion();
  if (!payload) return;
  const timedPayload = {
    ...payload,
    timeRemaining: session.timeRemainingMs()
  };
  io.to(session.hostSocketId).emit('game:question', timedPayload);
  io.to(session.code).except(session.hostSocketId).emit(
    'game:question',
    questionForPlayer(timedPayload)
  );
}

export function broadcastLeaderboard(io: Server, session: GameSession): void {
  const rankings = session.getRankings();
  const answerReveal = session.getCurrentQuestionReveal();
  const hostPayload = { rankings, answerReveal };
  const playerAnswerReveal = answerReveal ? revealForPlayer(answerReveal) : answerReveal;
  const playerPayload = { rankings, answerReveal: playerAnswerReveal };

  if (answerReveal) {
    io.to(session.hostSocketId).emit('question:reveal', answerReveal);
    io.to(session.code)
      .except(session.hostSocketId)
      .emit('question:reveal', playerAnswerReveal);
  }
  io.to(session.hostSocketId).emit('leaderboard:show', hostPayload);
  io.to(session.hostSocketId).emit('leaderboard:snapshot', hostPayload);
  io.to(session.code).except(session.hostSocketId).emit('leaderboard:show', playerPayload);
  io.to(session.code).except(session.hostSocketId).emit('leaderboard:snapshot', playerPayload);
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
