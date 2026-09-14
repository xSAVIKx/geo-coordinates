<script lang="ts">
  import { motionReduced } from '../app/settings.svelte';
  import { t } from '../i18n/i18n.svelte';

  // A perfect round: a friendly line with a star, and a short confetti burst on a fixed, pointer-transparent
  // canvas over the page (so nothing moves in the layout and focus stays where it is). With reduced motion
  // there is no canvas and the star stays still.
  const DURATION = 1600;
  const reduced = motionReduced();
  let canvas = $state<HTMLCanvasElement>();
  let running = $state(!reduced);

  $effect(() => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) { running = false; return; }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    const colors = ['--accent', '--warm', '--ok', '--marker-c', '--marker-b'].map((v) => css.getPropertyValue(v).trim() || '#1759c9');
    const pieces = Array.from({ length: 140 }, (_, i) => {
      const fromLeft = i % 2 === 0;
      const angle = (fromLeft ? -1 : -Math.PI + 1) + (Math.random() - 0.5) * 0.9;
      const speed = 9 + Math.random() * 9;
      return {
        x: fromLeft ? 0 : w, y: h * (0.55 + Math.random() * 0.25),
        vx: Math.cos(angle) * speed * (w / 1200 + 0.5), vy: Math.sin(angle) * speed,
        size: 6 + Math.random() * 6, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
        color: colors[i % colors.length]!,
      };
    });
    const start = performance.now();
    let last = start;
    let frame = 0;
    const tick = (now: number) => {
      const dt = Math.min(2.5, (now - last) / 16.7);
      last = now;
      const age = (now - start) / DURATION;
      ctx.clearRect(0, 0, w, h);
      if (age >= 1) { running = false; return; }
      ctx.globalAlpha = age > 0.7 ? (1 - age) / 0.3 : 1;
      for (const p of pieces) {
        p.vy += 0.35 * dt; p.vx *= 0.99; p.vy *= 0.99;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });
</script>

<p class="perfect" class:still={reduced}>
  <svg class="star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" /></svg>
  <span>{t('celebrate.perfect')}</span>
</p>
{#if running}<canvas class="confetti" bind:this={canvas} aria-hidden="true"></canvas>{/if}

<style>
  .perfect { display: inline-flex; align-items: center; gap: var(--space-2); margin: var(--space-2) 0 0; padding: var(--space-1) var(--space-4) var(--space-1) var(--space-2); border-radius: var(--radius-pill); background: var(--warm-soft); color: var(--warm-text); font-weight: var(--weight-heavy); }
  .star { flex: none; width: 1.75rem; height: 1.75rem; fill: var(--warm); stroke: var(--warm-text); stroke-width: 1.2; stroke-linejoin: round; animation: pop 600ms var(--ease) both; }
  .still .star { animation: none; }
  @keyframes pop { 0% { transform: scale(0.2) rotate(-40deg); opacity: 0; } 70% { transform: scale(1.2) rotate(8deg); opacity: 1; } 100% { transform: none; } }
  .confetti { position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 60; }
</style>
