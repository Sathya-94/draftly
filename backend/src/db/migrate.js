import fs from 'fs';
import path from 'path';
import { pool } from './pool.js';

async function runMigrations() {
  const migrationsDir = path.join(process.cwd(), 'src/db/migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Running migration: ${file}`);
    await pool.query(sql);
  }

  console.log('All migrations applied successfully');
  process.exit(0);
}

runMigrations().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});