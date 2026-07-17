import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@libsql/client';
import { createMigratedTestDatabase } from './test-db';
import {
  GEONAMES_US_POPULATED_PLACES_SOURCE,
  importRoutingPlaces,
  importSecondRegionRoutingPlaces,
  importThirdRegionRoutingPlaces,
  normalizeGeoNamesRoutingPlaces
} from './routing-place-importer';

let db: Client;
let cleanup: (() => Promise<void>) | undefined;

vi.mock('./db', () => ({
  get db() {
    return db;
  }
}));

describe('source-backed Routing Place importer', () => {
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

  it('normalizes GeoNames populated places into stable app-owned Routing Places', () => {
    const places = normalizeGeoNamesRoutingPlaces([
      {
        geonameId: '4930956',
        name: ' Boston ',
        adminName1: ' Massachusetts ',
        featureCode: 'PPLA2',
        latitude: 42.35843,
        longitude: -71.05977,
        population: 675647
      },
      {
        geonameId: '123',
        name: 'Not a populated place',
        adminName1: 'Massachusetts',
        featureCode: 'MT',
        latitude: 42,
        longitude: -71
      }
    ]);

    expect(places).toEqual([
      expect.objectContaining({
        id: 'geonames-us-4930956',
        name: 'Boston',
        region: 'Massachusetts',
        kind: 'city',
        searchLabel: 'Boston, Massachusetts',
        sourceSystem: GEONAMES_US_POPULATED_PLACES_SOURCE.system,
        sourceDataset: GEONAMES_US_POPULATED_PLACES_SOURCE.dataset,
        sourceRecordId: '4930956'
      })
    ]);
  });

  it('deduplicates source rows by unambiguous search label', () => {
    const places = normalizeGeoNamesRoutingPlaces([
      {
        geonameId: '4975802',
        name: 'Portland',
        adminName1: 'Maine',
        featureCode: 'PPL',
        latitude: 43.66147,
        longitude: -70.25533,
        population: 66881
      },
      {
        geonameId: 'duplicate-portland',
        name: 'Portland',
        adminName1: 'Maine',
        featureCode: 'PPL',
        latitude: 43.66147,
        longitude: -70.25533,
        population: 66881
      }
    ]);

    expect(places).toHaveLength(1);
    expect(places[0].searchLabel).toBe('Portland, Maine');
  });

  it('imports Boston to Bar Harbor Routing Places with provenance and keeps the import idempotent', async () => {
    const firstImport = await importSecondRegionRoutingPlaces(db);
    const secondImport = await importSecondRegionRoutingPlaces(db);

    expect(firstImport.imported).toBeGreaterThanOrEqual(8);
    expect(secondImport.imported).toBe(firstImport.imported);

    const count = await db.execute({
      sql: `
        SELECT COUNT(*) AS count
        FROM routing_places
        WHERE source_system = ? AND source_dataset = ?
      `,
      args: [GEONAMES_US_POPULATED_PLACES_SOURCE.system, GEONAMES_US_POPULATED_PLACES_SOURCE.dataset]
    });
    expect(Number(count.rows[0].count)).toBe(firstImport.imported);

    const boston = await routingPlaceRow('Boston, Massachusetts');
    expect(boston).toMatchObject({
      id: 'geonames-us-4930956',
      name: 'Boston',
      region: 'Massachusetts',
      kind: 'city',
      source_system: 'geonames',
      source_dataset: 'US populated places',
      source_record_id: '4930956'
    });
    expect(JSON.parse(String(boston.source_provenance_json))).toMatchObject({
      sourceSystem: 'geonames',
      sourceDataset: 'US populated places',
      geonameId: '4930956',
      importedCoordinates: { latitude: 42.35843, longitude: -71.05977 }
    });
  });

  it('imports Reston to Niagara Falls Routing Places with provenance, bounds, and idempotence', async () => {
    const firstImport = await importThirdRegionRoutingPlaces(db);
    const secondImport = await importThirdRegionRoutingPlaces(db);

    expect(firstImport.imported).toBeGreaterThanOrEqual(20);
    expect(secondImport.imported).toBe(firstImport.imported);
    expect(firstImport.places.every((place) => place.latitude >= 38.5 && place.latitude <= 43.4)).toBe(true);
    expect(firstImport.places.every((place) => place.longitude >= -80.9 && place.longitude <= -76.0)).toBe(true);

    const count = await db.execute({
      sql: `
        SELECT COUNT(*) AS count
        FROM routing_places
        WHERE source_system = ? AND source_dataset = ?
      `,
      args: [GEONAMES_US_POPULATED_PLACES_SOURCE.system, GEONAMES_US_POPULATED_PLACES_SOURCE.dataset]
    });
    expect(Number(count.rows[0].count)).toBe(firstImport.imported);

    const reston = await routingPlaceRow('Reston, Virginia');
    expect(reston).toMatchObject({
      id: 'geonames-us-4781530',
      name: 'Reston',
      region: 'Virginia',
      kind: 'city',
      source_system: 'geonames',
      source_dataset: 'US populated places',
      source_record_id: '4781530'
    });
    expect(JSON.parse(String(reston.source_provenance_json))).toMatchObject({
      sourceSystem: 'geonames',
      sourceDataset: 'US populated places',
      geonameId: '4781530',
      importedCoordinates: { latitude: 38.96872, longitude: -77.3411 }
    });

    const niagaraFalls = await routingPlaceRow('Niagara Falls, New York');
    expect(niagaraFalls).toMatchObject({
      id: 'geonames-us-5128723',
      name: 'Niagara Falls',
      region: 'New York',
      source_record_id: '5128723'
    });
  });

  it('updates imported records on rerun without creating duplicates', async () => {
    const [barHarbor] = normalizeGeoNamesRoutingPlaces([
      {
        geonameId: '4957320',
        name: 'Bar Harbor',
        adminName1: 'Maine',
        featureCode: 'PPL',
        latitude: 44.38758,
        longitude: -68.2039,
        population: 5235
      }
    ]);

    await importRoutingPlaces(db, [barHarbor]);
    await importRoutingPlaces(db, [{ ...barHarbor, latitude: 44.39, longitude: -68.21 }]);

    const result = await db.execute({
      sql: `
        SELECT COUNT(*) AS count, latitude, longitude
        FROM routing_places
        WHERE id = ?
      `,
      args: [barHarbor.id]
    });

    expect(Number(result.rows[0].count)).toBe(1);
    expect(Number(result.rows[0].latitude)).toBe(44.39);
    expect(Number(result.rows[0].longitude)).toBe(-68.21);
  });

  it('makes imported second-region places searchable as Endpoints and Trip Stops through the existing Routing Place workflow', async () => {
    await importSecondRegionRoutingPlaces(db);
    const { findRoutingPlaceBySearchLabel, listRoutingPlaces } = await import('./routing-places');

    const boston = await findRoutingPlaceBySearchLabel('Boston, Massachusetts');
    const bostonCaseInsensitive = await findRoutingPlaceBySearchLabel('boston, massachusetts');
    const barHarborByName = await findRoutingPlaceBySearchLabel('Bar Harbor');
    const listedLabels = (await listRoutingPlaces()).map((place) => place.searchLabel);

    expect(boston?.searchLabel).toBe('Boston, Massachusetts');
    expect(bostonCaseInsensitive?.searchLabel).toBe('Boston, Massachusetts');
    expect(barHarborByName?.searchLabel).toBe('Bar Harbor, Maine');
    expect(listedLabels).toEqual(expect.arrayContaining(['Boston, Massachusetts', 'Bar Harbor, Maine', 'Portland, Maine']));
  });

  it('makes imported third-region places searchable without changing earlier tracer region behavior', async () => {
    await importSecondRegionRoutingPlaces(db);
    await importThirdRegionRoutingPlaces(db);
    const { findRoutingPlaceBySearchLabel, listRoutingPlaces } = await import('./routing-places');

    const reston = await findRoutingPlaceBySearchLabel('Reston, Virginia');
    const niagaraFallsCaseInsensitive = await findRoutingPlaceBySearchLabel('niagara falls, new york');
    const niagaraFallsByName = await findRoutingPlaceBySearchLabel('Niagara Falls');
    const boston = await findRoutingPlaceBySearchLabel('Boston, Massachusetts');
    const listedLabels = (await listRoutingPlaces()).map((place) => place.searchLabel);

    expect(reston?.searchLabel).toBe('Reston, Virginia');
    expect(niagaraFallsCaseInsensitive?.searchLabel).toBe('Niagara Falls, New York');
    expect(niagaraFallsByName?.searchLabel).toBe('Niagara Falls, New York');
    expect(boston?.searchLabel).toBe('Boston, Massachusetts');
    expect(listedLabels).toEqual(expect.arrayContaining(['Reston, Virginia', 'Niagara Falls, New York', 'Boston, Massachusetts']));
  });
});

async function routingPlaceRow(searchLabel: string) {
  const result = await db.execute({
    sql: `
      SELECT id, name, region, kind, latitude, longitude, search_label, source_system, source_dataset, source_record_id, source_provenance_json
      FROM routing_places
      WHERE search_label = ?
      LIMIT 1
    `,
    args: [searchLabel]
  });

  const row = result.rows[0];
  if (!row) throw new Error(`Missing Routing Place: ${searchLabel}`);
  return row;
}
