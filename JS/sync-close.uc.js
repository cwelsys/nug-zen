// ==UserScript==
// @name           Sync Close
// @description    Closes tabs without the close animation when Spaces sync removes them or the window isn't being drawn, so a sleeping device can't leave synced-away tabs half-closed and re-upload them.
// @include        *browser.xhtml
// ==/UserScript==

(() => {
	const { whenReady } = window.Nug;

	function init() {
		if (typeof gBrowser === "undefined" || gBrowser._nugSyncClose) return;
		gBrowser._nugSyncClose = true;
		const removeTab = gBrowser.removeTab;
		gBrowser.removeTab = function (tab, options) {
			if (
				options?.animate &&
				(window.gZenFolders?._sessionRestoring || document.hidden)
			) {
				options = { ...options, animate: false };
			}
			return removeTab.call(this, tab, options);
		};
	}

	whenReady(init);
})();
