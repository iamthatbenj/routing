import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const travelerFacingFiles = [
  'src/routes/+page.svelte',
  'src/routes/trips/edit/[token]/+page.svelte',
  'src/routes/trips/share/[token]/+page.svelte',
  'src/routes/trips/edit/[token]/handoff/[savedRouteId]/+page.svelte',
  'src/lib/leg-handoff.ts',
  'src/lib/server/route-searches.ts'
];

describe('traveler-facing domain copy', () => {
  it('does not use itinerary language in visible Trip summaries', () => {
    const text = readTravelerFacingText();

    expect(text).not.toMatch(/Trip itinerary/i);
    expect(text).not.toMatch(/Shared Trip itinerary/i);
    expect(text).not.toMatch(/Whole Trip itinerary/i);
  });

  it('uses Endpoint context for route explanation copy', () => {
    const text = readTravelerFacingText();

    expect(text).not.toContain('Destination context');
    expect(text).toContain('Endpoint context');
  });

  it('uses Leg Handoff for app-owned handoff copy', () => {
    const text = readTravelerFacingText();

    expect(text).not.toContain('Navigation Handoff');
    expect(text).not.toContain('navigation handoff');
    expect(text).toContain('Leg Handoff');
  });

  it('qualifies external provider waypoint language', () => {
    const text = readTravelerFacingText();

    expect(text).not.toContain(' as waypoints');
    expect(text).toContain('provider waypoints');
  });
});

function readTravelerFacingText() {
  return travelerFacingFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
}
