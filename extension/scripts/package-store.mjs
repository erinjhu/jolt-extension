/**
 * Builds the Chrome Web Store upload zip.
 *
 * `dist/` keeps the manifest `"key"` so local "Load unpacked" installs share
 * the store item's extension ID. The Web Store rejects uploads that contain
 * `"key"`, so this stages a copy of `dist/`, strips the field, zips the staged
 * contents at the archive root, then removes the staging folder.
 *
 * Run `npm run build` first (the `zip:store` npm script does this for you).
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const stage = resolve(root, '.store-stage');
const zipPath = resolve(root, 'jolt-autofill-store.zip');

function run(cmd, args, cwd) {
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (res.error || res.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

if (!existsSync(resolve(dist, 'manifest.json'))) {
  throw new Error('dist/manifest.json not found — run the build first.');
}

rmSync(stage, { recursive: true, force: true });
rmSync(zipPath, { force: true });

try {
  mkdirSync(stage, { recursive: true });
  cpSync(dist, stage, { recursive: true });

  const manifestPath = resolve(stage, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  delete manifest.key;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  // Zip the *contents* of the stage folder so manifest.json sits at the root.
  // Top-level names are listed explicitly to avoid "./" prefixes in the archive.
  const entries = readdirSync(stage);
  if (process.platform === 'win32') {
    // Windows ships bsdtar, which writes proper zip archives with `-a`.
    // Use the system copy explicitly: Git Bash's GNU tar can shadow it on PATH.
    const sysTar = resolve(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
    run(sysTar, ['-a', '-c', '-f', zipPath, '-C', stage, ...entries], root);
  } else {
    run('zip', ['-r', '-q', zipPath, ...entries], stage);
  }
  console.log(`Created ${zipPath}`);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
