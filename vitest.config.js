import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        'coverage/',
        '**/*.d.ts',
        'scripts/test/integration/*.js', // Exclude integration tests from coverage
        'scripts/test/*.js',
        'scripts/*.js',
        'supabase/',
        'tailwind.config.js',
        'next.config.js',
        'postcss.config.js',
        'vitest.config.js',
        '**/*.test.{js,ts,jsx,tsx}',
        '**/*.spec.{js,ts,jsx,tsx}',
        // Global ignores
        'app/globals.css',
        'app/**/loading.{js,jsx,ts,tsx}',
        'app/**/error.{js,jsx,ts,tsx}',
        'app/**/not-found.{js,jsx,ts,tsx}',
        'app/**/page.{js,jsx,ts,tsx}',
        'app/**/layout.{js,jsx,ts,tsx}',
        'lib/utils.js' // Utility functions
      ],
      include: [
        'lib/agents-v2/**/*.{js,ts}',
        'lib/services/**/*.{js,ts}',
        'app/components/**/*.{js,jsx,ts,tsx}',
        'lib/hooks/**/*.{js,ts}',
        'lib/utils/**/*.{js,ts}'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        },
        // Specific thresholds for critical components
        'lib/agents-v2/': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        'lib/services/': {
          branches: 75,
          functions: 75,
          lines: 75,
          statements: 75
        }
      }
    }
  }
})