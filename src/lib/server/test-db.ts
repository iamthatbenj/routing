import { createClient, type Client } from '@libsql/client';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export type TestDatabase = {
  db: Client;
  cleanup: () => Promise<void>;
};

export async function createMigratedTestDatabase(): Promise<TestDatabase> {
  const dir = mkdtempSync(join(tmpdir(), 'routing-test-db-'));
  const dbPath = join(dir, 'test.db');
  const db = createClient({ url: `file:${dbPath}` });

  const migrationsDir = new URL('../../../migrations', import.meta.url);
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir.pathname, file), 'utf8');
    const statements = sql
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await db.execute(statement);
    }
  }

  return {
    db,
    cleanup: async () => {
      await db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  };
}
