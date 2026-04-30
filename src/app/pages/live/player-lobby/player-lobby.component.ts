import { CommonModule } from '@angular/common';
import { Component, OnInit, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LiveQuizService } from '../../../core/live-quiz.service';
import { SessionMissingComponent } from '../session-missing/session-missing.component';

@Component({
  selector: 'app-player-lobby',
  standalone: true,
  imports: [CommonModule, ButtonModule, SessionMissingComponent],
  templateUrl: './player-lobby.component.html',
  styleUrl: './player-lobby.component.css'
})
export class PlayerLobbyComponent implements OnInit {
  readonly quiz = inject(LiveQuizService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  sessionCode = '';
  lobbyError = '';
  sessionMissing = false;
  validating = true;

  constructor() {
    effect(() => {
      if (!this.quiz.currentQuestion() || !this.sessionCode) return;
      this.router.navigate(['/play', this.sessionCode, 'game']);
    });

    effect(() => {
      const error = this.quiz.lastError();
      if (!error) return;
      this.lobbyError = error;
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
    this.quiz.validateSession(code).then(({ valid, state }) => {
      this.validating = false;
      if (!valid || state === 'ended') {
        this.sessionMissing = true;
        return;
      }
      const saved = this.savedSession();
      if (!this.quiz.myProfile().nickname && saved?.sessionCode === code) {
        this.quiz.joinSession(saved.sessionCode, saved.nickname);
        return;
      }
      if (!this.quiz.myProfile().nickname) {
        this.router.navigate(['/join'], { queryParams: { code } });
      }
    });
  }

  backToJoin(): void {
    this.router.navigate(['/join'], { queryParams: { code: this.sessionCode } });
  }

  leaveLobby(): void {
    this.quiz.leaveSession();
    this.router.navigate(['/']);
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
}
