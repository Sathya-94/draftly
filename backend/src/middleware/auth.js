import { verifyAccessToken, verifyRefreshToken, generateAccessToken } from '../utils/jwt.js';
import { pool } from '../db/pool.js';

export async function requireAuth(req, res, next) {
  try {
    // Let CORS preflight pass through without auth
    if (req.method === 'OPTIONS') {
      return next();
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const token = authHeader.split(' ')[1]; // "Bearer <token>"

    try {
      // ✅ Verify access token
      const decoded = verifyAccessToken(token);
      req.user = { id: decoded.id, email: decoded.email };
      return next();
    } catch (err) {
      // ❌ Access token expired or invalid
      // Check if refresh token is provided
      const refreshToken = req.headers['x-refresh-token'];
      if (!refreshToken) {
        return res.status(401).json({ error: 'Access token expired, refresh token missing' });
      }

      try {
        // Verify refresh token
        const decodedRefresh = verifyRefreshToken(refreshToken);

        // Check DB if refresh token matches
        const result = await pool.query(
          'SELECT id, email, refresh_token FROM users WHERE id = $1',
          [decodedRefresh.id]
        );

        if (result.rows.length === 0) {
          return res.status(403).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        if (user.refresh_token !== refreshToken) {
          return res.status(403).json({ error: 'Refresh token mismatch or revoked' });
        }

        // Issue new access token
        const newAccessToken = generateAccessToken(user);

        // Attach user and new token
        req.user = { id: user.id, email: user.email };
        res.setHeader('x-access-token', newAccessToken);

        return next();
      } catch (refreshErr) {
        return res.status(403).json({ error: 'Invalid or expired refresh token' });
      }
    }
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
