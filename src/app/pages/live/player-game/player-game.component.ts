import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LiveQuizService } from '../../../core/live-quiz.service';
import { SocketService } from '../../../core/socket.service';

@Component({
  selector: 'app-player-game',
  standalone: true,
  imports: [CommonModule, ButtonModule, ToastModule],
  providers: [MessageService],
  templateUrl: './player-game.component.html',
  styleUrl: './player-game.component.css'
})
export class PlayerGameComponent implements OnInit, OnDestroy {
  readonly quiz = inject(LiveQuizService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly socket = inject(SocketService);
  private readonly destroyRef = inject(DestroyRef);

  readonly circumference = 276.46;
  sessionCode = '';
  selectedAnswers: string[] = [];
  submitted = false;
  showLeaderboard = false;
  timeLeftSeconds = 0;
  timerFraction = 1;

  private timerId: ReturnType<typeof setInterval> | null = null;
  private timerDeadline = 0;
  private timerDurationMs = 0;
  private sawDisconnect = false;
  private sawInitialConnection = false;

  constructor() {
    effect(() => {
      const question = this.quiz.currentQuestion();
      if (!question) return;
      this.selectedAnswers = [];
      this.submitted = this.quiz.answeredCurrentQuestion();
      this.showLeaderboard = false;
      const remaining = this.quiz.timeRemainingMs();
      this.startTimer(remaining > 0 ? remaining : question.timeLimit * 1000);
    });

    effect(() => {
      if (this.quiz.answeredCurrentQuestion()) {
        this.submitted = true;
      }
    });

    effect(() => {
      if (this.quiz.paused()) {
        this.setTimerStatic(this.quiz.timeRemainingMs());
        this.stopTimer();
        return;
      }
      if (this.quiz.gameState() === 'active' && !this.timerId && this.quiz.currentQuestion()) {
        const remaining = this.quiz.timeRemainingMs();
        this.startTimer(remaining > 0 ? remaining : this.quiz.currentQuestion()!.timeLimit * 1000);
      }
    });

    effect(() => {
      if (this.quiz.gameState() !== 'between') return;
      this.stopTimer();
      this.showLeaderboard = true;
    });

    effect(() => {
      if (this.quiz.gameState() !== 'ended') return;
      this.stopTimer();
      this.router.navigate(['/leaderboard', this.sessionCode || this.quiz.sessionCode()]);
    });

    effect(() => {
      const error = this.quiz.lastError();
      if (!error) return;
      this.messages.add({
        severity: 'error',
        summary: 'Session error',
        detail: error
      });
      this.quiz.clearError();
    });
  }

  ngOnInit(): void {
    const code = this.route.snapshot.paramMap.get('code')?.toUpperCase() ?? '';
    if (!code) {
      this.router.navigate(['/join']);
      return;
    }
    this.sessionCode = code;
    const saved = this.savedSession();
    if (!this.quiz.myProfile().nickname && saved?.sessionCode === code) {
      this.quiz.joinSession(saved.sessionCode, saved.nickname);
    }
    if (!this.quiz.myProfile().nickname && !saved) {
      this.router.navigate(['/join'], { queryParams: { code } });
    }
    this.persistSession();
    this.watchReconnect();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  answerStyle(label: string): Record<string, string> {
    const colors: Record<string, string> = {
      A: '#e21b3c',
      B: '#1368ce',
      C: '#d89e00',
      D: '#26890c'
    };
    return { 'background-color': colors[label] ?? '#374151' };
  }

  isSelected(label: string): boolean {
    return this.selectedAnswers.includes(label);
  }

  chooseAnswer(label: string): void {
    const question = this.quiz.currentQuestion();
    if (!question || this.submitted || this.quiz.paused()) return;

    if (question.type === 'single') {
      this.selectedAnswers = [label];
      this.submitAnswer();
      return;
    }

    if (this.isSelected(label)) {
      this.selectedAnswers = this.selectedAnswers.filter((answer) => answer !== label);
    } else {
      this.selectedAnswers = [...this.selectedAnswers, label];
    }
  }

  submitAnswer(): void {
    if (!this.selectedAnswers.length || this.submitted) return;
    this.submitted = true;
    this.quiz.submitAnswer([...this.selectedAnswers]);
  }

  dismissLeaderboard(): void {
    this.showLeaderboard = false;
  }

  strokeOffset(): number {
    return this.circumference * (1 - this.timerFraction);
  }

  timerColor(): string {
    if (this.timerFraction > 0.5) return '#26890c';
    if (this.timerFraction > 0.25) return '#d89e00';
    return '#e21b3c';
  }

  private startTimer(durationMs: number): void {
    this.stopTimer();
    this.timerDurationMs = Math.max(1, durationMs);
    this.timerDeadline = Date.now() + this.timerDurationMs;
    this.tickTimer();
    this.timerId = setInterval(() => this.tickTimer(), 250);
  }

  private stopTimer(): void {
    if (!this.timerId) return;
    clearInterval(this.timerId);
    this.timerId = null;
  }

  private setTimerStatic(remainingMs: number): void {
    const question = this.quiz.currentQuestion();
    const total = question ? question.timeLimit * 1000 : Math.max(1, remainingMs);
    const remaining = Math.max(0, remainingMs);
    this.timeLeftSeconds = Math.ceil(remaining / 1000);
    this.timerFraction = Math.max(0, Math.min(1, remaining / total));
  }

  private tickTimer(): void {
    const remaining = Math.max(0, this.timerDeadline - Date.now());
    this.timeLeftSeconds = Math.ceil(remaining / 1000);
    this.timerFraction = Math.max(0, Math.min(1, remaining / this.timerDurationMs));
    if (remaining <= 0) {
      this.stopTimer();
    }
  }

  private savedSession(): { sessionCode: string; nickname: string } | null {
    const raw = sessionStorage.getItem('livePlayerSession');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { sessionCode: string; nickname: string };
    } catch {
      return null;
    }
  }

  private persistSession(): void {
    const nickname = this.quiz.myProfile().nickname || this.savedSession()?.nickname;
    if (!this.sessionCode || !nickname) return;
    sessionStorage.setItem(
      'livePlayerSession',
      JSON.stringify({ sessionCode: this.sessionCode, nickname })
    );
  }

  private watchReconnect(): void {
    this.socket.connected$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((connected) => {
        if (!connected && this.sawInitialConnection) {
          this.sawDisconnect = true;
          return;
        }
        if (!connected) return;
        if (!this.sawDisconnect) {
          this.sawInitialConnection = true;
          return;
        }

        const saved = this.savedSession();
        if (saved?.sessionCode === this.sessionCode && saved.nickname) {
          this.quiz.joinSession(saved.sessionCode, saved.nickname);
          this.messages.add({
            severity: 'success',
            summary: 'Reconnected',
            detail: 'Reconnected — resuming session'
          });
        }
        this.sawInitialConnection = true;
        this.sawDisconnect = false;
      });
  }
}
