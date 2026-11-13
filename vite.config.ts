import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path is set for GitHub Pages project-site hosting.
// Override with the VITE_BASE env var if the repo name changes.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/jolt-extension/',
});
