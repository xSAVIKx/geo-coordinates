<script lang="ts">
  import { tick } from 'svelte';
  import { formatLat, formatLatLon, formatLon } from '../geo/format';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { AUTHOR } from './credits';
  import PrintTools from './PrintTools.svelte';

  // A one-page summary of the lessons, made for A4 paper (see the print rules at the end and in base.css).
  // The page is drawn as paper on every theme: explicit black-on-white colours, and every diagram paints
  // its own fills and strokes, so the screen preview and the PDF look the same.
  const year = new Date().getFullYear();
  const lang = $derived(i18n.lang);
  const lat = (v: number) => formatLat(v, lang);
  const lon = (v: number) => formatLon(v, lang);
  // Keeps a formula (52 − 30 = 22°) and a Ukrainian letter pair (52° пн. ш.) from breaking across lines.
  const nb = (text: string) => text.replace(/ ([−+×÷=≈→]) /g, '\u00a0$1\u00a0').replace(/(\d[°′]) (?=(пн|пд|сх|зх)\.)/g, '$1\u00a0').replace(/(пн|пд|сх|зх)\. (?=[шд]\.)/g, '$1.\u00a0')
    .replace(/(\d) (?=(km|км|min|minutes?|minut[ay]?|хв|хвилин[аи]?|h|hours?|год|годин[аи]?|godz\.|godzin[ay]?)(?![\p{L}]))/gu, '$1\u00a0');
  const sections = [
    { id: 'grid', items: 4 },
    { id: 'read', items: 3 },
    { id: 'rel', items: 3 },
    { id: 'min', items: 3 },
    { id: 'diff', items: 3 },
    { id: 'dist', items: 4 },
    { id: 'time', items: 4 },
    { id: 'dec', items: 3 },
  ] as const;
  // Grid diagram: a 2:1 world grid, 30° between lines.
  const gx = (lonDeg: number) => 4 + ((lonDeg + 180) / 360) * 142;
  const gy = (latDeg: number) => 4 + ((90 - latDeg) / 180) * 71;
  // The prime meridian's name sits between the frame (x 4) and the meridian, 3 units from each; a long name
  // («нульовий меридіан») is measured once drawn and squeezed to that room, whatever the system font's widths.
  const PRIME_ROOM = gx(0) - 3 - 7;
  let primeLabel = $state<SVGTextElement>();
  let primeFit = $state<number | null>(null);
  $effect(() => {
    void t('cheat.fig.prime');
    primeFit = null;
    void tick().then(() => {
      const w = primeLabel?.getComputedTextLength() ?? 0;
      primeFit = w > PRIME_ROOM ? PRIME_ROOM : null;
    });
  });
</script>

<PrintTools />

<article class="sheet" aria-labelledby="cheat-title">
  <header class="sheet-head">
    <h1 id="cheat-title" tabindex="-1">{t('cheat.title')}</h1>
    <p>{t('cheat.subtitle')}</p>
  </header>

  <div class="sections">
    {#each sections as s, n (s.id)}
      <section class="sec sec-{s.id}" aria-labelledby="cheat-{s.id}">
        <h2 id="cheat-{s.id}"><span class="num" aria-hidden="true">{n + 1}</span>{t(`cheat.${s.id}.title`)}</h2>
        <div class="body">
          {#if s.id === 'rel'}
            <svg class="fig side" viewBox="0 0 64 100" aria-hidden="true">
              <line x1="10" y1="12" x2="10" y2="88" stroke="#1a1a1a" stroke-width="1.2" />
              <path d="M10 6l-3.2 6h6.4zM10 94l-3.2-6h6.4z" fill="#1a1a1a" />
              {#each [40, 20, 0, -20, -40] as v, i (v)}
                <line x1="7" y1={22 + i * 14} x2="13" y2={22 + i * 14} stroke="#1a1a1a" stroke-width={v === 0 ? 2 : 1} />
                <text x="16" y={24.5 + i * 14} font-size="7" fill="#1a1a1a" font-weight={v === 0 ? 700 : 400}>{lat(v)}</text>
              {/each}
              <text x="16" y="9" font-size="7" font-weight="700" fill="#1a1a1a">{t('cheat.fig.north')}</text>
              <text x="16" y="96" font-size="7" font-weight="700" fill="#1a1a1a">{t('cheat.fig.south')}</text>
            </svg>
          {/if}
          <ul>
            {#each { length: s.items } as _, i (i)}<li>{nb(t(`cheat.${s.id}.${i + 1}`))}</li>{/each}
          </ul>
          {#if s.id === 'grid'}
            <svg class="fig wide" viewBox="0 0 150 92" aria-hidden="true">
              <rect x="4" y="4" width="142" height="71" fill="#ffffff" stroke="#1a1a1a" stroke-width="1" />
              {#each [-150, -120, -90, -60, -30, 30, 60, 90, 120, 150] as m (m)}<line x1={gx(m)} y1="4" x2={gx(m)} y2="75" stroke="#b5b5b5" stroke-width="0.5" />{/each}
              {#each [60, 30, -30, -60] as p (p)}<line x1="4" y1={gy(p)} x2="146" y2={gy(p)} stroke="#b5b5b5" stroke-width="0.5" />{/each}
              <line x1="4" y1={gy(0)} x2="146" y2={gy(0)} stroke="#1a1a1a" stroke-width="2" />
              <line x1={gx(0)} y1="4" x2={gx(0)} y2="75" stroke="#1a1a1a" stroke-width="1.6" stroke-dasharray="4 2" />
              <g font-size="7" fill="#1a1a1a" stroke="#ffffff" stroke-width="2.4" paint-order="stroke" stroke-linejoin="round">
                <text x={gx(0) + 3} y="11.5">{lat(90)}</text>
                <text x={gx(0) + 3} y="72">{lat(-90)}</text>
                <text x="6" y={gy(0) - 2.5}>0° · {t('cheat.fig.equator')}</text>
                <!-- A little smaller for a long name, then squeezed to the measured room if still too wide (see primeFit). -->
                <text bind:this={primeLabel} class="prime-label" x={gx(0) - 3} y="11.5" text-anchor="end" font-size={Math.min(7, PRIME_ROOM / (t('cheat.fig.prime').length * 0.56))}
                  textLength={primeFit ?? undefined} lengthAdjust={primeFit === null ? undefined : 'spacingAndGlyphs'}>{t('cheat.fig.prime')}</text>
                <text x={gx(-90)} y={gy(0) + 9} text-anchor="middle">{lon(-90)}</text>
                <text x={gx(90)} y={gy(0) + 9} text-anchor="middle">{lon(90)}</text>
              </g>
              <g font-size="7" fill="#1a1a1a" font-weight="700">
                <text x="4" y="84">{lon(180)}</text>
                <text x={gx(0)} y="84" text-anchor="middle">0°</text>
                <text x="146" y="84" text-anchor="end">{lon(180)}</text>
              </g>
            </svg>
          {:else if s.id === 'read'}
            <svg class="fig wide" viewBox="0 0 150 98" aria-hidden="true">
              <rect x="50" y="4" width="96" height="66" fill="#ffffff" stroke="#1a1a1a" stroke-width="1" />
              {#each [16, 37, 58] as y (y)}<line x1="50" y1={y} x2="146" y2={y} stroke="#9a9a9a" stroke-width="0.7" />{/each}
              {#each [74, 122] as x (x)}<line x1={x} y1="4" x2={x} y2="70" stroke="#9a9a9a" stroke-width="0.7" />{/each}
              <line x1="120" y1="37" x2="53" y2="37" stroke="#1a1a1a" stroke-width="1.3" stroke-dasharray="3 2" />
              <path d="M53 37l4-2.4v4.8z" fill="#1a1a1a" />
              <line x1="122" y1="39" x2="122" y2="67" stroke="#1a1a1a" stroke-width="1.3" stroke-dasharray="3 2" />
              <path d="M122 67l-2.4-4h4.8z" fill="#1a1a1a" />
              <circle cx="122" cy="37" r="3.6" fill="#1a1a1a" stroke="#ffffff" stroke-width="1.2" />
              <g font-size="7" fill="#1a1a1a">
                <text x="47" y="18.5" text-anchor="end">{lat(40)}</text>
                <text x="47" y="39.5" text-anchor="end" font-weight="700">{lat(30)}</text>
                <text x="47" y="60.5" text-anchor="end">{lat(20)}</text>
                <text x="74" y="79" text-anchor="middle">{lon(10)}</text>
                <text x="122" y="79" text-anchor="middle" font-weight="700">{lon(20)}</text>
              </g>
              <text x="98" y="93" text-anchor="middle" font-size="8" font-weight="700" fill="#1a1a1a">{formatLatLon({ lat: 30, lon: 20 }, lang)}</text>
            </svg>
          {:else if s.id === 'min'}
            <svg class="fig strip" viewBox="0 0 150 30" aria-hidden="true">
              <line x1="12" y1="12" x2="138" y2="12" stroke="#1a1a1a" stroke-width="1.2" />
              {#each [0, 15, 30, 45, 60] as m, i (m)}
                <line x1={12 + i * 31.5} y1={m % 60 === 0 ? 6 : m === 30 ? 7 : 9} x2={12 + i * 31.5} y2={m % 60 === 0 ? 18 : m === 30 ? 17 : 15} stroke="#1a1a1a" stroke-width={m % 30 === 0 ? 1.4 : 0.9} />
                <text x={12 + i * 31.5} y="27" text-anchor="middle" font-size="7" fill="#1a1a1a" font-weight={m % 60 === 0 ? 700 : 400}>{m === 0 ? '52°' : m === 60 ? '53°' : `${m}′`}</text>
              {/each}
            </svg>
          {:else if s.id === 'time'}
            <svg class="fig strip" viewBox="0 0 150 40" aria-hidden="true">
              <line x1="8" y1="15" x2="140" y2="15" stroke="#1a1a1a" stroke-width="1.2" />
              <path d="M146 15l-6.5-3.2v6.4z" fill="#1a1a1a" />
              <circle cx="46" cy="15" r="2.6" fill="#1a1a1a" /><circle cx="104" cy="15" r="2.6" fill="#1a1a1a" />
              <g font-size="7" fill="#1a1a1a" text-anchor="middle">
                <text x="46" y="10">{lon(21)}</text><text x="104" y="10">{lon(31)}</text>
                <text x="46" y="25" font-weight="700">12:00</text><text x="104" y="25" font-weight="700">12:40</text>
                <text x="75" y="25" font-size="6.5">+{t('q.answer.min', { n: 40 })}</text>
              </g>
              <text x="4" y="37" font-size="6.5" fill="#1a1a1a">← {t('cheat.fig.earlier')}</text>
              <text x="146" y="37" font-size="6.5" fill="#1a1a1a" text-anchor="end">{t('cheat.fig.later')} →</text>
            </svg>
          {/if}
        </div>
      </section>
    {/each}
  </div>

  <p class="sheet-foot">{t('cheat.foot', { app: t('app.title'), year, author: AUTHOR.name })}</p>
</article>

<style>
  /* Paper on every theme: fixed colours, rem sizes on screen and pt sizes on paper. */
  .sheet { --ink: #141414; --muted: #4a4a4a; --rule: #c9c9c9; max-width: 52rem; margin: 0 auto; background: #ffffff; color: var(--ink); border: 1px solid #d6d6d6; border-radius: var(--radius-lg); box-shadow: var(--shadow-2); padding: var(--space-8) var(--space-8) var(--space-5); color-scheme: light; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 1em; border-bottom: 2px solid var(--ink); padding-bottom: 0.4em; margin-bottom: 0.9em; }
  h1 { margin: 0; font-size: 1.6rem; font-weight: 800; color: var(--ink); }
  h1:focus { outline: none; }
  .sheet-head p { margin: 0; color: var(--muted); font-weight: 600; }
  .sections { columns: 2 22rem; column-gap: 1.6em; }
  .sec { break-inside: avoid; margin: 0 0 0.9em; }
  h2 { display: flex; align-items: center; gap: 0.45em; margin: 0 0 0.3em; font-size: 1.05rem; font-weight: 800; color: var(--ink); letter-spacing: 0; }
  .num { display: inline-grid; place-items: center; flex: none; width: 1.45em; height: 1.45em; border-radius: 50%; background: var(--ink); color: #ffffff; font-size: 0.85em; }
  .body { display: flow-root; }
  ul { margin: 0; padding-left: 1.1em; font-size: 0.92rem; line-height: 1.38; }
  /* Formulas keep their parts together with no-break spaces; on a very narrow screen with larger text one may still break rather than widen the page. */
  li { margin: 0 0 0.15em; overflow-wrap: anywhere; }
  li::marker { color: var(--muted); }
  .fig { display: block; }
  .fig text { font-family: var(--font); }
  .fig.wide { width: min(100%, 17rem); margin: 0.35em auto 0; }
  .fig.strip { width: min(100%, 17rem); margin: 0.3em auto 0; }
  .fig.side { float: right; width: 4.6rem; margin: 0 0 0.2em 0.6em; }
  .sec-rel ul { overflow: hidden; }
  .sheet-foot { margin: 0.6em 0 0; padding-top: 0.4em; border-top: 1px solid var(--rule); color: var(--muted); font-size: 0.8rem; text-align: center; }
  @media (max-width: 599px) { .sheet { padding: var(--space-4); } h1 { font-size: 1.35rem; } }

  @media print {
    .sheet { max-width: none; border: 0; border-radius: 0; padding: 0; font-size: 9.5pt; }
    h1 { font-size: 16pt; }
    .sheet-head p { font-size: 10pt; }
    .sections { columns: 2; column-gap: 7mm; }
    h2 { font-size: 11pt; }
    ul { font-size: 9.5pt; line-height: 1.33; }
    .sec { margin-bottom: 0.7em; }
    .fig.wide, .fig.strip { width: 62mm; }
    .fig.side { width: 22mm; }
    .sheet-foot { font-size: 7.5pt; }
  }
</style>
