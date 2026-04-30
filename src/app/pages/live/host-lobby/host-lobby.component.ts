import { CommonModule } from '@angular/common';
import { Component, OnInit, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import QRCode from 'qrcode';
import { environment } from '../../../../environments/environment';
import { LiveQuizService } from '../../../core/live-quiz.service';
import { PlayerState } from '../../../core/live-quiz.model';
import { SessionMissingComponent } from '../session-missing/session-missing.component';

@Component({
  selector: 'app-host-lobby',
  standalone: true,
  imports: [CommonModule, ButtonModule, ToastModule, SessionMissingComponent],
  providers: [MessageService],
  templateUrl: './host-lobby.component.html',
  styleUrl: './host-lobby.component.css'
})
export class HostLobbyComponent implements OnInit {
  readonly quiz = inject(LiveQuizService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  sessionCode = '';
  joinUrl = '';
  qrDataUrl = '';
  starting = false;
  lobbyError = '';
  sessionMissing = false;
  validating = true;

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
    this.quiz.validateSession(code).then(({ valid, state }) => {
      this.validating = false;
      if (!valid || state === 'ended') {
        this.sessionMissing = true;
        return;
      }
      this.joinUrl = `${environment.frontendBaseUrl}/join?code=${code}`;
      QRCode.toDataURL(this.joinUrl, { width: 220, margin: 2 })
        .then((url) => {
          this.qrDataUrl = url;
        })
        .catch((err) => console.error('[host-lobby] QR generation failed', err));
      sessionStorage.setItem('liveHostSessionCode', code);
      this.quiz.reconnectHost(code, sessionStorage.getItem('liveHostToken') ?? '');
    });
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
    this.quiz.cancelHostSession();
    this.router.navigate(['/']);
  }

  copyJoinUrl(): void {
    if (!this.joinUrl) return;
    const writeFn = navigator.clipboard?.writeText.bind(navigator.clipboard);
    if (!writeFn) {
      this.messages.add({
        severity: 'warn',
        summary: 'Copy unavailable',
        detail: 'Clipboard not supported in this browser.'
      });
      return;
    }
    writeFn(this.joinUrl).then(
      () => {
        this.messages.add({
          severity: 'success',
          summary: 'Copied!',
          detail: 'Join link copied to clipboard.',
          life: 2000
        });
      },
      () => {
        this.messages.add({
          severity: 'error',
          summary: 'Copy failed',
          detail: 'Could not copy link to clipboard.'
        });
      }
    );
  }
}
