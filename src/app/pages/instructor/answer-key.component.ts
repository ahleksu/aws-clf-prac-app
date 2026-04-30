import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { environment } from '../../../environments/environment';

interface InstructorAnswer {
  label: string;
  text: string;
  status: 'correct' | 'skipped';
  explanation: string;
}

interface InstructorQuestion {
  questionKey: string;
  id: number;
  domain: string;
  domainSlug: string;
  type: 'single' | 'multiple';
  question: string;
  resource?: string;
  correctLabels: string[];
  answers: InstructorAnswer[];
}

const STORAGE_KEY = 'instructorKey';

@Component({
  selector: 'app-instructor-answer-key',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, SelectModule],
  templateUrl: './answer-key.component.html',
  styleUrl: './answer-key.component.css'
})
export class InstructorAnswerKeyComponent implements OnInit {
  readonly domains = [
    { label: 'All domains', value: 'all' },
    { label: 'Cloud Concepts', value: 'cloud_concepts' },
    { label: 'Cloud Technology & Services', value: 'cloud_tech' },
    { label: 'Security & Compliance', value: 'security_compliance' },
    { label: 'Billing, Pricing & Support', value: 'billing_support' }
  ];

  readonly results = signal<InstructorQuestion[]>([]);
  readonly resultCount = signal<number>(0);
  readonly loading = signal<boolean>(false);
  readonly errorMessage = signal<string>('');
  readonly authPrompt = signal<boolean>(true);
  readonly expanded = signal<Record<string, boolean>>({});

  instructorKey = '';
  draftKey = '';
  domainFilter = 'all';
  idFilter = '';
  textFilter = '';

  ngOnInit(): void {
    if (typeof sessionStorage === 'undefined') return;
    const saved = sessionStorage.getItem(STORAGE_KEY) ?? '';
    if (saved) {
      this.instructorKey = saved;
      this.authPrompt.set(false);
      void this.search();
    }
  }

  saveKey(): void {
    const trimmed = this.draftKey.trim();
    if (!trimmed) {
      this.errorMessage.set('Enter the instructor key.');
      return;
    }
    this.instructorKey = trimmed;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, trimmed);
    }
    this.authPrompt.set(false);
    this.errorMessage.set('');
    void this.search();
  }

  forgetKey(): void {
    this.instructorKey = '';
    this.draftKey = '';
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    this.authPrompt.set(true);
    this.results.set([]);
    this.resultCount.set(0);
  }

  async search(): Promise<void> {
    if (!this.instructorKey) {
      this.authPrompt.set(true);
      return;
    }
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const params = new URLSearchParams();
      params.set('domain', this.domainFilter || 'all');
      if (this.idFilter.trim()) params.set('id', this.idFilter.trim());
      if (this.textFilter.trim()) params.set('q', this.textFilter.trim());
      const response = await fetch(
        `${environment.apiUrl}/api/instructor/questions?${params.toString()}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.instructorKey}` }
        }
      );
      if (response.status === 401 || response.status === 403) {
        this.errorMessage.set('Unauthorized. Re-enter the instructor key.');
        this.authPrompt.set(true);
        this.results.set([]);
        this.resultCount.set(0);
        return;
      }
      if (!response.ok) {
        this.errorMessage.set(`Request failed (${response.status}).`);
        this.results.set([]);
        this.resultCount.set(0);
        return;
      }
      const data = await response.json() as { count: number; questions: InstructorQuestion[] };
      this.results.set(data.questions ?? []);
      this.resultCount.set(data.count ?? 0);
    } catch (err) {
      console.error('[instructor] search failed', err);
      this.errorMessage.set('Could not reach instructor endpoint.');
    } finally {
      this.loading.set(false);
    }
  }

  toggle(questionKey: string): void {
    this.expanded.update((map) => ({ ...map, [questionKey]: !map[questionKey] }));
  }

  isExpanded(questionKey: string): boolean {
    return !!this.expanded()[questionKey];
  }

  answerClass(answer: InstructorAnswer): string {
    return answer.status === 'correct' ? 'answer-correct' : 'answer-other';
  }
}
