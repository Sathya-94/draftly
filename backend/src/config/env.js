import dotenv from 'dotenv';
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 4000,
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: process.env.DB_PORT || 5432,
  DB_USER: process.env.DB_USER || 'draftly',
  DB_PASSWORD: process.env.DB_PASSWORD || 'draftly',
  DB_NAME: process.env.DB_NAME || 'draftly',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'replace-with-32-byte-key',
  ENCRYPTION_IV: process.env.ENCRYPTION_IV || 'replace-with-16-byte-iv',
};