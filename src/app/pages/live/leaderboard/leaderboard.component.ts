import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, computed, inject, input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LiveQuizService } from '../../../core/live-quiz.service';
import { LeaderboardEntry } from '../../../core/live-quiz.model';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.css'
})
export class LeaderboardComponent implements OnInit {
  private readonly quiz = inject(LiveQuizService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  @Input() finalLeaderboard: LeaderboardEntry[] = [];
  @Input() myNickname = '';

  readonly isHost = input<boolean>(false);
  readonly sessionCode = input<string>('');

  readonly confettiPieces = Array.from({ length: 28 }, (_, idx) => idx);

  routeSessionCode = '';

  readonly hostView = computed(() => this.isHost() || this.quiz.role() === 'host');

  ngOnInit(): void {
    this.routeSessionCode =
      this.route.snapshot.paramMap.get('code')?.toUpperCase() ?? '';
  }

  resolvedSessionCode(): string {
    return this.sessionCode() || this.routeSessionCode || this.quiz.sessionCode();
  }

  totalQuestions(): number {
    return this.quiz.totalQuestions() || this.quiz.currentQuestion()?.total || 0;
  }

  entries(): LeaderboardEntry[] {
    if (this.finalLeaderboard.length) return this.finalLeaderboard;
    const serviceFinal = this.quiz.finalLeaderboard();
    return serviceFinal.length ? serviceFinal : this.quiz.rankings();
  }

  topThree(): LeaderboardEntry[] {
    return this.entries().slice(0, 3);
  }

  currentNickname(): string {
    return this.myNickname || this.quiz.myProfile().nickname;
  }

  isMine(entry: LeaderboardEntry): boolean {
    return !!this.currentNickname() && entry.nickname === this.currentNickname();
  }

  backHome(): void {
    this.router.navigate(['/']);
  }

  downloadCsv(): void {
    const rows = this.entries();
    if (!rows.length) return;
    const total = this.totalQuestions();
    const header = 'Rank,Nickname,Score,Correct,Total Questions,Accuracy %,Streak';
    const csvLines = [header];
    for (const entry of rows) {
      const correct = entry.correctCount ?? 0;
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
      const streak = entry.streak ?? 0;
      csvLines.push(
        [
          entry.rank,
          this.escapeCsv(entry.nickname),
          entry.score,
          correct,
          total,
          accuracy,
          streak
        ].join(',')
      );
    }
    const csv = csvLines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const code = this.resolvedSessionCode() || 'session';
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `quiz-results-${code}-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
