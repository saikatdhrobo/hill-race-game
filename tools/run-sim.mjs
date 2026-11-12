/**
 * Bundles the headless physics harness with esbuild and runs it in Node.
 * Handy for tuning handling without a browser:  npm run sim
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outfile = join(here, '.sim-bundle.mjs');

await build({
  entryPoints: [join(here, 'headless-sim.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  outfile,
  logLevel: 'warning',
});

await import(`file://${outfile}?t=${Date.now()}`);
