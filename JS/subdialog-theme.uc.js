// ==UserScript==
// @name           Nug Subdialog Theme
// @include        *browser.xhtml
// ==/UserScript==

(function () {
	const { prefs } = window.Nug;

	const NUG_SUBDIALOG_CSS = `
@media (prefers-color-scheme: dark) {
	/* Catppuccin Mocha */
	@media (-moz-pref('nug-catppuccin-flavor', 0)) {
		:root {
			--base: #1e1e2e; --mantle: #181825; --crust: #11111b;
			--surface0: #313244; --surface1: #45475a; --surface2: #585b70;
			--text: #cdd6f4; --subtext1: #bac2de;
			--blue: #89b4fa; --lavender: #b4befe; --sapphire: #74c7ec;
			--sky: #89dceb; --teal: #94e2d5; --green: #a6e3a1;
			--yellow: #f9e2af; --peach: #fab387; --maroon: #eba0ac;
			--red: #f38ba8; --mauve: #cba6f7; --pink: #f5c2e7;
			--flamingo: #f2cdcd; --rosewater: #f5e0dc;
		}
	}
	/* Catppuccin Macchiato */
	@media (-moz-pref('nug-catppuccin-flavor', 1)) {
		:root {
			--base: #24273a; --mantle: #1e2030; --crust: #181926;
			--surface0: #363a4f; --surface1: #494d64; --surface2: #5b6078;
			--text: #cad3f5; --subtext1: #b8c0e0;
			--blue: #8aadf4; --lavender: #b7bdf8; --sapphire: #7dc4e4;
			--sky: #91d7e3; --teal: #8bd5ca; --green: #a6da95;
			--yellow: #eed49f; --peach: #f5a97f; --maroon: #ee99a0;
			--red: #ed8796; --mauve: #c6a0f6; --pink: #f5bde6;
			--flamingo: #f0c6c6; --rosewater: #f4dbd6;
		}
	}
	/* --nug-accent / --nug-icon-color / --nug-folder-color are set on
	   documentElement by applyNugColors() — see resolver below. */

	/* Canvas/dialog background (overrides Zen's --zen-dialog-background → #161C31) */
	:root {
		--zen-dialog-background: var(--base) !important;
		--background-color-canvas: var(--base) !important;
		--zen-primary-color: var(--nug-accent) !important;
		--color-accent-primary: var(--nug-accent) !important;
	}

	/* Dialog buttons via shadow DOM parts */
	dialog::part(dialog-button) {
		--button-background-color: var(--surface0) !important;
		--button-background-color-hover: var(--surface1) !important;
		--button-background-color-active: var(--surface2) !important;
		--button-background-color-primary: var(--nug-accent) !important;
		--button-background-color-primary-hover: color-mix(in srgb, var(--nug-accent) 85%, var(--text)) !important;
		--button-background-color-primary-active: color-mix(in srgb, var(--nug-accent) 70%, var(--text)) !important;
		--button-text-color: var(--text) !important;
		--button-text-color-primary: var(--crust) !important;
	}

	/* Groupbox buttons and menulists */
	groupbox button, groupbox menulist {
		background-color: var(--surface0) !important;
		color: var(--text) !important;
	}
	groupbox button:hover, groupbox menulist:hover {
		background-color: var(--surface1) !important;
	}
	groupbox button:active, groupbox menulist:active {
		background-color: var(--surface2) !important;
	}
}
`;

	const NUG_SINE_FIXES_CSS = `
#nug-accent-custom,
#nug-icon-custom,
#nug-folder-custom,
#nug-findbar-custom-top,
#nug-findbar-custom-right,
#nug-findbar-custom-bottom,
#nug-findbar-custom-left {
	display: none;
}

#nug-accent-color menupopup menuitem[value=""],
#nug-icon-color menupopup menuitem[value=""],
#nug-folder-color menupopup menuitem[value=""] {
	display: none;
}

/* Gate the Ephemeral Container sub-prefs on the master toggle. Done here with
   a live -moz-bool-pref query rather than Sine's "conditions" (its pref-change
   observer is broken upstream — preferences.sys.mjs calls an undefined \`th\`),
   so this also updates without a restart. */
@media not (-moz-bool-pref: 'nug.ephemeral.enabled') {
	#nug-ephemeral-container,
	#nug-ephemeral-debug,
	#nug-ephemeral-dryrun {
		display: none;
	}
}
`;

	const NUG_COLORS = [
		"blue",
		"lavender",
		"sapphire",
		"sky",
		"teal",
		"green",
		"yellow",
		"peach",
		"maroon",
		"red",
		"mauve",
		"pink",
		"flamingo",
		"rosewater",
		"text",
	];
	const NUG_CUSTOM_INDEX = 15;
	const NUG_HEX_RE =
		/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
	const NUG_PREFS = [
		{
			idx: "nug-accent-color",
			custom: "nug-accent-custom",
			cssVar: "--nug-accent",
			defIdx: 0,
		},
		{
			idx: "nug-icon-color",
			custom: "nug-icon-custom",
			cssVar: "--nug-icon-color",
			defIdx: 10,
		},
		{
			idx: "nug-folder-color",
			custom: "nug-folder-custom",
			cssVar: "--nug-folder-color",
			defIdx: 10,
		},
	];

	function resolveNugColor(p) {
		const i = prefs.getInt(p.idx, p.defIdx);
		if (i === NUG_CUSTOM_INDEX) {
			const hex = prefs.getString(p.custom, "");
			if (NUG_HEX_RE.test(hex)) return hex;
			return `var(--${NUG_COLORS[p.defIdx]})`;
		}
		const name = NUG_COLORS[i] || NUG_COLORS[p.defIdx];
		return `var(--${name})`;
	}

	function applyNugColors(doc) {
		const root = doc?.documentElement;
		if (!root) return;
		for (const p of NUG_PREFS) {
			root.style.setProperty(p.cssVar, resolveNugColor(p));
		}
	}

	const subdialogObserver = {
		observe(subject) {
			try {
				const url = subject.documentURI || "";
				const isChromeXhtml =
					url.startsWith("chrome://") &&
					url.endsWith(".xhtml") &&
					url !== "chrome://extensions/content/dummy.xhtml";
				const isPrefsPage =
					url === "about:preferences" ||
					url.startsWith("about:preferences?") ||
					url.startsWith("about:preferences#") ||
					url === "about:settings" ||
					url.startsWith("about:settings?") ||
					url.startsWith("about:settings#");
				if (!isChromeXhtml && !isPrefsPage) return;

				subject.addEventListener(
					"DOMContentLoaded",
					() => {
						try {
							const style = subject.createElement("style");
							style.textContent =
								NUG_SUBDIALOG_CSS + NUG_SINE_FIXES_CSS;
							subject.documentElement.appendChild(style);
							applyNugColors(subject);
						} catch (e) {}

						// Wait for SubDialog to finish sizing, then expand if needed.
						try {
							const win = subject.defaultView;
							const frame = win?.frameElement;
							const box = frame?.closest(".dialogBox");
							if (box) {
								const pWin = win.parent;
								let ticks = 0;
								const waitForSizing = () => {
									ticks++;
									if (box.getAttribute("style")) {
										ticks = 0;
										pWin.requestAnimationFrame(
											checkOverflow,
										);
									} else if (ticks < 120) {
										pWin.requestAnimationFrame(
											waitForSizing,
										);
									}
								};
								const checkOverflow = () => {
									ticks++;
									try {
										const contentH =
											subject.documentElement
												.scrollHeight;
										const frameH =
											frame.getBoundingClientRect()
												.height;
										if (
											contentH > frameH + 5 &&
											frameH > 0
										) {
											const diff =
												Math.ceil(contentH - frameH) +
												4;
											const curMinH =
												parseFloat(
													pWin.getComputedStyle(box)
														.minHeight,
												) || 0;
											let newMinH = curMinH + diff;
											const maxAllowed = Math.floor(
												pWin.innerHeight * 0.9,
											);
											if (newMinH > maxAllowed) {
												newMinH = maxAllowed;
												subject.documentElement.style.setProperty(
													"overflow",
													"auto",
													"important",
												);
											}
											box.style.setProperty(
												"min-height",
												newMinH + "px",
												"important",
											);
											return;
										}
										if (ticks < 60) {
											pWin.requestAnimationFrame(
												checkOverflow,
											);
										}
									} catch (e) {}
								};
								pWin.requestAnimationFrame(waitForSizing);
							}
						} catch (e) {}
					},
					{ once: true },
				);
			} catch (e) {}
		},
	};

	Services.obs.addObserver(subdialogObserver, "document-element-inserted");

	// Apply colors to the chrome window and react to pref changes live.
	applyNugColors(document);
	const watchedPrefs = NUG_PREFS.flatMap((p) => [p.idx, p.custom]);
	const unsubscribe = prefs.subscribe(watchedPrefs, () =>
		applyNugColors(document),
	);

	window.addEventListener(
		"unload",
		() => {
			try {
				Services.obs.removeObserver(
					subdialogObserver,
					"document-element-inserted",
				);
			} catch (e) {}
			unsubscribe();
		},
		{ once: true },
	);
})();
