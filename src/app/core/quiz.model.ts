export interface Answer {
    text: string;
    status: 'correct' | 'skipped';
    explanation: string;
}

export interface Question {
    id: number;
    question: string;
    domain: string;
    resource?: string;
    type: 'single' | 'multiple';
    answers: Answer[];
}
