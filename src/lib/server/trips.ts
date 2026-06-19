import { randomUUID } from 'node:crypto';
import { db } from './db';
import { createSecretToken, hashSecretToken } from './tokens';

export type Trip = {
  id: string;
  title: string;
  shareToken: string;
  createdAt: string;
  updatedAt: string;
};

function rowToTrip(row: Record<string, unknown>): Trip {
  return {
    id: String(row.id),
    title: String(row.title),
    shareToken: String(row.share_token ?? ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export async function createTrip(title = 'Untitled Trip') {
  const id = randomUUID();
  const editToken = createSecretToken();
  const shareToken = createSecretToken();
  const now = new Date().toISOString();

  await db.execute({
    sql: `
      INSERT INTO trips (id, title, edit_token_hash, share_token_hash, share_token, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    args: [id, title, hashSecretToken(editToken), hashSecretToken(shareToken), shareToken, now, now]
  });

  return { id, editToken, shareToken };
}

export async function findTripByEditToken(token: string) {
  const result = await db.execute({
    sql: `
      SELECT id, title, share_token, created_at, updated_at
      FROM trips
      WHERE edit_token_hash = ?
      LIMIT 1
    `,
    args: [hashSecretToken(token)]
  });

  const row = result.rows[0];
  return row ? rowToTrip(row) : null;
}

export async function findTripByShareToken(token: string) {
  const result = await db.execute({
    sql: `
      SELECT id, title, share_token, created_at, updated_at
      FROM trips
      WHERE share_token = ? OR share_token_hash = ?
      LIMIT 1
    `,
    args: [token, hashSecretToken(token)]
  });

  const row = result.rows[0];
  return row ? rowToTrip(row) : null;
}
