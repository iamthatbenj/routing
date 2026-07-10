<script lang="ts">
  import './+page.css';
  import MapShell from '$lib/components/MapShell.svelte';

  let { data } = $props();

  function formatDuration(seconds: number) {
    const totalMinutes = Math.round(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`;
  }

  function formatDistance(meters: number) {
    return `${Math.round(meters / 1609.344)} mi`;
  }

  function formatRouteFraction(routeFraction: number | undefined) {
    return typeof routeFraction === 'number' ? `${Math.round(routeFraction * 100)}% along route` : 'Position unknown';
  }

  function formatCoordinate(value: number | undefined) {
    return typeof value === 'number' ? value.toFixed(5) : 'unknown';
  }

  function routeKind(source: string) {
    return source === 'ors-fastest' ? 'Fastest baseline Corridor' : source === 'ors-anchor' ? 'Anchor-generated Interesting Route' : 'Saved Route Corridor';
  }

  function anchorLabel(route: { source: string; name: string }) {
    return route.source === 'ors-anchor' && route.name.startsWith('Via ') ? route.name.replace(/^Via /, '').trim() : '';
  }

  function formatScoreImpact(value: number) {
    return `+${Math.round(value)}`;
  }

  function formatPenalty(value: number) {
    const rounded = Math.round(value);
    return rounded > 0 ? `-${rounded}` : '0';
  }
</script>

<svelte:head>
  <title>Leg Handoff — {data.savedRoute.title}</title>
  <meta name="description" content="Use a preferred Saved Route in an external navigation app." />
</svelte:head>

<main class="handoff-page">
  <section class="hero" aria-labelledby="handoff-title">
    <p class="eyebrow">Leg Handoff</p>
    <h1 id="handoff-title">{data.savedRoute.snapshot.endpoints.from} → {data.savedRoute.snapshot.endpoints.to}</h1>
    <p>
      Use this handoff to launch the preferred Saved Route in a navigation app while keeping this
      app's route context, Highlights, and warnings nearby.
    </p>
  </section>

  <section class="handoff-card handoff-map-card" aria-labelledby="handoff-map-heading">
    <p class="eyebrow">Route map</p>
    <h2 id="handoff-map-heading">Verify the handoff shape</h2>
    <MapShell
      label="Leg Handoff route map"
      routeOptions={[data.mapRouteOption]}
      selectedRouteId={data.mapRouteOption.id}
      stops={data.mapStops}
    />
  </section>

  <section class="handoff-card warning" aria-label="Route geometry warning">
    <p class="eyebrow">External navigation warning</p>
    <h2>Confirm the route before driving</h2>
    <p>{data.geometryWarning}</p>
  </section>

  <section class="handoff-card actions" aria-labelledby="nav-heading">
    <p class="eyebrow">Navigation links</p>
    <h2 id="nav-heading">Open in your navigation app</h2>
    <div class="button-row">
      <a class="primary" href={data.googleMapsUrl} target="_blank" rel="noreferrer">Google Maps with Shaping Stops</a>
      <a class="secondary" href={data.appleMapsUrl} target="_blank" rel="noreferrer">Apple Maps Endpoints only</a>
    </div>
    {#if data.savedRoute.snapshot.handoffStops.length}
      <p>
        Google Maps receives the Shaping Stops as provider waypoints. Apple Maps web links do not reliably
        support intermediate stops, so this Apple Maps link opens Endpoints only.
      </p>
      <ol class="manual-stops" aria-label="Stops to add manually in Apple Maps">
        <li>{data.savedRoute.snapshot.endpoints.from}</li>
        {#each data.savedRoute.snapshot.handoffStops as stop}
          <li>{stop.displayLabel ?? stop.label}</li>
        {/each}
        <li>{data.savedRoute.snapshot.endpoints.to}</li>
      </ol>
    {/if}
  </section>

  <section class="handoff-card context-card" aria-labelledby="context-heading">
    <p class="eyebrow">App context link</p>
    <h2 id="context-heading">Share route context</h2>
    <p>
      This page preserves why the Leg was chosen. Copy the URL from your browser to share this
      context with other travelers.
    </p>
    <code>{data.appContextUrl}</code>
  </section>

  <section class="handoff-card summary-card" aria-labelledby="summary-heading">
    <p class="eyebrow">Preferred Saved Route</p>
    <h2 id="summary-heading">{data.savedRoute.title}</h2>
    <p class="route-origin">{routeKind(data.savedRoute.snapshot.source)}</p>
    {#if anchorLabel(data.savedRoute.snapshot)}
      <p>This Interesting Route was generated through the Anchor: <strong>{anchorLabel(data.savedRoute.snapshot)}</strong>.</p>
    {/if}
    <dl>
      <div>
        <dt>Directness</dt>
        <dd>{data.savedRoute.snapshot.directness}</dd>
      </div>
      <div>
        <dt>Time</dt>
        <dd>{formatDuration(data.savedRoute.snapshot.durationSeconds)}</dd>
      </div>
      <div>
        <dt>Distance</dt>
        <dd>{formatDistance(data.savedRoute.snapshot.distanceMeters)}</dd>
      </div>
      <div>
        <dt>Interest Score</dt>
        <dd>{data.savedRoute.snapshot.interestScore}</dd>
      </div>
    </dl>

    {#if data.savedRoute.snapshot.reasons.length}
      <section class="score-breakdown" aria-label="Interest Score breakdown">
        <h3>Interest Score breakdown</h3>
        <ul>
          {#each data.savedRoute.snapshot.reasons as reason}
            {#if reason.kind === 'highlight'}
              <li>
                <span>{reason.category === 'scenic_segment' ? 'Scenic Segment' : 'Highlight'}</span>
                <strong>{formatScoreImpact(reason.scoreImpact)}</strong>
                <p>{reason.label} · {reason.visitEffort}</p>
              </li>
            {:else if reason.kind === 'tradeoff'}
              <li>
                <span>Directness tradeoff</span>
                <strong>{formatPenalty(reason.penalty)}</strong>
                <p>{reason.extraSeconds > 0 ? `${formatDuration(reason.extraSeconds)} slower · ${reason.directness}` : `Fastest baseline · ${reason.directness}`}</p>
              </li>
            {:else if reason.kind === 'endpoint_context'}
              <li class="context-only">
                <span>Endpoint context</span>
                <strong>Not scored</strong>
                <p>{reason.labels.slice(0, 2).join(', ')}</p>
              </li>
            {:else if reason.kind === 'anchor'}
              <li>
                <span>Anchor</span>
                <strong>Corridor</strong>
                <p>{reason.label}</p>
              </li>
            {/if}
          {/each}
        </ul>
      </section>
    {:else if data.savedRoute.snapshot.explanations.length}
      <ul>
        {#each data.savedRoute.snapshot.explanations as explanation}
          <li>{explanation}</li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="handoff-card shaping-card" aria-labelledby="shaping-heading">
    <p class="eyebrow">Shaping Stops</p>
    <h2 id="shaping-heading">
      {data.savedRoute.snapshot.handoffStops.length ? 'Included in the Leg Handoff' : 'No Shaping Stops yet'}
    </h2>
    {#if data.savedRoute.snapshot.handoffStops.length}
      <p>
        These visible Shaping Stops are included where the navigation app supports provider waypoints. Remove
        or change them in the navigation app if they do not match your intended Corridor.
      </p>
      <ol class="shaping-diagnostics">
        {#each data.savedRoute.snapshot.handoffStops as stop, index}
          <li>
            <div class="stop-order">{index + 1}</div>
            <div class="stop-diagnostic-copy">
              <strong>{stop.displayLabel ?? `Shaping Stop ${index + 1}`}</strong>
              <span>{formatRouteFraction(stop.routeFraction)}</span>
              <code>{formatCoordinate(stop.latitude)}, {formatCoordinate(stop.longitude)}</code>
            </div>
          </li>
        {/each}
      </ol>
    {:else}
      <p>
        This handoff does not need a known Shaping Stop yet. Future Leg Handoffs will support more
        editable Shaping Stops when extra stops are needed to preserve the intended Corridor.
      </p>
    {/if}
  </section>
</main>
