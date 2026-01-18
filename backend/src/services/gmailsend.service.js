import { pool } from '../db/pool.js';
import { google } from "googleapis";
import { getUserOAuthClient } from "./gmail.service.js";

export async function sendDraft(draftId, userId) {
  // 1. Load draft
  const draftRes = await pool.query(
    `SELECT * FROM drafts WHERE id=$1 AND user_id=$2`,
    [draftId, userId]
  );
  const draft = draftRes.rows[0];
  if (!draft) {
    const err = new Error("Draft not found");
    err.code = "DRAFT_NOT_FOUND";
    return { status: "Draft not found" };
  }
  if (draft.status === "rejected") {
    const err = new Error("Draft is rejected and cannot be sent");
    err.code = "DRAFT_REJECTED";
    return { status: "Draft is rejected and cannot be sent" };
  }
  if (draft.status !== "approved" && draft.status !== "sent") {
    const err = new Error("Draft not approved");
    err.code = "DRAFT_NOT_APPROVED";
    return { status: "Draft not approved" };
  }

  // 2. Idempotency check (already successfully sent)
  const existingLog = await pool.query(
    `SELECT * FROM send_logs WHERE draft_id=$1 AND status='success' ORDER BY timestamp DESC LIMIT 1`,
    [draftId]
  );
  if (existingLog.rows.length) {
    return { status: "already_sent", log: existingLog.rows[0] };
  }

  // 3. Determine attempt number
  const attemptRes = await pool.query(
    `SELECT COALESCE(MAX(attempt),0) + 1 AS next_attempt FROM send_logs WHERE draft_id=$1`,
    [draftId]
  );
  const attempt = attemptRes.rows[0].next_attempt || 1;

  // 4. Compose raw email
  const rawMessage = Buffer.from(
    `From: me\nTo: ${draft.context_snapshot.to}\nSubject: ${draft.context_snapshot.subject}\n\n${draft.body}`
  ).toString("base64url");

  // 5. Gmail API send
  const oauthClient = await getUserOAuthClient(userId);
  const gmail = google.gmail({ version: "v1", auth: oauthClient });

  try {
    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: rawMessage }
    });

    // 6. Log success
    const log = await pool.query(
      `INSERT INTO send_logs (draft_id, attempt, status, error_code, error_message, timestamp)
       VALUES ($1, $2, 'success', NULL, $3, NOW())
       RETURNING *`,
      [draftId, attempt, res.data.id]
    );

    // 7. Update draft status
    await pool.query(
      `UPDATE drafts SET status='sent', updated_at=NOW() WHERE id=$1`,
      [draftId]
    );

    return { status: "sent", log: log.rows[0] };
  } catch (err) {
    // 8. Log failure
    const log = await pool.query(
      `INSERT INTO send_logs (draft_id, attempt, status, error_code, error_message, timestamp)
       VALUES ($1, $2, 'failed', 'SEND_ERROR', $3, NOW())
       RETURNING *`,
      [draftId, attempt, err.message]
    );
    const failure = new Error("Send failed, logged for retry");
    failure.code = "SEND_FAILED";
    failure.log = log.rows[0];
    throw failure;
  }
}
