/**
 * A faithful DOM replica of the DSH conversation column, for the
 * dsh-plugin-composer-align tools.
 *
 * Everything here is *shipped* material: the stylesheets are lifted verbatim out
 * of `@deepseek-ai/dsh-client-ui-conversation/lib/client.js` (real class-name
 * hashes, real geometry) plus the real token palette from `preview/`, and the
 * markup mirrors the JSX the shell renders — including the renderer's
 * `display:contents` slot outlets:
 *
 *   [data-composer-seat]
 *     └ div[data-slot="conversation.composer"]        display:contents
 *         └ div[data-chain-overlay-fallback=…]        display:contents
 *             └ div.composerStack
 *                 ├ HeroShell                       (hero only)
 *                 ├ div.heroWorkspaceRow            (hero only)
 *                 └ div[data-slot="conversation.composer.bar"]  display:contents
 *                     └ div.yhfFVG_root > div.yhfFVG_card[data-composer-card]
 *
 * `wrapped: false` drops those outlets, so a rule that depends on their depth is
 * caught instead of silently passing on the replica alone.
 *
 * The only hand-written parts are the sample conversation text and the inline
 * glyphs; no geometry, colour or spacing is invented.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Resolve a path in both layouts: this workspace (`dsh-plugin-x/…`) and the plugin repo. */
const read = (p) =>
  readFileSync(
    [join(root, p), join(root, p.replace(/^dsh-plugin-[^/]+\//, ''))].find((candidate) =>
      existsSync(candidate),
    ) ?? join(root, p),
    'utf8',
  );

/**
 * The plugin's stylesheet, obtained by *running the plugin*: the client module is
 * evaluated in a sandbox, its `apply(ctx)` is called with a fake effect context,
 * and the `<style>` element it installs is read back. Nothing is sliced out of
 * the file by hand, so template constants, syntax and the install/cleanup path
 * are all exercised here too.
 */
export const PLUGIN_CSS = (() => {
  const source = read('dsh-plugin-composer-align/client.js');
  let definition;
  let installed = null;
  const document = {
    createElement: () => ({
      dataset: {},
      textContent: '',
      remove() {
        if (installed === this) installed = null;
      },
    }),
    head: {
      appendChild: (tag) => {
        installed = tag;
      },
    },
  };
  const sandbox = {
    window: { __ModuleLoader__: { load: (def) => { definition = def; } } },
    document,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'dsh-plugin-composer-align/client.js' });
  if (!definition) throw new Error('client.js never registered itself on window.__ModuleLoader__');
  const mod = definition.factory(() => {
    throw new Error('the plugin must not require() anything');
  });
  const cleanups = [];
  mod.apply({ effect: (fn) => cleanups.push(fn()) });
  if (installed === null) throw new Error('apply(ctx) installed no stylesheet');
  const css = installed.textContent;
  for (const cleanup of cleanups) cleanup();
  if (installed !== null) throw new Error('the stylesheet was not removed on cleanup');
  if (typeof css !== 'string' || css.length < 200) throw new Error('the installed stylesheet looks empty');
  return css;
})();

/**
 * Every CSS-module string in the conversation bundle, verbatim, keyed by a marker
 * class so a rename shows up as a hard failure instead of silently missing
 * styles.
 */
export const CONVERSATION_CSS = (() => {
  const source = read('core/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js');
  const re = /(?:const|var|let)\s+([A-Za-z0-9_$]+)\s*=\s*"((?:[^"\\]|\\.)*)"/g;
  const wanted = [
    ['ConversationRoot', 'ST7X_W_root'],
    ['HeroShell', 'bocITq_root'],
    ['InputBar', 'yhfFVG_root'],
    ['ContextMeter', 'y0jqnG_root'],
  ];
  const found = {};
  let match;
  while ((match = re.exec(source)) !== null) {
    /* Not every literal is JSON-clean (`\0` shows up in the bundle); the CSS
       modules are, and a parse failure is not one of them. */
    let css;
    try {
      css = JSON.parse('"' + match[2] + '"');
    } catch {
      continue;
    }
    if (css.length < 200) continue;
    const hit = wanted.find(([, marker]) => css.includes(marker));
    if (hit) found[hit[0]] = css;
  }
  const missing = wanted.map(([name]) => name).filter((name) => found[name] === undefined);
  if (missing.length > 0) throw new Error(`bundle no longer ships: ${missing.join(', ')}`);
  return wanted.map(([name]) => `/* ${name} */\n${found[name]}`).join('\n\n');
})();

/**
 * The status row's own stylesheet, from `@deepseek-ai/dsh-client-ui-chat` —
 * `StatsPills` is what `conversation.composer.dock` holds in this profile's
 * `performanceUsage: compact` mode.
 */
export const CHAT_CSS = (() => {
  const source = read('core/dsh/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js');
  const re = /(?:const|var|let)\s+([A-Za-z0-9_$]+)\s*=\s*"((?:[^"\\]|\\.)*)"/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    let css;
    try {
      css = JSON.parse('"' + match[2] + '"');
    } catch {
      continue;
    }
    if (css.includes('OpZ85W_root')) return css;
  }
  throw new Error('the chat bundle no longer ships the StatsPills stylesheet');
})();

/** The real token palette (`--dsw-*`) the stylesheets resolve against. */
export const TOKENS = ['palette.css', 'theme.css'].map((f) => read(join('preview', f))).join('\n');

const GLYPH = (size, path, extra = '') =>
  `<svg ${extra}width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">${path}</svg>`;
const PLUS = '<path d="M8 3.4v9.2M3.4 8h9.2"/>';
const MIC = '<path d="M8 2.6a2 2 0 0 1 2 2v3.4a2 2 0 0 1-4 0V4.6a2 2 0 0 1 2-2Z"/><path d="M3.8 7.6a4.2 4.2 0 0 0 8.4 0M8 11.8V14"/>';
const SEND = '<path d="M8 12.4V3.6M4.4 7.2 8 3.6l3.6 3.6"/>';
const FOLDER = '<path d="M2 4.4h3.4l1 1.4H14v6.4H2Z"/>';
const GAUGE = '<path d="M8 8 12 4"/><circle cx="8" cy="8" r="6"/>';
const DATABASE = '<ellipse cx="8" cy="4.4" rx="5.2" ry="2.2"/><path d="M2.8 4.4v7.2c0 1.2 2.3 2.2 5.2 2.2s5.2-1 5.2-2.2V4.4"/>';
const RING = '<circle cx="8" cy="8" r="6" stroke-dasharray="26 12"/>';
const FISH = '<path d="M5.6 4.2c4.2-2.4 7.6.6 8.4 2.6-2.6.6-4 2.4-4 2.4s1.2 2 3.8 2.4c-1.8 2.6-5.6 2.6-7.4.6-1-1.2-1.4-2.6-1.4-4 0-1.6.4-3 .6-4Z" fill="currentColor" stroke="none"/>';

/**
 * The InputBar row, identical in both phases (it is the same component in the
 * app): the shipped 28px `+` button, a 13px selector, and the 34px send button
 * that sets the row height.
 */
const INPUT_ROW = `
            <div class="yhfFVG_row">
              <div class="yhfFVG_tools">
                <button type="button" class="yhfFVG_add" aria-label="添加文件或调用指令">${GLYPH(14, PLUS)}</button>
                <div class="yhfFVG_modes">
                  <button type="button" class="yhfFVG_select">完全权限</button>
                </div>
              </div>
              <div class="yhfFVG_trailing">
                <div class="yhfFVG_standardControls">
                  <button type="button" class="yhfFVG_select">DeepSeek-V4.1-Flash High</button>
                </div>
                <div class="yhfFVG_activity">
                  <button type="button" class="yhfFVG_select" aria-label="语音输入">${GLYPH(16, MIC)}</button>
                  <button type="button" class="yhfFVG_primary" aria-label="发送消息">${GLYPH(16, SEND)}</button>
                </div>
              </div>
            </div>`;

/**
 * The composer dock — the input card's last sibling, below it. In the hero the
 * shell never calls the slot, so the div is truly empty and the shipped
 * `.hero .dock:empty{display:none}` hides it; in a conversation the slot outlet
 * is always rendered (even when the status row has nothing to show), and the
 * row itself appears once the session has usage.
 */
const dock = ({ hero, wrapped, dock: kind }) => {
  const anchor = (children) =>
    `<div data-slot="conversation.composer.dock" style="display:contents">${children}</div>`;
  /* The hero never calls the slot at all, so the div is truly `:empty`. */
  if (hero) return '<div class="yhfFVG_dock"></div>';
  const status = kind === 'stats'
    ? `<div class="OpZ85W_root" data-composer-stats>
          <span class="OpZ85W_pill">${GLYPH(14, GAUGE)}223 tok/s</span>
          <span class="OpZ85W_pill">${GLYPH(14, DATABASE)}缓存命中 99.7%</span>
        </div>`
    : '';
  /* The context meter is its own dock occupant and is what keeps the dock 26px
     tall in a conversation even before any usage exists. */
  const meter = kind === 'empty'
    ? ''
    : `<div class="y0jqnG_root"><button type="button" class="y0jqnG_trigger">${GLYPH(14, RING)}<span class="y0jqnG_percent">32%</span></button></div>`;
  const inner = `${anchor(status)}${meter}`;
  return `<div class="yhfFVG_dock">${wrapped ? inner : status + meter}</div>`;
};

const inputBar = ({ hero, wrapped, placeholder, dock: dockKind }) => `
        ${hero && wrapped ? '<div data-slot="conversation.composer.bar" style="display:contents">' : ''}
        <div class="yhfFVG_root${hero ? ' yhfFVG_hero' : ''}">
          <div class="yhfFVG_card" data-composer-card>
            <div class="yhfFVG_scroll" data-input-scroll>
              <div class="yhfFVG_grow">
                <div class="yhfFVG_input" data-composer-input contenteditable="true" role="textbox" aria-multiline="true" aria-label="${placeholder}"></div>
                <div class="yhfFVG_placeholder" data-composer-placeholder>${placeholder}</div>
              </div>
            </div>
${INPUT_ROW}
          </div>
          ${dock({ hero, wrapped, dock: dockKind })}
        </div>
        ${hero && wrapped ? '</div>' : ''}`;

/** HeroShell: the headline only — the workspace row is its sibling in the stack. */
const heroShell = () => `
          <div class="bocITq_root">
            <div class="bocITq_stack">
              <div class="bocITq_headline">
                <span class="bocITq_fishHitbox">${GLYPH(34, FISH, 'class="bocITq_fish" aria-hidden="true" ')}</span>
                <span class="bocITq_titleGroup"><span>探索未至之境</span><span class="bocITq_previewBadge">预览版</span></span>
              </div>
              <div class="bocITq_body"></div>
            </div>
          </div>`;

const WORKSPACE_ROW = `
          <div class="ST7X_W_heroWorkspaceRow">
            <button type="button" class="bocITq_workspace">${GLYPH(14, FOLDER)}<span class="bocITq_workspaceLabel">DSH UI Lab</span><span class="bocITq_chevron">⌄</span></button>
          </div>`;

/**
 * The message list the seat is anchored under in the `active` phase. `lines`
 * controls whether the conversation fits (no scroll) or overflows (the seat is
 * sticky and must still sit on the bottom edge).
 */
const sessionView = (lines) => `
      <div data-slot="conversation.session" style="display:contents">
        <div class="ST7X_W_viewArea">
          <div data-slot="conversation.view" style="display:contents">
            <div style="padding:24px 32px;font:14px/24px var(--dsw-font-family)">
              ${Array.from({ length: lines }, (_, i) => `<p style="margin:0 0 12px">第 ${i + 1} 轮对话内容</p>`).join('')}
            </div>
          </div>
        </div>
      </div>`;

const PLACEHOLDER = {
  hero: '描述你想要构建的内容, / 调用指令, @ 文件或对话',
  active: '发消息或创建任务, / 调用指令, @ 文件或对话',
};

/**
 * One conversation root in one phase.
 * @param id - DOM id, used by the measuring page.
 * @param phase - `hero` (New Session) or `active` (a conversation in progress).
 * @param wrapped - keep the renderer's `display:contents` slot outlets.
 * @param lines - message count; more than the frame holds forces a scroll.
 * @param withWorkspace - render the hero's workspace chip (a session is selected).
 */
export function frame({ id, phase, wrapped, lines = 3, withWorkspace = true, dock = 'stats' }) {
  const hero = phase === 'hero';
  const header = hero
    ? '<header class="ST7X_W_header ST7X_W_headerBlank"><div class="ST7X_W_titleRow"></div></header>'
    : '<header class="ST7X_W_header"><div class="ST7X_W_titleRow"></div><div class="ST7X_W_tabs"><span class="ST7X_W_tab ST7X_W_tabActive">会话</span><span class="ST7X_W_tab">文件</span></div></header>';
  const stack = `${hero && wrapped ? '<div data-slot="conversation.composer" style="display:contents"><div data-chain-overlay-fallback="conversation.composer" style="display:contents">' : ''}
      <div class="ST7X_W_composerStack${hero ? ' ST7X_W_composerHero' : ''}">
${hero ? heroShell() : ''}${hero && withWorkspace ? WORKSPACE_ROW : ''}${inputBar({ hero, wrapped, dock, placeholder: PLACEHOLDER[phase] })}
      </div>
      ${hero && wrapped ? '</div></div>' : ''}`;
  return `
<div class="ST7X_W_root" id="${id}" data-phase="${phase}" style="--dsh-conversation-column-width:1500px">
  ${header}
  <div class="ST7X_W_body" data-conversation-content data-content-phase="${phase}" data-conversation-region="chat">
    <div class="ST7X_W_scrollBody" data-conversation-scroll>
      ${hero ? '' : sessionView(lines)}
      <div class="ST7X_W_composerSeat" data-composer-seat data-conversation-region="composer">
${stack}
      </div>
    </div>
  </div>
</div>`;
}
