<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>{data.trip.title} — Shared Trip</title>
</svelte:head>

<main class="share-page">
  <section>
    <p class="eyebrow">Read-only Trip</p>
    <h1>{data.trip.title}</h1>
    <p>
      This read-only Trip link proves the sharing route shape. Full Trip sharing behavior will be
      expanded after editable Trip planning is in place.
    </p>
    <a href="/">Back to planner</a>
  </section>
</main>
