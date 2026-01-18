import pkg from 'pg';
import { env } from '../config/env.js';
const { Pool } = pkg;

const useConnectionString = !!process.env.DATABASE_URL;

export const pool = new Pool(
  useConnectionString
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000
      }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        max: 10, // max connections
        idleTimeoutMillis: 30000 // close idle connections after 30s
      }
);
