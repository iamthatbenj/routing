export type RouteReason =
  | { kind: 'anchor'; label: string }
  | { kind: 'highlight'; label: string; category: string; visitEffort: string; scoreImpact: number }
  | { kind: 'tradeoff'; extraSeconds: number; directness: string; penalty: number }
  | { kind: 'endpoint_context'; labels: string[] };

export function parseRouteReasons(value: string | null | undefined): RouteReason[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRouteReason);
  } catch {
    return [];
  }
}

function isRouteReason(value: unknown): value is RouteReason {
  if (!value || typeof value !== 'object') return false;
  const reason = value as Record<string, unknown>;

  if (reason.kind === 'anchor') {
    return typeof reason.label === 'string' && reason.label.length > 0;
  }

  if (reason.kind === 'highlight') {
    return (
      typeof reason.label === 'string' &&
      typeof reason.category === 'string' &&
      typeof reason.visitEffort === 'string' &&
      typeof reason.scoreImpact === 'number'
    );
  }

  if (reason.kind === 'tradeoff') {
    return typeof reason.extraSeconds === 'number' && typeof reason.directness === 'string' && typeof reason.penalty === 'number';
  }

  if (reason.kind === 'endpoint_context') {
    return Array.isArray(reason.labels) && reason.labels.every((label) => typeof label === 'string');
  }

  return false;
}
