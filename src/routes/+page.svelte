<script lang="ts">
  let { form } = $props();

  type TripStop = {
    name: string;
    detail: string;
  };

  type RouteOption = {
    name: string;
    badge: string;
    duration: string;
    delta: string;
    summary: string;
    highlights: string[];
  };

  const tripStops: TripStop[] = [
    { name: 'Denver', detail: 'Start from the city you are leaving.' },
    { name: 'Moab', detail: 'Add lodging or arrival notes later.' }
  ];

  const routeOptions: RouteOption[] = [
    {
      name: 'Fastest baseline',
      badge: 'Comparison',
      duration: '5 hr 35 min',
      delta: '+0 min',
      summary: 'A practical baseline for deciding whether a more interesting corridor is worth it.',
      highlights: ['Clear time comparison', 'Selectable later', 'No route personality yet']
    },
    {
      name: 'Balanced scenic corridor',
      badge: 'Recommended',
      duration: '6 hr 20 min',
      delta: '+45 min',
      summary: 'A placeholder Interesting Route card showing how the Denver → Moab Leg will be compared.',
      highlights: ['Glenwood Canyon', 'Colorado National Monument', 'Moab context']
    }
  ];
</script>

<svelte:head>
  <title>Routing — Trip-first route planning</title>
  <meta
    name="description"
    content="Plan Trips by comparing Interesting Routes between Routing Places."
  />
</svelte:head>

<main class="shell">
  <section class="hero" aria-labelledby="page-title">
    <p class="eyebrow">Tracer Bullet 1 · Denver to Moab</p>
    <div class="hero-copy">
      <h1 id="page-title">Plan the Trip first. Pick the interesting Leg next.</h1>
      <p>
        Routing helps travelers organize Trip Stops, compare Route Options for each Leg, and
        hand off the preferred Saved Route to a navigation app when it is time to drive.
      </p>
    </div>
    <form class="hero-actions" method="POST" action="?/createTrip" aria-label="Trip actions">
      <label class="sr-only" for="trip-title">Trip title</label>
      <input id="trip-title" name="title" value="Western parks sampler" />
      <button class="primary" type="submit">Create Trip</button>
      <a class="secondary" href="#open-edit-link">Open edit link</a>
      {#if form?.message}
        <p class="form-error">{form.message}</p>
      {/if}
    </form>
  </section>

  <section class="workspace" aria-label="Trip planning workspace">
    <article class="panel trip-panel">
      <div class="panel-heading">
        <p class="eyebrow">Trip</p>
        <h2>Western parks sampler</h2>
        <p>Anonymous Trip persistence lands next. This shell shows the mobile-first planning shape.</p>
      </div>

      <ol class="stops" aria-label="Trip Stops">
        {#each tripStops as stop, index}
          <li>
            <span class="stop-index">{index + 1}</span>
            <div>
              <strong>{stop.name}</strong>
              <p>{stop.detail}</p>
            </div>
          </li>
        {/each}
      </ol>

      <form class="stop-form" aria-label="Add a Trip Stop placeholder">
        <label for="routing-place">Add a Routing Place</label>
        <div>
          <input id="routing-place" value="" placeholder="Search cities and travel locales" disabled />
          <button type="button" disabled>Add</button>
        </div>
        <p>Autocomplete is intentionally app-owned, not general geocoding.</p>
      </form>
    </article>

    <article class="panel leg-panel">
      <div class="panel-heading horizontal">
        <div>
          <p class="eyebrow">Leg</p>
          <h2>Denver → Moab</h2>
          <p>Compare the fastest baseline against Interesting Route Options.</p>
        </div>
        <span class="status">Balanced</span>
      </div>

      <div class="directness" aria-label="Directness selector placeholder">
        <button type="button">Direct</button>
        <button class="selected" type="button">Balanced</button>
        <button type="button">Adventurous</button>
      </div>

      <div class="route-options" aria-label="Route Options">
        {#each routeOptions as option}
          <section class:baseline={option.badge === 'Comparison'} class="route-card">
            <div class="route-card-heading">
              <div>
                <span>{option.badge}</span>
                <h3>{option.name}</h3>
              </div>
              <div class="time">
                <strong>{option.duration}</strong>
                <small>{option.delta}</small>
              </div>
            </div>
            <p>{option.summary}</p>
            <ul>
              {#each option.highlights as highlight}
                <li>{highlight}</li>
              {/each}
            </ul>
          </section>
        {/each}
      </div>
    </article>

    <aside class="map-preview" aria-label="Map preview placeholder">
      <div>
        <p class="eyebrow">Map later in the process</p>
        <h2>Route preview</h2>
        <p>
          The first slice keeps route choice card-first. MapLibre-compatible vector maps will fit here
          when the route geometry work arrives.
        </p>
      </div>
    </aside>
  </section>
</main>
