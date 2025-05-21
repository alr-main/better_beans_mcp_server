import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'miniflare',
    environmentOptions: {
      modules: true,
      scriptPath: 'dist/index.js',
      bindings: {
        SUPABASE_URL: 'https://dummy-supabase-url.supabase.co',
        SUPABASE_KEY: 'dummy-key',
        API_KEYS_SALT: 'dummy-salt',
        WORKER_ENV: 'development',
      },
    },
    setupFiles: ['./test/setup.ts'],
  },
});
