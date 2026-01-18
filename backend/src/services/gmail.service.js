import { google } from 'googleapis';
import { pool } from '../db/pool.js';
import { logInfo, logError } from '../utils/logger.js';
import { decryptToken } from '../utils/crypto.js';
import { parseMessagePayload } from '../utils/gmailhelper.js';

function mapHeaders(headers = []) {
  return headers.reduce((acc, h) => {
    acc[h.name.toLowerCase()] = h.value;
    return acc;
  }, {});
}

function injectInlineImages(html, attachments = []) {
  if (!html) return html;
  let updated = html;
  attachments
    .filter(att => att.isInline && att.dataUri && att.contentId)
    .forEach(att => {
      const cid = att.contentId;
      const pattern = new RegExp(`cid:${cid}`, 'g');
      updated = updated.replace(pattern, att.dataUri);
    });
  return updated;
}

export async function getUserOAuthClient(userId) {
  const result = await pool.query(
    'SELECT access_token, refresh_token, token_expiry FROM users WHERE id = $1',
    [userId]
  );
  if (result.rows.length === 0) throw new Error('User not found');

  const row = result.rows[0];
  const accessToken = decryptToken(row.access_token);
  const refreshToken = decryptToken(row.refresh_token);

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: row.token_expiry ? new Date(row.token_expiry).getTime() : null
  });

  return oauth2Client;
}

// Create Gmail client for a user
async function getGmailClient(userId) {
  const oauth2Client = await getUserOAuthClient(userId);
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// List recent threads
export async function listThreads(userId, maxResults = 10) {
  try {
    const gmail = await getGmailClient(userId);
    const res = await gmail.users.threads.list({ userId: 'me', maxResults });
    const threads = res.data.threads || [];

    // Fetch minimal metadata per thread so we can surface subject in the UI.
    const enriched = await Promise.all(
      threads.map(async thread => {
        const detail = await gmail.users.threads.get({
          userId: 'me',
          id: thread.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'To', 'Date']
        });

        const firstMessage = detail.data.messages?.[0];
        const headers = mapHeaders(firstMessage?.payload?.headers || []);

        return {
          id: thread.id,
          threadId: thread.id,
          subject: headers.subject || '(no subject)',
          snippet: firstMessage?.snippet || thread.snippet || '',
          from: headers.from || '',
          to: headers.to || ''
        };
      })
    );

    logInfo('Fetched Gmail threads', { userId, count: enriched.length });
    return enriched;
  } catch (err) {
    logError('Failed to fetch Gmail threads', { error: err.message, userId });
    throw err;
  }
}

// Get full thread messages
export async function getThread(userId, threadId) {
  try {
    const gmail = await getGmailClient(userId);
    const res = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full'
    });

    const messages = await Promise.all((res.data.messages || []).map(async msg => {
      const headers = mapHeaders(msg.payload?.headers || []);
      const parsed = parseMessagePayload(msg.payload);

      // Fetch inline attachments to embed images
      await Promise.all(
        (parsed.attachments || [])
          .filter(att => att.isInline && att.attachmentId && !att.dataUri)
          .map(async att => {
            const attachment = await gmail.users.messages.attachments.get({
              userId: 'me',
              messageId: msg.id,
              id: att.attachmentId
            });
            const data = attachment.data?.data;
            if (data) {
              const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
              att.dataUri = `data:${att.mimeType};base64,${base64}`;
            }
          })
      );

      const htmlWithInline = injectInlineImages(parsed.html, parsed.attachments);
      return {
        id: msg.id,
        threadId: res.data.id,
        subject: headers.subject || '',
        from: headers.from || '',
        to: headers.to || '',
        date: headers.date || '',
        snippet: msg.snippet || '',
        body: parsed.text || parsed.html,
        html: htmlWithInline || parsed.html,
        attachments: parsed.attachments
      };
    }));

    const subject = messages[messages.length - 1]?.subject || res.data.snippet || '';
    logInfo('Fetched Gmail thread detail', { userId, threadId });
    return { id: res.data.id, subject, messages };
  } catch (err) {
    logError('Failed to fetch Gmail thread detail', { error: err.message, userId, threadId });
    throw err;
  }
}

export async function getMessageContext(userId, threadId, messageId) {
  const oauthClient = await getUserOAuthClient(userId); // load tokens from DB
  const gmail = google.gmail({ version: "v1", auth: oauthClient });

  const msg = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full"
  });

  const headers = mapHeaders(msg.data.payload.headers || []);
  const parsed = parseMessagePayload(msg.data.payload);

  return {
    subject: headers["subject"],
    from: headers["from"],
    to: headers["to"],
    body: parsed.text || parsed.html, // plain text fallback
    bodyHtml: parsed.html,
    attachments: parsed.attachments
  };
}
