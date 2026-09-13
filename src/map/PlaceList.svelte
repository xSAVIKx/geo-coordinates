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
  .places { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1); }
  summary { min-height: var(--tap); display: flex; align-items: center; gap: var(--space-2); padding: var(--space-1) var(--space-5); cursor: pointer; font-weight: var(--weight-strong); list-style: none; border-radius: var(--radius-lg); }
  summary::-webkit-details-marker { display: none; }
  summary::before { content: ''; width: 0.5rem; height: 0.5rem; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(-45deg); transition: transform var(--dur) var(--ease); margin-right: var(--space-1); }
  details[open] summary::before { transform: rotate(45deg); }
  summary:hover { background: var(--surface-2); }
  ul { list-style: none; margin: 0; padding: var(--space-2) var(--space-3) var(--space-3); display: grid; gap: var(--space-2); grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr)); max-height: 22rem; overflow: auto; border-top: 1px solid var(--border); }
  button { width: 100%; display: flex; justify-content: space-between; gap: var(--space-2); align-items: center; text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: var(--space-1) var(--space-3); transition: background-color var(--dur) var(--ease), border-color var(--dur) var(--ease); }
  button:hover { background: var(--accent-soft); border-color: var(--accent); }
  .name { font-weight: 600; }
  .coords { color: var(--text-muted); font-size: var(--step--1); font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
