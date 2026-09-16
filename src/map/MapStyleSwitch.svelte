<script lang="ts">
  import { tick } from 'svelte';
  import { t } from '../i18n/i18n.svelte';
  import { mapState } from './mapState.svelte';
  import { MAP_STYLES, type MapStyle } from './mapStyle';

  // Spec §5: Atlas · Physical · Satellite · Political on every map toolbar; below 480 px a compact disclosure menu.
  let { idPrefix }: { idPrefix: string } = $props();

  const query = '(max-width: 479px)';
  let compact = $state(typeof matchMedia === 'function' && matchMedia(query).matches);
  $effect(() => {
    const mq = matchMedia(query);
    const on = (e: MediaQueryListEvent) => { compact = e.matches; open = false; };
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  });

  let open = $state(false);
  let button = $state<HTMLButtonElement>();
  let panel = $state<HTMLDivElement>();
  let place = $state({ top: 0, left: 0 });
  /** False until the panel has been measured and placed, so it is never painted at the first guess (see `toggle`). */
  let placed = $state(false);

  /**
   * The compact panel is `position: fixed`, but it is mounted inside the phone toolbar, whose
   * sideways-scroll fade (`.toolbar`'s mask-image, see FlatMap.svelte/Globe.svelte) makes the
   * toolbar the containing block and a stacking context for its fixed descendants in Chromium.
   * Left in place, the panel's z-index would then be scoped to the toolbar, so a later sibling
   * such as the coordinate sliders below the map paints over it and swallows its clicks. Moving
   * the node to <body> keeps it truly fixed to the viewport and in the root stacking context.
   */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }

  /**
   * Puts the panel under its button — or over it. Fixed to the viewport, so the phone's sideways-scrolling tool row
   * cannot clip it; and because it is fixed, anything that falls past the bottom edge cannot be scrolled to at all,
   * by pointer or by keyboard: at 375 × 667 the toolbar sits low enough that the fourth style was simply off the
   * screen. So with no room below the button the panel goes above it, and is clamped into the viewport either way.
   * Called once before opening (a first guess, while the panel's height is still unknown) and again once it is
   * mounted; also on every page scroll, so it keeps following its button.
   */
  function anchor() {
    if (!button) return;
    const r = button.getBoundingClientRect(), h = panel?.offsetHeight ?? 0, below = r.bottom + 4;
    const top = h && below + h > innerHeight - 8 ? Math.max(8, Math.min(r.top - 4 - h, innerHeight - 8 - h)) : below;
    // The panel's real width, not a copy of the 14.5rem in the stylesheet: with `largeText` (or a big-screen
    // --fs-scale) that rem is 25 %+ wider, and a hardcoded 232 px let the right-hand edge hang off the viewport.
    // Before the first mount `offsetWidth` is 0, and the guess below is re-run from `toggle()` once it is known.
    const w = panel?.offsetWidth ?? 0;
    const left = Math.max(8, Math.min(r.left, innerWidth - 8 - w));
    // A scroll can leave the panel exactly where it was (a sideways scroll, or one the toolbar absorbed); writing
    // the same numbers back would still re-render. The browser already coalesces scroll events to one a frame, so
    // this is the whole of the throttling this needs — a rAF debounce would only add a frame of drift.
    if (top !== place.top || left !== place.left) place = { top, left };
  }

  function toggle() {
    if (!open) { anchor(); placed = false; }
    open = !open;
    // `tick()` (not a raw microtask) waits for Svelte to actually mount the portalled panel into
    // <body> before focus() is attempted — under load a plain queueMicrotask can run first, while
    // `panel` is still unset, silently dropping the focus move (see SchoolPopover.svelte for the
    // same pattern). `preventScroll` avoids the browser scrolling anything to reveal the newly
    // focused button — the panel already places itself in view, and an incidental scroll here
    // would (before the fix below) have closed the very panel that just opened.
    if (open) void tick().then(() => {
      // Now that the panel is mounted its size is known, so this placement is the real one — and the first guess,
      // made with no height at all, is never seen: the panel is transparent until this runs. Without that it
      // opened below its button and then jumped up a frame later, by 265 px with the large-text setting on.
      anchor();
      placed = true;
      panel?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
    });
  }
  function close(refocus: boolean) { open = false; placed = false; if (refocus) button?.focus(); }
  function pick(s: MapStyle) {
    mapState.chooseMapStyle(s);
    if (compact) close(true);
  }
  $effect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!panel?.contains(e.target as Node) && !button?.contains(e.target as Node)) close(false); };
    const away = () => close(false);
    /*
     * Only a real page scroll (target is the document) concerns the panel: the panel is `position: fixed` precisely
     * so the phone's sideways-scrolling tool row can scroll under it without affecting it (see `portal` above), but
     * a capture-phase 'scroll' listener on window also sees that row's own internal scroll.
     *
     * A page scroll re-anchors the panel to its button rather than closing it. Closing looked tidier but was wrong
     * on a phone: when the toggle is below the fold — which it is on the globe at 375 × 667, at y ≈ 754 of a 667 px
     * screen — the browser scrolls the page to reveal it as part of the very tap that opens the panel, and that
     * scroll event arrives *after* the click, so the menu closed itself every time it was opened. Re-anchoring is
     * also simply what an anchored menu should do. Once the button itself has left the screen, the panel goes too.
     */
    const scrolled = (e: Event) => {
      if (e.target !== document) return;
      const r = button?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > innerHeight) away(); else anchor();
    };
    addEventListener('pointerdown', outside, true);
    addEventListener('resize', away);
    addEventListener('scroll', scrolled, true);
    return () => { removeEventListener('pointerdown', outside, true); removeEventListener('resize', away); removeEventListener('scroll', scrolled, true); };
  });
</script>

{#snippet choices()}
  {#each MAP_STYLES as s (s)}
    <button type="button" class="btn" aria-pressed={mapState.chosenMapStyle === s} title={s === 'atlas' ? undefined : t(`map.style.source.${s}`)} onclick={() => pick(s)}>{t(`map.style.${s}`)}</button>
  {/each}
{/snippet}

{#if !compact}
  <div class="style-group seg" role="group" aria-label={t('map.style')} aria-describedby="{idPrefix}-style-hint">{@render choices()}</div>
{:else}
  <button bind:this={button} type="button" class="btn style-menu" aria-expanded={open} aria-controls="{idPrefix}-style-panel" aria-describedby="{idPrefix}-style-hint" onclick={toggle}>
    {t('map.style.menu', { style: t(`map.style.${mapState.chosenMapStyle}`) })}
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
  </button>
  {#if open}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -- Esc closes the menu; the buttons inside are the controls -->
    <div bind:this={panel} use:portal id="{idPrefix}-style-panel" class="style-panel" class:placed role="group" aria-label={t('map.style')}
      style:top="{place.top}px" style:left="{place.left}px"
      onkeydown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); } }}>
      {@render choices()}
    </div>
  {/if}
{/if}
<!-- What the four styles are. The drawn style's source line is *not* repeated here: MapStage prints it as a visible
     caption right under the map, so a screen reader already reaches it — saying it again made every visit to this
     group read the same sentence twice. -->
<p id="{idPrefix}-style-hint" class="visually-hidden">{t('map.style.hint')}</p>

<style>
  /*
   * `.seg`'s own default (flex-wrap: wrap, base.css) is kept rather than forced to one row: FlatMap's toolbar
   * never squeezes this group (its own narrow-toolbar rule keeps every direct child at its natural size and
   * scrolls the row sideways instead), but Globe's column can be far narrower than four text buttons' natural
   * width — forcing one row there let the buttons shrink below their own text (`.btn`'s explicit min-width does
   * not protect a single unbreakable word) and their labels overlapped instead of wrapping.
   */
  .style-menu { gap: var(--space-1); white-space: nowrap; }
  .style-menu svg { width: 1.1rem; height: 1.1rem; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
  /* max-height is the last resort behind the placement above: with very large text the four styles could still be
     taller than a short phone screen, and a fixed panel's overflow is unreachable unless it scrolls itself. */
  .style-panel { position: fixed; z-index: 30; width: 14.5rem; max-height: calc(100dvh - 1rem); overflow: auto; display: grid; gap: var(--space-1); padding: var(--space-2); background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--radius); box-shadow: var(--shadow-3); }
  /* Transparent for the one frame between mounting and being measured; still focusable, so the focus move in
     `toggle` lands as it always did. */
  .style-panel { opacity: 0; }
  .style-panel.placed { opacity: 1; }
  .style-panel .btn { justify-content: flex-start; }
</style>
