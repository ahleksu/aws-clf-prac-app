import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LiveQuizService } from '../../../core/live-quiz.service';

@Component({
  selector: 'app-session-missing',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  template: `
    <section class="session-missing">
      <i class="pi pi-info-circle"></i>
      <h1>Session no longer exists</h1>
      <p>{{ message }}</p>
      <p-button
        label="Back to Home"
        icon="pi pi-home"
        (onClick)="goHome()"
      />
    </section>
  `,
  styles: [`
    :host { display: block; box-sizing: border-box; }
    :host * { box-sizing: border-box; }
    .session-missing {
      box-sizing: border-box;
      display: grid;
      gap: 0.85rem;
      place-items: center;
      width: min(100%, 32rem);
      margin: 4rem auto;
      padding: 2rem 1.5rem;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: #ffffff;
      box-shadow: 0 18px 60px rgba(15, 23, 42, 0.08);
      text-align: center;
    }
    .session-missing i {
      font-size: 2.4rem;
      color: #2563eb;
    }
    .session-missing h1 {
      margin: 0;
      color: #111827;
      font-size: 1.4rem;
      font-weight: 900;
    }
    .session-missing p {
      margin: 0;
      color: #4b5563;
      font-weight: 600;
    }
  `]
})
export class SessionMissingComponent {
  @Input() message = 'This live session has ended or never existed. Start a new session or join a different one.';
  private readonly router = inject(Router);
  private readonly quiz = inject(LiveQuizService);

  goHome(): void {
    this.quiz.clearPlayerState();
    this.quiz.clearHostState();
    this.router.navigate(['/']);
  }
}
