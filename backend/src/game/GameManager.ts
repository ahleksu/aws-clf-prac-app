import crypto from 'crypto';
import { GameSession } from './GameSession';
import { GameSessionData, QuizDomain, ScoringMode } from './types';
import { loadQuestions } from './QuestionLoader';

const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 6;
const SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000;

export class GameManager {
  private readonly sessions = new Map<string, GameSession>();
  private cleanupHandle?: NodeJS.Timeout;

  startCleanup(): void {
    if (this.cleanupHandle) return;
    this.cleanupHandle = setInterval(() => this.cleanupOldSessions(), CLEANUP_INTERVAL_MS);
  }

  stopCleanup(): void {
    if (this.cleanupHandle) {
      clearInterval(this.cleanupHandle);
      this.cleanupHandle = undefined;
    }
  }

  sessionCount(): number {
    return this.sessions.size;
  }

  listSessions(): GameSession[] {
    return Array.from(this.sessions.values());
  }

  getSession(code: string): GameSession | undefined {
    return this.sessions.get(code.toUpperCase());
  }

  getSessionByHost(socketId: string): GameSession | undefined {
    for (const s of this.sessions.values()) {
      if (s.hostSocketId === socketId) return s;
    }
    return undefined;
  }

  generateCode(): string {
    for (let attempt = 0; attempt < 10; attempt++) {
      const bytes = crypto.randomBytes(CODE_LENGTH);
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
      }
      if (!this.sessions.has(code)) return code;
    }
    throw new Error('Failed to generate unique session code after 10 attempts');
  }

  generateHostToken(): string {
    return crypto.randomBytes(24).toString('hex');
  }

  async createSession(
    hostSocketId: string,
    domain: QuizDomain,
    questionCount: number,
    timePerQuestion: number,
    scoringMode: ScoringMode = 'speed'
  ): Promise<GameSession> {
    const questions = await loadQuestions(domain, questionCount);
    if (questions.length === 0) {
      throw new Error(`No questions available for domain: ${domain}`);
    }
    const code = this.generateCode();
    const data: GameSessionData = {
      id: crypto.randomUUID(),
      code,
      hostSocketId,
      hostToken: this.generateHostToken(),
      domain,
      questions,
      currentQuestionIndex: 0,
      state: 'lobby',
      players: new Map(),
      questionStartTime: 0,
      timePerQuestion,
      totalQuestions: questions.length,
      scoringMode,
      createdAt: new Date()
    };
    const session = new GameSession(data);
    this.sessions.set(code, session);
    return session;
  }

  removeSession(code: string): void {
    const session = this.sessions.get(code.toUpperCase());
    if (session) {
      session.clearTimer();
      this.sessions.delete(code.toUpperCase());
    }
  }

  cleanupOldSessions(): void {
    const now = Date.now();
    for (const [code, session] of this.sessions) {
      const age = now - session.data.createdAt.getTime();
      if (age > SESSION_TTL_MS) {
        session.clearTimer();
        this.sessions.delete(code);
        console.log(`[GameManager] purged stale session ${code} (age ${Math.round(age / 60000)}m)`);
      }
    }
  }
}
