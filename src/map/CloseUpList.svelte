<script lang="ts">
  import { announce } from '../app/announcer.svelte';
  import { formatLatLon } from '../geo/format';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { CITY_BOXES } from './cityBoxes';
  import { mapState } from './mapState.svelte';

  // The accessible way to the twelve close-ups (spec §6): ordinary buttons in a disclosure, like the Places and
  // Schools lists. A button centres both maps on the box and sets the zoom that fills the view with it.
  const items = $derived.by(() => {
    const collator = new Intl.Collator(i18n.lang);
    return CITY_BOXES.map((b) => ({ ...b, name: t(`closeup.place.${b.id}`) }))
      .sort((a, b) => collator.compare(a.name, b.name));
  });

  // The map moves with no visible change of focus, so a screen reader is told where it landed — the same courtesy
  // showSchool.ts pays the Schools list.
  function show(id: string, name: string): void {
    if (mapState.showCityBox(id)) announce(t('closeup.showing', { place: name }));
  }
</script>

<details class="close-ups">
  <!-- The count is decoration: a bare "12" after the title reads as "Places up close 12" out loud, and the note
       inside the disclosure already says "Twelve places …" in words. -->
  <summary>{t('closeup.title')} <span class="total" aria-hidden="true">{CITY_BOXES.length}</span></summary>
  <div class="body">
    <p class="note">{t('closeup.hint')}</p>
    <ul>
      {#each items as b (b.id)}
        <li>
          <button type="button" onclick={() => show(b.id, b.name)} aria-label={t('closeup.goTo', { place: b.name })}>
            <span class="name">{b.name}</span>
            <!-- Minutes, not whole degrees: these twelve are the places where the lesson claims a line is painted
                 on the ground, so the card has to agree with the note ("66°34′N") and with the readout the pupil
                 sees on arriving ("66°33′N"), not round Rovaniemi's box off to 67°N. -->
            <span class="coords" aria-hidden="true">{formatLatLon(b, i18n.lang, 'minute')}</span>
          </button>
        </li>
      {/each}
    </ul>
  </div>
</details>

<style>
  /* SchoolList.svelte's shell, so the three lists under the map read as one family; the buttons show a name and
     its coordinates like the Places list. Summary and buttons keep the 44 px tap target. */
  .close-ups { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1); }
  summary { min-height: var(--tap); display: flex; align-items: center; gap: var(--space-2); padding: var(--space-1) var(--space-5); cursor: pointer; font-weight: var(--weight-strong); list-style: none; border-radius: var(--radius-lg); }
  summary::-webkit-details-marker { display: none; }
  summary::before { content: ''; flex: none; width: 0.5rem; height: 0.5rem; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(-45deg); transition: transform var(--dur) var(--ease); margin-right: var(--space-1); }
  details[open] > summary::before { transform: rotate(45deg); }
  summary:hover { background: var(--surface-2); }
  .total { color: var(--text-muted); font-weight: 400; font-size: var(--step--1); }
  .body { border-top: 1px solid var(--border); padding: var(--space-2) var(--space-3) var(--space-3); max-height: 26rem; overflow: auto; }
  .note { margin: 0 0 var(--space-2); padding: 0 var(--space-2); color: var(--text-muted); font-size: var(--step--1); max-width: var(--measure); }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr)); }
  button { width: 100%; min-height: var(--tap); display: flex; flex-wrap: wrap; justify-content: space-between; column-gap: var(--space-2); align-items: center; text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: var(--space-1) var(--space-3); transition: background-color var(--dur) var(--ease), border-color var(--dur) var(--ease); }
  button:hover { background: var(--accent-soft); border-color: var(--accent); }
  /*
   * A Ukrainian coordinate pair ("41° пн. ш., 74° зх. д.") is twice the width of "41°N, 74°W", which left the
   * name a column too narrow to hold "Мангеттен (Нью-Йорк)" in fewer than three lines. The name keeps at least
   * 9rem of its own and the pair drops under it instead of breaking the name up — a short name (Delhi, Tokyo,
   * Sydney) still keeps its pair beside it.
   */
  .name { font-weight: 600; min-width: min(100%, 9rem); }
  /* `margin-left: auto` so a pair that dropped to its own line still ends at the card's right edge, like the
     pairs that fitted beside their name. */
  .coords { color: var(--text-muted); font-size: var(--step--1); font-variant-numeric: tabular-nums; white-space: nowrap; margin-left: auto; }
</style>
