import { announce } from '../app/announcer.svelte';
import { t } from '../i18n/i18n.svelte';
import { mapState } from './mapState.svelte';

/** A school button in the Schools list or a badge's list: show the school on the maps and say so. */
export function showSchool(id: string): void {
  const school = mapState.chooseSchool(id);
  if (school) announce(t('schools.showing', { school: school.name }));
}
