import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { LiveAnswer, LiveQuestion, QuizDomain, SourceQuestion } from './types';

const ANSWER_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
const QUIZ_DIR = path.resolve(__dirname, '../../quiz');

const DOMAIN_NAME_TO_SLUG: Record<string, string> = {
  'cloud concepts': 'cloud_concepts',
  'security and compliance': 'security_compliance',
  'security & compliance': 'security_compliance',
  'cloud technology and services': 'cloud_tech',
  'cloud technology & services': 'cloud_tech',
  'billing pricing and support': 'billing_support',
  'billing, pricing, and support': 'billing_support',
  'billing, pricing and support': 'billing_support'
};

function resolveDomainSlug(domainText: string, fallback: QuizDomain): string {
  const norm = (domainText || '').trim().toLowerCase();
  if (DOMAIN_NAME_TO_SLUG[norm]) return DOMAIN_NAME_TO_SLUG[norm];
  if (fallback !== 'all') return fallback;
  return norm.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unknown';
}

function fisherYatesShuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function toLiveQuestion(source: SourceQuestion, domainSlug: string): LiveQuestion {
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
    domainSlug,
    questionKey: `${domainSlug}:${source.id}`,
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

  const mapped = source.map((q) => toLiveQuestion(q, resolveDomainSlug(q.domain, domain)));
  const shuffled = fisherYatesShuffle(mapped);
  const sliced = shuffled.slice(0, Math.min(questionCount, shuffled.length));
  return sliced;
}
