<script lang="ts">
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
      <a class="secondary" href={data.appleMapsUrl} target="_blank" rel="noreferrer">Apple Maps endpoints only</a>
    </div>
    {#if data.savedRoute.snapshot.handoffStops.length}
      <p>
        Google Maps receives the Shaping Stops as waypoints. Apple Maps web links do not reliably
        support intermediate stops, so this Apple Maps link opens endpoints only.
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

  <section class="handoff-card" aria-labelledby="context-heading">
    <p class="eyebrow">App context link</p>
    <h2 id="context-heading">Share route context</h2>
    <p>
      This page preserves why the Leg was chosen. Copy the URL from your browser to share this
      context with other travelers.
    </p>
    <code>{data.appContextUrl}</code>
  </section>

  <section class="handoff-card" aria-labelledby="summary-heading">
    <p class="eyebrow">Preferred Saved Route</p>
    <h2 id="summary-heading">{data.savedRoute.title}</h2>
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

    {#if data.savedRoute.snapshot.explanations.length}
      <ul>
        {#each data.savedRoute.snapshot.explanations as explanation}
          <li>{explanation}</li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="handoff-card" aria-labelledby="shaping-heading">
    <p class="eyebrow">Shaping Stops</p>
    <h2 id="shaping-heading">
      {data.savedRoute.snapshot.handoffStops.length ? 'Included in the navigation handoff' : 'No Shaping Stops yet'}
    </h2>
    {#if data.savedRoute.snapshot.handoffStops.length}
      <p>
        These visible Shaping Stops are included where the navigation app supports waypoints. Remove
        or change them in the navigation app if they do not match your plan.
      </p>
      <ol>
        {#each data.savedRoute.snapshot.handoffStops as stop}
          <li>{stop.displayLabel ?? stop.label}</li>
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
