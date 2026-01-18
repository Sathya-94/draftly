// gmailHelpers.js
import { JSDOM } from "jsdom";

/**
 * Parse a Gmail message payload to extract HTML, text, and attachment metadata.
 */
export function parseMessagePayload(payload) {
  const result = { html: "", text: "", attachments: [] };
  if (!payload) return result;

  function walk(part) {
    if (!part) return;
    const mime = part.mimeType || "";
    const headers = part.headers || [];
    const contentId = headers.find(h => h.name?.toLowerCase() === "content-id")?.value;
    const isInline = Boolean(contentId);

    // Capture attachment metadata
    if (part.filename && part.body?.attachmentId) {
      result.attachments.push({
        filename: part.filename,
        mimeType: mime,
        size: part.body.size,
        attachmentId: part.body.attachmentId,
        contentId: contentId ? contentId.replace(/[<>]/g, "") : null,
        isInline
      });
    }

    if (part.body?.data) {
      const decoded = decodeBase64(part.body.data);
      if (mime === "text/html") {
        result.html = result.html || decoded;
      } else if (mime === "text/plain") {
        result.text = result.text || decoded;
      } else if (isInline && mime.startsWith("image/")) {
        // Inline image data available directly in the part (rare)
        result.attachments.push({
          filename: part.filename || contentId || "inline-image",
          mimeType: mime,
          size: part.body.size,
          attachmentId: part.body.attachmentId || null,
          contentId: contentId ? contentId.replace(/[<>]/g, "") : null,
          isInline,
          dataUri: `data:${mime};base64,${part.body.data.replace(/-/g, "+").replace(/_/g, "/")}`
        });
      }
    }

    if (part.parts && part.parts.length) {
      part.parts.forEach(walk);
    }
  }

  walk(payload);

  // Fallback: derive HTML from text when HTML part is missing
  if (!result.html && result.text) {
    result.html = result.text.replace(/\n/g, "<br>");
  }

  // Ensure plain text available
  if (!result.text && result.html) {
    result.text = stripHtml(result.html);
  }

  return result;
}

/**
 * Gmail API encodes body data in base64url.
 */
function decodeBase64(base64url) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const buff = Buffer.from(base64, "base64");
  return buff.toString("utf-8");
}

function stripHtml(raw) {
  try {
    const dom = new JSDOM(raw);
    return (dom.window.document.body.textContent || "").trim();
  } catch {
    return raw.replace(/<[^>]+>/g, "").trim();
  }
}
