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
    {
        path: 'host',
        loadComponent: () => import('./pages/live/host-dashboard/host-dashboard.component')
            .then((m) => m.HostDashboardComponent)
    },
    {
        path: 'host/lobby/:code',
        loadComponent: () => import('./pages/live/host-lobby/host-lobby.component')
            .then((m) => m.HostLobbyComponent)
    },
    {
        path: 'host/session/:code',
        loadComponent: () => import('./pages/live/host-session/host-session.component')
            .then((m) => m.HostSessionComponent)
    },
    {
        path: 'join',
        loadComponent: () => import('./pages/live/join/join.component')
            .then((m) => m.JoinComponent)
    },
    {
        path: 'play/:code',
        loadComponent: () => import('./pages/live/player-lobby/player-lobby.component')
            .then((m) => m.PlayerLobbyComponent)
    },
    {
        path: 'play/:code/game',
        loadComponent: () => import('./pages/live/player-game/player-game.component')
            .then((m) => m.PlayerGameComponent)
    },
    {
        path: 'leaderboard/:code',
        loadComponent: () => import('./pages/live/leaderboard/leaderboard.component')
            .then((m) => m.LeaderboardComponent)
    },
    {path: '**', redirectTo: ''} // Redirect to home for any unknown routes
];
