// ==UserScript==
// @name           Vimium New Tab
// @description    Opens Zen's floating URL bar instead of a tab when an extension opens https://zen-urlbar.invalid/. Pair with Vimium: map t createTab https://zen-urlbar.invalid/
// @include        *browser.xhtml
// ==/UserScript==

(function () {
	if (location.href !== "chrome://browser/content/browser.xhtml") return;
	if (window.Nug.newTabHook) return;
	window.Nug.newTabHook = true;

	const MARKER = "https://zen-urlbar.invalid/";

	window.Nug.whenReady(() => {
		const addTab = gBrowser.addTab;
		gBrowser.addTab = function (uri, ...rest) {
			if (typeof uri !== "string" || !uri.startsWith(MARKER)) {
				return addTab.call(this, uri, ...rest);
			}
			delete gZenCompactModeManager._nextTimeWillBeActive;
			if (!gURLBar.hasAttribute("zen-newtab")) BrowserCommands.openTab();
			return this.selectedTab;
		};
	});
})();
