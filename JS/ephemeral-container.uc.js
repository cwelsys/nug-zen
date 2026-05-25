// ==UserScript==
// @name           Ephemeral Container
// @description    Turns a chosen container into a self-wiping "incognito" one: its tabs never write to browsing history, and cookies + site data are destroyed when its last tab closes (and at every browser launch). Assign the container to a workspace for an ephemeral workspace.
// @include        *browser.xhtml
// ==/UserScript==

// CONFIG (about:config)
//   nug.ephemeral.enabled    bool    default true   - master on/off
//   nug.ephemeral.container  string  default "Ephemeral"
//   nug.ephemeral.debug      bool    default false  - verbose [nug-ephemeral] logging
//   nug.ephemeral.dryrun     bool    default false  - log intended actions but DON'T
//                                                     suppress history or wipe data
//
// DEBUGGING:
//   Services.__nugEphemeral.events      -> recent event log (ring buffer)
//   Services.__nugEphemeral.api.status()
//   Services.__nugEphemeral.api.wipeNow()    -> wipe the container's site data now
//   Services.__nugEphemeral.api.applyNow()   -> (re)apply history suppression to open tabs

(function () {
	if (location.href !== "chrome://browser/content/browser.xhtml") return;

	// On Services (process-wide) so the launch-wipe guard, event buffer, and debug
	// API are reachable from any window and any chrome console scope.
	const shared = (Services.__nugEphemeral ??= {
		launchWiped: false,
		events: [],
		api: null,
	});

	const winId = (() => {
		try {
			return window.docShell.outerWindowID;
		} catch (e) {
			return "?";
		}
	})();

	// Bare marker, logged unconditionally, to confirm the file evaluated at all.
	try {
		Services.console.logStringMessage(
			`[nug-ephemeral] EVALUATING win:${winId}`,
		);
	} catch (e) {}

	const getBool = (p, d) => {
		try {
			return Services.prefs.getBoolPref(p, d);
		} catch (e) {
			return d;
		}
	};
	const getStr = (p, d) => {
		try {
			return Services.prefs.getStringPref(p, d);
		} catch (e) {
			return d;
		}
	};

	const enabled = () => getBool("nug.ephemeral.enabled", true);
	const debug = () => getBool("nug.ephemeral.debug", false);
	const dryRun = () => getBool("nug.ephemeral.dryrun", false);
	const containerName = () => getStr("nug.ephemeral.container", "Ephemeral");

	function log(event, data) {
		const entry = {
			t: new Date().toISOString().slice(11, 23),
			win: winId,
			event,
			data,
		};
		shared.events.push(entry);
		if (shared.events.length > 300) shared.events.shift();
		if (!debug()) return;
		try {
			console.log(
				`%c[nug-ephemeral]%c ${entry.t} win:${winId} ${event}`,
				"color:#cba6f7;font-weight:bold",
				"color:inherit",
				data ?? "",
			);
		} catch (e) {}
	}

	function ephemeralUcid() {
		const name = containerName();
		const id = ContextualIdentityService.getPublicIdentities().find(
			(i) => i.name === name,
		)?.userContextId;
		return typeof id === "number" ? id : null;
	}

	const tabUcid = (tab) =>
		parseInt(tab?.getAttribute("usercontextid") || "0", 10);
	const tabUrl = (tab) => {
		try {
			return tab?.linkedBrowser?.currentURI?.spec;
		} catch (e) {
			return undefined;
		}
	};

	let wipeCheckPending = false;

	// Stop a browser from recording visits to Places (global) history. The attribute
	// is the durable anchor: SetEmbedderElement re-reads it on every (re)bind,
	// including Fission process switches, so suppression survives them. Setting the
	// BrowsingContext flag directly takes effect now for the current process; the
	// attribute alone only applies at the next bind.
	function suppressHistory(browser) {
		try {
			browser.setAttribute("disableglobalhistory", "true");
		} catch (e) {}
		try {
			if (browser.browsingContext)
				browser.browsingContext.useGlobalHistory = false;
		} catch (e) {}
	}

	function maybeSuppress(tab, reason) {
		if (!enabled()) return;
		const ucid = ephemeralUcid();
		if (ucid == null || tabUcid(tab) !== ucid) return;
		const browser = tab.linkedBrowser;
		if (!browser) return;
		log("suppress-history", {
			reason,
			ucid,
			url: tabUrl(tab),
			dryRun: dryRun(),
		});
		if (dryRun()) return;
		suppressHistory(browser);
	}

	function wipeSiteData(ucid, reason) {
		if (typeof ucid !== "number") return false;
		log("WIPE site-data", { ucid, reason, dryRun: dryRun() });
		if (dryRun()) return true;
		// No flags arg: clears all data types for these origin attributes.
		try {
			Services.clearData.deleteDataFromOriginAttributesPattern(
				{ userContextId: ucid },
				(failedFlags) =>
					failedFlags
						? log("WIPE site-data PARTIAL", {
								ucid,
								reason,
								failedFlags,
							})
						: log("WIPE site-data done", { ucid, reason }),
			);
			return true;
		} catch (e) {
			console.error("[nug-ephemeral] clearData threw:", e);
			log("WIPE site-data FAILED", { ucid, reason, error: String(e) });
			return false;
		}
	}

	function ephemeralTabsOpen(ucid, label, excludeWin) {
		const perWindow = [];
		let total = 0;
		for (const win of Services.wm.getEnumerator("navigator:browser")) {
			if (win === excludeWin) continue;
			const gb = win.gBrowser;
			if (!gb) continue;
			let n = 0;
			for (const tab of gb.tabs) {
				if (!tab.closing && tabUcid(tab) === ucid) n++;
			}
			total += n;
			perWindow.push(n);
		}
		log("count-ephemeral-tabs", { label, ucid, total, perWindow });
		return total;
	}

	function applyNow() {
		for (const win of Services.wm.getEnumerator("navigator:browser")) {
			const gb = win.gBrowser;
			if (!gb) continue;
			for (const tab of gb.tabs) {
				if (tab.hasAttribute("pending")) continue; // lazy; handled on insert
				maybeSuppress(tab, "applyNow");
			}
		}
	}

	function wipeNow() {
		const ucid = ephemeralUcid();
		log("wipeNow() called", { ucid });
		if (ucid == null) return;
		wipeSiteData(ucid, "wipeNow");
	}

	// Fires when a tab's <browser> is created, including lazy (restored) tabs the
	// moment they become real, before they navigate. Disabling history here means
	// the first load is never recorded.
	function onTabBrowserInserted(event) {
		maybeSuppress(event.target, "browser-inserted");
	}

	function onTabClose(event) {
		const tab = event.target;
		const ucid = ephemeralUcid();
		const ours = ucid != null && tabUcid(tab) === ucid;
		log("TabClose", {
			ucid,
			tabUcid: tabUcid(tab),
			ours,
			url: tabUrl(tab),
			zenEmptyTab: tab.hasAttribute?.("zen-empty-tab"),
			zenEssential: tab.hasAttribute?.("zen-essential"),
			markedForReplacement: !!tab._markedForReplacement,
			closing: !!tab.closing,
			enabled: enabled(),
		});
		if (!enabled() || !ours) return;
		// A tab adopted by another window (or otherwise swapped) fires TabClose but
		// isn't really closing: it still exists elsewhere. The cross-window count
		// would catch it anyway, but skipping here avoids the churn.
		if (tab._markedForReplacement) return;
		// Closing N ephemeral tabs in one tick should run ONE deferred "last tab?"
		// check, not N (each of which would otherwise see 0 and wipe again).
		if (wipeCheckPending) return;
		wipeCheckPending = true;
		setTimeout(() => {
			wipeCheckPending = false;
			const deferredCount = ephemeralTabsOpen(ucid, "TabClose-deferred");
			if (deferredCount === 0)
				wipeSiteData(ucid, "last-ephemeral-tab-closed");
			else log("TabClose: tabs remain, no wipe", { deferredCount });
		}, 0);
	}

	let ContextualIdentityService;

	function init() {
		try {
			({ ContextualIdentityService } = ChromeUtils.importESModule(
				"resource://gre/modules/ContextualIdentityService.sys.mjs",
			));
		} catch (e) {
			Cu.reportError("[nug-ephemeral] module import failed: " + e);
			log("module-import-failed", String(e));
			return;
		}

		const ucid = ephemeralUcid();
		log("init", {
			container: containerName(),
			ucid,
			enabled: enabled(),
			dryRun: dryRun(),
			launchWipedAlready: shared.launchWiped,
		});

		window.addEventListener("TabBrowserInserted", onTabBrowserInserted);
		window.addEventListener("TabClose", onTabClose);
		window.addEventListener(
			"unload",
			() => {
				try {
					window.removeEventListener(
						"TabBrowserInserted",
						onTabBrowserInserted,
					);
				} catch (e) {}
				try {
					window.removeEventListener("TabClose", onTabClose);
				} catch (e) {}
				// On a full quit the next launch wipe handles it; don't race shutdown.
				if (Services.startup.shuttingDown) return;
				// Closing a single window does NOT fire per-tab TabClose, so wipe
				// here if no ephemeral tabs remain in the OTHER windows.
				try {
					const u = ephemeralUcid();
					if (!enabled() || u == null) return;
					let hadOurs = false;
					for (const tab of gBrowser.tabs) {
						if (tabUcid(tab) === u) {
							hadOurs = true;
							break;
						}
					}
					if (
						hadOurs &&
						ephemeralTabsOpen(u, "window-close", window) === 0
					)
						wipeSiteData(u, "last-ephemeral-window-closed");
				} catch (e) {}
			},
			{ once: true },
		);

		if (ucid != null && !shared.launchWiped) {
			// Mark the launch wipe done only once it actually starts successfully,
			// so a throw (e.g. clearData not ready yet) lets the next window retry.
			if (wipeSiteData(ucid, "launch")) shared.launchWiped = true;
		}

		// Suppress on tabs already open in this window. Pending (lazy) tabs are
		// skipped; onTabBrowserInserted catches them when their browser is created.
		if (ucid != null) {
			for (const tab of gBrowser.tabs) {
				if (tab.hasAttribute("pending")) continue;
				maybeSuppress(tab, "init");
			}
		}

		const api = {
			wipeNow,
			applyNow,
			ephemeralUcid,
			containerName,
			status: () => ({
				container: containerName(),
				ucid: ephemeralUcid(),
				enabled: enabled(),
				dryRun: dryRun(),
				openEphemeralTabs: ephemeralTabsOpen(ephemeralUcid(), "status"),
			}),
			events: () => shared.events,
			clearEvents: () => {
				shared.events.length = 0;
			},
		};
		shared.api = api;
		window.nugEphemeral = api;
		log("init complete");
	}

	if (gBrowserInit.delayedStartupFinished) {
		init();
	} else {
		const listener = (subject, topic) => {
			if (
				topic === "browser-delayed-startup-finished" &&
				subject === window
			) {
				Services.obs.removeObserver(listener, topic);
				init();
			}
		};
		Services.obs.addObserver(listener, "browser-delayed-startup-finished");
	}
})();
