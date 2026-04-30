export type QuizDomain =
  | 'all'
  | 'cloud_concepts'
  | 'cloud_tech'
  | 'security_compliance'
  | 'billing_support';

export type SessionState = 'lobby' | 'active' | 'paused' | 'between' | 'ended';

export type ScoringMode = 'speed' | 'points';

export interface LiveAnswer {
  text: string;
  label: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface LiveQuestion {
  id: number;
  question: string;
  domain: string;
  domainSlug: string;
  questionKey: string;
  type: 'single' | 'multiple';
  answers: LiveAnswer[];
  correctAnswers: string[];
  explanation: string;
  resource?: string;
}

export interface PlayerAnswer {
  questionId: number;
  submitted: string[];
  correct: boolean;
  timeMs: number;
  pointsEarned: number;
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

export interface GameSessionData {
  id: string;
  code: string;
  hostSocketId: string;
  hostToken: string;
  domain: QuizDomain;
  questions: LiveQuestion[];
  currentQuestionIndex: number;
  state: SessionState;
  players: Map<string, PlayerState>;
  questionStartTime: number;
  timePerQuestion: number;
  totalQuestions: number;
  scoringMode: ScoringMode;
  createdAt: Date;
  questionTimer?: NodeJS.Timeout;
}

export interface Ranking {
  nickname: string;
  score: number;
  rank: number;
  correctCount: number;
  streak: number;
}

export interface ClientAnswer {
  text: string;
  label: string;
}

export interface QuestionPayload {
  questionNumber: number;
  total: number;
  questionText: string;
  type: 'single' | 'multiple';
  answers: ClientAnswer[];
  timeLimit: number;
  domain: string;
  questionId?: number;
  questionKey?: string;
}

export interface RevealAnswer {
  label: string;
  text: string;
  isCorrect: boolean;
  explanation: string;
}

export interface QuestionRevealPayload {
  answerLabels: string[];
  explanation: string;
  answers: RevealAnswer[];
  questionId?: number;
  questionKey?: string;
  resource?: string;
}

export interface AnswerResult {
  correct: boolean;
  pointsEarned: number;
  correctAnswers: string[];
  explanation: string;
  newScore: number;
  rank: number;
}

export interface SourceAnswer {
  text: string;
  status: 'correct' | 'skipped';
  explanation: string;
}

export interface SourceQuestion {
  id: number;
  question: string;
  domain: string;
  resource?: string;
  type: 'single' | 'multiple';
  answers: SourceAnswer[];
}
