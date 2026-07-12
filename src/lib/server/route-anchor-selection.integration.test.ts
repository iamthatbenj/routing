import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@libsql/client';
import acadiaSource from '../../../data/candidate-highlights/acadia-nps-supplement.json';
import acadiaPromotions from '../../../data/highlight-promotions/acadia-reviewed-highlights.json';
import { createMigratedTestDatabase } from './test-db';
import { importSecondRegionRoutingPlaces } from './routing-place-importer';
import { findRoutingPlaceBySearchLabel, type RoutingPlace } from './routing-places';
import { importCandidateHighlights, normalizeSourcePoiRecords } from './candidate-highlight-importer';
import { promoteCandidateHighlight, type PromotionReview } from './highlight-promotion';
import { generateFallbackAnchorCorridors } from './route-searches';
import type { Leg, TripStop } from './trip-stops';

let db: Client;
let cleanup: (() => Promise<void>) | undefined;

vi.mock('./db', () => ({
  get db() {
    return db;
  }
}));

describe('DB-backed regional Anchor selection for Route Search', () => {
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

  it('selects Denver to Moab fallback Anchors without Acadia contamination', async () => {
    const denver = await requiredRoutingPlace('Denver, Colorado');
    const moab = await requiredRoutingPlace('Moab, Utah');

    const routes = await generateFallbackAnchorCorridors(leg(denver, moab));
    const routeNames = routes.map((route) => route.name);

    expect(routeNames).toEqual([
      'Approximate direct Corridor',
      'Approximate via Rocky Mountain National Park',
      'Approximate via Black Canyon of the Gunnison',
      'Approximate via Colorado National Monument'
    ]);
    expect(routeNames).toHaveLength(4);
    expect(routeNames.join(' ')).not.toContain('Acadia');
    expect(routeNames.join(' ')).not.toContain('Arches');
    expect(routeNames.join(' ')).not.toContain('Canyonlands');
  });

  it('selects Boston to Bar Harbor fallback Anchors without Colorado contamination', async () => {
    await importSecondRegionRoutingPlaces(db);
    await importAndPromoteAcadiaHighlights();
    const boston = await requiredRoutingPlace('Boston, Massachusetts');
    const barHarbor = await requiredRoutingPlace('Bar Harbor, Maine');

    const routes = await generateFallbackAnchorCorridors(leg(boston, barHarbor));
    const routeNames = routes.map((route) => route.name);

    expect(routeNames).toEqual([
      'Approximate direct Corridor',
      'Approximate via Acadia National Park',
      'Approximate via Cadillac Mountain',
      'Approximate via Park Loop Road'
    ]);
    expect(routeNames.join(' ')).not.toContain('Colorado');
    expect(routeNames.join(' ')).not.toContain('Dinosaur');
  });
});

async function importAndPromoteAcadiaHighlights() {
  const normalized = normalizeSourcePoiRecords(
    acadiaSource.records,
    { sourceSystem: acadiaSource.sourceSystem, sourceDatabase: acadiaSource.sourceDatabase }
  );
  await importCandidateHighlights(db, normalized.candidates, normalized);

  for (const promotion of acadiaPromotions) {
    await promoteCandidateHighlight(db, promotion.candidateHighlightId, promotion.review as PromotionReview);
  }
}

async function requiredRoutingPlace(searchLabel: string) {
  const place = await findRoutingPlaceBySearchLabel(searchLabel);
  if (!place) throw new Error(`Missing Routing Place: ${searchLabel}`);
  return place;
}

function leg(from: RoutingPlace, to: RoutingPlace): Leg {
  return {
    id: `${from.id}-${to.id}`,
    from: stop('from-stop', from, 1),
    to: stop('to-stop', to, 2)
  };
}

function stop(id: string, routingPlace: RoutingPlace, position: number): TripStop {
  return {
    id,
    tripId: 'trip',
    position,
    details: '',
    routingPlace
  };
}
