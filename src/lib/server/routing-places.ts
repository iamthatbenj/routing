import { db } from './db';

export type RoutingPlace = {
  id: string;
  name: string;
  region: string;
  kind: string;
  latitude: number;
  longitude: number;
  searchLabel: string;
};

function rowToRoutingPlace(row: Record<string, unknown>): RoutingPlace {
  return {
    id: String(row.id),
    name: String(row.name),
    region: String(row.region),
    kind: String(row.kind),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    searchLabel: String(row.search_label)
  };
}

export async function listRoutingPlaces() {
  const result = await db.execute(`
    SELECT id, name, region, kind, latitude, longitude, search_label
    FROM routing_places
    ORDER BY name
  `);

  return result.rows.map(rowToRoutingPlace);
}

export async function listImportantRoutingPlacesForAnchors() {
  const result = await db.execute(`
    SELECT id, name, region, kind, latitude, longitude, search_label
    FROM routing_places
    WHERE kind IN ('national_park', 'national_monument')
    ORDER BY name
  `);

  return result.rows.map(rowToRoutingPlace);
}

export async function findRoutingPlaceBySearchLabel(searchLabel: string) {
  const result = await db.execute({
    sql: `
      SELECT id, name, region, kind, latitude, longitude, search_label
      FROM routing_places
      WHERE search_label = ? OR lower(search_label) = lower(?) OR lower(name) = lower(?)
      ORDER BY CASE WHEN search_label = ? THEN 0 ELSE 1 END
      LIMIT 1
    `,
    args: [searchLabel, searchLabel, searchLabel, searchLabel]
  });

  const row = result.rows[0];
  return row ? rowToRoutingPlace(row) : null;
}
