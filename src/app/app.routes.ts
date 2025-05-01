import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { QuizComponent } from './pages/quiz/quiz.component';
import { ResultComponent } from './pages/result/result.component';
import { ReviewAnswersComponent } from './pages/review-answers/review-answers.component';

export const routes: Routes = [
    {path: '', component: HomeComponent},
    {path:'quiz', component: QuizComponent},
    {path: 'result', component: ResultComponent},
    {path: 'review', component: ReviewAnswersComponent},
    {path: '**', redirectTo: ''} // Redirect to home for any unknown routes
];
