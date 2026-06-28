import { beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.fn();

vi.mock('./db', () => ({
  db: {
    execute,
    batch: vi.fn()
  }
}));

const { updateTripStopDetails } = await import('./trip-stops');

describe('updateTripStopDetails', () => {
  beforeEach(() => {
    execute.mockReset();
    execute.mockResolvedValue({ rows: [] });
  });

  it('updates details for a Trip Stop scoped to its Trip and touches the Trip', async () => {
    await updateTripStopDetails('trip-1', 'stop-1', '  staying near downtown  ');

    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenNthCalledWith(1, {
      sql: 'UPDATE trip_stops SET details = ? WHERE id = ? AND trip_id = ?',
      args: ['staying near downtown', 'stop-1', 'trip-1']
    });
    expect(execute.mock.calls[1]?.[0]).toMatchObject({
      sql: 'UPDATE trips SET updated_at = ? WHERE id = ?'
    });
    expect(execute.mock.calls[1]?.[0].args[1]).toBe('trip-1');
  });

  it('allows blank details to clear the Trip Stop details', async () => {
    await updateTripStopDetails('trip-1', 'stop-1', '   ');

    expect(execute).toHaveBeenNthCalledWith(1, {
      sql: 'UPDATE trip_stops SET details = ? WHERE id = ? AND trip_id = ?',
      args: ['', 'stop-1', 'trip-1']
    });
  });
});
