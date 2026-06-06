<script lang="ts">
  let { data } = $props();
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
      with it will be able to edit this Trip as later planning features arrive.
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

  <section class="placeholder" aria-label="Trip planning placeholder">
    <p class="eyebrow">Next slice</p>
    <h2>Add Routing Places as Trip Stops</h2>
    <p>
      TB1.03 will replace this placeholder with Denver and Moab Trip Stop entry and a derived Leg.
    </p>
  </section>
</main>
