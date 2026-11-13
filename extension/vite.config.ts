import { defineConfig, Plugin } from 'vite';
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Copies `manifest.json` into the build output after the bundle is written. */
function copyManifest(): Plugin {
  return {
    name: 'copy-manifest',
    writeBundle() {
      copyFileSync(
        resolve(__dirname, 'manifest.json'),
        resolve(__dirname, 'dist/manifest.json'),
      );
    },
  };
}

/**
 * Builds the extension's scripts and HTML into `dist/` with stable,
 * un-hashed filenames so `manifest.json` can reference them directly.
 *
 * Each content script, the background service worker, and the popup are
 * independent entry points — the service worker and content script run in
 * isolated worlds, so they must not be code-split into shared chunks.
 */
export default defineConfig({
  root: __dirname,
  // Relative asset URLs so the popup HTML resolves `popup.js` from the
  // extension root regardless of how Chrome mounts the unpacked folder.
  base: './',
  publicDir: resolve(__dirname, 'public'),
  plugins: [copyManifest()],
  // The extension bundles no CSS; disable PostCSS so the parent project's
  // Tailwind/PostCSS config is not inherited during the build.
  css: { postcss: {} },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    modulePreload: false,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
        popup: resolve(__dirname, 'popup.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: '[name].[ext]',
        // Keep each entry self-contained; no shared runtime chunk.
        inlineDynamicImports: false,
        manualChunks: undefined,
      },
    },
  },
});
