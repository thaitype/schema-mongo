import { defineConfig, configDefaults } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    alias: {
      '@thaitype/schema-mongo': path.resolve(__dirname, './src/index.ts'),
      '@thaitype/schema-mongo/adapters/zod': path.resolve(__dirname, './src/adapters/zod.ts'),
    },
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