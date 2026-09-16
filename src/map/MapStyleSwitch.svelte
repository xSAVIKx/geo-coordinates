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

  function toggle() {
    if (!open && button) {
      // Fixed to the viewport, so the phone's sideways-scrolling tool row cannot clip it.
      const r = button.getBoundingClientRect();
      place = { top: r.bottom + 4, left: Math.max(8, Math.min(r.left, innerWidth - 8 - 232)) };
    }
    open = !open;
    // `tick()` (not a raw microtask) waits for Svelte to actually mount the portalled panel into
    // <body> before focus() is attempted — under load a plain queueMicrotask can run first, while
    // `panel` is still unset, silently dropping the focus move (see SchoolPopover.svelte for the
    // same pattern). `preventScroll` avoids the browser scrolling anything to reveal the newly
    // focused button — the panel already places itself in view, and an incidental scroll here
    // would (before the fix below) have closed the very panel that just opened.
    if (open) void tick().then(() => panel?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true }));
  }
  function close(refocus: boolean) { open = false; if (refocus) button?.focus(); }
  function pick(s: MapStyle) {
    mapState.chooseMapStyle(s);
    if (compact) close(true);
  }
  $effect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!panel?.contains(e.target as Node) && !button?.contains(e.target as Node)) close(false); };
    const away = () => close(false);
    // Only a real page scroll (target is the document) closes the panel: the panel is `position:
    // fixed` precisely so the phone's sideways-scrolling tool row can scroll under it without
    // affecting it (see `portal` above), but a capture-phase 'scroll' listener on window also
    // sees that row's own internal scroll — including the one the browser performs to bring an
    // off-screen toggle button into view before the very click that opens this panel. Reacting to
    // that closed the panel it had just opened.
    const scrolled = (e: Event) => { if (e.target === document) away(); };
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
    <div bind:this={panel} use:portal id="{idPrefix}-style-panel" class="style-panel" role="group" aria-label={t('map.style')}
      style:top="{place.top}px" style:left="{place.left}px"
      onkeydown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); } }}>
      {@render choices()}
    </div>
  {/if}
{/if}
<p id="{idPrefix}-style-hint" class="visually-hidden">{t('map.style.hint')} {mapState.drawnMapStyle !== 'atlas' ? t(`map.style.source.${mapState.drawnMapStyle}`) : ''}</p>

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
  .style-panel { position: fixed; z-index: 30; width: 14.5rem; display: grid; gap: var(--space-1); padding: var(--space-2); background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--radius); box-shadow: var(--shadow-3); }
  .style-panel .btn { justify-content: flex-start; }
</style>
