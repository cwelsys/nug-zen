// ==UserScript==
// @name           Window Zoom
// @description    Renders Zen's secondary windows (settings, Library, Page Info, About, Boost editor, prompts) at the default page zoom, and follows it when it changes.
// ==/UserScript==

(function () {
	const DOCUMENTS = [
		"chrome://browser/content/zen-components/windows/zen-settings-window.xhtml",
		"chrome://browser/content/places/places.xhtml",
		"chrome://browser/content/pageinfo/pageInfo.xhtml",
		"chrome://browser/content/zen-components/windows/zen-about.xhtml",
		"chrome://browser/content/aboutDialog.xhtml",
		"chrome://browser/content/zen-components/windows/zen-boost-editor.xhtml",
		"chrome://global/content/commonDialog.xhtml",
	];
	const RESIZE = new Set([
		"chrome://global/content/commonDialog.xhtml",
		"chrome://browser/content/zen-components/windows/zen-about.xhtml",
	]);
	const PREF = "browser.content.full-zoom";

	const href = location.href.split(/[?#]/)[0];
	if (
		!DOCUMENTS.includes(href) ||
		window.browsingContext.parent ||
		window.Nug?.windowZoom
	) {
		return;
	}
	window.Nug = Object.assign(window.Nug || {}, { windowZoom: true });

	const { ZoomUI } = ChromeUtils.importESModule(
		"resource:///modules/ZoomUI.sys.mjs",
	);
	const prefs = Cc["@mozilla.org/content-pref/service;1"].getService(
		Ci.nsIContentPrefService2,
	);

	function apply(value) {
		const zoom = Number.isFinite(value) && value > 0 ? value : 1;
		if (window.closed || window.browsingContext.fullZoom === zoom) return;
		window.browsingContext.fullZoom = zoom;
		if (RESIZE.has(href)) {
			window.requestAnimationFrame(() => window.sizeToContent());
		}
	}

	const observer = {
		onContentPrefSet(group, name, value) {
			if (group == null) apply(parseFloat(value));
		},
		onContentPrefRemoved(group) {
			if (group == null) apply(1);
		},
	};

	ZoomUI.getGlobalValue().then(apply);
	prefs.addObserverForName(PREF, observer);
	window.addEventListener(
		"unload",
		() => prefs.removeObserverForName(PREF, observer),
		{ once: true },
	);
})();
