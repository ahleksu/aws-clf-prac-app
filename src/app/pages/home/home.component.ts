import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CommonModule } from '@angular/common';
import { trigger, style, animate, transition } from '@angular/animations';
import { ServerHealthService } from '../../core/server-health.service';


@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('600ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
})
export class HomeComponent implements OnInit {
  private readonly router = inject(Router);
  readonly serverHealth = inject(ServerHealthService);

  ngOnInit(): void {
    this.serverHealth.checkHealth();
  }

  startQuiz(type: string) {
    this.router.navigate(['/quiz'], { queryParams: { type } });
  }

  hostSession() {
    this.router.navigate(['/host']);
  }

  joinSession() {
    this.router.navigate(['/join']);
  }
}
