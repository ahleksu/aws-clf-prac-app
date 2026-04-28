import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';
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
export class LeaderboardComponent {
  private readonly quiz = inject(LiveQuizService);
  private readonly router = inject(Router);

  @Input() finalLeaderboard: LeaderboardEntry[] = [];
  @Input() myNickname = '';

  readonly confettiPieces = Array.from({ length: 28 }, (_, idx) => idx);

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
}
