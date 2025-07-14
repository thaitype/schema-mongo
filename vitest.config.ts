import { defineConfig, defaultExclude, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        ...configDefaults.coverage.exclude ?? [],
        'examples',
      ],
      provider: 'istanbul',
      enabled: true,
    },
  },
});