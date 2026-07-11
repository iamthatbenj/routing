import type { Client } from '@libsql/client';
import secondRegionGeoNames from '../../../data/routing-places/boston-bar-harbor-geonames.json';

export const GEONAMES_US_POPULATED_PLACES_SOURCE = {
  system: 'geonames',
  dataset: 'US populated places',
  sourceUrl: 'https://download.geonames.org/export/dump/US.zip'
} as const;

type GeoNamesRoutingPlaceRecord = {
  geonameId: string;
  name: string;
  adminName1: string;
  featureCode: string;
  latitude: number;
  longitude: number;
  population?: number;
};

export type ImportedRoutingPlace = {
  id: string;
  name: string;
  region: string;
  kind: 'city' | 'town' | 'travel_relevant_place';
  latitude: number;
  longitude: number;
  searchLabel: string;
  sourceSystem: string;
  sourceDataset: string;
  sourceRecordId: string;
  sourceProvenance: Record<string, unknown>;
};

export type ImportRoutingPlacesResult = {
  imported: number;
  places: ImportedRoutingPlace[];
};

const POPULATED_PLACE_FEATURE_CODES = new Set(['PPL', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPLC']);

export function normalizeGeoNamesRoutingPlaces(records: GeoNamesRoutingPlaceRecord[]): ImportedRoutingPlace[] {
  const bySearchLabel = new Map<string, ImportedRoutingPlace>();

  for (const record of records) {
    if (!POPULATED_PLACE_FEATURE_CODES.has(record.featureCode)) continue;

    const name = record.name.trim();
    const region = record.adminName1.trim();
    const sourceRecordId = record.geonameId.trim();
    if (!name || !region || !sourceRecordId) continue;

    const place: ImportedRoutingPlace = {
      id: `geonames-us-${sourceRecordId}`,
      name,
      region,
      kind: kindForGeoNamesRecord(record),
      latitude: Number(record.latitude),
      longitude: Number(record.longitude),
      searchLabel: `${name}, ${region}`,
      sourceSystem: GEONAMES_US_POPULATED_PLACES_SOURCE.system,
      sourceDataset: GEONAMES_US_POPULATED_PLACES_SOURCE.dataset,
      sourceRecordId,
      sourceProvenance: {
        sourceSystem: GEONAMES_US_POPULATED_PLACES_SOURCE.system,
        sourceDataset: GEONAMES_US_POPULATED_PLACES_SOURCE.dataset,
        sourceUrl: GEONAMES_US_POPULATED_PLACES_SOURCE.sourceUrl,
        geonameId: sourceRecordId,
        featureCode: record.featureCode,
        population: record.population ?? null,
        importedName: name,
        importedRegion: region,
        importedCoordinates: {
          latitude: Number(record.latitude),
          longitude: Number(record.longitude)
        }
      }
    };

    const existing = bySearchLabel.get(place.searchLabel.toLowerCase());
    if (!existing || sourcePriority(place) > sourcePriority(existing)) {
      bySearchLabel.set(place.searchLabel.toLowerCase(), place);
    }
  }

  return [...bySearchLabel.values()].sort((a, b) => a.searchLabel.localeCompare(b.searchLabel));
}

export async function importRoutingPlaces(client: Client, places: ImportedRoutingPlace[]): Promise<ImportRoutingPlacesResult> {
  const now = new Date().toISOString();

  for (const place of places) {
    await client.execute({
      sql: `
        INSERT INTO routing_places (
          id, name, region, kind, latitude, longitude, search_label,
          source_system, source_dataset, source_record_id, source_provenance_json, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          region = excluded.region,
          kind = excluded.kind,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          search_label = excluded.search_label,
          source_system = excluded.source_system,
          source_dataset = excluded.source_dataset,
          source_record_id = excluded.source_record_id,
          source_provenance_json = excluded.source_provenance_json,
          updated_at = excluded.updated_at
      `,
      args: [
        place.id,
        place.name,
        place.region,
        place.kind,
        place.latitude,
        place.longitude,
        place.searchLabel,
        place.sourceSystem,
        place.sourceDataset,
        place.sourceRecordId,
        JSON.stringify(place.sourceProvenance),
        now
      ]
    });
  }

  return { imported: places.length, places };
}

export async function importSecondRegionRoutingPlaces(client: Client) {
  return importRoutingPlaces(client, normalizeGeoNamesRoutingPlaces(secondRegionGeoNames));
}

function kindForGeoNamesRecord(record: GeoNamesRoutingPlaceRecord): ImportedRoutingPlace['kind'] {
  return Number(record.population ?? 0) >= 50000 ? 'city' : 'town';
}

function sourcePriority(place: ImportedRoutingPlace) {
  return place.kind === 'city' ? 2 : 1;
}
