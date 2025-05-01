import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Question } from './quiz.model';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class QuizService {
  private questions: Question[] = [];
  private userAnswers: any[] = [];

  constructor(private http: HttpClient) {}

  loadQuestions(type: string): Observable<Question[]> {
    return this.http.get<Question[]>(`/quiz/${type}.json`);
  }

  setQuestions(questions: Question[]) {
    this.questions = questions;
  }

  getQuestions(): Question[] {
    return this.questions;
  }

  setUserAnswers(answers: any[]) {
    this.userAnswers = answers;
  }

  getUserAnswers(): any[] {
    return this.userAnswers;
  }
}
