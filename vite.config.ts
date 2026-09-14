import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { licenceNotices } from './scripts/licence-notices.ts';
import { mapleBearSchools } from './scripts/schools-plugin.ts';

export default defineConfig({
  plugins: [mapleBearSchools(), svelte(), viteSingleFile({ removeViteModuleLoader: true }), licenceNotices()],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: { input: 'geo-coordinates.html' },
  },
});
