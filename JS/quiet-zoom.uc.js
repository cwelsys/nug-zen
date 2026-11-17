// ==UserScript==
// @name           Quiet Zoom
// @description    Drops Zen's "Zoom: N%" toast that appears on page loads and zoom changes.
// @include        *browser.xhtml
// ==/UserScript==

(function () {
	if (location.href !== "chrome://browser/content/browser.xhtml") return;

	window.Nug.whenReady(() => {
		const showToast = gZenUIManager.showToast;
		gZenUIManager.showToast = function (messageId, ...rest) {
			if (messageId === "zen-zoom-changed-toast") return;
			return showToast.call(this, messageId, ...rest);
		};
	});
})();
