import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-result',
  standalone: true,
  templateUrl: './result.component.html',
  styleUrl: './result.component.css',
  imports: [CommonModule, ChartModule, ButtonModule],
})
export class ResultComponent {
  totalQuestions = 0;
  correctAnswers = 0;
  score = 0;
  finishedAt: Date = new Date();
  quizType: string = 'all';

  domainBreakdown: { domain: string; correct: number; incorrect: number; skipped: number }[] = [];
  skippedAnswers = 0;


  chartData: any;
  chartOptions: any;

  barChartData: any;
  barChartOptions: any;

  constructor(private router: Router) {
    const state = this.router.getCurrentNavigation()?.extras.state;
    if (state) {
      this.totalQuestions = state['total'] ?? 0;
      this.correctAnswers = state['correct'] ?? 0;
      this.score = Math.round((this.correctAnswers / this.totalQuestions) * 100);
      this.finishedAt = new Date(state['timestamp']);
      this.quizType = state['type'] ?? 'all';

      const domainSummary = state['domainSummary'] ?? {};
      this.domainBreakdown = Object.keys(domainSummary).map(domain => {
        const summary = domainSummary[domain];
        const skipped = summary.skipped ?? 0;
        return {
          domain,
          correct: summary.correct,
          incorrect: summary.total - summary.correct - skipped,
          skipped: skipped
        };
      });

      // Count skipped
      this.skippedAnswers = this.domainBreakdown.reduce((acc, d) => acc + d.skipped, 0);
    }

    this.setupChart();
    this.setupBarChart();
  }

  setupChart() {
    const incorrect = this.totalQuestions - this.correctAnswers - this.skippedAnswers;

    this.chartData = {
      labels: ['Correct', 'Incorrect', 'Skipped'],
      datasets: [
        {
          data: [this.correctAnswers, incorrect, this.skippedAnswers],
          backgroundColor: ['#16a34a', '#ef4444', '#9CA3AF'],
          hoverOffset: 4
        }
      ]
    };

    this.chartOptions = {
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    };
  }


  setupBarChart() {
    this.barChartData = {
      labels: this.domainBreakdown.map(d => d.domain),
      datasets: [
        {
          label: 'Correct',
          backgroundColor: '#16a34a',
          data: this.domainBreakdown.map(d => d.correct)
        },
        {
          label: 'Incorrect',
          backgroundColor: '#ef4444',
          data: this.domainBreakdown.map(d => d.incorrect)
        },
        {
          label: 'Skipped',
          backgroundColor: '#9CA3AF',
          data: this.domainBreakdown.map(d => d.skipped)
        }
      ]
    };

    this.barChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top'
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: '#4B5563'
          },
          grid: {
            color: '#E5E7EB'
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            color: '#4B5563'
          },
          grid: {
            color: '#E5E7EB'
          }
        }
      }
    };

  }
  goToReview() {
    this.router.navigate(['/review'], {
      state: {
        questions: history.state.questions ?? []  // ensure questions are passed along
      }
    });
  }


  retakeQuiz() {
    this.router.navigate(['/quiz'], { queryParams: { type: this.quizType } });
  }

  goHome() {
    this.router.navigate(['/']);
  }
}
