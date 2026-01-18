import { Router } from 'express';
import { pool } from '../db/pool.js';
import { logInfo, logError } from '../utils/logger.js';


const router = Router();

router.get('/ping', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT NOW()');
    logInfo('DB ping successful', { user: 'system' });
    res.json({ db_time: result.rows[0].now });
  } catch (err) {
    logError('DB ping failed', { error: err.message });
    next(err);
  }
});

export default router;