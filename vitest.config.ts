import { defineConfig } from 'vitest/config'

/**
 * Kept separate from vite.config.ts on purpose: Vitest resolves its own copy of
 * Vite, and mixing the two configs makes the plugin types conflict. The tests
 * here are plain TypeScript — no JSX, no Tailwind — so they need none of the
 * app's build plugins.
 */
export default defineConfig({
  test: {
    // Only the pure geometry, hyphenation and cache-key logic is unit tested.
    // The WASM recognition path is verified against a real scanned book in the
    // browser instead.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
