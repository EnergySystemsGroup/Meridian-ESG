import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    exclude: ['node_modules', 'dist', '.next', '__tests__', 'lib/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'tests/fixtures',
        'tests/helpers',
        '**/*.config.js',
      ],
    },
    setupFiles: ['./tests/helpers/setup.js'],
    testTimeout: 10000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    isolate: false,
  },
  resolve: {
    alias: {
      '@': rootDir,
      '@/lib': path.resolve(rootDir, 'lib'),
      '@/app': path.resolve(rootDir, 'app'),
      '@/components': path.resolve(rootDir, 'components'),
    },
  },
});
