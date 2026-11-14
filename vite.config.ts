import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path is set for GitHub Pages project-site hosting.
// Override with the VITE_BASE env var if the repo name changes.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/jolt-extension/',
  server: {
    // Listen on all interfaces so the Cloudflare tunnel can reach the dev
    // server, and accept any *.trycloudflare.com quick-tunnel host (the
    // subdomain changes on every run). allowedHosts entries are bare
    // hostnames — no scheme, no https:// prefix.
    host: true,
    allowedHosts: ['.trycloudflare.com'],
  },
});
