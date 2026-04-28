export type QuizDomain =
  | 'all'
  | 'cloud_concepts'
  | 'cloud_tech'
  | 'security_compliance'
  | 'billing_support';

export type SessionState = 'lobby' | 'active' | 'paused' | 'between' | 'ended';

export interface LiveAnswer {
  text: string;
  label: string;
}

export interface QuestionPayload {
  questionNumber: number;
  total: number;
  questionText: string;
  type: 'single' | 'multiple';
  answers: LiveAnswer[];
  timeLimit: number;
  timeRemaining?: number;
  domain: string;
}

export interface PlayerState {
  socketId: string;
  nickname: string;
  score: number;
  rank: number;
  answers: PlayerAnswer[];
  streak: number;
  connected: boolean;
}

export interface PlayerAnswer {
  questionId: number;
  submitted: string[];
  correct: boolean;
  timeMs: number;
  pointsEarned: number;
}

export interface LiveSession {
  sessionCode: string;
  role: 'host' | 'player';
  playerCount: number;
  state: SessionState;
}

export interface PlayerProfile {
  nickname: string;
  score: number;
  rank: number;
  streak: number;
}

export interface AnswerResult {
  correct: boolean;
  pointsEarned: number;
  correctAnswers: string[];
  explanation: string;
  newScore: number;
  rank: number;
}

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  score: number;
  correctCount: number;
  streak?: number;
}

export interface QuestionStats {
  answered: number;
  total: number;
}

export interface QuestionReveal {
  answerLabels: string[];
  explanation: string;
}

export interface CreateSessionConfig {
  domain: QuizDomain;
  questionCount: number;
  timePerQuestion: number;
}
