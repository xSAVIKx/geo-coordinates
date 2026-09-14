// The words drawn on overlays, in the page's language — shared by Overlays.svelte (which draws them)
// and the layers that keep clear of them (SpecialLines.svelte, Places.svelte).
import { i18n, t } from '../i18n/i18n.svelte';
import { formatNumber } from '../i18n/text';
import type { BracketUnit } from './brackets';
import { localizeLabel } from './markerLabel';

/** A marker's label text: a translated `labelKey`, or `label` in the language's notation. */
export const markerText = (o: { label?: string; labelKey?: string }): string => (o.labelKey ? t(o.labelKey) : o.label ? localizeLabel(o.label, i18n.lang) : '');
export const bracketFmt = (value: number, unit: BracketUnit): string => (unit === 'km' ? t('unit.km', { n: formatNumber(value, i18n.lang) }) : `${formatNumber(value, i18n.lang)}°`);
export const noonText = (): string => `${t('lab.noon')} 12:00`;
