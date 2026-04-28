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
  QuestionStats,
  SessionState
} from './live-quiz.model';

interface SessionCreatedPayload {
  sessionCode: string;
}

interface SessionJoinedPayload {
  sessionCode: string;
  playerCount: number;
  nickname: string;
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
  myRank?: number;
  myFinalRank?: number;
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
  readonly playerCount = signal<number>(0);
  readonly questionStats = signal<QuestionStats>({ answered: 0, total: 0 });
  readonly answerResult = signal<AnswerResult | null>(null);
  readonly lastError = signal<string | null>(null);
  readonly paused = signal<boolean>(false);
  readonly hostDisconnected = signal<boolean>(false);

  constructor() {
    this.socket.connect(environment.wsUrl);
    this.registerSocketHandlers();
  }

  createSession(config: CreateSessionConfig): void {
    this.resetHostState();
    this.socket.emit('host:create', config);
  }

  joinSession(sessionCode: string, nickname: string): void {
    const code = this.normalizeCode(sessionCode);
    const cleanNickname = nickname.trim().slice(0, 20);
    this.lastError.set(null);
    this.sessionCode.set(code);
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

  reconnectHost(sessionCode: string): void {
    const code = this.normalizeCode(sessionCode);
    this.sessionCode.set(code);
    this.socket.emit('host:reconnect', { sessionCode: code });
  }

  clearError(): void {
    this.lastError.set(null);
  }

  private registerSocketHandlers(): void {
    this.socket.on<SessionCreatedPayload>('session:created', this.destroyRef).subscribe((payload) => {
      this.sessionCode.set(payload.sessionCode);
      this.gameState.set('lobby');
      this.lastError.set(null);
    });

    this.socket.on<SessionJoinedPayload>('session:joined', this.destroyRef).subscribe((payload) => {
      this.sessionCode.set(payload.sessionCode);
      this.playerCount.set(payload.playerCount);
      this.gameState.set('lobby');
      this.lastError.set(null);
      this.myProfile.update((profile) => ({
        ...profile,
        nickname: payload.nickname
      }));
    });

    this.socket.on<SessionErrorPayload>('session:error', this.destroyRef).subscribe((payload) => {
      this.lastError.set(payload.message);
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
      this.currentQuestion.set(question);
      this.gameState.set('active');
      this.answerResult.set(null);
      this.questionStats.set({ answered: 0, total: this.playerCount() });
      this.paused.set(false);
      this.hostDisconnected.set(false);
    });

    this.socket.on<QuestionStats>('question:stats', this.destroyRef).subscribe((stats) => {
      this.questionStats.set(stats);
    });

    this.socket.on<LeaderboardPayload>('leaderboard:snapshot', this.destroyRef).subscribe((payload) => {
      this.applyLeaderboard(payload.rankings ?? []);
      this.gameState.set('between');
    });

    this.socket.on<LeaderboardPayload>('leaderboard:show', this.destroyRef).subscribe((payload) => {
      this.applyLeaderboard(payload.rankings ?? []);
      this.gameState.set('between');
      if (payload.myRank) {
        this.myProfile.update((profile) => ({ ...profile, rank: payload.myRank ?? profile.rank }));
      }
    });

    this.socket.on<{ timeRemaining?: number }>('game:paused', this.destroyRef).subscribe(() => {
      this.paused.set(true);
      this.gameState.set('paused');
    });

    this.socket.on<{ timeRemaining?: number }>('game:resumed', this.destroyRef).subscribe(() => {
      this.paused.set(false);
      this.gameState.set('active');
    });

    this.socket.on<AnswerResult>('answer:result', this.destroyRef).subscribe((result) => {
      this.answerResult.set(result);
      this.myProfile.update((profile) => ({
        ...profile,
        score: result.newScore,
        rank: result.rank,
        streak: result.correct ? profile.streak + 1 : 0
      }));
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
  }

  private resetHostState(): void {
    this.gameState.set('lobby');
    this.currentQuestion.set(null);
    this.players.set([]);
    this.rankings.set([]);
    this.finalLeaderboard.set([]);
    this.sessionCode.set('');
    this.playerCount.set(0);
    this.questionStats.set({ answered: 0, total: 0 });
    this.answerResult.set(null);
    this.lastError.set(null);
    this.paused.set(false);
    this.hostDisconnected.set(false);
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
