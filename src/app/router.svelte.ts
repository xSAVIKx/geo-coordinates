import type { LangCode } from '../geo/types';
import { i18n, initialLang, setLang } from '../i18n/i18n.svelte';
import { formatRoute, parseRoute, type Route } from './router';

export const router = $state<{ route: Route }>({ route: { name: 'home', lang: 'en' } });

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
