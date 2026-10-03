/**
 * Build `preview/composer-align.html`: the New Session composer before and after
 * the plugin, beside the conversation composer it is being aligned to.
 *
 * Three real frames at the same window size, all rendered from the shipped
 * stylesheets and the shipped class hashes (`tools/composer-replica.mjs`):
 *
 *   发送后（对话态）      新会话 · 修复前       新会话 · 修复后
 *
 * A dashed reference band is drawn at the conversation composer's box on both
 * New Session panels (measured live from the first frame, not hard-coded), and
 * the actual input card is outlined, so the jump and its removal are visible
 * without reading any numbers. The measurements themselves are asserted by
 * `tools/verify-composer-align.mjs`.
 *
 * Run: node tools/build-composer-align-preview.mjs
 *      node tools/screenshot-preview.mjs composer-align
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { frame, PLUGIN_CSS, CONVERSATION_CSS, CHAT_CSS, TOKENS } from './composer-replica.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Window size of every panel, in CSS px. */
const W = 1000;
const H = 820;

const panel = ({ label, note, id, phase, patched = false }) => `
<figure class="panel${patched ? ' patched' : ''}" data-id="${id}">
  <figcaption><span class="tag">${label}</span>${note}</figcaption>
  <div class="screen">${frame({ id, phase, wrapped: true, lines: 3 })}</div>
</figure>`;

const html = `<!doctype html>
<html lang="zh" data-platform="darwin"><head><meta charset="utf-8">
<title>新会话输入框对齐 · dsh-plugin-composer-align</title>
<style>${TOKENS}</style>
<style>${CONVERSATION_CSS}</style>
<style>${CHAT_CSS}</style>
<style id="composer-align">${PLUGIN_CSS.replace(/\[data-conversation-content\]\[data-content-phase="hero"\]/g, '.patched [data-conversation-content][data-content-phase="hero"]')}</style>
<style>
  html, body { margin: 0; background: #0b0b0d; font-family: -apple-system, "SF Pro Text", "PingFang SC", system-ui, sans-serif; }
  .wrap { display: grid; grid-template-columns: repeat(3, ${W}px); gap: 1px; background: #2a2a30; }
  figure { margin: 0; background: #0b0b0d; }
  figcaption { color: #8b8b95; font-size: 12px; letter-spacing: .02em; padding: 10px 14px; background: #141417; }
  figcaption .tag { color: #e8e8ee; font-weight: 600; margin-right: 8px; }
  .patched figcaption .tag { color: #6ee7a8; }
  .screen { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; background: #fff; }
  .screen .ST7X_W_root { height: ${H}px; }
  /* the reference band = where the conversation composer sits */
  .ref { position: absolute; pointer-events: none; border: 1px dashed #4d93f8;
         background: rgba(77, 147, 248, .07); border-radius: 28px; box-sizing: border-box; }
  .ref span { position: absolute; top: -19px; left: 2px; font-size: 11px; color: #2f6fd0; white-space: nowrap; }
  .actual { position: absolute; pointer-events: none; border: 2px solid #f43f5e; border-radius: 28px; box-sizing: border-box; }
  /* inside the card, top right: the card's own placeholder text is left aligned */
  .actual span { position: absolute; top: 8px; right: 14px; font-size: 11px; color: #f43f5e; white-space: nowrap; }
  .actual.good { border-color: #16a34a; }
  .actual.good span { color: #16a34a; }
</style>
</head><body>
<div class="wrap">
${panel({ label: '发送后（对话态）', note: '目标位置：卡片 + 下方用量行，距底 30px', id: 'target', phase: 'active' })}
${panel({ label: '新会话 · 修复前', note: '官方把整块垂直居中：卡片悬在窗口中间，还比目标高 16px', id: 'before', phase: 'hero' })}
${panel({ label: '新会话 · 修复后', note: '输入框落在目标位置，用量行高度也预留好了', id: 'after', phase: 'hero', patched: true })}
</div>
<script>
/* Measure the conversation composer once, then draw the same box on the two New
   Session panels. Nothing here feeds the assertions in verify-composer-align.mjs. */
const screenOf = (figure) => figure.querySelector('.screen');
const boxIn = (el, host) => {
  const r = el.getBoundingClientRect();
  const h = host.getBoundingClientRect();
  return { x: r.left - h.left, y: r.top - h.top, w: r.width, h: r.height };
};
const figureOf = (id) => document.querySelector('figure[data-id="' + id + '"]');
const targetScreen = screenOf(figureOf('target'));
const targetCard = targetScreen.querySelector('[data-composer-card]');
const target = boxIn(targetCard, targetScreen);

const overlay = (host, rect, className, label) => {
  const el = document.createElement('div');
  el.className = className;
  el.style.left = rect.x + 'px';
  el.style.top = rect.y + 'px';
  el.style.width = rect.w + 'px';
  el.style.height = rect.h + 'px';
  el.innerHTML = '<span>' + label + '</span>';
  host.appendChild(el);
};

for (const id of ['target', 'before', 'after']) {
  const screen = screenOf(figureOf(id));
  const card = screen.querySelector('[data-composer-card]');
  const actual = boxIn(card, screen);
  if (id === 'target') {
    overlay(screen, actual, 'actual good', '发送后输入框 = 目标');
    continue;
  }
  overlay(screen, target, 'ref', '发送后输入框的位置（目标）');
  overlay(screen, actual, 'actual', '新会话输入框 · 现在在这里');
}
</script>
</body></html>`;

writeFileSync(join(root, 'preview/composer-align.html'), html);
console.log('wrote preview/composer-align.html');
