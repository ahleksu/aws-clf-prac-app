import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ChipModule } from 'primeng/chip';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';

interface ReviewQuestion {
  id: number;
  question: string;
  domain: string;
  type: 'single' | 'multiple';
  answers: { text: string; status: 'correct' | 'skipped'; explanation: string }[];
  userAnswer: string[];
  resource?: string;
  isCorrect?: boolean;
  isSkipped?: boolean;
}



@Component({
  selector: 'app-review-answers',
  standalone: true,
  imports: [CommonModule, FormsModule, ChipModule, SelectModule, ButtonModule],
  templateUrl: './review-answers.component.html',
  styleUrl: './review-answers.component.css'
})
export class ReviewAnswersComponent {
  allQuestions: ReviewQuestion[] = [];
  filteredQuestions: ReviewQuestion[] = [];
  selectedDomain: string = 'All domains';
  showAll: boolean = true;

  domainOptions = [
    { name: 'All domains', value: 'All domains' },
    { name: 'Cloud Concepts', value: 'Cloud Concepts' },
    { name: 'Billing, Pricing, and Support', value: 'Billing, Pricing, and Support' },
    { name: 'Security and Compliance', value: 'Security and Compliance' },
    { name: 'Cloud Technology and Services', value: 'Cloud Technology and Services' }
  ];

  totalQuestions = 0;
  correctAnswers = 0;
  incorrectAnswers = 0;
  skippedAnswers = 0;

  constructor(private router: Router) {
    const state = this.router.getCurrentNavigation()?.extras.state;
    if (state && state['questions']?.length) {
      this.allQuestions = state['questions'].map((q: ReviewQuestion) => {
        const correctAnswers = q.answers.filter(a => a.status === 'correct').map(a => a.text);
        const hasAnswer = q.userAnswer?.length > 0;
        const isCorrect =
          hasAnswer &&
          correctAnswers.length === q.userAnswer.length &&
          correctAnswers.every(ans => q.userAnswer.includes(ans));

        return {
          ...q,
          isCorrect,
          isSkipped: !hasAnswer
        };
      });

      this.totalQuestions = this.allQuestions.length;
      this.correctAnswers = this.allQuestions.filter(q => q.isCorrect).length;
      this.incorrectAnswers = this.allQuestions.filter(q => !q.isCorrect && !q.isSkipped).length;
      this.skippedAnswers = this.allQuestions.filter(q => q.isSkipped).length;
      this.filteredQuestions = [...this.allQuestions];
    } else {
      this.router.navigate(['/']);
    }
  }

  filterQuestions() {
    if (this.selectedDomain === 'All domains') {
      this.filteredQuestions = [...this.allQuestions];
    } else {
      this.filteredQuestions = this.allQuestions.filter(q => q.domain === this.selectedDomain);
    }
  }

  isUserIncorrect(q: ReviewQuestion, answer: { status: string; text: string }): boolean {
    return q.userAnswer.includes(answer.text) && answer.status !== 'correct';
  }

  toggleCollapseAll(): void {
    this.showAll = !this.showAll;
  }

  goBack() {
    this.router.navigate(['/result'], {
      state: {
        total: this.totalQuestions,
        correct: this.correctAnswers,
        skipped: this.skippedAnswers,
        domainSummary: this.generateDomainSummary(),
        timestamp: new Date(), 
        type: 'all',
        questions: this.allQuestions
      }
    });
  }


  private generateDomainSummary(): Record<string, { correct: number; total: number; skipped: number }> {
    const summary: Record<string, { correct: number; total: number; skipped: number }> = {};
    this.allQuestions.forEach((q) => {
      const domain = q.domain;
      if (!summary[domain]) {
        summary[domain] = { correct: 0, total: 0, skipped: 0 };
      }
      summary[domain].total += 1;
      if (q.isCorrect) {
        summary[domain].correct += 1;
      }
      if (q.isSkipped) {
        summary[domain].skipped += 1;
      }
    });
    return summary;
  }




  retakeTest() {
    this.router.navigate(['/quiz'], { queryParams: { type: 'all' } });
  }

  goHome() {
    this.router.navigate(['/']);
  }
}
