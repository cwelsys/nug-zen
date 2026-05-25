// ==UserScript==
// @name           Nug Core
// @description    Shared helpers for the other Nug userscripts. Must load before anything that depends on it.
// @include        *browser.xhtml
// ==/UserScript==

// Sine loads every .uc.js into the same chrome window global, so these helpers
// live on `window.Nug` and the feature scripts read them from there. The `??=`
// guard keeps re-injection (new window, cache bust) idempotent.
(function () {
	const Nug = (window.Nug ??= {});
	if (Nug._ready) return;
	Nug._ready = true;

	// Run fn once the browser window is fully initialized. By the time
	// delayedStartupFinished is true, gBrowser and the urlbar exist, so callers
	// don't need their own readiness polling.
	Nug.whenReady = function (fn) {
		if (window.gBrowserInit?.delayedStartupFinished) {
			fn();
			return;
		}
		const listener = (subject, topic) => {
			if (
				topic === "browser-delayed-startup-finished" &&
				subject === window
			) {
				Services.obs.removeObserver(listener, topic);
				fn();
			}
		};
		Services.obs.addObserver(listener, "browser-delayed-startup-finished");
	};

	// Pref reads that fall back to the default instead of throwing.
	Nug.prefs = {
		getBool(name, def = false) {
			try {
				return Services.prefs.getBoolPref(name, def);
			} catch (e) {
				return def;
			}
		},
		getInt(name, def = 0) {
			try {
				return Services.prefs.getIntPref(name, def);
			} catch (e) {
				return def;
			}
		},
		getString(name, def = "") {
			try {
				return Services.prefs.getStringPref(name, def);
			} catch (e) {
				return def;
			}
		},
		// Observe one or more prefs; onChange gets the changed pref name. Returns
		// an unsubscribe fn — wire it to window unload.
		subscribe(names, onChange) {
			const list = Array.isArray(names) ? names : [names];
			const observer = { observe: (_s, _t, data) => onChange(data) };
			for (const name of list) Services.prefs.addObserver(name, observer);
			return () => {
				for (const name of list) {
					try {
						Services.prefs.removeObserver(name, observer);
					} catch (e) {}
				}
			};
		},
	};

	// Append a <style> to the chrome document once, keyed by id. Returns the node.
	Nug.injectStyle = function (id, css) {
		const existing = document.getElementById(id);
		if (existing) return existing;
		const style = document.createElement("style");
		style.id = id;
		style.textContent = css;
		document.head.appendChild(style);
		return style;
	};

	// True when the OS asks for reduced motion and the per-feature opt-out pref
	// isn't set.
	Nug.prefersReducedMotion = function (
		ignorePref = "nug.ignore-reduced-motion",
	) {
		return (
			window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
			!Nug.prefs.getBool(ignorePref, false)
		);
	};
})();
