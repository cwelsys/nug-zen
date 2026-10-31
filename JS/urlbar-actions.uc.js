// ==UserScript==
// @name           URL Bar Actions
// @description    Adds about: pages and settings panes to Zen's Tab command palette, ranks it by match score, and gives the search mode chip engine icons.
// @include        *browser.xhtml
// ==/UserScript==

(function () {
	if (location.href !== "chrome://browser/content/browser.xhtml") return;

	const ABOUT_PAGES = [
		["about:about", "All about: Pages"],
		["about:processes", "Task Manager"],
		["about:memory", "Memory Usage"],
		["about:support", "Troubleshooting Information"],
		["about:config", "Advanced Preferences"],
		["about:profiles", "Profiles"],
		["about:downloads", "Downloads"],
		["about:logins", "Passwords"],
		["about:networking", "Networking and DNS"],
		["about:cache", "Network Cache"],
		["about:serviceworkers", "Service Workers"],
		["about:debugging", "Debug Extensions and Workers"],
		["about:profiling", "Performance Profiler"],
		["about:unloads", "Tab Unloading"],
		["about:policies", "Enterprise Policies"],
		["about:webrtc", "WebRTC Internals"],
		["about:webauthn", "Passkeys and Security Keys"],
		["about:protections", "Tracking Protection Report"],
		["about:compat", "Web Compatibility Fixes"],
		["about:translations", "Translations"],
		["about:telemetry", "Telemetry"],
		["about:logging", "Logging"],
		["about:buildconfig", "Build Configuration"],
		["about:url-classifier", "URL Classifier"],
	];

	const SETTINGS_PANES = [
		["paneGeneral", "General"],
		["paneZenLooks", "Look and Feel"],
		["paneZenTabManagement", "Tab Management and Workspaces"],
		["paneZenMarketplace", "Zen Mods"],
		["paneSync", "Account and Sync"],
		["paneHome", "Home and Startup"],
		["paneSearch", "Search Engines and Shortcuts"],
		["panePrivacy", "Privacy and Security, Cookies, Tracking"],
		["panePasswordsAutofill", "Passwords and Autofill"],
		["paneAppearance", "Appearance and Fonts"],
		["paneDownloads", "Downloads"],
		["paneTabsBrowsing", "Tabs and Browsing"],
		["paneAccessibility", "Accessibility"],
		["paneLanguages", "Languages"],
		["paneAi", "AI Controls"],
		["panePermissionsData", "Permissions and Site Data"],
		["paneExperimental", "Experimental Features"],
	];

	function registerActions() {
		let globalActions;
		try {
			({ globalActions } = ChromeUtils.importESModule(
				"resource:///modules/ZenUBGlobalActions.sys.mjs",
			));
		} catch (e) {
			return;
		}
		if (!Array.isArray(globalActions)) return;
		if (globalActions.some((a) => a.commandId?.startsWith("nug:"))) return;

		const always = () => true;
		for (const [url, name] of ABOUT_PAGES) {
			globalActions.push({
				label: `${name} · ${url}`,
				icon: "chrome://global/skin/icons/info.svg",
				commandId: `nug:${url}`,
				isAvailable: always,
				extraPayload: {},
				command: (win) =>
					win.switchToTabHavingURI(url, true, {
						triggeringPrincipal:
							Services.scriptSecurityManager.getSystemPrincipal(),
					}),
			});
		}
		for (const [pane, name] of SETTINGS_PANES) {
			globalActions.push({
				label: `Settings: ${name}`,
				icon: "chrome://browser/skin/zen-icons/settings.svg",
				commandId: `nug:settings-${pane}`,
				isAvailable: always,
				extraPayload: {},
				command: (win) => win.openPreferences(pane),
			});
		}
	}

	function rankPaletteByScore() {
		let learner;
		try {
			({ zenUrlbarResultsLearner: learner } = ChromeUtils.importESModule(
				"resource:///modules/ZenUBResultsLearner.sys.mjs",
			));
		} catch (e) {
			return;
		}
		if (!learner?.getDeprioritizeIndex || learner._nugRanked) return;
		learner._nugRanked = true;
		const getDeprioritizeIndex = learner.getDeprioritizeIndex;
		learner.getDeprioritizeIndex = function (commandId) {
			const win = Services.wm.getMostRecentWindow("navigator:browser");
			const sources = win?.UrlbarShared?.RESULT_SOURCE;
			const source = win?.gURLBar?.searchMode?.source;
			if (
				sources &&
				(source === sources.ZEN_ACTIONS || source === sources.WORKSPACES)
			) {
				return undefined;
			}
			return getDeprioritizeIndex.call(this, commandId);
		};
	}

	let searchService;
	function getSearchService() {
		searchService ??= ChromeUtils.importESModule(
			"moz-src:///toolkit/components/search/SearchService.sys.mjs",
		).SearchService;
		return searchService;
	}

	let iconRequest = 0;
	async function onSearchModeChanged(e) {
		const indicator = document.getElementById("urlbar-search-mode-indicator");
		if (!indicator) return;
		const request = ++iconRequest;
		const engineName = e.detail?.searchMode?.engineName;
		let iconURL = null;
		if (engineName) {
			try {
				const engine = getSearchService().getEngineByName(engineName);
				iconURL = await engine?.getIconURL(16);
				if (engine && !iconURL) {
					engine.updateFavicon?.();
					const origin = engine.getSubmission("").uri.prePath;
					const favicon = await PlacesUtils.favicons.getFaviconForPage(
						Services.io.newURI(origin),
					);
					iconURL = favicon?.dataURI.spec;
				}
			} catch (err) {}
		}
		if (request !== iconRequest) return;
		if (iconURL) {
			indicator.style.setProperty(
				"--nug-engine-icon",
				`url("${iconURL.replace(/"/g, '\\"')}")`,
			);
		} else {
			indicator.style.removeProperty("--nug-engine-icon");
		}
	}

	window.Nug.whenReady(() => {
		registerActions();
		rankPaletteByScore();
		window.addEventListener("Zen:UrlbarSearchModeChanged", onSearchModeChanged);
		window.addEventListener(
			"unload",
			() =>
				window.removeEventListener(
					"Zen:UrlbarSearchModeChanged",
					onSearchModeChanged,
				),
			{ once: true },
		);
	});
})();
