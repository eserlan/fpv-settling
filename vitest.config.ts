import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      shared: resolve(__dirname, './src/shared'),
      client: resolve(__dirname, './src/client'),
      server: resolve(__dirname, './src/server'),
      "@flamework/networking": resolve(__dirname, './tests/mocks/networking.ts'),
      "@flamework/core": resolve(__dirname, './tests/mocks/flamework-core.ts'),
      "@rbxts/services": resolve(__dirname, './tests/mocks/rbxts-services.ts'),
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/index.ts',
      ],
    },
  },
});
