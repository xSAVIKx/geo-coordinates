<script lang="ts">
  import { formatLatLon } from '../geo/format';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { mapState } from './mapState.svelte';
  import { PLACES } from './places';

  let { onselect, showCoords = true, ids, title }: { onselect?: (id: string) => void; showCoords?: boolean; ids?: readonly string[]; title?: string } = $props();

  const items = $derived.by(() => {
    const collator = new Intl.Collator(i18n.lang);
    return PLACES.filter((p) => (ids ? ids.includes(p.id) : true))
      .map((p) => ({ ...p, name: t(`place.${p.id}`) }))
      .sort((a, b) => collator.compare(a.name, b.name));
  });

  function choose(id: string) {
    if (onselect) return onselect(id);
    const place = PLACES.find((p) => p.id === id)!;
    mapState.userSetPoint(place, 'slider');
    mapState.centerGlobeOn(place);
  }
</script>

<details class="places">
  <summary>{title ?? t('places.title')}</summary>
  <ul>
    {#each items as p (p.id)}
      <li>
        <button type="button" onclick={() => choose(p.id)} aria-label={onselect ? p.name : t('places.goTo', { place: p.name })}>
          <span class="name">{p.name}</span>
          {#if showCoords}<span class="coords" aria-hidden={!onselect}>{formatLatLon(p, i18n.lang)}</span>{/if}
        </button>
      </li>
    {/each}
  </ul>
</details>

<style>
  .places { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
  summary { min-height: var(--tap); display: flex; align-items: center; padding: 0 var(--space-4); cursor: pointer; font-weight: 600; }
  ul { list-style: none; margin: 0; padding: var(--space-2); display: grid; gap: var(--space-2); grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr)); max-height: 22rem; overflow: auto; }
  button { width: 100%; display: flex; justify-content: space-between; gap: var(--space-2); align-items: center; text-align: left; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-1) var(--space-3); }
  .coords { color: var(--text-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
