/**
 * Render every preview page under `preview/` to its PNG.
 *
 * The pages are built by `tools/build-preview.mjs`; this script only drives
 * headless Chrome over them. Window sizes are the ones the committed PNGs were
 * produced with (device scale factor 2), so re-running it reproduces the same
 * framing. `idle-dot.png` (rule 13) is the newest one.
 *
 * Usage: node tools/screenshot-preview.mjs [page…]
 *        node tools/screenshot-preview.mjs idle-dot      # just one page
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const preview = join(root, 'preview');

/** page (without extension) → [width, height] of the Chrome window, in CSS px. */
const PAGES = {
  compare: [1400, 1240],
  align: [760, 1120],
  overflow: [760, 1240],
  header: [760, 900],
  heights: [760, 1180],
  folder: [1240, 560],
  fill: [1400, 660],
  'fill-light': [1400, 660],
  grad: [1400, 660],
  'idle-dot': [1200, 760],
  'new-session': [1120, 1600],
  'composer-align': [3000, 900],
};

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].find((p) => existsSync(p));
if (!CHROME) throw new Error('no Chrome/Chromium found to render the previews');

const wanted = process.argv.slice(2);
const names = Object.keys(PAGES).filter((n) => wanted.length === 0 || wanted.includes(n));
for (const name of names) {
  const [w, h] = PAGES[name];
  const page = join(preview, `${name}.html`);
  if (!existsSync(page)) throw new Error(`missing ${page} — run tools/build-preview.mjs first`);
  execFileSync(
    CHROME,
    ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
     `--window-size=${w},${h}`, `--screenshot=${join(preview, `${name}.png`)}`, `file://${page}`],
    { stdio: ['ignore', 'ignore', 'ignore'] },
  );
  console.log(`wrote preview/${name}.png (${w * 2}×${h * 2})`);
}
