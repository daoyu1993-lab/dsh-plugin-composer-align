/**
 * Verify that the New Session composer and the conversation composer occupy the
 * *same* box — the promise dsh-plugin-composer-align makes.
 *
 * The markup and stylesheets come from `tools/composer-replica.mjs` (shipped CSS,
 * shipped class hashes, the renderer's `display:contents` slot outlets). Each
 * phase is rendered twice, once with those outlets and once without, so the
 * plugin's role-based selectors are proven not to depend on the wrapper depth.
 * The plugin's stylesheet is toggled on the same page, which is how the "before"
 * column is measured.
 *
 * The load-bearing assertions are not "the card is 98px tall" but **"the hero
 * card box equals the active card box to the pixel, in both DOM shapes, with and
 * without a selected workspace, and for a conversation that overflows"** — that
 * is what "一模一样的位置" means, and it keeps failing loudly if upstream changes
 * either side of the comparison.
 *
 * Usage: node tools/verify-composer-align.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { frame, PLUGIN_CSS, CONVERSATION_CSS, CHAT_CSS, TOKENS } from './composer-replica.mjs';

/** Frame id per case, in the order the frames are built below. */
const IDS = ['hero', 'active', 'activeBare', 'heroFlat', 'activeFlat', 'heroNoChip', 'activeLong'];

/** Frames: the real trees, the wrapper-free shapes, and the edge cases. */
const FRAMES = [
  frame({ id: 'hero', phase: 'hero', wrapped: true }),
  /* `active` carries the status row the profile shows in every conversation
     (`performanceUsage: compact`: tokens/s + cache hit + context meter), so it is
     the box the New Session composer has to match; `activeBare` is a conversation
     whose dock has nothing at all to draw. */
  frame({ id: 'active', phase: 'active', wrapped: true, dock: 'stats' }),
  frame({ id: 'activeBare', phase: 'active', wrapped: true, dock: 'empty' }),
  frame({ id: 'heroFlat', phase: 'hero', wrapped: false }),
  frame({ id: 'activeFlat', phase: 'active', wrapped: false, dock: 'stats' }),
  frame({ id: 'heroNoChip', phase: 'hero', wrapped: true, withWorkspace: false }),
  frame({ id: 'activeLong', phase: 'active', wrapped: true, lines: 60 }),
];

const MEASURE = `
<pre id="out"></pre>
<script>
const frameOf = (id) => document.getElementById(id);
const box = (el, host) => {
  const r = el.getBoundingClientRect();
  const h = host.getBoundingClientRect();
  return { x: +(r.left - h.left).toFixed(2), y: +(r.top - h.top).toFixed(2),
           w: +r.width.toFixed(2), h: +r.height.toFixed(2),
           right: +(r.right - h.left).toFixed(2), bottom: +(r.bottom - h.top).toFixed(2),
           fromBottom: +(h.bottom - r.bottom).toFixed(2) };
};
const measure = (id) => {
  const f = frameOf(id);
  const card = f.querySelector('[data-composer-card]');
  const input = f.querySelector('[data-composer-input]');
  const scroll = f.querySelector('[data-conversation-scroll]');
  const seat = f.querySelector('[data-composer-seat]');
  const chip = f.querySelector('.bocITq_workspace');
  const headline = f.querySelector('.bocITq_headline');
  /* The box chain from the card up to the root: what is a flex item, what
     generates no box, and where the growth stopped. Printed for diagnosis. */
  const chain = [];
  for (let el = card; el !== null && el !== f; el = el.parentElement) {
    const cs = getComputedStyle(el);
    chain.push({
      tag: el.tagName.toLowerCase(),
      slot: el.getAttribute('data-slot'),
      contents: cs.display === 'contents',
      display: cs.display, flex: cs.flex, h: box(el, f).h, y: box(el, f).y,
    });
  }
  return {
    card: box(card, f), input: box(input, f), seat: box(seat, f), scroll: box(scroll, f),
    headline: headline ? box(headline, f) : null,
    chip: chip ? box(chip, f) : null,
    chain,
    inputMinHeight: getComputedStyle(input).minHeight,
    /* the card must be fully inside the body: nothing pushed off the bottom edge */
    clipped: card.getBoundingClientRect().bottom > scroll.getBoundingClientRect().bottom + 0.51
      || card.getBoundingClientRect().top < scroll.getBoundingClientRect().top - 0.51,
  };
};

const plugin = document.getElementById('composer-align');
const result = { before: {}, after: {} };
const ids = ${JSON.stringify(IDS)};
for (const id of ids) result.before[id] = measure(id);
plugin.disabled = false;        /* the stylesheet is live from here on */
for (const id of ids) result.after[id] = measure(id);
document.getElementById('out').textContent = 'RESULT:' + JSON.stringify(result);
</script>`;

const html = `<!doctype html><html lang="zh" data-platform="darwin"><head><meta charset="utf-8">
<style>${TOKENS}</style>
<style>${CONVERSATION_CSS}</style>
<style>${CHAT_CSS}</style>
<link id="composer-align" rel="stylesheet" href="data:text/css;charset=utf-8,${encodeURIComponent(PLUGIN_CSS)}" disabled>
<style>
  html, body { margin: 0; background: #fff; }
  .frame { width: 1600px; height: 1000px; overflow: hidden; border: 1px solid #ddd; margin: 0 0 16px; }
</style>
</head><body>
${FRAMES.map((f) => `<div class="frame">${f}</div>`).join('\n')}
${MEASURE}
</body></html>`;

const tmp = join(tmpdir(), 'dsh-composer-align-verify.html');
writeFileSync(tmp, html);

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].find((p) => existsSync(p));
if (!CHROME) throw new Error('no Chrome/Chromium found to run the verification');

const dom = execFileSync(
  CHROME,
  ['--headless=new', '--disable-gpu', '--no-first-run', '--dump-dom', '--virtual-time-budget=3000', `file://${tmp}`],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
const match = dom.match(/RESULT:(\{.*?\})<\/pre>/s);
if (!match) throw new Error('the measuring page produced no RESULT payload');
const r = JSON.parse(match[1]);

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};
const near = (a, b, tol = 0.51) => Math.abs(a - b) <= tol;
const same = (a, b, keys = ['x', 'y', 'w', 'h']) => keys.every((k) => near(a[k], b[k]));
const fmt = (b) => `x=${b.x} y=${b.y} ${b.w}×${b.h} 底距=${b.fromBottom}`;
const delta = (a, b) => `Δx=${(a.x - b.x).toFixed(2)} Δy=${(a.y - b.y).toFixed(2)} Δw=${(a.w - b.w).toFixed(2)} Δh=${(a.h - b.h).toFixed(2)}`;

const b = r.before;
const a = r.after;

// ── the problem, before the plugin ────────────────────────────────────────
check('修复前：新会话卡片与对话卡片确实不在同一处（否则本插件无事可做）',
  !same(b.hero.card, b.active.card),
  `新会话 ${fmt(b.hero.card)} vs 对话 ${fmt(b.active.card)} — ${delta(b.hero.card, b.active.card)}`);
check('修复前：高度差 = 官方 hero 写字区的 52px vs 对话的 36px',
  near(b.hero.card.h - b.active.card.h, 16), `Δh=${(b.hero.card.h - b.active.card.h).toFixed(2)}px`);
check('修复前：官方自己在用量行出现时也会把输入框顶高 22px（本插件要消掉这段位移）',
  near(b.activeBare.card.y - b.active.card.y, 22),
  `dock 为空 ${fmt(b.activeBare.card)} → 有用量 ${fmt(b.active.card)}，Δy=${(b.activeBare.card.y - b.active.card.y).toFixed(2)}`);

// ── the promise, after the plugin ─────────────────────────────────────────
for (const [label, heroId, activeId] of [
  ['真实 DOM（含渲染器槽位包装）', 'hero', 'active'],
  ['去包装的扁平 DOM（健壮性）', 'heroFlat', 'activeFlat'],
  ['尚未选工作区的新会话（无工作区行）', 'heroNoChip', 'active'],
]) {
  check(`修复后·卡片位置一致（${label}）`, same(a[heroId].card, a[activeId].card),
    `${fmt(a[heroId].card)} vs ${fmt(a[activeId].card)} — ${delta(a[heroId].card, a[activeId].card)}`);
  check(`修复后·写字区位置一致（${label}）`, same(a[heroId].input, a[activeId].input),
    `${fmt(a[heroId].input)} vs ${fmt(a[activeId].input)}`);
}
check('修复后·用量行没显示时也留着同样的间距（用户要求：空着，但别去掉）',
  same(a.activeBare.card, a.active.card) && near(a.activeBare.card.fromBottom, 30),
  `${fmt(a.activeBare.card)} vs ${fmt(a.active.card)}`);
check('修复后·高对话（内容溢出、座位 sticky）时卡片仍钉在同一位置',
  same(a.activeLong.card, a.active.card), `${fmt(a.activeLong.card)} vs ${fmt(a.active.card)}`);

// ── the same box, spelled out ─────────────────────────────────────────────
check('修复后·宽度与对话态相同（卡片上限内居中）', near(a.hero.card.w, a.active.card.w), `w=${a.hero.card.w}`);
check('修复后·卡片底边 = 对话态卡片底边（用量行高度已计入）',
  near(a.hero.card.fromBottom, a.active.card.fromBottom) && a.hero.card.fromBottom > 20,
  `新会话底距 ${a.hero.card.fromBottom}px / 对话底距 ${a.active.card.fromBottom}px`);
check('修复后·写字区高度 = 对话态的 36px', a.hero.inputMinHeight === '36px' && near(a.hero.input.h, a.active.input.h),
  `min-height=${a.hero.inputMinHeight} h=${a.hero.input.h} vs ${a.active.input.h}`);
check('修复后·卡片没有被挤出身体区（未被裁切）',
  !a.hero.clipped && !a.active.clipped && !a.heroFlat.clipped,
  `hero=${a.hero.clipped} active=${a.active.clipped}`);

// ── the hero must still read as a hero ────────────────────────────────────
check('保留：新会话大标题仍在，且仍在卡片上方',
  a.hero.headline !== null && a.hero.headline.bottom < a.hero.card.y,
  a.hero.headline ? `标题底 ${a.hero.headline.bottom} < 卡片顶 ${a.hero.card.y}` : '标题不见了');
check('保留：大标题仍在余量里垂直居中（不贴顶、不贴卡片）',
  a.hero.headline.y > 20 && a.hero.headline.bottom < a.hero.card.y,
  `标题 ${fmt(a.hero.headline)}`);
check('保留：工作区选择行与卡片之间的间距没有被动过（输入框上面的东西保持原位）',
  near(b.hero.card.y - b.hero.chip.bottom, a.hero.card.y - a.hero.chip.bottom),
  `修复前 ${(b.hero.card.y - b.hero.chip.bottom).toFixed(2)}px → 修复后 ${(a.hero.card.y - a.hero.chip.bottom).toFixed(2)}px`);
check('未越界：带用量行的对话态几何完全没被动过（用户拿来对齐的那个位置）',
  same(b.active.card, a.active.card) && same(b.active.input, a.active.input),
  `${fmt(b.active.card)} → ${fmt(a.active.card)}`);
check('未越界：对话态用量行本身的高度没变（仍由官方 StatsPills 决定）',
  near(a.active.scroll.fromBottom, b.active.scroll.fromBottom) && near(a.active.card.fromBottom, b.active.card.fromBottom),
  `底距 ${b.active.card.fromBottom} → ${a.active.card.fromBottom}`);
check('未越界：没有任何针对 active/settling 的选择器（对话态唯一的影响是 dock 占位）',
  !/\bactive\b|\bsettling\b/.test(PLUGIN_CSS) && (PLUGIN_CSS.match(/data-content-phase/g) ?? []).length > 0,
  `${(PLUGIN_CSS.match(/data-content-phase/g) ?? []).length} 处 phase 作用域，全部为 hero；dock 占位规则不带 phase`);

console.log('\nraw measured boxes (frame 1600×1000):');
for (const [when, set] of [['before', r.before], ['after ', r.after]]) {
  for (const [state, m] of Object.entries(set)) {
    console.log(`  ${when} ${state.padEnd(11)} card ${fmt(m.card)} | input ${fmt(m.input)}` +
      `${m.chip ? ` | chip ${fmt(m.chip)}` : ''}${m.headline ? ` | headline y=${m.headline.y}` : ''}` +
      ` | clipped=${m.clipped}`);
  }
}
console.log('\nbox chain from the card up to the root (after, real DOM):');
for (const [state, m] of [['hero', r.after.hero], ['active', r.after.active]]) {
  console.log(`  ${state}:`);
  for (const c of m.chain) {
    console.log(`    ${c.tag}${c.slot ? `[slot=${c.slot}]` : ''}${c.contents ? ' (display:contents)' : ''}` +
      ` display=${c.display} flex=${c.flex} h=${c.h} y=${c.y}`);
  }
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
