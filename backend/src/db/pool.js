import { setDefaultResultOrder } from 'dns';
import pkg from 'pg';
import { env } from '../config/env.js';


// Prefer IPv4 to avoid ENETUNREACH issues on hosts without IPv6 egress
setDefaultResultOrder?.('ipv4first');

const { Pool } = pkg;

function buildConfigFromUrl(urlStr) {
  const url = new URL(urlStr);
  // Optional: allow overriding with PGHOSTADDR if you want to hardcode an IPv4
  const host = process.env.PGHOSTADDR || url.hostname;
  const port = url.port || 5432;
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const database = url.pathname.replace(/^\//, '');
  return {
    host,
    port,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    // Force IPv4
    family: 4
  };
}

const useConnectionString = !!process.env.DATABASE_URL;

export const pool = new Pool(
  useConnectionString
    ? {
        connectionString: process.env.DATABASE_URL,
        // Recommended: add a limit to how many clients the pool holds
        max: 20, 
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        max: 10, // max connections
        idleTimeoutMillis: 30000, // close idle connections after 30s
        family: 4
      }
);
