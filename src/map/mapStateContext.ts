import { getContext, setContext } from 'svelte';
import { mapState, type MapState } from './mapState.svelte';

/*
 * The map layers draw whichever MapState is provided above them, and the app's one shared `mapState`
 * when none is. The interactive views never provide one; StaticMap does, so many small maps (a printed
 * worksheet) can each show their own scene with the same renderer.
 */
const KEY = Symbol('map-state');

export function provideMapState(state: MapState): void {
  setContext(KEY, state);
}

/** Call during component initialisation (it reads Svelte context). */
export function useMapState(): MapState {
  return getContext<MapState | undefined>(KEY) ?? mapState;
}
