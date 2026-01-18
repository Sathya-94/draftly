import express from "express";
import { sendDraft } from "../services/gmailsend.service.js";

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const { draftId } = req.body;
    const userId = req.user.id;

    const result = await sendDraft(draftId, userId);
    res.json(result);
  } catch (err) {
    // Normalize known validation errors
    if (err.code === "DRAFT_NOT_FOUND") {
      return res.status(404).json({ error: err.message });
    }
    if (err.code === "DRAFT_NOT_APPROVED" || err.code === "DRAFT_REJECTED") {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === "SEND_FAILED" && err.log) {
      return res.status(502).json({ error: err.message, log: err.log });
    }
    next(err);
  }
});

export default router;
