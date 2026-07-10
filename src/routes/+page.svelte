<script lang="ts">
  import './+page.css';

  let { form } = $props();

  type WorkflowStep = {
    label: string;
    title: string;
    copy: string;
  };

  const workflowSteps: WorkflowStep[] = [
    {
      label: '1 · Trip Stops',
      title: 'Build a Trip from Routing Places',
      copy: 'Start with city-level or travel-relevant Routing Places, then add optional Trip Stop details as your plans become clearer.'
    },
    {
      label: '2 · Route Search',
      title: 'Compare Route Options for each Leg',
      copy: 'Each adjacent pair of Trip Stops becomes a Leg where you can compare a fastest baseline with more interesting Corridors.'
    },
    {
      label: '3 · Saved Routes',
      title: 'Choose a Preferred Saved Route',
      copy: 'Save the Route Option you want to revisit, mark one Saved Route as preferred for the Leg, and keep alternatives for comparison.'
    },
    {
      label: '4 · Leg Handoff',
      title: 'Open navigation context when ready',
      copy: 'Use the Leg Handoff page to open external navigation links while keeping the selected Corridor, Highlights, and Shaping Stops visible.'
    }
  ];
</script>

<svelte:head>
  <title>Routing — Trip-first route planning</title>
  <meta
    name="description"
    content="Create a Trip, compare Interesting Routes for each Leg, save preferred routes, and share route context."
  />
</svelte:head>

<main class="shell">
  <section class="hero" aria-labelledby="page-title">
    <p class="eyebrow">Trip-first route planning</p>
    <div class="hero-copy">
      <h1 id="page-title">Plan the Trip. Choose the interesting route.</h1>
      <p>
        Routing helps travelers create Trips, add Trip Stops, compare Route Options for each Leg,
        save a Preferred Saved Route, and share or hand off the route context when it is time to drive.
      </p>
    </div>
    <form class="hero-actions" method="POST" action="?/createTrip" aria-label="Create a Trip">
      <label for="trip-title">Trip title</label>
      <div>
        <input id="trip-title" name="title" value="Western parks sampler" maxlength="90" />
        <button class="primary" type="submit">Create Trip</button>
      </div>
      {#if form?.message}
        <p class="form-error" role="alert">{form.message}</p>
      {/if}
    </form>
  </section>

  <section class="workspace" aria-label="Routing workflow">
    <article class="panel workflow-panel">
      <div class="panel-heading">
        <p class="eyebrow">How it works</p>
        <h2>From Trip Stops to Leg Handoff</h2>
        <p>
          The app keeps planning Trip-first: add places, compare current Legs, save the route you intend
          to use, then open a Leg Handoff with navigation links and context.
        </p>
      </div>

      <ol class="workflow-list" aria-label="Trip planning workflow">
        {#each workflowSteps as step}
          <li>
            <span>{step.label}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.copy}</p>
            </div>
          </li>
        {/each}
      </ol>
    </article>

    <article class="panel example-panel">
      <div class="panel-heading horizontal">
        <div>
          <p class="eyebrow">Example corridor</p>
          <h2>Denver → Moab</h2>
          <p>
            The current demo data includes Denver, Moab, and nearby Colorado/Utah Highlights. It is an
            example route-planning region, not the shape of every Trip.
          </p>
        </div>
        <span class="status">Example</span>
      </div>

      <div class="example-card" aria-label="Example Route Search summary">
        <span>Route Search</span>
        <strong>Compare fastest and interesting Corridors</strong>
        <p>
          Route Options can include a fastest baseline, Anchor-generated alternatives, Interest Score
          explanations, map context, Saved Routes, and Shaping Stops for Leg Handoff.
        </p>
      </div>
    </article>

    <aside class="map-preview" aria-label="Current map capability">
      <div>
        <p class="eyebrow">Maps and sharing</p>
        <h2>Context stays with the route</h2>
        <p>
          MapLibre-compatible maps now show Route Option geometry, Highlights, endpoints, and Shaping
          Stops where route context is available. Read-only share links let others review the Trip
          without exposing the private edit link.
        </p>
      </div>
    </aside>
  </section>
</main>
