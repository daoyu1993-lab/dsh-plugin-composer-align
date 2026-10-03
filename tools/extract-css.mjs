/**
 * Extract inline CSS strings from a DSH client bundle, so a preview page can be
 * rendered with the component's REAL styles (real class-name hashes, real
 * geometry, real tokens).
 *
 * Bundles carry their CSS modules as double-quoted string literals assigned to
 * `const css$N` / `var <name>_css_default`. Anything shorter than MIN_CSS_LENGTH
 * is skipped as noise (class-name maps, small helpers).
 *
 * Usage: node tools/extract-css.mjs <bundle.js> <out.css> [--min <n>] [--only <name[,name]>]
 *
 *   --min <n>     收下更短的字面量。`preview/workspace.css` 需要它：那条
 *                 93 字节的 `css$2`（AnimatedRows 的 `.…_exits`）低于默认门槛。
 *   --only <names> 只要这几个字面量，不设长度门槛，也不写抬头注释
 *                  —— `preview/palette.css` 就是这样从 theme 包里单独取出
 *                  `design_platform_css_default` 那一段的。
 *
 * 这三个 CSS 参数化的用法见 README「自检」第 0 步：官方产物片段不随仓库分发，
 * 由本机 DSH 现场抽出来。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [, , bundlePath, outPath, ...flags] = process.argv;
if (!bundlePath || !outPath) {
  console.error(
    'usage: node tools/extract-css.mjs <bundle.js> <out.css> [--min <n>] [--only <name[,name]>]',
  );
  process.exit(1);
}

const option = (name, fallback) => {
  const at = flags.indexOf(name);
  return at === -1 ? fallback : flags[at + 1];
};
const MIN_CSS_LENGTH = Number(option('--min', 200));
const ONLY = String(option('--only', '') ?? '')
  .split(',')
  .filter(Boolean);

const source = readFileSync(bundlePath, 'utf8');
const re = /(?:const|var|let)\s+([A-Za-z0-9_$]+)\s*=\s*"((?:[^"\\]|\\.)*)"/g;

const out = [];
let match;
while ((match = re.exec(source)) !== null) {
  const [, name, raw] = match;
  const selected = ONLY.length > 0 && ONLY.includes(name);
  if (!selected && (ONLY.length > 0 || raw.length < MIN_CSS_LENGTH)) continue;
  // The literal is double-quoted with escaped quotes/backslashes.
  const css = JSON.parse('"' + raw + '"');
  if (!css.includes('{')) continue;
  // `--only` is a single-sheet slice: no header, so the file is the CSS itself.
  out.push(ONLY.length > 0 ? css : `/* ${name} */\n${css}`);
}

const text = out.join('\n\n');
writeFileSync(outPath, text);
console.log(`${outPath}: ${out.length} stylesheets, ${text.length} bytes`);
