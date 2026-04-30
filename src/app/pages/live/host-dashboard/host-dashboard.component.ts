import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LiveQuizService } from '../../../core/live-quiz.service';
import { QuizDomain, ScoringMode } from '../../../core/live-quiz.model';

const MIN_SESSION_QUESTIONS = 5;
const MAX_SESSION_QUESTIONS = 65;

@Component({
  selector: 'app-host-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputNumberModule,
    SelectModule,
    SelectButtonModule,
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
  private readonly http = inject(HttpClient);

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

  readonly scoringOptions: { label: string; value: ScoringMode }[] = [
    { label: '⚡ Speed Scoring', value: 'speed' },
    { label: '📋 Points Only', value: 'points' }
  ];

  domain: QuizDomain = 'all';
  questionCount: number | null = 20;
  timePerQuestion = 30;
  scoringMode: ScoringMode = 'speed';
  creating = false;
  private readonly domainQuestionCounts: Partial<Record<QuizDomain, number>> = {};

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

    this.loadQuestionCounts();
  }

  createSession(): void {
    const count = Number(this.questionCount);
    const max = this.maxQuestionCount();
    if (!Number.isInteger(count) || count < MIN_SESSION_QUESTIONS || count > max) {
      this.messages.add({
        severity: 'warn',
        summary: 'Question count out of range',
        detail: `Choose ${MIN_SESSION_QUESTIONS} to ${max} questions for ${this.selectedDomainLabel()}.`
      });
      return;
    }
    this.creating = true;
    this.quiz.createSession({
      domain: this.domain,
      questionCount: count,
      timePerQuestion: this.timePerQuestion,
      scoringMode: this.scoringMode
    });
  }

  cancelSession(): void {
    this.creating = false;
    this.quiz.cancelHostSession();
    this.router.navigate(['/']);
  }

  maxQuestionCount(): number {
    const available = this.domainQuestionCounts[this.domain] ?? MAX_SESSION_QUESTIONS;
    return Math.max(MIN_SESSION_QUESTIONS, Math.min(MAX_SESSION_QUESTIONS, available));
  }

  availableQuestionCount(): number | null {
    return this.domainQuestionCounts[this.domain] ?? null;
  }

  questionCountHint(): string {
    const available = this.availableQuestionCount();
    const max = this.maxQuestionCount();
    if (available === null) {
      return `Choose ${MIN_SESSION_QUESTIONS} to ${max} questions.`;
    }
    return `${available} available questions. Live sessions support ${MIN_SESSION_QUESTIONS} to ${max}.`;
  }

  isQuestionCountValid(): boolean {
    const count = Number(this.questionCount);
    return Number.isInteger(count)
      && count >= MIN_SESSION_QUESTIONS
      && count <= this.maxQuestionCount();
  }

  selectedDomainLabel(): string {
    return this.domainOptions.find((option) => option.value === this.domain)?.label ?? 'this domain';
  }

  private loadQuestionCounts(): void {
    for (const option of this.domainOptions) {
      this.http.get<unknown[]>(`/quiz/${option.value}.json`).subscribe({
        next: (questions) => {
          this.domainQuestionCounts[option.value] = Array.isArray(questions) ? questions.length : 0;
        },
        error: () => {
          this.domainQuestionCounts[option.value] = MAX_SESSION_QUESTIONS;
        }
      });
    }
  }
}
