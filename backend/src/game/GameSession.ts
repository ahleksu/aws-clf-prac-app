import {
  AnswerResult,
  GameSessionData,
  LiveQuestion,
  PlayerState,
  QuestionPayload,
  Ranking,
  SessionState
} from './types';

const BASE_POINTS = 1000;
const MAX_TIME_BONUS = 500;
const STREAK_INCREMENT = 100;
const MAX_STREAK_BONUS = 500;

export class GameSession {
  readonly data: GameSessionData;
  private pausedTimeRemainingMs: number | null = null;

  constructor(data: GameSessionData) {
    this.data = data;
  }

  get code(): string {
    return this.data.code;
  }

  get state(): SessionState {
    return this.data.state;
  }

  get hostSocketId(): string {
    return this.data.hostSocketId;
  }

  isHost(socketId: string): boolean {
    return socketId === this.data.hostSocketId;
  }

  setHost(socketId: string): void {
    this.data.hostSocketId = socketId;
  }

  getPlayer(socketId: string): PlayerState | undefined {
    return this.data.players.get(socketId);
  }

  getPlayerByNickname(nickname: string): PlayerState | undefined {
    const norm = nickname.trim().toLowerCase();
    for (const player of this.data.players.values()) {
      if (player.nickname.toLowerCase() === norm) {
        return player;
      }
    }
    return undefined;
  }

  listPlayers(): PlayerState[] {
    return Array.from(this.data.players.values());
  }

  connectedPlayerCount(): number {
    let n = 0;
    for (const p of this.data.players.values()) {
      if (p.connected) n++;
    }
    return n;
  }

  addPlayer(socketId: string, nickname: string): PlayerState | { error: string } {
    const trimmed = nickname.trim();
    if (!trimmed) {
      return { error: 'Nickname is required.' };
    }
    if (trimmed.length > 20) {
      return { error: 'Nickname must be 20 characters or fewer.' };
    }
    if (this.data.state !== 'lobby') {
      const existing = this.getPlayerByNickname(trimmed);
      if (existing && !existing.connected) {
        this.data.players.delete(existing.socketId);
        existing.socketId = socketId;
        existing.connected = true;
        this.data.players.set(socketId, existing);
        return existing;
      }
      return { error: 'Quiz already started — cannot join now.' };
    }
    if (this.getPlayerByNickname(trimmed)) {
      return { error: 'Nickname already taken in this session.' };
    }

    const player: PlayerState = {
      socketId,
      nickname: trimmed,
      score: 0,
      rank: 0,
      answers: [],
      streak: 0,
      connected: true
    };
    this.data.players.set(socketId, player);
    return player;
  }

  reconnectPlayer(socketId: string, nickname: string): PlayerState | undefined {
    const existing = this.getPlayerByNickname(nickname);
    if (!existing) return undefined;
    if (existing.socketId !== socketId) {
      this.data.players.delete(existing.socketId);
      existing.socketId = socketId;
      this.data.players.set(socketId, existing);
    }
    existing.connected = true;
    return existing;
  }

  markDisconnected(socketId: string): PlayerState | undefined {
    const p = this.data.players.get(socketId);
    if (!p) return undefined;
    p.connected = false;
    return p;
  }

  removePlayer(socketId: string): void {
    this.data.players.delete(socketId);
  }

  private currentQuestion(): LiveQuestion | undefined {
    return this.data.questions[this.data.currentQuestionIndex];
  }

  getCurrentQuestion(): QuestionPayload | null {
    const q = this.currentQuestion();
    if (!q) return null;
    return {
      questionNumber: this.data.currentQuestionIndex + 1,
      total: this.data.totalQuestions,
      questionText: q.question,
      type: q.type,
      answers: q.answers.map((a) => ({ text: a.text, label: a.label })),
      timeLimit: this.data.timePerQuestion,
      domain: q.domain
    };
  }

  startQuiz(): QuestionPayload | null {
    if (this.data.state !== 'lobby') return null;
    this.data.currentQuestionIndex = 0;
    this.data.state = 'active';
    this.data.questionStartTime = Date.now();
    this.pausedTimeRemainingMs = null;
    for (const p of this.data.players.values()) {
      p.streak = 0;
      p.score = 0;
      p.answers = [];
    }
    return this.getCurrentQuestion();
  }

  submitAnswer(socketId: string, submitted: string[]): AnswerResult | undefined {
    if (this.data.state !== 'active') return undefined;
    const player = this.data.players.get(socketId);
    if (!player) return undefined;
    const question = this.currentQuestion();
    if (!question) return undefined;

    if (player.answers.some((a) => a.questionId === question.id)) {
      return undefined;
    }

    const timeMs = Math.max(0, Date.now() - this.data.questionStartTime);
    const timeLimitMs = this.data.timePerQuestion * 1000;

    const submittedSet = new Set(submitted.map((s) => s.toUpperCase().trim()));
    const correctSet = new Set(question.correctAnswers.map((s) => s.toUpperCase()));

    let isCorrect = false;
    if (question.type === 'single') {
      isCorrect = submittedSet.size === 1 && correctSet.has([...submittedSet][0]);
    } else {
      if (submittedSet.size === correctSet.size) {
        isCorrect = true;
        for (const s of submittedSet) {
          if (!correctSet.has(s)) { isCorrect = false; break; }
        }
      }
    }

    if (isCorrect) {
      player.streak += 1;
    } else {
      player.streak = 0;
    }

    const pointsEarned = this.calculatePoints(isCorrect, timeMs, timeLimitMs, player.streak);
    player.score += pointsEarned;

    player.answers.push({
      questionId: question.id,
      submitted: [...submittedSet],
      correct: isCorrect,
      timeMs,
      pointsEarned
    });

    const rankings = this.getRankings();
    const myRanking = rankings.find((r) => r.nickname === player.nickname);

    return {
      correct: isCorrect,
      pointsEarned,
      correctAnswers: question.correctAnswers,
      explanation: question.explanation,
      newScore: player.score,
      rank: myRanking?.rank ?? 0
    };
  }

  private calculatePoints(
    correct: boolean,
    timeMs: number,
    timeLimitMs: number,
    streak: number
  ): number {
    if (!correct) return 0;
    const ratio = Math.max(0, Math.min(1, timeMs / timeLimitMs));
    const timeBonus = Math.round(MAX_TIME_BONUS * (1 - ratio));
    const streakBonus = Math.min(streak * STREAK_INCREMENT, MAX_STREAK_BONUS);
    return BASE_POINTS + timeBonus + streakBonus;
  }

  checkAllAnswered(): boolean {
    const question = this.currentQuestion();
    if (!question) return false;
    let connected = 0;
    let answered = 0;
    for (const p of this.data.players.values()) {
      if (!p.connected) continue;
      connected++;
      if (p.answers.some((a) => a.questionId === question.id)) {
        answered++;
      }
    }
    return connected > 0 && answered >= connected;
  }

  answerStats(): { answered: number; total: number } {
    const question = this.currentQuestion();
    if (!question) return { answered: 0, total: 0 };
    let connected = 0;
    let answered = 0;
    for (const p of this.data.players.values()) {
      if (!p.connected) continue;
      connected++;
      if (p.answers.some((a) => a.questionId === question.id)) {
        answered++;
      }
    }
    return { answered, total: connected };
  }

  finishCurrentQuestion(): void {
    if (this.data.state === 'active' || this.data.state === 'paused') {
      this.data.state = 'between';
      this.clearTimer();
      this.pausedTimeRemainingMs = null;
    }
  }

  advanceQuestion(): { question: QuestionPayload | null; ended: boolean } {
    if (this.data.state === 'active' || this.data.state === 'paused') {
      this.finishCurrentQuestion();
    }
    this.data.currentQuestionIndex += 1;
    if (this.data.currentQuestionIndex >= this.data.questions.length) {
      this.data.state = 'ended';
      return { question: null, ended: true };
    }
    this.data.state = 'active';
    this.data.questionStartTime = Date.now();
    this.pausedTimeRemainingMs = null;
    return { question: this.getCurrentQuestion(), ended: false };
  }

  pause(): { timeRemaining: number } {
    if (this.data.state !== 'active') {
      return { timeRemaining: this.timeRemainingMs() };
    }
    this.pausedTimeRemainingMs = this.timeRemainingMs();
    this.data.state = 'paused';
    this.clearTimer();
    return { timeRemaining: this.pausedTimeRemainingMs };
  }

  resume(): { timeRemaining: number } {
    if (this.data.state !== 'paused') {
      return { timeRemaining: this.timeRemainingMs() };
    }
    const remaining = this.pausedTimeRemainingMs ?? this.data.timePerQuestion * 1000;
    this.data.questionStartTime = Date.now() - (this.data.timePerQuestion * 1000 - remaining);
    this.data.state = 'active';
    this.pausedTimeRemainingMs = null;
    return { timeRemaining: remaining };
  }

  timeRemainingMs(): number {
    if (this.pausedTimeRemainingMs !== null) {
      return this.pausedTimeRemainingMs;
    }
    const elapsed = Date.now() - this.data.questionStartTime;
    return Math.max(0, this.data.timePerQuestion * 1000 - elapsed);
  }

  endQuiz(): Ranking[] {
    this.data.state = 'ended';
    this.clearTimer();
    return this.getRankings();
  }

  getRankings(): Ranking[] {
    const players = Array.from(this.data.players.values());
    const sorted = players
      .map((p) => ({
        nickname: p.nickname,
        score: p.score,
        correctCount: p.answers.filter((a) => a.correct).length,
        streak: p.streak,
        rank: 0
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.correctCount - a.correctCount;
      });

    let lastScore = -1;
    let lastRank = 0;
    sorted.forEach((entry, idx) => {
      if (entry.score !== lastScore) {
        lastRank = idx + 1;
        lastScore = entry.score;
      }
      entry.rank = lastRank;
      const player = this.getPlayerByNickname(entry.nickname);
      if (player) player.rank = lastRank;
    });

    return sorted;
  }

  setTimer(timer: NodeJS.Timeout): void {
    this.clearTimer();
    this.data.questionTimer = timer;
  }

  clearTimer(): void {
    if (this.data.questionTimer) {
      clearTimeout(this.data.questionTimer);
      this.data.questionTimer = undefined;
    }
  }
}
