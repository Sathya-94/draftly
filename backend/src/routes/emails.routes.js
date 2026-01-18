import express from 'express';
import { listThreads, getThread } from '../services/gmail.service.js';
import { requireAuth } from '../middleware/auth.js';


const router = express.Router();

// GET /api/emails?page&limit
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id; // assume auth middleware sets req.user
    const threads = await listThreads(userId, parseInt(req.query.limit) || 10);
    res.json(threads);
  } catch (err) {
    next(err);
  }
});

// GET /api/emails/:threadId
router.get('/:threadId', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const thread = await getThread(userId, req.params.threadId);
    res.json(thread);
  } catch (err) {
    next(err);
  }
});

export default router;
