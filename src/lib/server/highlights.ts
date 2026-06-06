import { db } from './db';

export type Highlight = {
  id: string;
  name: string;
  category: 'nature' | 'landmark' | 'food' | 'scenic_segment';
  latitude: number;
  longitude: number;
  strength: number;
  visitEffort: string;
  endpointContextPlaceId: string | null;
  description: string;
};

function rowToHighlight(row: Record<string, unknown>): Highlight {
  return {
    id: String(row.id),
    name: String(row.name),
    category: String(row.category) as Highlight['category'],
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    strength: Number(row.strength),
    visitEffort: String(row.visit_effort),
    endpointContextPlaceId: row.endpoint_context_place_id ? String(row.endpoint_context_place_id) : null,
    description: String(row.description ?? '')
  };
}

export async function listHighlights() {
  const result = await db.execute(`
    SELECT id, name, category, latitude, longitude, strength, visit_effort,
      endpoint_context_place_id, description
    FROM highlights
    ORDER BY strength DESC
  `);

  return result.rows.map(rowToHighlight);
}

export async function findHighlightsByH3Cells(cells: string[], resolution: number) {
  if (cells.length === 0) return [];

  const placeholders = cells.map(() => '?').join(', ');
  const result = await db.execute({
    sql: `
      SELECT DISTINCT
        highlights.id,
        highlights.name,
        highlights.category,
        highlights.latitude,
        highlights.longitude,
        highlights.strength,
        highlights.visit_effort,
        highlights.endpoint_context_place_id,
        highlights.description
      FROM highlights
      JOIN highlight_h3_cells ON highlight_h3_cells.highlight_id = highlights.id
      WHERE highlight_h3_cells.resolution = ?
        AND highlight_h3_cells.cell IN (${placeholders})
      ORDER BY highlights.strength DESC
    `,
    args: [resolution, ...cells]
  });

  return result.rows.map(rowToHighlight);
}
