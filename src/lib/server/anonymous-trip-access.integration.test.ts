import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@libsql/client';
import { createMigratedTestDatabase } from './test-db';

let db: Client;
let cleanup: (() => Promise<void>) | undefined;

vi.mock('./db', () => ({
  get db() {
    return db;
  }
}));

describe('anonymous Trip access integration', () => {
  beforeEach(async () => {
    const testDb = await createMigratedTestDatabase();
    db = testDb.db;
    cleanup = testDb.cleanup;
  });

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
    vi.clearAllMocks();
  });

  it('creates a Trip, loads it through the private edit token, and does not persist the edit token in plaintext', async () => {
    const { createTrip, findTripByEditToken } = await import('./trips');
    const tripAccess = await createTrip('Anonymous parks Trip');

    const loadedTrip = await findTripByEditToken(tripAccess.editToken);
    const rows = await db.execute('SELECT id, title, edit_token_hash, share_token, share_token_hash FROM trips');
    const storedTrip = rows.rows[0];

    expect(loadedTrip).toMatchObject({
      id: tripAccess.id,
      title: 'Anonymous parks Trip',
      shareToken: tripAccess.shareToken
    });
    expect(String(storedTrip.edit_token_hash)).not.toBe(tripAccess.editToken);
    expect(String(storedTrip.edit_token_hash)).toHaveLength(43);
    expect(JSON.stringify(storedTrip)).not.toContain(tripAccess.editToken);
  });

  it('loads the same Trip through the read-only share token without exposing the private edit token', async () => {
    const { createTrip } = await import('./trips');
    const editPage = await import('../../routes/trips/edit/[token]/+page.server');
    const sharePage = await import('../../routes/trips/share/[token]/+page.server');
    const tripAccess = await createTrip('Shared parks Trip');

    const editData = await editPage.load({
      params: { token: tripAccess.editToken },
      url: new URL('https://routing.test/trips/edit/private-token')
    } as Parameters<typeof editPage.load>[0]);
    const shareData = await sharePage.load({ params: { token: tripAccess.shareToken } } as Parameters<typeof sharePage.load>[0]);

    expect(editData.trip).toMatchObject({ id: tripAccess.id, title: 'Shared parks Trip' });
    expect(editData.editToken).toBe(tripAccess.editToken);
    expect(editData.shareUrl).toBe(`https://routing.test/trips/share/${tripAccess.shareToken}`);
    expect(shareData.trip).toMatchObject({ id: tripAccess.id, title: 'Shared parks Trip' });
    expect(JSON.stringify(shareData)).not.toContain(tripAccess.editToken);
  });

  it('rejects invalid private edit and read-only share tokens with not-found responses', async () => {
    const editPage = await import('../../routes/trips/edit/[token]/+page.server');
    const sharePage = await import('../../routes/trips/share/[token]/+page.server');

    await expect(
      editPage.load({ params: { token: 'not-a-real-edit-token' }, url: new URL('https://routing.test') } as Parameters<typeof editPage.load>[0])
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      sharePage.load({ params: { token: 'not-a-real-share-token' } } as Parameters<typeof sharePage.load>[0])
    ).rejects.toMatchObject({ status: 404 });
  });

  it('keeps the read-only share route free of mutation actions', async () => {
    const sharePage = await import('../../routes/trips/share/[token]/+page.server');

    expect('actions' in sharePage).toBe(false);
  });
});
