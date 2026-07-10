import { beforeEach, describe, expect, it, vi } from 'vitest';

const createTrip = vi.fn();

vi.mock('$lib/server/trips', () => ({
  createTrip
}));

const { actions } = await import('./+page.server');

describe('homepage createTrip action', () => {
  beforeEach(() => {
    createTrip.mockReset();
  });

  it('creates a Trip with the submitted title and redirects to the private edit link', async () => {
    createTrip.mockResolvedValueOnce({ id: 'trip-1', editToken: 'edit-secret', shareToken: 'share-secret' });

    await expect(callCreateTripAction({ title: '  Southwest loop  ' })).rejects.toMatchObject({
      status: 303,
      location: '/trips/edit/edit-secret'
    });

    expect(createTrip).toHaveBeenCalledWith('Southwest loop');
  });

  it('uses an Untitled Trip fallback when the submitted title is blank', async () => {
    createTrip.mockResolvedValueOnce({ id: 'trip-1', editToken: 'edit-secret', shareToken: 'share-secret' });

    await expect(callCreateTripAction({ title: '   ' })).rejects.toMatchObject({ status: 303 });

    expect(createTrip).toHaveBeenCalledWith('Untitled Trip');
  });

  it('returns a form failure when Trip creation fails', async () => {
    createTrip.mockRejectedValueOnce(new Error('database unavailable'));

    const result = await callCreateTripAction({ title: 'Broken Trip' });

    expect(result).toMatchObject({
      status: 500,
      data: {
        message: 'Could not create the Trip. Check database configuration and migrations.'
      }
    });
  });
});

async function callCreateTripAction(fields: Record<string, string>) {
  const request = new Request('https://routing.test/?/createTrip', {
    method: 'POST',
    body: new URLSearchParams(fields)
  });

  return actions.createTrip({ request } as Parameters<typeof actions.createTrip>[0]);
}
