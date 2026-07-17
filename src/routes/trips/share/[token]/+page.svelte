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

  function routeKind(source: string) {
    return source === 'ors-fastest' ? 'Fastest baseline Corridor' : source === 'ors-anchor' ? 'Anchor-generated Interesting Route' : 'Route Option Corridor';
  }

  function anchorLabel(route: { source: string; name: string }) {
    return route.source === 'ors-anchor' && route.name.startsWith('Via ') ? route.name.replace(/^Via /, '').trim() : '';
  }

  function shapingStopCountLabel(count: number) {
    return `${count} Shaping Stop${count === 1 ? '' : 's'}`;
  }

  function isConstrainedRoute(route: { snapshot: { directnessConstraint?: { status?: string } } }) {
    return route.snapshot.directnessConstraint?.status === 'constrained';
  }

  function legStatus(leg: { preferredSavedRoute: null | { title: string } }) {
    return leg.preferredSavedRoute ? leg.preferredSavedRoute.title : 'No Preferred Saved Route selected yet';
  }
</script>

<svelte:head>
  <title>{data.trip.title} — Shared Trip</title>
</svelte:head>

<main class="share-page">
  <section class="hero" aria-labelledby="share-title">
    <p class="eyebrow">Read-only shared Trip</p>
    <h1 id="share-title">{data.trip.title}</h1>
    <p>
      This is a read-only Trip share link. You can review the Trip context and Preferred Saved
      Routes, but you cannot edit Trip Stops or change Saved Routes from here.
    </p>
    <a href="/">Back to Routing home</a>
  </section>

  {#if data.stops.length >= 2}
    <section class="share-card share-summary" aria-labelledby="share-summary-heading">
      <p class="eyebrow">Trip summary</p>
      <h2 id="share-summary-heading">Whole Trip at a glance</h2>
      <ol class="trip-summary-list" aria-label="Shared Trip summary">
        {#each data.stops as stop, index}
          <li class="trip-summary-stop">
            <span class="trip-summary-index">Stop {index + 1}</span>
            <strong>{stop.routingPlace.name}</strong>
            <small>{stop.routingPlace.region} · {stop.routingPlace.kind.replaceAll('_', ' ')}</small>
            {#if stop.details}
              <p>{stop.details}</p>
            {/if}
          </li>
          {#if index < data.legs.length}
            {@const leg = data.legs[index]}
            <li class:missing={!leg.preferredSavedRoute} class="trip-summary-leg">
              <span class="trip-summary-index">Leg {index + 1}</span>
              <div>
                <strong>{leg.from.routingPlace.name} → {leg.to.routingPlace.name}</strong>
                <ul class="trip-summary-leg-stops" aria-label={`Stop details for shared Leg ${index + 1}`}>
                  <li>
                    <span>From</span>
                    <p>{leg.from.routingPlace.region}{leg.from.details ? ` · ${leg.from.details}` : ''}</p>
                  </li>
                  <li>
                    <span>To</span>
                    <p>{leg.to.routingPlace.region}{leg.to.details ? ` · ${leg.to.details}` : ''}</p>
                  </li>
                </ul>
                {#if leg.preferredSavedRoute}
                  <p>{leg.preferredSavedRoute.title}</p>
                  <small>{formatDuration(leg.preferredSavedRoute.snapshot.durationSeconds)} · {formatDistance(leg.preferredSavedRoute.snapshot.distanceMeters)}</small>
                {:else}
                  <p>No Preferred Saved Route selected yet.</p>
                  <small>This Leg is visible, but no route has been chosen for sharing.</small>
                {/if}
              </div>
              {#if leg.preferredSavedRoute}
                <a href={`#shared-leg-${leg.id}`}>View Leg</a>
              {/if}
            </li>
          {/if}
        {/each}
      </ol>
    </section>
  {/if}

  <section class="share-card share-stops" aria-labelledby="stops-heading">
    <p class="eyebrow">Trip Stops</p>
    <h2 id="stops-heading">Stops in order</h2>
    {#if data.stops.length}
      <ol class="stops">
        {#each data.stops as stop, index}
          <li>
            <span class="stop-index">{index + 1}</span>
            <div>
              <strong>{stop.routingPlace.name}</strong>
              <p>{stop.routingPlace.region} · {stop.routingPlace.kind.replaceAll('_', ' ')}</p>
              {#if stop.details}
                <p>{stop.details}</p>
              {/if}
            </div>
          </li>
        {/each}
      </ol>
    {:else}
      <p>No Trip Stops have been added yet.</p>
    {/if}
  </section>

  <section class="share-card share-legs" aria-labelledby="legs-heading">
    <p class="eyebrow">Legs</p>
    <h2 id="legs-heading">Preferred Saved Routes</h2>
    {#if data.legs.length}
      <div class="leg-list">
        {#each data.legs as leg, index}
          <article class="leg-card" id={`shared-leg-${leg.id}`}>
            <p class="eyebrow">Leg {index + 1} · {legStatus(leg)}</p>
            <h3>{leg.from.routingPlace.name} → {leg.to.routingPlace.name}</h3>
            {#if leg.preferredSavedRoute}
              <article class="saved-route-card">
                <div class="saved-route-heading">
                  <div>
                    <span>Preferred Saved Route</span>
                    <strong>{leg.preferredSavedRoute.title}</strong>
                    <small>Original Route Option: {leg.preferredSavedRoute.snapshot.name}</small>
                  </div>
                </div>
                {#if isConstrainedRoute(leg.preferredSavedRoute)}
                  <p class="constraint-note"><strong>Constrained Route Option</strong>: {leg.preferredSavedRoute.snapshot.directnessConstraint.reason}</p>
                {/if}
                <p class="route-origin">
                  {#if anchorLabel(leg.preferredSavedRoute.snapshot)}
                    Anchor-generated Corridor via {anchorLabel(leg.preferredSavedRoute.snapshot)}
                  {:else}
                    {routeKind(leg.preferredSavedRoute.snapshot.source)}
                  {/if}
                </p>
                {#if leg.mapRouteOption}
                  <div class="share-map-card">
                    <MapShell
                      label={`${leg.from.routingPlace.name} to ${leg.to.routingPlace.name} shared Preferred Saved Route map`}
                      routeOptions={[leg.mapRouteOption]}
                      selectedRouteId={leg.mapRouteOption.id}
                      stops={leg.mapStops}
                      highlights={data.highlights}
                    />
                  </div>
                {/if}
                <section class="handoff-context" aria-label={`Leg Handoff context for ${leg.preferredSavedRoute.title}`}>
                  <p class="eyebrow">Leg Handoff</p>
                  <h4>Open this Preferred Saved Route</h4>
                  <p>{leg.geometryWarning}</p>
                  <div class="button-row">
                    <a class="primary-link" href={leg.googleMapsUrl} target="_blank" rel="noreferrer">Google Maps with Shaping Stops</a>
                    <a class="secondary-link" href={leg.appleMapsUrl} target="_blank" rel="noreferrer">Apple Maps Endpoints only</a>
                  </div>
                  {#if leg.preferredSavedRoute.snapshot.handoffStops.length}
                    <p>
                      Google Maps receives the Shaping Stops as provider waypoints. Apple Maps web links do
                      not reliably support intermediate stops, so the Apple Maps link opens Endpoints only.
                    </p>
                  {/if}
                </section>
                <dl class="saved-route-facts">
                  <div>
                    <dt>Score</dt>
                    <dd>{leg.preferredSavedRoute.snapshot.interestScore}</dd>
                  </div>
                  <div>
                    <dt>Time</dt>
                    <dd>{formatDuration(leg.preferredSavedRoute.snapshot.durationSeconds)}</dd>
                  </div>
                  <div>
                    <dt>Distance</dt>
                    <dd>{formatDistance(leg.preferredSavedRoute.snapshot.distanceMeters)}</dd>
                  </div>
                  <div>
                    <dt>Leg Handoff</dt>
                    <dd>{shapingStopCountLabel(leg.preferredSavedRoute.snapshot.handoffStops.length)}</dd>
                  </div>
                </dl>
              </article>
            {:else}
              <p>No Preferred Saved Route has been chosen for this Leg yet.</p>
            {/if}
          </article>
        {/each}
      </div>
    {:else}
      <p>Add at least two Trip Stops before this shared Trip has Legs.</p>
    {/if}
  </section>
</main>
