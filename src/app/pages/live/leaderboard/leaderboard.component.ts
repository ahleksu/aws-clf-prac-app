import { Component, Input } from '@angular/core';
import { LeaderboardEntry } from '../../../core/live-quiz.model';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  template: `
    <main class="max-w-4xl mx-auto px-4 py-10">
      <h1 class="text-2xl font-semibold">Leaderboard</h1>
    </main>
  `
})
export class LeaderboardComponent {
  @Input() finalLeaderboard: LeaderboardEntry[] = [];
  @Input() myNickname = '';
}
