import { createClient } from '@libsql/client';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN ?? process.env.DATABASE_AUTH_TOKEN;

const db = createClient({ url, authToken });

await db.execute(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const migrationsDir = new URL('../migrations', import.meta.url);
const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

for (const file of files) {
  const existing = await db.execute({
    sql: 'SELECT filename FROM schema_migrations WHERE filename = ?',
    args: [file]
  });

  if (existing.rows.length > 0) {
    console.log(`Skipping ${file}`);
    continue;
  }

  const sql = await readFile(join(migrationsDir.pathname, file), 'utf8');
  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await db.execute(statement);
  }

  await db.execute({
    sql: 'INSERT INTO schema_migrations (filename) VALUES (?)',
    args: [file]
  });
  console.log(`Applied ${file}`);
}

await db.close();
