<script lang="ts">
  let { data, form } = $props();
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
      <button class="secondary" type="button" disabled>Read-only share link coming next</button>
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
            <span>Ready for Route Search</span>
            <h3>{leg.from.routingPlace.name} → {leg.to.routingPlace.name}</h3>
            <p>
              TB1.04 will compare Route Options for this Leg using a real external routing provider.
            </p>
          </article>
        {/each}
      </div>
    {/if}
  </section>
</main>
