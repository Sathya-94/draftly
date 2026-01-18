import crypto from 'crypto';
import { env } from '../config/env.js';

export function encryptToken(token) {
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(env.ENCRYPTION_KEY, 'hex'),
    Buffer.from(env.ENCRYPTION_IV, 'hex')
  );
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

export function decryptToken(encryptedToken) {
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(env.ENCRYPTION_KEY, 'hex'),
    Buffer.from(env.ENCRYPTION_IV, 'hex')
  );
  let decrypted = decipher.update(encryptedToken, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted; // raw string, not JSON.parse
}