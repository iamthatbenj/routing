<script lang="ts">
  import './+page.css';
  import MapShell from '$lib/components/MapShell.svelte';

  let { data, form } = $props();
  let mapLeg = $derived(data.legs.find((leg) => leg.routeSearch?.options.length));
  let selectedMapRouteId = $state<string | undefined>();

  $effect(() => {
    const routeOptions = mapLeg?.routeSearch?.options ?? [];
    if (routeOptions.length === 0) {
      selectedMapRouteId = undefined;
      return;
    }

    if (!selectedMapRouteId || !routeOptions.some((option) => option.id === selectedMapRouteId)) {
      selectedMapRouteId = routeOptions.find((option) => option.source !== 'ors-fastest')?.id ?? routeOptions[0]?.id;
    }
  });

  function selectMapRoute(routeId: string) {
    selectedMapRouteId = routeId;
    document.getElementById(`route-option-${routeId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function handleRouteCardKeydown(event: KeyboardEvent, routeId: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectMapRoute(routeId);
    }
  }

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
    if (source === 'ors-fastest') return 'Fastest baseline';
    if (source === 'ors-anchor') return 'Anchor-generated Interesting Route';
    if (source === 'fallback-direct') return 'Approximate fallback Corridor';
    if (source === 'fallback-anchor') return 'Approximate fallback Anchor Corridor';
    return 'Route Option';
  }

  function isFallbackRoute(source: string) {
    return source.startsWith('fallback-');
  }

  function anchorLabel(option: { source: string; name: string }) {
    if (option.source === 'ors-anchor' && option.name.startsWith('Via ')) return option.name.replace(/^Via /, '').trim();
    if (option.source === 'fallback-anchor' && option.name.startsWith('Approximate via ')) return option.name.replace(/^Approximate via /, '').trim();
    return '';
  }

  function formatScoreImpact(value: number) {
    return `+${Math.round(value)}`;
  }

  function formatPenalty(value: number) {
    const rounded = Math.round(value);
    return rounded > 0 ? `-${rounded}` : '0';
  }

  function shapingStopCountLabel(count: number) {
    return `${count} Shaping Stop${count === 1 ? '' : 's'}`;
  }

  function diagnosticOutcomeLabel(outcome: string) {
    if (outcome === 'fallback_complete') return 'fallback complete';
    return outcome.replaceAll('_', ' ');
  }

  function savedRouteForOption(leg: { savedRoutes: Array<{ routeOptionId: string | null; isPreferred: boolean }> }, routeOptionId: string) {
    return leg.savedRoutes.find((savedRoute) => savedRoute.routeOptionId === routeOptionId);
  }
</script>

<svelte:head>
  <title>{data.trip.title} — Routing</title>
  <meta name="description" content="Edit an anonymous Trip in Routing." />
</svelte:head>

<main class="trip-page">
  <section class="trip-card" aria-labelledby="trip-title">
    <p class="eyebrow">Private edit link</p>
    <h1 id="trip-title">{data.trip.title}</h1>
    <p>
      This Trip was loaded from a long, unguessable edit token. Keep this link private; anyone
      with it can edit this Trip.
    </p>

    <div class="meta-grid" aria-label="Trip metadata">
      <div>
        <span>Trip</span>
        <strong>{data.trip.id}</strong>
      </div>
      <div>
        <span>Updated</span>
        <strong>{new Date(data.trip.updatedAt).toLocaleString()}</strong>
      </div>
    </div>

    <div class="actions">
      <a class="primary" href="/">Back to planner</a>
      <a class="secondary" href={data.shareUrl}>Open read-only share link</a>
    </div>

    <div class="share-link-card" aria-label="Read-only share link">
      <span>Read-only share link</span>
      <p>Anyone with this link can view the Trip context, but they cannot edit this private Trip.</p>
      <code>{data.shareUrl}</code>
    </div>
  </section>

  <section class="planner" aria-labelledby="trip-stops-heading">
    <div class="section-heading">
      <p class="eyebrow">Trip Stops</p>
      <h2 id="trip-stops-heading">Build the Denver → Moab Leg</h2>
      <p>
        Add Routing Places from the app-owned gazetteer. Adjacent Trip Stops automatically form
        Legs for route comparison.
      </p>
    </div>

    {#if form?.message}
      <p class="form-error" role="alert">{form.message}</p>
    {/if}

    <form class="add-stop" method="POST" action="?/addStop">
      <label for="routing-place">Routing Place</label>
      <input
        id="routing-place"
        name="routingPlace"
        list="routing-places"
        placeholder="Try Denver, Colorado"
        autocomplete="off"
      />
      <datalist id="routing-places">
        {#each data.routingPlaces as place}
          <option value={place.searchLabel}>{place.kind}</option>
        {/each}
      </datalist>

      <label for="stop-details">Stop details</label>
      <input id="stop-details" name="details" placeholder="Optional lodging area or notes" />

      <button class="primary" type="submit">Add Trip Stop</button>
    </form>

    {#if data.stops.length === 0}
      <div class="empty-state">
        <strong>No Trip Stops yet</strong>
        <p>Add Denver, then Moab, to create the first Leg.</p>
      </div>
    {:else}
      <ol class="stops" aria-label="Trip Stops">
        {#each data.stops as stop, index}
          <li>
            <span class="stop-index">{index + 1}</span>
            <div class="stop-copy">
              <strong>{stop.routingPlace.name}</strong>
              <p>{stop.routingPlace.region} · {stop.routingPlace.kind.replaceAll('_', ' ')}</p>
              {#if stop.details}
                <p>{stop.details}</p>
              {/if}
            </div>
            <form class="reorder" method="POST" action="?/moveStop" aria-label={`Reorder ${stop.routingPlace.name}`}>
              <input type="hidden" name="stopId" value={stop.id} />
              <button type="submit" name="direction" value="up" disabled={index === 0}>↑</button>
              <button type="submit" name="direction" value="down" disabled={index === data.stops.length - 1}>↓</button>
            </form>
          </li>
        {/each}
      </ol>
    {/if}
  </section>

  <section class="legs" aria-labelledby="legs-heading">
    <div class="section-heading">
      <p class="eyebrow">Legs</p>
      <h2 id="legs-heading">Derived from adjacent Trip Stops</h2>
    </div>

    {#if data.legs.length === 0}
      <div class="empty-state">
        <strong>No Leg yet</strong>
        <p>Add at least two Trip Stops to derive the first Leg.</p>
      </div>
    {:else}
      <div class="leg-list">
        {#each data.legs as leg}
          <article class="leg-card">
            <span>{leg.routeSearch ? `Route Search ${leg.routeSearch.status}` : 'Ready for Route Search'}</span>
            <h3>{leg.from.routingPlace.name} → {leg.to.routingPlace.name}</h3>
            <p>
              Compare real route geometry from OpenRouteService. Balanced is the default Directness
              for this tracer bullet.
            </p>

            <form class="route-search-form" method="POST" action="?/startRouteSearch">
              <input type="hidden" name="fromStopId" value={leg.from.id} />
              <input type="hidden" name="toStopId" value={leg.to.id} />
              <label for={`directness-${leg.id}`}>Directness</label>
              <select id={`directness-${leg.id}`} name="directness">
                <option>Direct</option>
                <option selected>Balanced</option>
                <option>Adventurous</option>
              </select>
              <button class="primary" type="submit">Compare Route Options</button>
            </form>

            {#if leg.routeSearch?.status === 'failed'}
              <p class="route-error">{leg.routeSearch.errorMessage}</p>
            {/if}

            {#if leg.routeSearch}
              <details class="route-diagnostics">
                <summary>Route Search diagnostics</summary>
                <dl>
                  <div>
                    <dt>Provider</dt>
                    <dd>{leg.routeSearch.diagnostics.provider}</dd>
                  </div>
                  <div>
                    <dt>Outcome</dt>
                    <dd>{diagnosticOutcomeLabel(leg.routeSearch.diagnostics.outcome)}</dd>
                  </div>
                  <div>
                    <dt>Options</dt>
                    <dd>{leg.routeSearch.diagnostics.optionCount}</dd>
                  </div>
                  <div>
                    <dt>Sources</dt>
                    <dd>{leg.routeSearch.diagnostics.routeSources.join(', ') || 'none'}</dd>
                  </div>
                  {#if leg.routeSearch.diagnostics.errorCategory}
                    <div>
                      <dt>Error category</dt>
                      <dd>{leg.routeSearch.diagnostics.errorCategory}</dd>
                    </div>
                  {/if}
                  {#if leg.routeSearch.diagnostics.errorStatus}
                    <div>
                      <dt>Provider status</dt>
                      <dd>{leg.routeSearch.diagnostics.errorStatus}</dd>
                    </div>
                  {/if}
                </dl>
              </details>
            {/if}

            {#if leg.savedRoutes.length}
              <section class="saved-routes" aria-label="Saved Routes">
                <h4>Saved Routes</h4>
                <div class="saved-route-list">
                  {#each leg.savedRoutes as savedRoute}
                    <article class:preferred={savedRoute.isPreferred} class="saved-route-card">
                      <div class="saved-route-heading">
                        <div>
                          <span>{savedRoute.isPreferred ? 'Preferred Saved Route' : 'Saved Route'}</span>
                          <strong>{savedRoute.title}</strong>
                          <small>Original Route Option: {savedRoute.snapshot.name}</small>
                        </div>
                        {#if savedRoute.isPreferred}
                          <em>Preferred</em>
                        {/if}
                      </div>
                      <p class="route-origin">
                        {#if anchorLabel(savedRoute.snapshot)}
                          Anchor-generated Corridor via {anchorLabel(savedRoute.snapshot)}
                        {:else if savedRoute.snapshot.source === 'ors-fastest'}
                          Fastest baseline Corridor
                        {:else}
                          {routeKind(savedRoute.snapshot.source)} Corridor
                        {/if}
                      </p>
                      <form class="rename-route-form" method="POST" action="?/renameSavedRoute" aria-label={`Rename ${savedRoute.title}`}>
                        <input type="hidden" name="savedRouteId" value={savedRoute.id} />
                        <label for={`rename-${savedRoute.id}`}>Rename Saved Route</label>
                        <div>
                          <input id={`rename-${savedRoute.id}`} name="title" value={savedRoute.title} maxlength="90" />
                          <button class="save-route" type="submit">Rename</button>
                        </div>
                      </form>
                      <dl class="saved-route-facts">
                        <div>
                          <dt>Score</dt>
                          <dd>{savedRoute.snapshot.interestScore}</dd>
                        </div>
                        <div>
                          <dt>Time</dt>
                          <dd>{formatDuration(savedRoute.snapshot.durationSeconds)}</dd>
                        </div>
                        <div>
                          <dt>Distance</dt>
                          <dd>{formatDistance(savedRoute.snapshot.distanceMeters)}</dd>
                        </div>
                        <div>
                          <dt>Handoff</dt>
                          <dd>{shapingStopCountLabel(savedRoute.snapshot.handoffStops.length)}</dd>
                        </div>
                      </dl>
                      <div class="saved-route-actions">
                        {#if savedRoute.isPreferred}
                          <a class="save-route" href={`/trips/edit/${data.editToken}/handoff/${savedRoute.id}`}>Open Leg Handoff</a>
                        {:else}
                          <form method="POST" action="?/preferSavedRoute">
                            <input type="hidden" name="savedRouteId" value={savedRoute.id} />
                            <button class="save-route" type="submit">Use as Preferred Saved Route</button>
                          </form>
                        {/if}
                        <form method="POST" action="?/deleteSavedRoute">
                          <input type="hidden" name="savedRouteId" value={savedRoute.id} />
                          <button class="delete-route" type="submit">Delete Saved Route</button>
                        </form>
                      </div>
                    </article>
                  {/each}
                </div>
              </section>
            {/if}

            {#if leg.routeSearch?.options.length}
              <div class="route-options">
                {#each leg.routeSearch.options as option}
                  <section
                    id={`route-option-${option.id}`}
                    class:baseline={option.source === 'ors-fastest'}
                    class:selected={option.id === selectedMapRouteId}
                    class="route-option-card"
                    role="button"
                    tabindex="0"
                    onclick={() => selectMapRoute(option.id)}
                    onkeydown={(event) => handleRouteCardKeydown(event, option.id)}
                  >
                    <div class="route-option-heading">
                      <div>
                        <span>{routeKind(option.source)}</span>
                        <h4>{option.name}</h4>
                        {#if anchorLabel(option)}
                          <p class="route-origin">Anchor: {anchorLabel(option)}</p>
                        {:else if option.source === 'ors-fastest'}
                          <p class="route-origin">Baseline Corridor for comparison</p>
                        {:else if isFallbackRoute(option.source)}
                          <p class="route-origin">Provider unavailable · approximate planning geometry only</p>
                        {/if}
                        {#if savedRouteForOption(leg, option.id)?.isPreferred}
                          <p class="route-saved-status preferred">Already saved as Preferred Saved Route</p>
                        {:else if savedRouteForOption(leg, option.id)}
                          <p class="route-saved-status">Already saved</p>
                        {/if}
                      </div>
                      <strong class="score">{option.interestScore}</strong>
                    </div>
                    <dl>
                      <div>
                        <dt>Time</dt>
                        <dd>{formatDuration(option.durationSeconds)}</dd>
                      </div>
                      <div>
                        <dt>Distance</dt>
                        <dd>{formatDistance(option.distanceMeters)}</dd>
                      </div>
                    </dl>
                    {#if option.reasons.length}
                      <section class="score-breakdown" aria-label={`Interest Score breakdown for ${option.name}`}>
                        <h5>Interest Score breakdown</h5>
                        <ul>
                          {#each option.reasons as reason}
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
                                <span>Destination context</span>
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
                    {:else if option.explanations.length}
                      <ul class="explanations">
                        {#each option.explanations as explanation}
                          <li>{explanation}</li>
                        {/each}
                      </ul>
                    {/if}
                    {#if isFallbackRoute(option.source)}
                      <p class="fallback-save-note">Approximate fallback Corridors cannot be saved for navigation Handoff.</p>
                    {:else}
                      <form method="POST" action="?/saveRoute">
                        <input type="hidden" name="fromStopId" value={leg.from.id} />
                        <input type="hidden" name="toStopId" value={leg.to.id} />
                        <input type="hidden" name="routeSearchId" value={leg.routeSearch.id} />
                        <input type="hidden" name="routeOptionId" value={option.id} />
                        <button class="save-route" type="submit">Save Route</button>
                      </form>
                    {/if}
                  </section>
                {/each}
              </div>
            {/if}

          </article>
        {/each}
      </div>
    {/if}
  </section>

  <section class="map-panel" aria-labelledby="map-heading">
    <div class="section-heading">
      <p class="eyebrow">Map preview</p>
      <h2 id="map-heading">Corridors will land here</h2>
      <p>
        This MapLibre foundation keeps the Trip page card-first while making room for TB2 route
        geometry, Highlights, and Shaping Stops.
      </p>
    </div>
    {#if mapLeg}
      <MapShell
        label={`${mapLeg.from.routingPlace.name} to ${mapLeg.to.routingPlace.name} Leg comparison map`}
        routeOptions={mapLeg.routeSearch?.options ?? []}
        selectedRouteId={selectedMapRouteId}
        highlights={data.highlights}
        onRouteSelect={selectMapRoute}
      />
    {:else}
      <MapShell label="Leg comparison map preview" highlights={data.highlights} />
    {/if}
    <p class="map-attribution-note">
      Map style comes from <code>PUBLIC_MAP_STYLE_URL</code>. Check provider attribution and terms before production use.
    </p>
  </section>
</main>
