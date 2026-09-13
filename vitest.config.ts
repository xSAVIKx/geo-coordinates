import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { mapleBearSchools } from './scripts/schools-plugin.ts';

export default defineConfig({
  plugins: [mapleBearSchools(), svelte()],
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
