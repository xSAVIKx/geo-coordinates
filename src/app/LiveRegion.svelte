<script lang="ts">
  import { liveRegion } from './announcer.svelte';
</script>

<div class="visually-hidden" aria-live="polite" aria-atomic="true">{liveRegion.polite}</div>
<div class="visually-hidden" aria-live="assertive" aria-atomic="true">{liveRegion.assertive}</div>
