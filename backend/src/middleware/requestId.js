import { randomUUID } from 'crypto';

export function requestId(req, res, next) {
  // Generate a unique ID for each request
  req.id = randomUUID();

  // Optionally expose it in response headers
  res.setHeader('X-Request-ID', req.id);

  next();
}