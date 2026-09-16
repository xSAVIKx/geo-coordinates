import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { licenceNotices } from './scripts/licence-notices.ts';
import { mapleBearSchools } from './scripts/schools-plugin.ts';
import { siteIcons } from './scripts/site-head.ts';
import { mapTextures } from './scripts/textures-plugin.ts';

export default defineConfig({
  plugins: [mapleBearSchools(), siteIcons(), mapTextures(), svelte(), viteSingleFile({ removeViteModuleLoader: true }), licenceNotices()],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: { input: 'geo-coordinates.html' },
  },
});
