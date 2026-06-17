import { describe, expect, it } from 'vitest';
import { parseRouteReasons } from './route-reasons';

describe('parseRouteReasons', () => {
  it('defaults existing rows without structured reasons to an empty list', () => {
    expect(parseRouteReasons(null)).toEqual([]);
    expect(parseRouteReasons('')).toEqual([]);
    expect(parseRouteReasons('not json')).toEqual([]);
  });

  it('keeps valid structured reasons', () => {
    const reasons = parseRouteReasons(
      JSON.stringify([
        { kind: 'anchor', label: 'Colorado National Monument, Colorado' },
        { kind: 'highlight', label: 'Glenwood Canyon', category: 'scenic_segment', visitEffort: 'Quick Stop', scoreImpact: 80.5 },
        { kind: 'tradeoff', extraSeconds: 3600, directness: 'Balanced', penalty: 10 },
        { kind: 'endpoint_context', labels: ['Arches National Park'] }
      ])
    );

    expect(reasons).toHaveLength(4);
    expect(reasons[0]).toMatchObject({ kind: 'anchor', label: 'Colorado National Monument, Colorado' });
  });

  it('filters malformed reasons without breaking old UI', () => {
    const reasons = parseRouteReasons(JSON.stringify([{ kind: 'anchor' }, { kind: 'tradeoff', extraSeconds: 10, directness: 'Balanced', penalty: 1 }]));

    expect(reasons).toEqual([{ kind: 'tradeoff', extraSeconds: 10, directness: 'Balanced', penalty: 1 }]);
  });
});
