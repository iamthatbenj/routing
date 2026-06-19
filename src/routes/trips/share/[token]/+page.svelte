<script lang="ts">
  import './+page.css';

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
    <a href="/">Back to planner</a>
  </section>

  <section class="share-card" aria-labelledby="stops-heading">
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

  <section class="share-card" aria-labelledby="legs-heading">
    <p class="eyebrow">Legs</p>
    <h2 id="legs-heading">Preferred Saved Routes</h2>
    {#if data.legs.length}
      <div class="leg-list">
        {#each data.legs as leg}
          <article class="leg-card">
            <p class="eyebrow">Leg</p>
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
                <p class="route-origin">
                  {#if anchorLabel(leg.preferredSavedRoute.snapshot)}
                    Anchor-generated Corridor via {anchorLabel(leg.preferredSavedRoute.snapshot)}
                  {:else}
                    {routeKind(leg.preferredSavedRoute.snapshot.source)}
                  {/if}
                </p>
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
                    <dt>Handoff</dt>
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
