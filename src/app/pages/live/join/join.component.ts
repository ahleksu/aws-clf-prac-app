import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LiveQuizService } from '../../../core/live-quiz.service';

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, ToastModule],
  providers: [MessageService],
  templateUrl: './join.component.html',
  styleUrl: './join.component.css'
})
export class JoinComponent implements OnInit {
  private readonly quiz = inject(LiveQuizService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly messages = inject(MessageService);

  sessionCode = '';
  nickname = '';
  joining = false;

  constructor() {
    effect(() => {
      const joined = this.quiz.joinConfirmed();
      const code = this.quiz.sessionCode();
      const nickname = this.quiz.myProfile().nickname;
      if (!this.joining || !joined || !code || !nickname) return;
      sessionStorage.setItem('livePlayerSession', JSON.stringify({ sessionCode: code, nickname }));
      this.joining = false;
      this.router.navigate(['/play', code]);
    });

    effect(() => {
      const error = this.quiz.lastError();
      if (!error) return;
      this.joining = false;
      this.messages.add({
        severity: 'error',
        summary: 'Unable to join',
        detail: error
      });
      this.quiz.clearError();
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const code = params.get('code');
        if (code) {
          this.sessionCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
        }
      });
  }

  normalizeCode(): void {
    this.sessionCode = this.sessionCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }

  normalizeNickname(): void {
    this.nickname = this.nickname
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 20);
  }

  canJoin(): boolean {
    return this.sessionCode.length === 6 && this.nickname.trim().length > 0;
  }

  joinSession(): void {
    this.normalizeCode();
    this.normalizeNickname();
    if (!this.canJoin()) {
      this.messages.add({
        severity: 'warn',
        summary: 'Missing details',
        detail: 'Enter a 6-character code and a nickname.'
      });
      return;
    }
    this.joining = true;
    this.quiz.joinSession(this.sessionCode, this.nickname);
  }
}
