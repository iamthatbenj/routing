import { readFile } from 'node:fs/promises';
import { createDatabaseClient, databaseConfig, loadDotEnv, printDatabaseTarget } from './db-utils.mjs';

const source = {
  system: 'geonames',
  dataset: 'US populated places',
  sourceUrl: 'https://download.geonames.org/export/dump/US.zip'
};

const populatedPlaceFeatureCodes = new Set(['PPL', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPLC']);

loadDotEnv();
const config = databaseConfig();
printDatabaseTarget(config);

const db = createDatabaseClient(config);

try {
  const records = JSON.parse(await readFile(new URL('../data/routing-places/boston-bar-harbor-geonames.json', import.meta.url), 'utf8'));
  const places = normalize(records);
  const now = new Date().toISOString();

  for (const place of places) {
    await db.execute({
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

  console.log(`Imported ${places.length} source-backed Routing Places for Boston → Bar Harbor.`);
} finally {
  await db.close();
}

function normalize(records) {
  const bySearchLabel = new Map();

  for (const record of records) {
    if (!populatedPlaceFeatureCodes.has(record.featureCode)) continue;

    const name = String(record.name ?? '').trim();
    const region = String(record.adminName1 ?? '').trim();
    const sourceRecordId = String(record.geonameId ?? '').trim();
    if (!name || !region || !sourceRecordId) continue;

    const place = {
      id: `geonames-us-${sourceRecordId}`,
      name,
      region,
      kind: Number(record.population ?? 0) >= 50000 ? 'city' : 'town',
      latitude: Number(record.latitude),
      longitude: Number(record.longitude),
      searchLabel: `${name}, ${region}`,
      sourceSystem: source.system,
      sourceDataset: source.dataset,
      sourceRecordId,
      sourceProvenance: {
        sourceSystem: source.system,
        sourceDataset: source.dataset,
        sourceUrl: source.sourceUrl,
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

    const key = place.searchLabel.toLowerCase();
    if (!bySearchLabel.has(key) || priority(place) > priority(bySearchLabel.get(key))) {
      bySearchLabel.set(key, place);
    }
  }

  return [...bySearchLabel.values()].sort((a, b) => a.searchLabel.localeCompare(b.searchLabel));
}

function priority(place) {
  return place.kind === 'city' ? 2 : 1;
}
