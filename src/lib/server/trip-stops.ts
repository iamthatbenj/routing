import { randomUUID } from 'node:crypto';
import { db } from './db';
import type { RoutingPlace } from './routing-places';

export type TripStop = {
  id: string;
  tripId: string;
  position: number;
  details: string;
  routingPlace: RoutingPlace;
};

export type Leg = {
  id: string;
  from: TripStop;
  to: TripStop;
};

function rowToTripStop(row: Record<string, unknown>): TripStop {
  return {
    id: String(row.id),
    tripId: String(row.trip_id),
    position: Number(row.position),
    details: String(row.details ?? ''),
    routingPlace: {
      id: String(row.routing_place_id),
      name: String(row.name),
      region: String(row.region),
      kind: String(row.kind),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      searchLabel: String(row.search_label)
    }
  };
}

export async function listTripStops(tripId: string) {
  const result = await db.execute({
    sql: `
      SELECT
        trip_stops.id,
        trip_stops.trip_id,
        trip_stops.position,
        trip_stops.details,
        routing_places.id AS routing_place_id,
        routing_places.name,
        routing_places.region,
        routing_places.kind,
        routing_places.latitude,
        routing_places.longitude,
        routing_places.search_label
      FROM trip_stops
      JOIN routing_places ON routing_places.id = trip_stops.routing_place_id
      WHERE trip_stops.trip_id = ?
      ORDER BY trip_stops.position
    `,
    args: [tripId]
  });

  return result.rows.map(rowToTripStop);
}

export function deriveLegs(stops: TripStop[]): Leg[] {
  return stops.slice(0, -1).map((from, index) => {
    const to = stops[index + 1];
    return {
      id: `${from.id}-${to.id}`,
      from,
      to
    };
  });
}

export async function addTripStop(tripId: string, routingPlaceId: string, details = '') {
  const countResult = await db.execute({
    sql: 'SELECT COUNT(*) AS count FROM trip_stops WHERE trip_id = ?',
    args: [tripId]
  });
  const nextPosition = Number(countResult.rows[0]?.count ?? 0) + 1;

  await db.execute({
    sql: `
      INSERT INTO trip_stops (id, trip_id, routing_place_id, position, details)
      VALUES (?, ?, ?, ?, ?)
    `,
    args: [randomUUID(), tripId, routingPlaceId, nextPosition, details]
  });

  await touchTrip(tripId);
}

export async function updateTripStopDetails(tripId: string, stopId: string, details: string) {
  await db.execute({
    sql: 'UPDATE trip_stops SET details = ? WHERE id = ? AND trip_id = ?',
    args: [details.trim(), stopId, tripId]
  });

  await touchTrip(tripId);
}

export async function moveTripStop(tripId: string, stopId: string, direction: 'up' | 'down') {
  const stops = await listTripStops(tripId);
  const index = stops.findIndex((stop) => stop.id === stopId);
  const targetIndex = direction === 'up' ? index - 1 : index + 1;

  if (index < 0 || targetIndex < 0 || targetIndex >= stops.length) {
    return;
  }

  const current = stops[index];
  const target = stops[targetIndex];
  const temporaryPosition = -1;

  await db.batch([
    {
      sql: 'UPDATE trip_stops SET position = ? WHERE id = ? AND trip_id = ?',
      args: [temporaryPosition, current.id, tripId]
    },
    {
      sql: 'UPDATE trip_stops SET position = ? WHERE id = ? AND trip_id = ?',
      args: [current.position, target.id, tripId]
    },
    {
      sql: 'UPDATE trip_stops SET position = ? WHERE id = ? AND trip_id = ?',
      args: [target.position, current.id, tripId]
    }
  ]);

  await touchTrip(tripId);
}

async function touchTrip(tripId: string) {
  await db.execute({
    sql: 'UPDATE trips SET updated_at = ? WHERE id = ?',
    args: [new Date().toISOString(), tripId]
  });
}
