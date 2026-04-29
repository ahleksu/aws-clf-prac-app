import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { LiveAnswer, LiveQuestion, QuizDomain, SourceQuestion } from './types';

const ANSWER_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
const QUIZ_DIR = path.resolve(__dirname, '../../quiz');

function fisherYatesShuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function toLiveQuestion(source: SourceQuestion): LiveQuestion {
  const answers: LiveAnswer[] = source.answers.map((a, idx) => ({
    text: a.text,
    label: ANSWER_LABELS[idx] ?? String(idx + 1),
    isCorrect: a.status === 'correct',
    explanation: a.explanation ?? ''
  }));

  const correctAnswers = answers
    .filter((a) => a.isCorrect)
    .map((a) => a.label);

  const explanation = answers
    .filter((a) => a.isCorrect && a.explanation)
    .map((a) => a.explanation)
    .join(' ')
    .trim();

  return {
    id: source.id,
    question: source.question,
    domain: source.domain,
    type: source.type,
    answers,
    correctAnswers,
    explanation,
    resource: source.resource
  };
}

export async function loadQuestions(
  domain: QuizDomain,
  questionCount: number
): Promise<LiveQuestion[]> {
  const filePath = path.join(QUIZ_DIR, `${domain}.json`);
  const raw = await fs.readFile(filePath, 'utf-8');
  const source: SourceQuestion[] = JSON.parse(raw);

  const mapped = source.map(toLiveQuestion);
  const shuffled = fisherYatesShuffle(mapped);
  const sliced = shuffled.slice(0, Math.min(questionCount, shuffled.length));
  return sliced;
}
