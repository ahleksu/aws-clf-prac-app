import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { SocketService } from './socket.service';
import {
  AnswerResult,
  CreateSessionConfig,
  LeaderboardEntry,
  PlayerProfile,
  PlayerState,
  QuestionPayload,
  QuestionReveal,
  QuestionStats,
  ScoringMode,
  SessionState
} from './live-quiz.model';

interface SessionCreatedPayload {
  sessionCode: string;
  hostToken?: string;
  scoringMode?: ScoringMode;
  totalQuestions?: number;
}

interface SessionJoinedPayload {
  sessionCode: string;
  playerCount: number;
  nickname: string;
  score?: number;
  rank?: number;
  streak?: number;
  state?: SessionState;
}

interface SessionErrorPayload {
  message: string;
}

interface LobbyUpdatePayload {
  players?: PlayerState[];
  playerCount?: number;
}

interface LeaderboardPayload {
  rankings?: LeaderboardEntry[];
  finalLeaderboard?: LeaderboardEntry[];
  answerReveal?: QuestionReveal;
  myRank?: number;
  myFinalRank?: number;
}

interface PlayerStatePayload {
  score: number;
  rank: number;
  streak: number;
  answeredCurrentQuestion: boolean;
  timeRemaining?: number;
}

interface HostStatePayload {
  state: SessionState;
  question: QuestionPayload | null;
  questionStats: QuestionStats;
  timeRemaining: number;
  rankings: LeaderboardEntry[];
  answerReveal: QuestionReveal | null;
}

@Injectable({ providedIn: 'root' })
export class LiveQuizService {
  private readonly socket = inject(SocketService);
  private readonly destroyRef = inject(DestroyRef);

  readonly gameState = signal<SessionState>('lobby');
  readonly currentQuestion = signal<QuestionPayload | null>(null);
  readonly players = signal<PlayerState[]>([]);
  readonly rankings = signal<LeaderboardEntry[]>([]);
  readonly finalLeaderboard = signal<LeaderboardEntry[]>([]);
  readonly myProfile = signal<PlayerProfile>({
    nickname: '',
    score: 0,
    rank: 0,
    streak: 0
  });
  readonly sessionCode = signal<string>('');
  readonly hostToken = signal<string>('');
  readonly playerCount = signal<number>(0);
  readonly questionStats = signal<QuestionStats>({ answered: 0, total: 0 });
  readonly timeRemainingMs = signal<number>(0);
  readonly answerReveal = signal<QuestionReveal | null>(null);
  readonly answerResult = signal<AnswerResult | null>(null);
  readonly joinConfirmed = signal<boolean>(false);
  readonly answeredCurrentQuestion = signal<boolean>(false);
  readonly lastError = signal<string | null>(null);
  readonly paused = signal<boolean>(false);
  readonly hostDisconnected = signal<boolean>(false);
  readonly scoringMode = signal<ScoringMode>('speed');
  readonly totalQuestions = signal<number>(0);
  readonly role = signal<'host' | 'player' | null>(null);

  constructor() {
    this.socket.connect(environment.wsUrl);
    this.registerSocketHandlers();
  }

  createSession(config: CreateSessionConfig): void {
    this.resetHostState();
    this.joinConfirmed.set(false);
    this.role.set('host');
    this.scoringMode.set(config.scoringMode ?? 'speed');
    this.totalQuestions.set(config.questionCount);
    this.socket.emit('host:create', config);
  }

  joinSession(sessionCode: string, nickname: string): void {
    const code = this.normalizeCode(sessionCode);
    const cleanNickname = nickname.trim().slice(0, 20);
    this.lastError.set(null);
    this.joinConfirmed.set(false);
    this.sessionCode.set(code);
    this.role.set('player');
    this.myProfile.set({
      nickname: cleanNickname,
      score: 0,
      rank: 0,
      streak: 0
    });
    this.socket.emit('player:join', { sessionCode: code, nickname: cleanNickname });
  }

  startSession(): void {
    this.socket.emit('host:start', { sessionCode: this.sessionCode() });
  }

  nextQuestion(): void {
    this.socket.emit('host:next', { sessionCode: this.sessionCode() });
  }

  pauseSession(): void {
    this.socket.emit('host:pause', { sessionCode: this.sessionCode() });
  }

  resumeSession(): void {
    this.socket.emit('host:resume', { sessionCode: this.sessionCode() });
  }

  endSession(): void {
    this.socket.emit('host:end', { sessionCode: this.sessionCode() });
  }

  submitAnswer(answers: string[]): void {
    this.socket.emit('player:answer', {
      sessionCode: this.sessionCode(),
      answers
    });
  }

  reconnectHost(sessionCode: string, hostToken = ''): void {
    const code = this.normalizeCode(sessionCode);
    this.sessionCode.set(code);
    this.role.set('host');
    this.socket.emit('host:reconnect', { sessionCode: code, hostToken });
  }

  clearError(): void {
    this.lastError.set(null);
  }

  private registerSocketHandlers(): void {
    this.socket.on<SessionCreatedPayload>('session:created', this.destroyRef).subscribe((payload) => {
      this.sessionCode.set(payload.sessionCode);
      if (payload.hostToken) {
        this.hostToken.set(payload.hostToken);
        sessionStorage.setItem('liveHostSessionCode', payload.sessionCode);
        sessionStorage.setItem('liveHostToken', payload.hostToken);
      }
      if (payload.scoringMode) {
        this.scoringMode.set(payload.scoringMode);
      }
      if (typeof payload.totalQuestions === 'number') {
        this.totalQuestions.set(payload.totalQuestions);
      }
      this.role.set('host');
      this.gameState.set('lobby');
      this.lastError.set(null);
    });

    this.socket.on<SessionJoinedPayload>('session:joined', this.destroyRef).subscribe((payload) => {
      this.sessionCode.set(payload.sessionCode);
      this.playerCount.set(payload.playerCount);
      this.gameState.set(payload.state ?? 'lobby');
      this.joinConfirmed.set(true);
      this.lastError.set(null);
      this.myProfile.update((profile) => ({
        ...profile,
        nickname: payload.nickname,
        score: payload.score ?? profile.score,
        rank: payload.rank ?? profile.rank,
        streak: payload.streak ?? profile.streak
      }));
    });

    this.socket.on<SessionErrorPayload>('session:error', this.destroyRef).subscribe((payload) => {
      this.lastError.set(payload.message);
      this.joinConfirmed.set(false);
    });

    this.socket.on<LobbyUpdatePayload>('lobby:update', this.destroyRef).subscribe((payload) => {
      if (payload.players) {
        this.players.set(payload.players);
        this.playerCount.set(payload.players.filter((player) => player.connected).length);
      }
      if (typeof payload.playerCount === 'number') {
        this.playerCount.set(payload.playerCount);
      }
    });

    this.socket.on<QuestionPayload>('game:question', this.destroyRef).subscribe((question) => {
      const timeRemaining = typeof question.timeRemaining === 'number'
        ? question.timeRemaining
        : question.timeLimit * 1000;
      this.timeRemainingMs.set(timeRemaining);
      this.currentQuestion.set(question);
      this.gameState.set('active');
      this.answerResult.set(null);
      this.answerReveal.set(null);
      this.answeredCurrentQuestion.set(false);
      this.questionStats.set({ answered: 0, total: this.playerCount() });
      this.paused.set(false);
      this.hostDisconnected.set(false);
    });

    this.socket.on<QuestionStats>('question:stats', this.destroyRef).subscribe((stats) => {
      this.questionStats.set(stats);
    });

    this.socket.on<LeaderboardPayload>('leaderboard:snapshot', this.destroyRef).subscribe((payload) => {
      if (payload.answerReveal) {
        this.answerReveal.set(payload.answerReveal);
      }
      this.applyLeaderboard(payload.rankings ?? []);
      this.gameState.set('between');
    });

    this.socket.on<LeaderboardPayload>('leaderboard:show', this.destroyRef).subscribe((payload) => {
      if (payload.answerReveal) {
        this.answerReveal.set(payload.answerReveal);
      }
      this.applyLeaderboard(payload.rankings ?? []);
      this.gameState.set('between');
      if (payload.myRank) {
        this.myProfile.update((profile) => ({ ...profile, rank: payload.myRank ?? profile.rank }));
      }
    });

    this.socket.on<{ timeRemaining?: number }>('game:paused', this.destroyRef).subscribe((payload) => {
      if (typeof payload.timeRemaining === 'number') {
        this.timeRemainingMs.set(payload.timeRemaining);
      }
      this.paused.set(true);
      this.gameState.set('paused');
    });

    this.socket.on<{ timeRemaining?: number }>('game:resumed', this.destroyRef).subscribe((payload) => {
      if (typeof payload.timeRemaining === 'number') {
        this.timeRemainingMs.set(payload.timeRemaining);
      }
      this.paused.set(false);
      this.hostDisconnected.set(false);
      this.gameState.set('active');
    });

    this.socket.on<AnswerResult>('answer:result', this.destroyRef).subscribe((result) => {
      this.answerResult.set(result);
      this.answeredCurrentQuestion.set(true);
      this.myProfile.update((profile) => ({
        ...profile,
        score: result.newScore,
        rank: result.rank,
        streak: result.correct ? profile.streak + 1 : 0
      }));
    });

    this.socket.on<QuestionReveal>('question:reveal', this.destroyRef).subscribe((payload) => {
      this.answerReveal.set(payload);
    });

    this.socket.on<PlayerStatePayload>('player:state', this.destroyRef).subscribe((payload) => {
      this.answeredCurrentQuestion.set(payload.answeredCurrentQuestion);
      if (typeof payload.timeRemaining === 'number') {
        this.timeRemainingMs.set(payload.timeRemaining);
      }
      this.myProfile.update((profile) => ({
        ...profile,
        score: payload.score,
        rank: payload.rank,
        streak: payload.streak
      }));
    });

    this.socket.on<HostStatePayload>('host:state', this.destroyRef).subscribe((payload) => {
      this.timeRemainingMs.set(payload.timeRemaining);
      this.questionStats.set(payload.questionStats);
      this.rankings.set(payload.rankings ?? []);
      this.answerReveal.set(payload.answerReveal ?? null);
      if (payload.question) {
        this.currentQuestion.set(payload.question);
      }
      this.gameState.set(payload.state);
      this.paused.set(payload.state === 'paused');
      this.hostDisconnected.set(false);
    });

    this.socket.on<LeaderboardPayload>('game:ended', this.destroyRef).subscribe((payload) => {
      const leaderboard = payload.finalLeaderboard ?? [];
      this.finalLeaderboard.set(leaderboard);
      this.applyLeaderboard(leaderboard);
      this.gameState.set('ended');
      if (payload.myFinalRank) {
        this.myProfile.update((profile) => ({ ...profile, rank: payload.myFinalRank ?? profile.rank }));
      }
    });

    this.socket.on('host:disconnected', this.destroyRef).subscribe(() => {
      this.hostDisconnected.set(true);
      this.paused.set(true);
    });

    this.socket.on('host:reconnected', this.destroyRef).subscribe(() => {
      this.hostDisconnected.set(false);
    });
  }

  private resetHostState(): void {
    this.gameState.set('lobby');
    this.currentQuestion.set(null);
    this.players.set([]);
    this.rankings.set([]);
    this.finalLeaderboard.set([]);
    this.sessionCode.set('');
    this.hostToken.set('');
    this.playerCount.set(0);
    this.questionStats.set({ answered: 0, total: 0 });
    this.timeRemainingMs.set(0);
    this.answerReveal.set(null);
    this.answerResult.set(null);
    this.joinConfirmed.set(false);
    this.answeredCurrentQuestion.set(false);
    this.lastError.set(null);
    this.paused.set(false);
    this.hostDisconnected.set(false);
    this.scoringMode.set('speed');
    this.totalQuestions.set(0);
  }

  private applyLeaderboard(rankings: LeaderboardEntry[]): void {
    this.rankings.set(rankings);
    const mine = rankings.find((entry) => entry.nickname === this.myProfile().nickname);
    if (mine) {
      this.myProfile.update((profile) => ({
        ...profile,
        score: mine.score,
        rank: mine.rank,
        streak: mine.streak ?? profile.streak
      }));
    }
  }

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase().slice(0, 6);
  }
}
