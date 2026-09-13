import type { LangCode } from '../geo/types';
import { i18n, initialLang, setLang } from '../i18n/i18n.svelte';
import { formatRoute, parseRoute, type Route } from './router';

// Computed synchronously at module load (not deferred to onMount) so the very first render
// already reflects the real deep-linked route. This matters for App.svelte's focus-on-route-
// change effect: its "skip the first run" guard only works if the route it sees on that first
// run is already correct — otherwise the correction that happens once startRouter() runs in
// onMount looks like a real route change and wrongly steals focus into the <h1> on first paint.
function initialRoute(): Route {
  if (typeof location === 'undefined') return { name: 'home', lang: 'en' };
  return parseRoute(location.hash, initialLang());
}

export const router = $state<{ route: Route }>({ route: initialRoute() });

function sync(): void {
  const route = parseRoute(location.hash, i18n.lang);
  const canonical = formatRoute(route);
  if (location.hash !== canonical) history.replaceState(history.state, '', canonical);
  if (route.lang !== i18n.lang) setLang(route.lang);
  router.route = route;
}

export function startRouter(): () => void {
  setLang(initialLang());
  sync();
  window.addEventListener('hashchange', sync);
  return () => window.removeEventListener('hashchange', sync);
}

export function navigate(route: Route, opts: { replace?: boolean } = {}): void {
  const hash = formatRoute(route);
  if (opts.replace) { history.replaceState(history.state, '', hash); sync(); }
  else if (location.hash !== hash) location.hash = hash;
}

export function switchLang(lang: LangCode): void {
  navigate({ ...router.route, lang }, { replace: true });
}
