// The map styles (Map styles spec §3): Atlas (the lesson's own map), Physical (relief), Satellite (NASA imagery) and
// Political (countries). Physical and Satellite are drawn from textures (src/map/texture/); the others in SVG.
export type MapStyle = 'atlas' | 'physical' | 'satellite' | 'political';
export type TextureStyle = Extract<MapStyle, 'physical' | 'satellite'>;

export const MAP_STYLES: readonly MapStyle[] = ['atlas', 'physical', 'satellite', 'political'];
export const DEFAULT_MAP_STYLE: MapStyle = 'atlas';

export const isMapStyle = (v: unknown): v is MapStyle => typeof v === 'string' && (MAP_STYLES as readonly string[]).includes(v);
export const isTextureStyle = (s: MapStyle): s is TextureStyle => s === 'physical' || s === 'satellite';

/** A saved or typed value as a style: anything that is not exactly a style name (null, 'Satellite', a number) is Atlas. */
export const parseMapStyle = (v: unknown): MapStyle => (isMapStyle(v) ? v : DEFAULT_MAP_STYLE);
