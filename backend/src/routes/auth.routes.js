import express from 'express';
import { google } from 'googleapis';
import { pool } from '../db/pool.js';
import { logInfo, logError } from '../utils/logger.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
import { verifyRefreshToken } from '../utils/jwt.js';
import { encryptToken } from '../utils/crypto.js';


const router = express.Router();

// Load env vars
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI} = process.env;

// Configure OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// GET /api/auth/google — start OAuth2 flow
router.get('/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send'
    ],
    prompt: 'consent'
  });
  res.redirect(url);
});

// GET /api/auth/google/callback — handle OAuth2 callback
router.get('/google/callback', async (req, res, next) => {
  try {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);

    // Decode id_token payload to extract email + sub
    const payload = JSON.parse(
      Buffer.from(tokens.id_token.split('.')[1], 'base64').toString()
    );
    const email = payload.email;
    const googleId = payload.sub;

    if (!email) {
      throw new Error('Email not returned in id_token. Check OAuth scopes.');
    }

    // Encrypt tokens before saving
    const encryptedAccess = encryptToken(tokens.access_token);
    const encryptedRefresh = encryptToken(tokens.refresh_token);

    console.log('Inserting user:', { email, googleId });
    // Persist in DB
    const result = await pool.query(
      `INSERT INTO users (email, google_id, access_token, refresh_token, token_expiry, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (google_id) DO UPDATE
       SET access_token = EXCLUDED.access_token,
           refresh_token = EXCLUDED.refresh_token,
           token_expiry = EXCLUDED.token_expiry
       RETURNING id`,
      [
        email,
        googleId,
        encryptedAccess,
        encryptedRefresh,
        tokens.expiry_date ? new Date(tokens.expiry_date) : null
      ]
    );
    console.log('Inserted result:', result.rows);


    logInfo('OAuth2 login successful', { userId: result.rows[0].id }, req);

    const user = { id: result.rows[0].id, email };
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Optionally store refreshToken in DB for revocation
    await pool.query(
      `UPDATE users SET draftly_refresh_token = $1 WHERE id = $2`,
      [refreshToken, user.id]
    );

    // Use nonce from middleware
    const nonce = res.locals.nonce;


    // res.send(`
    //   <!DOCTYPE html>
    //   <html>
    //     <body>
    //       <script nonce="${nonce}">
    //         // Send tokens back to the opener window
    //         const targetOrigin = window.opener.location.origin;
    //         console.log("Sending to origin:", targetOrigin);

    //         window.opener.postMessage({
    //           type: 'draftly-auth',
    //           tokens: {
    //             accessToken: '${accessToken}',
    //             refreshToken: '${refreshToken}'
    //           }
    //         }, window.opener.location.origin);

    //         // Close the popup
    //         window.close();
    //       </script>
    //     </body>
    //   </html>
    // `);

   // res.json({ message: 'Login successful', userId: result.rows[0].id, accessToken, refreshToken });

   // Redirect to frontend callback page with tokens
  res.redirect(
    `${process.env.FRONTEND_URL}/popup-callback.html?accessToken=${accessToken}&refreshToken=${refreshToken}`
  );


  } catch (err) {
    logError('OAuth2 callback failed', { error: err.message }, req);
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Missing refresh token' });
    }

    // Decode refresh token to get userId
    const decoded = verifyRefreshToken(refreshToken);

    // Invalidate refresh token in DB
    await pool.query(
      'UPDATE users SET draftly_refresh_token = NULL WHERE id = $1',
      [decoded.id]
    );

    res.json({ message: 'Logout successful' });
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired refresh token' });
  }
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Missing refresh token' });
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);

    // Check DB if refreshToken matches the one stored for this user
    const result = await pool.query(
      'SELECT id, email, refresh_token FROM users WHERE id = $1',
      [decoded.id]
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
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired refresh token' });
  }
});



export default router;