<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { cityBoxAt } from './cityBoxes';
  import { mapState } from './mapState.svelte';
  import { CITY_PHOTOS } from './texture/cityAssets';

  // Spec §6: a short note for the three teaching places, and the credit for whichever box is on screen. Both
  // follow where the *view* is standing, not what is painted, so they are right in every style.
  const box = $derived(mapState.closeUps ? cityBoxAt(mapState.flat.center, mapState.flat.zoom) : null);
  const credit = $derived(box
    ? t('closeup.credit', { photo: t(`closeup.credit.${CITY_PHOTOS[box.id].source}`), streets: t('closeup.credit.osm') })
    : '');
</script>

{#if box?.note}<p class="close-up-note">{t(`closeup.note.${box.id}`)}</p>{/if}
<p class="close-up-credit">{credit}</p>

<style>
  .close-up-note { margin: 0; padding: var(--space-2) var(--space-3); background: var(--accent-soft); border-radius: var(--radius); max-width: var(--measure); }
  .close-up-credit { margin: 0; color: var(--text-muted); font-size: var(--step--1); }
  .close-up-credit:empty { display: none; }
</style>
