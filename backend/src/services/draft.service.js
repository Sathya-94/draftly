import { pool } from '../db/pool.js';

export async function createDraft({
  userId,
  threadId,
  messageId,
  tone,
  prompt,
  contextSnapshot,
  body,
  idempotencyKey
}) {
  // Sanitize JSON to avoid invalid values (undefined/functions/BigInt)
  const safeSnapshot = JSON.parse(
    JSON.stringify(contextSnapshot ?? {}, (_key, value) => {
      if (typeof value === 'function') return undefined;
      if (typeof value === 'bigint') return Number(value);
      return value;
    })
  );

  // Try updating existing draft for this user/thread/message
  const updated = await pool.query(
    `UPDATE drafts
     SET tone = $4,
         prompt = $5,
         context_snapshot = $6,
         body = $7,
         updated_at = NOW()
     WHERE user_id = $1 AND thread_id = $2 AND message_id = $3
     RETURNING *`,
    [userId, threadId, messageId, tone, prompt, safeSnapshot, body]
  );

  if (updated.rows.length > 0) {
    return updated.rows[0];
  }

  // Otherwise insert new draft
  const inserted = await pool.query(
    `INSERT INTO drafts (user_id, thread_id, message_id, tone, prompt, context_snapshot, body, idempotency_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [userId, threadId, messageId, tone, prompt, safeSnapshot, body, idempotencyKey]
  );

  return inserted.rows[0];
}

// Update draft body
export async function updateDraftBody(id, body) {
  const result = await pool.query(
    `UPDATE drafts 
     SET body = $2, updated_at = NOW() 
     WHERE id = $1 
     RETURNING *`,
    [id, body]
  );
  return result.rows[0];
}

export async function findDraftByMessage(userId, threadId, messageId) {
  const result = await pool.query(
    `SELECT * FROM drafts
     WHERE user_id = $1 AND thread_id = $2 AND message_id = $3
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId, threadId, messageId]
  );
  return result.rows[0];
}

export async function getDraftById(id) {
  const result = await pool.query(`SELECT * FROM drafts WHERE id=$1`, [id]);
  return result.rows[0];
}

export async function listDraftsByUser(userId) {
  const result = await pool.query(`SELECT * FROM drafts WHERE user_id=$1 ORDER BY created_at DESC`, [userId]);
  return result.rows;
}

export async function updateDraftStatus(id, status) {
  const result = await pool.query(
    `UPDATE drafts SET status=$2, updated_at=NOW() WHERE id=$1 RETURNING *`,
    [id, status]
  );
  return result.rows[0];
}
