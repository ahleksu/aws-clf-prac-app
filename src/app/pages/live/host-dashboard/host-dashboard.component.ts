import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LiveQuizService } from '../../../core/live-quiz.service';
import { QuizDomain } from '../../../core/live-quiz.model';

@Component({
  selector: 'app-host-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputNumberModule,
    SelectModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './host-dashboard.component.html',
  styleUrl: './host-dashboard.component.css'
})
export class HostDashboardComponent {
  private readonly quiz = inject(LiveQuizService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  readonly domainOptions: { label: string; value: QuizDomain }[] = [
    { label: 'All Domains', value: 'all' },
    { label: 'Domain 1: Cloud Concepts', value: 'cloud_concepts' },
    { label: 'Domain 2: Security & Compliance', value: 'security_compliance' },
    { label: 'Domain 3: Cloud Technology and Services', value: 'cloud_tech' },
    { label: 'Domain 4: Billing, Pricing, and Support', value: 'billing_support' }
  ];

  readonly timeOptions = [
    { label: '15 seconds', value: 15 },
    { label: '20 seconds', value: 20 },
    { label: '30 seconds', value: 30 },
    { label: '45 seconds', value: 45 },
    { label: '60 seconds', value: 60 }
  ];

  domain: QuizDomain = 'all';
  questionCount = 20;
  timePerQuestion = 30;
  creating = false;

  constructor() {
    effect(() => {
      const code = this.quiz.sessionCode();
      if (!this.creating || !code) return;
      sessionStorage.setItem('liveHostSessionCode', code);
      this.creating = false;
      this.router.navigate(['/host/lobby', code]);
    });

    effect(() => {
      const error = this.quiz.lastError();
      if (!error) return;
      this.creating = false;
      this.messages.add({
        severity: 'error',
        summary: 'Session error',
        detail: error
      });
      this.quiz.clearError();
    });
  }

  createSession(): void {
    this.creating = true;
    this.quiz.createSession({
      domain: this.domain,
      questionCount: this.questionCount,
      timePerQuestion: this.timePerQuestion
    });
  }
}
