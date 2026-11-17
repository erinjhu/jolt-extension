# Jolt for Phone

A React + Vite web app that captures a handwritten note photo, runs local OCR
(tesseract.js), and assembles a Jolt session payload.

- **Production (GitHub Pages):** https://erinjhu.github.io/jolt-extension/
- **Companion Chrome extension:** see [`extension/README.md`](extension/README.md)

## Local development

```powershell
npm install
npm run dev
```

Vite serves the app at `http://localhost:5173`. That's enough for desktop
work, but testing the camera/OCR flow on a **phone** needs two things a plain
`localhost` can't give you:

1. A public URL your phone can reach (your phone isn't on your dev machine's
   loopback).
2. **HTTPS** — mobile browsers only expose the camera (`getUserMedia`) on a
   secure origin.

A Cloudflare quick tunnel gives you both, for free, with no account.

## Testing on a phone with a Cloudflare tunnel

### 1. Install `cloudflared`

```powershell
winget install --id Cloudflare.cloudflared
```

(Alternatively `choco install cloudflared`, or download the binary from the
[cloudflared releases](https://github.com/cloudflare/cloudflared/releases).)
Verify it's on your PATH:

```powershell
cloudflared --version
```

### 2. Start the Vite dev server

```powershell
npm run dev
```

Leave this running. The `vite.config.ts` `server` block is already set to
`host: true`, so the server listens on all network interfaces and the tunnel
can reach it (see the config note below).

### 3. Open the tunnel (in a second terminal)

```powershell
cloudflared tunnel --url http://localhost:5173
```

`cloudflared` prints a public HTTPS URL that looks like:

```
https://<random-words>.trycloudflare.com
```

Open that URL on your phone. Because it's HTTPS, the camera works and the OCR
flow can be tested end to end on the device.

> **Quick tunnels are ephemeral.** The hostname is random and changes every
> time you restart `cloudflared`, and the tunnel disappears when you stop the
> command. That's expected for throwaway testing — no setup required. For a
> stable hostname you'd create a named tunnel with a Cloudflare account, which
> is out of scope here.

### 4. Stop

Press `Ctrl+C` in each terminal (tunnel first, then the dev server).

## Required `vite.config.ts` setting

Vite rejects requests whose `Host` header isn't in its allow-list, so a
tunnel request is blocked unless you opt the host in. The config already
contains:

```ts
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/jolt-extension/',
  server: {
    // Listen on all interfaces so the tunnel can reach the dev server.
    host: true,
    // Accept any *.trycloudflare.com quick-tunnel host. The leading dot
    // matches every subdomain, so you never edit this when the random
    // tunnel URL changes. allowedHosts entries are BARE hostnames —
    // no scheme, no "https://" prefix, no trailing slash.
    allowedHosts: ['.trycloudflare.com'],
  },
});
```

Two things that commonly trip people up:

- **No scheme.** Use `.trycloudflare.com`, not
  `https://....trycloudflare.com`. An entry with `https://` never matches and
  Vite responds with `Blocked request. This host is not allowed.`
- **Leading dot = wildcard subdomain.** `.trycloudflare.com` matches
  `katie-featured-lynn-knows.trycloudflare.com` and every other random name,
  so the config survives tunnel restarts. If you want to lock it to one exact
  hostname instead, list the full host with no leading dot.

If you host the tunnel on a custom domain, add that bare hostname to the array
as well, e.g. `allowedHosts: ['.trycloudflare.com', 'test.example.com']`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Blocked request. This host is not allowed.` | The tunnel host isn't in `server.allowedHosts`, or the entry has an `https://` prefix. Use the bare `.trycloudflare.com` form. |
| Phone can't load the page / connection refused | The dev server isn't listening on all interfaces. Confirm `server.host: true` and that `npm run dev` is still running. |
| Camera button does nothing on the phone | You opened an `http://` URL. Use the `https://` tunnel URL — the camera needs a secure origin. |
| Assets 404 on the tunnel URL | The `base` is `/jolt-extension/` for Pages. The dev server serves under that base too; open the tunnel root and let the app redirect, or append the base path. |
