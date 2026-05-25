// ==UserScript==
// @name           URL Bar Placeholder
// @description    Overrides the urlbar placeholder text and keeps it pinned.
// @include        *browser.xhtml
// ==/UserScript==

(function () {
	if (location.href !== "chrome://browser/content/browser.xhtml") return;

	const PLACEHOLDER = "What it is";

	function applyPlaceholder() {
		const input = document.getElementById("urlbar-input");
		if (!input) return;
		input.setAttribute("placeholder", PLACEHOLDER);
		new MutationObserver(() => {
			if (input.getAttribute("placeholder") !== PLACEHOLDER)
				input.setAttribute("placeholder", PLACEHOLDER);
		}).observe(input, { attributes: true, attributeFilter: ["placeholder"] });
	}

	window.Nug.whenReady(applyPlaceholder);
})();
