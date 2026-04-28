import { DestroyRef, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable } from 'rxjs';
import { Socket, io } from 'socket.io-client';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private socket: Socket | null = null;
  private readonly connectedSubject = new BehaviorSubject<boolean>(false);
  readonly connected$ = this.connectedSubject.asObservable();

  connect(url: string): void {
    if (!this.isBrowser) {
      return;
    }
    if (this.socket && this.socket.connected) {
      return;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      withCredentials: true
    });

    this.socket.on('connect', () => this.connectedSubject.next(true));
    this.socket.on('disconnect', () => this.connectedSubject.next(false));
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connectedSubject.next(false);
    }
  }

  emit<T = unknown>(event: string, data?: T): void {
    if (!this.socket) {
      return;
    }
    this.socket.emit(event, data);
  }

  on<T>(event: string, destroyRef?: DestroyRef): Observable<T> {
    const observable = new Observable<T>((subscriber) => {
      if (!this.socket) {
        subscriber.complete();
        return;
      }
      const handler = (payload: T) => subscriber.next(payload);
      this.socket.on(event, handler);
      return () => {
        this.socket?.off(event, handler);
      };
    });
    return observable.pipe(takeUntilDestroyed(destroyRef ?? this.destroyRef));
  }

  off(event: string): void {
    this.socket?.off(event);
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  get socketId(): string | undefined {
    return this.socket?.id;
  }
}
