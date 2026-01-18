import crypto from "crypto";

export function nonceMiddleware(req, res, next) {
  const nonce = crypto.randomBytes(16).toString("base64");

  // Attach nonce to res.locals so routes can use it
  res.locals.nonce = nonce;

  // Set CSP header allowing only scripts with this nonce
  res.setHeader(
    "Content-Security-Policy",
    `script-src 'self' 'nonce-${nonce}'; object-src 'none'; base-uri 'self';`
  );

  next();
}