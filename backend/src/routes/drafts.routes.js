import express from "express";
import crypto from "crypto";
import * as draftsService from "../services/draft.service.js";
import * as gmailService from "../services/gmail.service.js";
import * as llmService from "../services/llm.service.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// All draft routes require auth to identify user
router.use(requireAuth);

// Get draft for a specific message (if exists)
router.get("/", async (req, res, next) => {
  try {
    const { threadId, messageId } = req.query;
    if (!threadId || !messageId) {
      return res.status(400).json({ error: "threadId and messageId are required" });
    }

    const draft = await draftsService.findDraftByMessage(req.user.id, threadId, messageId);
    if (!draft) {
      return res.status(404).json({ error: "Draft not found" });
    }

    res.json(draft);
  } catch (err) {
    next(err);
  }
});

router.post("/generate", async (req, res, next) => {
  try {
    const { userId = req.user.id, threadId, messageId, tone } = req.body;
    const allowedTones = ["formal", "concise", "friendly"];
    const normalizedTone = tone === "neutral" ? "concise" : tone;
    const toneToUse = allowedTones.includes(normalizedTone) ? normalizedTone : "concise";

    // 1. Fetch Gmail context for this user/thread/message
    const contextSnapshot = await gmailService.getMessageContext(userId, threadId, messageId);

    // 2. Build prompt template (trim long bodies to speed up LLM latency)
    const trimmedBody = (contextSnapshot.body || "").slice(0, 2000);
    const prompt = `
      Draft a reply email.
      Subject: ${contextSnapshot.subject}
      From: ${contextSnapshot.from}
      To: ${contextSnapshot.to}
      Original body (trimmed): ${trimmedBody}
      Tone: ${toneToUse}
    `;

    const llmprovider = llmService.getProvider(process.env.LLM_PROVIDER || "openai", process.env.LLM_API_KEY);

    const body = await llmprovider.generate(prompt, { tone, context: contextSnapshot });

    const draft = await draftsService.createDraft({
      userId,
      threadId,
      messageId,
      tone: toneToUse,
      prompt,
      contextSnapshot,
      body,
      idempotencyKey: crypto.randomUUID()
    });

    res.json(draft);
  } catch (err) {
    next(err);
  }
});

// Streaming draft generation via SSE
router.post("/generate/stream", async (req, res, next) => {
  try {
    const { userId = req.user.id, threadId, messageId, tone } = req.body;
    const allowedTones = ["formal", "concise", "friendly"];
    const normalizedTone = tone === "neutral" ? "concise" : tone;
    const toneToUse = allowedTones.includes(normalizedTone) ? normalizedTone : "concise";

    if (!threadId || !messageId) {
      res.status(400).json({ error: "threadId and messageId are required" });
      return;
    }

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const send = (data) => res.write(`data: ${data}\n\n`);

    // 1. Fetch Gmail context
    const contextSnapshot = await gmailService.getMessageContext(userId, threadId, messageId);

    // 2. Build prompt template (trim to reduce latency)
    const trimmedBody = (contextSnapshot.body || "").slice(0, 2000);
    const prompt = `
      I want you to act as my professional communications assistant. I will provide you with an Email Body (the message I received) and my Preferred Tone.
      Your task is to:
      Analyze the sender's main questions or requests.
      Draft a reply that addresses all points clearly and concisely.
      Ensure the draft matches the requested tone exactly (e.g., if 'Casual,' use natural contractions and friendly language; if 'Formal,' use professional syntax and greetings).
      No need to include the subject again in the reply.
      Include an appropriate greeting (salutation) and a closing (sign-off) based on the preferred tone.
      Here are the required email details for drafting the response:
      Subject: ${contextSnapshot.subject}
      From: ${contextSnapshot.from}
      To: ${contextSnapshot.to}
      Preferred Tone: ${toneToUse}
      Email Body: > ${trimmedBody}
    `;

    const llmprovider = llmService.getProvider(process.env.LLM_PROVIDER || "openai", process.env.LLM_API_KEY);

    let generated = "";
    await llmprovider.generateStream(
      prompt,
      { tone: toneToUse, context: contextSnapshot },
      (token) => {
        generated += token;
        send(JSON.stringify({ token }));
      }
    );

    // Save draft after streaming completes
    const draft = await draftsService.createDraft({
      userId,
      threadId,
      messageId,
      tone: toneToUse,
      prompt,
      contextSnapshot,
      body: generated,
      idempotencyKey: crypto.randomUUID()
    });

    send(JSON.stringify({ finalDraft: draft }));
    send("[DONE]");
    res.end();
  } catch (err) {
    // Emit error over SSE and end
    try {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (_) {
      next(err);
    }
  }
});

// Get draft by ID
router.get("/:id", async (req, res, next) => {
  try {
    const draft = await draftsService.getDraftById(req.params.id);
    res.json(draft);
  } catch (err) {
    next(err);
  }
});

// List drafts for user
router.get("/user/:userId", async (req, res, next) => {
  try {
    const drafts = await draftsService.listDraftsByUser(req.params.userId);
    res.json(drafts);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { body } = req.body;

    if (!body) {
      return res.status(400).json({ error: "Draft body is required" });
    }

    const updated = await draftsService.updateDraftBody(id, body);
    if (!updated) {
      return res.status(404).json({ error: "Draft not found" });
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Update draft status (approve/reject)
router.patch("/:id/status", async (req, res, next) => {
  try {
    const draft = await draftsService.updateDraftStatus(req.params.id, req.body.status);
    res.json(draft);
  } catch (err) {
    next(err);
  }
});

export default router;
