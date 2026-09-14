<script lang="ts">
  import { i18n, t, tn } from '../i18n/i18n.svelte';
  import { mapState } from './mapState.svelte';
  import { SCHOOLS, type School } from './schools';
  import { showSchool } from './showSchool';

  // The accessible way to the Maple Bear schools (the map's squares and badges are not focusable):
  // a disclosure like the Places list, with one inner disclosure per country (names from
  // Intl.DisplayNames in the page's language). A school's button shows it on both maps, alone and
  // named, and moves the point there when it can move (MapState.chooseSchool).
  const groups = $derived.by(() => {
    const collator = new Intl.Collator(i18n.lang);
    let regions: Intl.DisplayNames | null = null;
    try { regions = new Intl.DisplayNames([i18n.lang], { type: 'region' }); } catch { regions = null; }
    const byCountry = new Map<string, School[]>();
    for (const s of SCHOOLS) {
      const list = byCountry.get(s.country) ?? [];
      list.push(s);
      byCountry.set(s.country, list);
    }
    return [...byCountry].map(([code, schools]) => ({
      code,
      name: regions?.of(code) ?? code,
      schools: [...schools].sort((a, b) => collator.compare(a.name, b.name)),
    })).sort((a, b) => collator.compare(a.name, b.name));
  });

</script>

<details class="schools">
  <summary>{t('map.schools')} <span class="total">{tn('map.schools.count', SCHOOLS.length)}</span></summary>
  <div class="body">
    <p class="note">{t('schools.note')}</p>
    <ul class="countries">
      {#each groups as g (g.code)}
        <li>
          <details class="country">
            <summary><span lang={i18n.lang}>{g.name}</span> <span class="total">{tn('map.schools.count', g.schools.length)}</span></summary>
            <ul class="list">
              {#each g.schools as s (s.id)}
                <li>
                  <button type="button" onclick={() => showSchool(s.id)} aria-label={mapState.pointEditable ? t('places.goTo', { place: s.name }) : t('schools.show', { school: s.name })}>
                    <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="2.5" /></svg>
                    <span class="name">{s.name}</span>
                  </button>
                </li>
              {/each}
            </ul>
          </details>
        </li>
      {/each}
    </ul>
  </div>
</details>

<style>
  .schools { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1); }
  summary { min-height: var(--tap); display: flex; align-items: center; gap: var(--space-2); padding: var(--space-1) var(--space-5); cursor: pointer; font-weight: var(--weight-strong); list-style: none; border-radius: var(--radius-lg); }
  summary::-webkit-details-marker { display: none; }
  summary::before { content: ''; flex: none; width: 0.5rem; height: 0.5rem; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(-45deg); transition: transform var(--dur) var(--ease); margin-right: var(--space-1); }
  details[open] > summary::before { transform: rotate(45deg); }
  summary:hover { background: var(--surface-2); }
  .total { color: var(--text-muted); font-weight: 400; font-size: var(--step--1); }
  .body { border-top: 1px solid var(--border); padding: var(--space-2) var(--space-3) var(--space-3); max-height: 26rem; overflow: auto; }
  .note { margin: 0 0 var(--space-2); padding: 0 var(--space-2); color: var(--text-muted); font-size: var(--step--1); max-width: var(--measure); }
  ul { list-style: none; margin: 0; padding: 0; }
  .countries { display: grid; gap: var(--space-1); }
  .country summary { padding: var(--space-1) var(--space-3); border-radius: var(--radius-sm); }
  .list { display: grid; gap: var(--space-2); padding: var(--space-1) var(--space-2) var(--space-3); grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr)); }
  button { width: 100%; min-height: var(--tap); display: flex; gap: var(--space-2); align-items: center; text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: var(--space-1) var(--space-3); transition: background-color var(--dur) var(--ease), border-color var(--dur) var(--ease); }
  button:hover { background: var(--accent-soft); border-color: var(--accent); }
  button svg { width: 0.9rem; height: 0.9rem; flex: none; }
  button rect { fill: var(--school); stroke: var(--school-border); stroke-width: 1.5; }
  .name { font-weight: 600; }
</style>
