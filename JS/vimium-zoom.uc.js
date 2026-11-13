// ==UserScript==
// @name           Vimium Zoom
// @description    Publishes the inverse of the page zoom to content as --nug-unzoom, so userContent.css can hold Vimium's UI at one size whatever the page zoom or display scale.
// @include        *browser.xhtml
// ==/UserScript==

(function () {
	if (location.href !== "chrome://browser/content/browser.xhtml") return;
	if (window.Nug.unzoom) return;
	window.Nug.unzoom = true;

	const { whenReady, prefs } = window.Nug;
	const PREF = "nug.vimium.scale-with-zoom";
	const APP_UNITS = 60;
	const sheets = Cc["@mozilla.org/content/style-sheet-service;1"].getService(
		Ci.nsIStyleSheetService,
	);

	let current = null;
	let watcher = null;

	function build(base) {
		const from = Math.max(1, Math.floor(base / 5) - 1);
		const to = Math.ceil(base / 0.2) + 1;
		let css = "";
		for (let units = from; units <= to; units++) {
			if (units === base) continue;
			const min = (APP_UNITS / (units + 0.5)).toFixed(6);
			const max = (APP_UNITS / (units - 0.5)).toFixed(6);
			const value = (units / base).toFixed(5);
			css += `@media (min-resolution:${min}dppx) and (max-resolution:${max}dppx){:root{--nug-unzoom:${value}}}`;
		}
		return Services.io.newURI("data:text/css," + encodeURIComponent(css));
	}

	function unregister() {
		if (current && sheets.sheetRegistered(current, sheets.USER_SHEET)) {
			sheets.unregisterSheet(current, sheets.USER_SHEET);
		}
		current = null;
	}

	function apply() {
		const ratio = window.devicePixelRatio;
		watcher?.removeEventListener("change", apply);
		watcher = window.matchMedia(`(resolution: ${ratio}dppx)`);
		watcher.addEventListener("change", apply);

		if (prefs.getBool(PREF)) {
			unregister();
			return;
		}
		const uri = build(Math.round(APP_UNITS / ratio));
		if (current?.spec === uri.spec) return;
		unregister();
		if (!sheets.sheetRegistered(uri, sheets.USER_SHEET)) {
			sheets.loadAndRegisterSheet(uri, sheets.USER_SHEET);
		}
		current = uri;
	}

	whenReady(() => {
		apply();
		const unsubscribe = prefs.subscribe(PREF, apply);
		window.addEventListener(
			"unload",
			() => {
				unsubscribe();
				watcher?.removeEventListener("change", apply);
			},
			{ once: true },
		);
	});
})();
