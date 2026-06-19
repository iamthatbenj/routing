import { createClient } from '@libsql/client';
import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export function loadDotEnv(path = '.env') {
  if (!existsSync(path)) return;

  const contents = readFileSync(path, 'utf8');
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    process.env[key] = unquoteEnvValue(rawValue);
  }
}

export function databaseConfig(env = process.env) {
  const url = env.TURSO_DATABASE_URL ?? env.DATABASE_URL ?? 'file:local.db';
  const authToken = env.TURSO_AUTH_TOKEN ?? env.DATABASE_AUTH_TOKEN;
  const source = env.TURSO_DATABASE_URL ? 'TURSO_DATABASE_URL' : env.DATABASE_URL ? 'DATABASE_URL' : 'default';
  const mode = url.startsWith('file:') ? 'local' : 'remote';

  return {
    url,
    authToken,
    source,
    mode,
    redactedUrl: redactDatabaseUrl(url),
    hasAuthToken: Boolean(authToken)
  };
}

export function createDatabaseClient(config = databaseConfig()) {
  return createClient({ url: config.url, authToken: config.authToken });
}

export async function migrationFiles() {
  const migrationsDir = new URL('../migrations', import.meta.url);
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
  return { migrationsDir, files };
}

export async function migrationStatements(migrationsDir, file) {
  const sql = await readFile(join(migrationsDir.pathname, file), 'utf8');
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function ensureSchemaMigrations(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export async function appliedMigrations(db) {
  const tableExists = await db.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
    args: []
  });

  if (tableExists.rows.length === 0) return [];

  const result = await db.execute({
    sql: 'SELECT filename, applied_at FROM schema_migrations ORDER BY filename',
    args: []
  });

  return result.rows.map((row) => ({ filename: String(row.filename), appliedAt: String(row.applied_at) }));
}

export function remoteMigrationConfirmed(argv = process.argv, env = process.env) {
  return argv.includes('--yes') || argv.includes('-y') || env.DATABASE_MIGRATE_CONFIRM === '1' || env.DATABASE_MIGRATE_CONFIRM === 'true';
}

export function printDatabaseTarget(config, writer = console.log) {
  writer(`Database mode: ${config.mode}`);
  writer(`Database URL: ${config.redactedUrl}`);
  writer(`Database source: ${config.source}`);
  writer(`Auth token configured: ${config.hasAuthToken ? 'yes' : 'no'}`);
}

function redactDatabaseUrl(url) {
  if (url.startsWith('file:')) return url;

  try {
    const parsed = new URL(url);
    if (parsed.username) parsed.username = '***';
    if (parsed.password) parsed.password = '***';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/token|auth|password|secret|key/i.test(key)) {
        parsed.searchParams.set(key, '***');
      }
    }
    return parsed.toString();
  } catch {
    return url.replace(/(token|auth|password|secret|key)=([^&]+)/gi, '$1=***');
  }
}

function unquoteEnvValue(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
