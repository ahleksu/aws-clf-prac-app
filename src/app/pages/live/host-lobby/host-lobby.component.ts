import { CommonModule } from '@angular/common';
import { Component, OnInit, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LiveQuizService } from '../../../core/live-quiz.service';
import { PlayerState } from '../../../core/live-quiz.model';

@Component({
  selector: 'app-host-lobby',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './host-lobby.component.html',
  styleUrl: './host-lobby.component.css'
})
export class HostLobbyComponent implements OnInit {
  readonly quiz = inject(LiveQuizService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  sessionCode = '';
  joinUrl = '';
  starting = false;
  lobbyError = '';

  constructor() {
    effect(() => {
      const question = this.quiz.currentQuestion();
      if (!this.starting || !question) return;
      this.starting = false;
      this.router.navigate(['/host/session', this.sessionCode]);
    });

    effect(() => {
      const error = this.quiz.lastError();
      if (!error) return;
      this.starting = false;
      this.lobbyError = error;
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
    const origin = globalThis.location?.origin ?? '';
    this.joinUrl = `${origin}/join?code=${code}`;
    sessionStorage.setItem('liveHostSessionCode', code);
    this.quiz.reconnectHost(code, sessionStorage.getItem('liveHostToken') ?? '');
  }

  connectedPlayers(): PlayerState[] {
    return this.quiz.players().filter((player) => player.connected);
  }

  startQuiz(): void {
    if (this.connectedPlayers().length === 0) return;
    this.lobbyError = '';
    this.starting = true;
    this.quiz.startSession();
  }

  cancelSession(): void {
    this.quiz.endSession();
    sessionStorage.removeItem('liveHostSessionCode');
    this.router.navigate(['/host']);
  }
}
