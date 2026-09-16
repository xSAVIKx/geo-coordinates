import { motionReduced } from '../app/settings.svelte';

/** Spec §5: a short fade-in when the drawn map style changes (planning ruling R12); none with reduced motion. */
export function styleFade(node: HTMLElement, style: string) {
  let current = style;
  return {
    update(next: string) {
      if (next === current) return;
      current = next;
      if (motionReduced() || typeof node.animate !== 'function') return;
      node.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
    },
  };
}
