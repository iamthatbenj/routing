import { describe, expect, it } from 'vitest';
import { relevantHighlightNamesFromReasons, relevantHighlightNamesFromRouteOptions } from './route-highlight-relevance';

describe('Route Highlight relevance', () => {
  it('collects Anchor, Highlight, Scenic Segment, and endpoint-context labels from structured reasons', () => {
    expect(
      relevantHighlightNamesFromReasons([
        { kind: 'anchor', label: 'Park Loop Road' },
        { kind: 'highlight', label: 'Cadillac Mountain', category: 'nature', visitEffort: 'Short Visit', scoreImpact: 94 },
        { kind: 'highlight', label: 'Park Loop Road', category: 'scenic_segment', visitEffort: 'Half Day', scoreImpact: 103.5 },
        { kind: 'endpoint_context', labels: ['Bar Harbor Shoreline Context'] },
        { kind: 'tradeoff', extraSeconds: 1200, directness: 'Balanced', penalty: 216 }
      ])
    ).toEqual(['Park Loop Road', 'Cadillac Mountain', 'Bar Harbor Shoreline Context']);
  });

  it('deduplicates relevant Highlight names across compared Route Options', () => {
    expect(
      relevantHighlightNamesFromRouteOptions([
        { reasons: [{ kind: 'anchor', label: 'Acadia National Park' }] },
        { reasons: [{ kind: 'highlight', label: 'Acadia National Park', category: 'nature', visitEffort: 'Full Day+', scoreImpact: 98 }] },
        { reasons: [{ kind: 'highlight', label: 'Thunder Hole', category: 'landmark', visitEffort: 'Quick Stop', scoreImpact: 78 }] }
      ])
    ).toEqual(['Acadia National Park', 'Thunder Hole']);
  });
});
