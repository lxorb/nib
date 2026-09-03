import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // The Svelte plugin is what compiles the runes in `.svelte.ts` stores.
  plugins: [svelte()],
  test: {
    // Vitest skips CSS by default, which makes the `?raw` imports the export
    // bakes into a document come back empty — the very thing under test.
    css: true,
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
