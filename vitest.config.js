import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    dir: 'tests',
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
