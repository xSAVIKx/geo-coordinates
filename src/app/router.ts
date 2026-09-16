import { LANGS, type LangCode } from '../geo/types';
import { TOPIC_IDS, type TopicId } from './ids';

export type Route =
  | { name: 'home'; lang: LangCode }
  | { name: 'explore'; lang: LangCode; topic: TopicId; step: number }
  | { name: 'practice'; lang: LangCode; topic: TopicId }
  | { name: 'rehearsal'; lang: LangCode }
  | { name: 'class-quiz'; lang: LangCode; seed: string | null }
  | { name: 'lab'; lang: LangCode }
  | { name: 'cheatsheet'; lang: LangCode }
  | { name: 'worksheet'; lang: LangCode };

export function parseRoute(hash: string, fallbackLang: LangCode): Route {
  const [pathPart = '', query = ''] = hash.replace(/^#\/?/, '').split('?');
  const parts = pathPart.split('/').filter(Boolean);
  const hasLang = (LANGS as readonly string[]).includes(parts[0] ?? '');
  const lang = hasLang ? (parts[0] as LangCode) : fallbackLang;
  const rest = hasLang ? parts.slice(1) : parts;
  const home: Route = { name: 'home', lang };
  if (rest.length === 0) return home;
  const [head, sub, stepRaw] = rest;
  if (rest.length === 1 && head === 'rehearsal') return { name: 'rehearsal', lang };
  if (rest.length === 1 && head === 'lab') return { name: 'lab', lang };
  if (rest.length === 1 && head === 'cheatsheet') return { name: 'cheatsheet', lang };
  if (rest.length === 1 && head === 'worksheet') return { name: 'worksheet', lang };
  if (rest.length === 1 && head === 'class-quiz') {
    const seed = new URLSearchParams(query).get('seed');
    return { name: 'class-quiz', lang, seed: seed && /^[\w-]{1,32}$/.test(seed) ? seed : null };
  }
  const m = /^topic-([1-9]\d?)$/.exec(head ?? '');
  if (!m) return home;
  const n = Number(m[1]);
  if (!(TOPIC_IDS as readonly number[]).includes(n)) return home;
  const topic = n as TopicId;
  if (sub === undefined) return { name: 'explore', lang, topic, step: 0 };
  if (sub === 'practice' && rest.length === 2) return { name: 'practice', lang, topic };
  if (sub === 'explore' && rest.length <= 3) {
    if (stepRaw === undefined) return { name: 'explore', lang, topic, step: 0 };
    const s = Number(stepRaw);
    return Number.isInteger(s) && s >= 1 ? { name: 'explore', lang, topic, step: s - 1 } : home;
  }
  return home;
}

export function formatRoute(r: Route): string {
  switch (r.name) {
    case 'home': return `#${r.lang}/`;
    case 'explore': return `#${r.lang}/topic-${r.topic}/explore${r.step > 0 ? `/${r.step + 1}` : ''}`;
    case 'practice': return `#${r.lang}/topic-${r.topic}/practice`;
    case 'rehearsal': return `#${r.lang}/rehearsal`;
    case 'class-quiz': return `#${r.lang}/class-quiz${r.seed ? `?seed=${r.seed}` : ''}`;
    case 'lab': return `#${r.lang}/lab`;
    case 'cheatsheet': return `#${r.lang}/cheatsheet`;
    case 'worksheet': return `#${r.lang}/worksheet`;
  }
}
