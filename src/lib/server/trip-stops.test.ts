import { beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.fn();
const batch = vi.fn();

vi.mock('./db', () => ({
  db: {
    execute,
    batch
  }
}));

const { deleteTripStop, updateTripStopDetails } = await import('./trip-stops');

describe('updateTripStopDetails', () => {
  beforeEach(() => {
    execute.mockReset();
    batch.mockReset();
    execute.mockResolvedValue({ rows: [] });
    batch.mockResolvedValue({ rows: [] });
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

describe('deleteTripStop', () => {
  beforeEach(() => {
    execute.mockReset();
    batch.mockReset();
    batch.mockResolvedValue({ rows: [] });
  });

  it('deletes an edge Trip Stop and repositions the remaining stops', async () => {
    execute.mockResolvedValueOnce({ rows: tripStopRows(['stop-1', 'stop-2', 'stop-3']) }).mockResolvedValue({ rows: [] });

    await deleteTripStop('trip-1', 'stop-1');

    expect(batch).toHaveBeenCalledWith([
      {
        sql: 'DELETE FROM trip_stops WHERE id = ? AND trip_id = ?',
        args: ['stop-1', 'trip-1']
      },
      {
        sql: 'UPDATE trip_stops SET position = ? WHERE id = ? AND trip_id = ?',
        args: [1, 'stop-2', 'trip-1']
      },
      {
        sql: 'UPDATE trip_stops SET position = ? WHERE id = ? AND trip_id = ?',
        args: [2, 'stop-3', 'trip-1']
      }
    ]);
    expect(execute.mock.calls.at(-1)?.[0]).toMatchObject({
      sql: 'UPDATE trips SET updated_at = ? WHERE id = ?'
    });
  });

  it('deletes a middle Trip Stop and closes the position gap', async () => {
    execute.mockResolvedValueOnce({ rows: tripStopRows(['stop-1', 'stop-2', 'stop-3']) }).mockResolvedValue({ rows: [] });

    await deleteTripStop('trip-1', 'stop-2');

    expect(batch).toHaveBeenCalledWith([
      {
        sql: 'DELETE FROM trip_stops WHERE id = ? AND trip_id = ?',
        args: ['stop-2', 'trip-1']
      },
      {
        sql: 'UPDATE trip_stops SET position = ? WHERE id = ? AND trip_id = ?',
        args: [2, 'stop-3', 'trip-1']
      }
    ]);
  });

  it('does not touch the Trip when the Trip Stop is not found', async () => {
    execute.mockResolvedValueOnce({ rows: tripStopRows(['stop-1']) });

    await deleteTripStop('trip-1', 'missing-stop');

    expect(batch).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

function tripStopRows(stopIds: string[]) {
  return stopIds.map((id, index) => ({
    id,
    trip_id: 'trip-1',
    position: index + 1,
    details: '',
    routing_place_id: `place-${index + 1}`,
    name: `Place ${index + 1}`,
    region: 'Colorado',
    kind: 'city',
    latitude: 39 + index,
    longitude: -104 - index,
    search_label: `Place ${index + 1}, Colorado`
  }));
}
