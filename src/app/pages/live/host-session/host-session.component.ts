import { CommonModule } from '@angular/common';
import { Component, OnInit, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ProgressBarModule } from 'primeng/progressbar';
import { ConfirmationService } from 'primeng/api';
import { LiveQuizService } from '../../../core/live-quiz.service';
import { RevealAnswer } from '../../../core/live-quiz.model';

@Component({
  selector: 'app-host-session',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    ConfirmDialogModule,
    ProgressBarModule
  ],
  providers: [ConfirmationService],
  templateUrl: './host-session.component.html',
  styleUrl: './host-session.component.css'
})
export class HostSessionComponent implements OnInit {
  readonly quiz = inject(LiveQuizService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);

  sessionCode = '';
  sessionError = '';

  constructor() {
    effect(() => {
      if (this.quiz.gameState() === 'ended') {
        this.router.navigate(['/leaderboard', this.sessionCode || this.quiz.sessionCode()]);
      }
    });

    effect(() => {
      const error = this.quiz.lastError();
      if (!error) return;
      this.sessionError = error;
      this.quiz.clearError();
    });
  }

  ngOnInit(): void {
    const code = this.route.snapshot.paramMap.get('code')?.toUpperCase() ?? '';
    if (!code) {
      this.router.navigate(['/host']);
      return;
    }
    this.sessionCode = code;
    sessionStorage.setItem('liveHostSessionCode', code);
    this.quiz.reconnectHost(code, sessionStorage.getItem('liveHostToken') ?? '');
  }

  progressValue(): number {
    const stats = this.quiz.questionStats();
    if (!stats.total) return 0;
    return Math.round((stats.answered / stats.total) * 100);
  }

  answerClass(label: string): string {
    const colorClass = {
      A: 'answer-a',
      B: 'answer-b',
      C: 'answer-c',
      D: 'answer-d'
    }[label] ?? 'answer-default';

    return `${colorClass} ${this.isCorrectAnswer(label) ? 'is-correct' : ''}`;
  }

  isCorrectAnswer(label: string): boolean {
    return this.quiz.answerReveal()?.answerLabels.includes(label) ?? false;
  }

  revealAnswers(): RevealAnswer[] {
    return this.quiz.answerReveal()?.answers ?? [];
  }

  hasReveal(): boolean {
    return this.revealAnswers().length > 0;
  }

  revealClass(answer: RevealAnswer): string {
    return answer.isCorrect ? 'reveal-correct' : 'reveal-unchosen';
  }

  revealStatusLabel(answer: RevealAnswer): string {
    return answer.isCorrect ? 'Correct answer' : 'Other option';
  }

  scoringModeLabel(): string {
    return this.quiz.scoringMode() === 'points' ? 'Points Only' : 'Speed Scoring';
  }

  scoringModeIcon(): string {
    return this.quiz.scoringMode() === 'points' ? 'pi-list-check' : 'pi-bolt';
  }

  togglePause(): void {
    if (this.quiz.paused()) {
      this.quiz.resumeSession();
      return;
    }
    this.quiz.pauseSession();
  }

  nextQuestion(): void {
    this.sessionError = '';
    this.quiz.nextQuestion();
  }

  confirmEnd(): void {
    this.confirmation.confirm({
      header: 'End quiz?',
      message: 'This will close the live session and show the final leaderboard.',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.quiz.endSession()
    });
  }
}
