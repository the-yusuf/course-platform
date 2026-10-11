import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // esbuild (vitest's default) doesn't emit decorator metadata, which Nest's
  // dependency injection and ValidationPipe rely on; SWC does.
  plugins: [tsconfigPaths(), swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    // all spec files share one database
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
