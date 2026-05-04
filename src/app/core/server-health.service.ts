import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, of, timeout } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ServerHealthService {
  private readonly http = inject(HttpClient);

  /** null = check in-flight, true = reachable, false = offline */
  readonly isOnline = signal<boolean | null>(null);

  checkHealth(): void {
    this.http
      .get(`${environment.apiUrl}/health`)
      .pipe(
        timeout(5000),
        map(() => true as const),
        catchError(() => of(false as const))
      )
      .subscribe((online) => this.isOnline.set(online));
  }
}
