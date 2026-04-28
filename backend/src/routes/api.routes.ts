import { Router } from 'express';
import { GameManager } from '../game/GameManager';

export function buildApiRouter(manager: GameManager): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', sessions: manager.sessionCount() });
  });

  router.get('/session/:code', (req, res) => {
    const code = String(req.params.code || '').toUpperCase();
    const session = manager.getSession(code);
    if (!session) {
      res.json({ valid: false, playerCount: 0, state: null });
      return;
    }
    res.json({
      valid: true,
      playerCount: session.connectedPlayerCount(),
      state: session.state
    });
  });

  return router;
}
