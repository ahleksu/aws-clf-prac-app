import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';

import { Question } from '../../core/quiz.model';
import { QuizService } from '../../core/quiz.service';

import { ProgressBarModule } from 'primeng/progressbar';
import { ButtonModule } from 'primeng/button';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'app-quiz',
  standalone: true,
  templateUrl: './quiz.component.html',
  styleUrl: './quiz.component.css',
  imports: [
    CommonModule,
    FormsModule,
    ProgressBarModule,
    ButtonModule,
    RadioButtonModule,
    CheckboxModule,
    DialogModule
  ],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('600ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class QuizComponent {
  questions: Question[] = [];
  currentQuestionIndex = 0;
  selectedOption: string | null = null;
  selectedOptions: string[] = [];
  showExplanation = false;
  isCorrect = false;
  showConfirmDialog = false;

  answerState: Record<number, {
    selectedOption?: string;
    selectedOptions?: string[];
    showExplanation: boolean;
    isCorrect: boolean;
  }> = {};

  private quizType: string = 'all';

  constructor(
    private quizService: QuizService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.quizType = this.route.snapshot.queryParamMap.get('type') ?? 'all';

    this.quizService.loadQuestions(this.quizType).subscribe((data) => {
      let loadedQuestions = data;

      if (this.quizType === 'all') {
        loadedQuestions = this.shuffleArray([...data]).slice(0, 65); // Random 65 questions
      }

      this.questions = loadedQuestions;
      this.restoreState();
    });
  }


  get currentQuestion(): Question {
    return this.questions[this.currentQuestionIndex];
  }

  get progressValue(): number {
    return this.questions.length > 0
      ? ((this.currentQuestionIndex + 1) / this.questions.length) * 100
      : 0;
  }

  isSelected(option: string): boolean {
    return this.currentQuestion.type === 'multiple'
      ? this.selectedOptions.includes(option)
      : this.selectedOption === option;
  }

  toggleAnswer(option: string): void {
    if (this.currentQuestion.type === 'single') {
      this.selectedOption = option;
    } else {
      const index = this.selectedOptions.indexOf(option);
      if (index === -1) {
        this.selectedOptions.push(option);
      } else {
        this.selectedOptions.splice(index, 1);
      }
    }
  }

  checkAnswer(): void {
    let isCorrect = false;

    if (this.currentQuestion.type === 'multiple') {
      const correctAnswers = this.currentQuestion.answers
        .filter(a => a.status === 'correct')
        .map(a => a.text)
        .sort();
      const selected = [...this.selectedOptions].sort();
      isCorrect = JSON.stringify(selected) === JSON.stringify(correctAnswers);
    } else {
      const correctAnswer = this.currentQuestion.answers.find(a => a.status === 'correct')?.text;
      isCorrect = this.selectedOption === correctAnswer;
    }

    this.answerState[this.currentQuestion.id] = {
      selectedOption: this.selectedOption ?? undefined,
      selectedOptions: [...this.selectedOptions],
      showExplanation: true,
      isCorrect
    };

    this.showExplanation = true;
    this.isCorrect = isCorrect;
  }

  goNext(): void {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
      this.restoreState();
    }
  }

  goBack(): void {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      this.restoreState();
    }
  }

  restoreState(): void {
    const cached = this.answerState[this.currentQuestion.id];
    if (cached) {
      this.selectedOption = cached.selectedOption ?? null;
      this.selectedOptions = cached.selectedOptions ?? [];
      this.showExplanation = cached.showExplanation;
      this.isCorrect = cached.isCorrect;
    } else {
      this.selectedOption = null;
      this.selectedOptions = [];
      this.showExplanation = false;
      this.isCorrect = false;
    }
  }

  finishTest(): void {
    const total = this.questions.length;
    const answeredCount = Object.keys(this.answerState).length;

    if (answeredCount < total) {
      this.showConfirmDialog = true;
      return;
    }

    this.finalizeQuiz();
  }

  finalizeQuiz(): void {
    const total = this.questions.length;
    const answered = Object.values(this.answerState);
    const correct = answered.filter(a => a.isCorrect).length;
    const timestamp = new Date();
  
    const domainSummary = this.questions.reduce((acc, q) => {
      const domain = q.domain || 'Unknown';
      const userAnswer = this.answerState[q.id];
      const isCorrect = userAnswer?.isCorrect ?? false;
      const isSkipped = !userAnswer;
  
      if (!acc[domain]) acc[domain] = { correct: 0, total: 0, skipped: 0 };
  
      acc[domain].total += 1;
  
      if (isCorrect) {
        acc[domain].correct += 1;
      } else if (isSkipped) {
        acc[domain].skipped += 1;
      }
  
      return acc;
    }, {} as Record<string, { correct: number; total: number; skipped: number }>);
  
    const questionsWithAnswers = this.questions.map(q => ({
      ...q,
      userAnswer: q.type === 'multiple'
        ? this.answerState[q.id]?.selectedOptions ?? []
        : (this.answerState[q.id]?.selectedOption ? [this.answerState[q.id].selectedOption!] : []),
      isSkipped: !this.answerState[q.id]
    }));
  
    this.router.navigate(['/result'], {
      state: {
        total,
        correct,
        timestamp,
        domainSummary,
        type: this.quizType,
        questions: questionsWithAnswers
      }
    });
  }
  


  confirmFinish(): void {
    this.showConfirmDialog = false;
    this.finalizeQuiz();
  }

  shuffleArray<T>(array: T[]): T[] {
    return array
      .map(value => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value);
  }
}
