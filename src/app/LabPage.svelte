<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../i18n/i18n.svelte';
  import MapStage from '../map/MapStage.svelte';
  import { mapState } from '../map/mapState.svelte';

  onMount(() => {
    mapState.applyScene({ views: ['globe', 'flat'], point: { lat: 52, lon: 21 }, pointEditable: true, layers: { specialLines: true } });
  });
</script>

<h1 tabindex="-1">{t('mode.lab.title')}</h1>
<p>{t('lab.intro')}</p>
<MapStage showPlaces />
