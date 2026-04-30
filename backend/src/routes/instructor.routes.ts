import { Router, Request, Response, NextFunction } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { QuizDomain, SourceQuestion } from '../game/types';

const QUIZ_DIR = path.resolve(__dirname, '../../quiz');

const DOMAIN_FILES: Record<Exclude<QuizDomain, 'all'>, string> = {
  cloud_concepts: 'cloud_concepts.json',
  cloud_tech: 'cloud_tech.json',
  security_compliance: 'security_compliance.json',
  billing_support: 'billing_support.json'
};

const ANSWER_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

interface InstructorAnswer {
  label: string;
  text: string;
  status: 'correct' | 'skipped';
  explanation: string;
}

interface InstructorQuestion {
  questionKey: string;
  id: number;
  domain: string;
  domainSlug: Exclude<QuizDomain, 'all'>;
  type: 'single' | 'multiple';
  question: string;
  resource?: string;
  correctLabels: string[];
  answers: InstructorAnswer[];
}

let cache: InstructorQuestion[] | null = null;

async function loadDomain(slug: Exclude<QuizDomain, 'all'>): Promise<InstructorQuestion[]> {
  const file = path.join(QUIZ_DIR, DOMAIN_FILES[slug]);
  const raw = await fs.readFile(file, 'utf-8');
  const source: SourceQuestion[] = JSON.parse(raw);
  return source.map((q) => mapQuestion(q, slug));
}

function mapQuestion(
  q: SourceQuestion,
  slug: Exclude<QuizDomain, 'all'>
): InstructorQuestion {
  const answers: InstructorAnswer[] = q.answers.map((a, idx) => ({
    label: ANSWER_LABELS[idx] ?? String(idx + 1),
    text: a.text,
    status: a.status,
    explanation: a.explanation ?? ''
  }));
  return {
    questionKey: `${slug}:${q.id}`,
    id: q.id,
    domain: q.domain,
    domainSlug: slug,
    type: q.type,
    question: q.question,
    resource: q.resource,
    correctLabels: answers.filter((a) => a.status === 'correct').map((a) => a.label),
    answers
  };
}

async function loadAll(): Promise<InstructorQuestion[]> {
  if (cache) return cache;
  const slugs = Object.keys(DOMAIN_FILES) as Array<Exclude<QuizDomain, 'all'>>;
  const lists = await Promise.all(slugs.map(loadDomain));
  cache = lists.flat();
  return cache;
}

function readInstructorKey(req: Request): string {
  const auth = req.header('authorization') || req.header('Authorization') || '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i);
  if (bearer) return bearer[1].trim();
  const header = req.header('x-instructor-key') || req.header('X-Instructor-Key') || '';
  return header.trim();
}

function instructorAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = (process.env.INSTRUCTOR_KEY || '').trim();
  if (!expected) {
    res.status(503).json({ error: 'Instructor endpoint not configured.' });
    return;
  }
  const provided = readInstructorKey(req);
  if (!provided || provided !== expected) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }
  next();
}

export function buildInstructorRouter(): Router {
  const router = Router();

  router.get('/api/instructor/questions', instructorAuth, async (req, res) => {
    try {
      const all = await loadAll();
      const domainParam = String(req.query.domain ?? 'all').toLowerCase();
      const idParam = String(req.query.id ?? '').trim();
      const qParam = String(req.query.q ?? '').trim().toLowerCase();

      let filtered = all;
      if (domainParam && domainParam !== 'all') {
        filtered = filtered.filter((entry) => entry.domainSlug === domainParam);
      }
      if (idParam) {
        const lower = idParam.toLowerCase();
        filtered = filtered.filter((entry) => {
          if (entry.questionKey.toLowerCase() === lower) return true;
          if (String(entry.id) === idParam) return true;
          return false;
        });
      }
      if (qParam) {
        filtered = filtered.filter((entry) =>
          entry.question.toLowerCase().includes(qParam) ||
          entry.answers.some((a) => a.text.toLowerCase().includes(qParam))
        );
      }

      res.json({ count: filtered.length, questions: filtered.slice(0, 200) });
    } catch (err) {
      console.error('[instructor] error', err);
      res.status(500).json({ error: 'Failed to load instructor questions.' });
    }
  });

  return router;
}
