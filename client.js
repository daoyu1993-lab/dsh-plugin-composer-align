/**
 * dsh-plugin-composer-align — browser half.
 *
 * Pins the New Session composer (phase `hero`) to the exact box the conversation
 * composer (phase `active`) occupies, so the input stops jumping the moment the
 * first message is sent.
 *
 * WHAT ACTUALLY DIFFERS (from `@deepseek-ai/dsh-client-ui-conversation`)
 *
 *   hero    `.scrollBody{justify-content:center}` centres the whole composer
 *           stack (HeroShell headline + workspace row + input card) in the body,
 *           so the card floats around the middle of the window.
 *   active  `.viewArea{flex:1 0 auto}` pushes the seat down and
 *           `.composerSeat{position:sticky;bottom:0}` glues it to the bottom, so
 *           the card sits 4px above the bottom of the body.
 *
 *   On top of that the hero variant is 16px taller than the conversation one
 *   (`.hero .input{min-height:52px}` vs the shipped `36px`), it carries a 32px
 *   stack bottom padding where the conversation has none, and its input row
 *   misses the conversation's 4px bottom padding.
 *
 *   And the last 26px is below the card: in a conversation the card's last
 *   sibling is the composer dock (`conversation.composer.dock` — the tokens/s
 *   and cache-hit pills plus the context meter, 4px padding + a 22px row), which
 *   lifts the card by 26px; the hero never calls that slot, and the shipped
 *   `.hero .dock:empty{display:none}` collapses it to zero.
 *
 * The fix is therefore: keep the hero tree, but give it the active geometry —
 * the seat fills the body, the input row lands on the bottom edge, the headline
 * keeps the freedom that is left over, the card keeps the conversation's size,
 * and the dock keeps the conversation's height even when there is nothing to put
 * in it (so the card does not move when the status row appears). Measured deltas
 * are in README.md; `tools/verify-composer-align.mjs` checks the two boxes
 * against each other on every run.
 *
 * WHY A STYLESHEET INSTEAD OF A COMPONENT
 * The hero composition is owned by the conversation shell, and the only
 * supported way to replace it is to take over the `conversation.composer` chain
 * slot — which would cost the shipped InputBar and every seat inside it. A
 * stylesheet keeps the shell, its slots and its occupants intact: the worst
 * possible failure is "the rules stop matching and the composer goes back to the
 * middle", never a broken composer.
 *
 * WHY THESE SELECTORS
 * Every class name in DSH is a CSS-module hash (`ST7X_W_composerHero`,
 * `yhfFVG_hero`) that changes per build, so class selectors are unusable. The
 * build-stable anchors used here are the shell's own data attributes:
 *
 *   `[data-conversation-content]` / `[data-content-phase]`  the conversation body
 *   `[data-conversation-scroll]`                            the scrolling column
 *   `[data-composer-seat]`                                  the composer's seat
 *   `[data-composer-card]`                                  the input card itself
 *   `[data-composer-input]`                                 the text surface
 *
 * The composer stack has no attribute of its own, so it is addressed by role:
 * inside the seat it is the only box that *contains* the card without the card
 * being its direct child (which is what excludes the input bar). The renderer's own slot wrappers
 * (`SlotOutlet` → `[data-slot]`, the chain fallback → `[data-chain-overlay-fallback]`)
 * sit above the stack, but they carry `display:contents` and therefore generate
 * no box: in layout the stack *is* the seat's flex item, so excluding them by
 * name changes no geometry. They still have to be excluded, and not for layout's
 * sake: the wrapper around `conversation.composer.bar` also satisfies the role
 * above, and its "first child" would then be the input bar instead of the
 * headline - the input bar would grow, and the card would stop halfway down the
 * column.
 *
 * Everything is scoped to `[data-content-phase="hero"]`, so the settling and
 * active phases keep the shipped rules untouched.
 *
 * Envelope: DSH browser bundles register themselves on the injected
 * `window.__ModuleLoader__` facade keyed by package id; the loader then calls
 * `apply(ctx)` and reads `inject` for service gating.
 */

window.__ModuleLoader__.load({
	id: 'dsh-plugin-composer-align',
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

		/** Plugin id, reused as the stylesheet owner marker. */
		const PLUGIN_ID = 'dsh-plugin-composer-align';

		/**
		 * The conversation body in its New Session phase. Every rule below hangs
		 * off it, so the active/settling phases are never touched.
		 */
		const HERO = '[data-conversation-content][data-content-phase="hero"]';

		/**
		 * The shipped composer stack, addressed by role (see the header): the box
		 * inside the seat that contains the input card without owning it directly.
		 * The renderer's `display:contents` slot wrappers are excluded by name so
		 * that the "first child" rule below can only land on the headline.
		 */
		const STACK = `${HERO} [data-composer-seat] :has([data-composer-card]):not(:has(> [data-composer-card])):not([data-slot]):not([data-chain-overlay-fallback])`;

		/**
		 * The composer dock: the input card's last sibling inside the input bar.
		 * It holds the conversation's status row (`conversation.composer.dock`:
		 * the tokens/s pill, the cache-hit pill and the context meter). It is
		 * present in every phase, but the hero renders the slot as nothing at
		 * all, which the shipped CSS turns into `display:none`. The rule that
		 * uses it must therefore NOT be phase-scoped: the reservation has to
		 * hold in a conversation too, for the moment before its status row has
		 * anything to show.
		 */
		const DOCK = '[data-conversation-content] [data-composer-seat] *:has(> [data-composer-card]) > *:last-child';

		const CSS = `
/* ── ① 身体区不再把整块垂直居中：座位将占满，输入卡片贴到底部 ──────────────
   官方 hero 态靠 \`justify-content:center\` 把「大标题 + 工作区行 + 输入卡片」
   整块居中；对话态则是消息区 flex:1 把座位顶到底。改成 flex-start 后由 ② 让
   座位自己吃掉整个高度，两种状态下的滚动容器高度完全一致。 */
${HERO} > [data-conversation-scroll] {
  justify-content: flex-start;
}

/* ── ② 座位占满身体区（官方 hero 态是 flex:none，只占内容高） ────────────── */
${HERO} [data-composer-seat] {
  flex: 1 1 auto;
}

/* ── ③ 输入栈占满座位，并去掉 hero 专属的 32px 底距 ────────────────────────
   官方 hero 给栈 \`padding-bottom:32px\`，卡片因此离座位底边 32px；对话态没有
   这层底距。行距（hero 8px / 对话 6px）不动：卡片是栈的最后一个孩子，它上面的
   间距只影响工作区行，改它只会白白挪动上方内容。 */
${STACK} {
  flex: 1 1 auto;
  min-height: 0;
  padding-bottom: 0;
}

/* ── ④ 新会话大标题吃掉上方余量，自己在余量里继续垂直居中 ──────────────────
   HeroShell 官方是 \`height:100%\`（父级高度自适应时等于 auto）。③ 之后父级
   高度变成定值，100% 会把栈撑破，所以显式改回 auto，再用 flex:1 1 0 让它吸掉
   座位里除「工作区行 + 输入行」之外的全部空间 —— 大标题因此仍停在原来的视线
   位置，工作区行和输入卡片一起落到窗口底部。 */
${STACK} > *:first-child {
  flex: 1 1 0;
  height: auto;
  min-height: 0;
}

/* ── ⑤ 输入行补上对话态的 4px 底距（官方 hero 态是 0） ─────────────────────
   卡片底边 = 座位底边 - 4px，与对话态 \`.yhfFVG_root{padding-bottom:4px}\` 对齐。 */
${HERO} [data-composer-seat] *:has(> [data-composer-card]) {
  padding-bottom: 4px;
}

/* ── ⑥ 写字区取对话态高度 ─────────────────────────────────────────────────
   官方 hero 态 \`.hero .input{min-height:52px}\`，对话态是 36px —— 这是卡片
   比对话态高 16px 的唯一来源，也是「位置一样但框不一样高」的最后一块。 */
${HERO} [data-composer-input] {
  min-height: 36px;
}

/* ── ⑦ 输入行下方那条「用量行」的占位：无论有没有内容，都留出同样的高度 ──────
   对话态里，卡片的最后一个兄弟节点是 composer dock —— 里面是「tokens/s · 缓存命中」
   用量行和上下文计量表（\`conversation.composer.dock\`，compact 模式下由 StatsPills
   与 ContextMeter 填满）。它高 26px（padding-top 4px + 一行 22px），会把卡片整体
   顶高 26px；而新会话态的 dock 是空 div（官方 \`.hero .dock:empty{display:none}\`），
   高度 0 —— 这正是「新会话已经贴底、发消息后却又上移 26px」的来源。
   这里把 dock 的最小高度钉死在这 26px：有内容时它本来就是 26px（不变），
   没内容时（新会话、或对话刚发出还没产生用量）由 min-height 撑住同样的 26px，
   卡片因此永远落在同一个 y 上，空白就空着。 */
${DOCK} {
  display: flex;
  box-sizing: border-box;
  min-height: var(--dsh-composer-dock-height, 26px);
}
`;

		/**
		 * Install the stylesheet; `ctx.effect` removes it again on unload and
		 * re-runs on hot reload, so iterations never stack duplicate tags.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			ctx.effect(
				() => {
					const tag = document.createElement('style');
					tag.dataset.plugin = PLUGIN_ID;
					tag.textContent = CSS;
					document.head.appendChild(tag);
					return () => tag.remove();
				},
				'composer-align: styles',
			);
		}

		exports.apply = apply;
		/** No Cordis services are required. */
		exports.inject = [];
		return module.exports;
	},
});
