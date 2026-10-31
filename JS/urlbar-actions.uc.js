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

	const onPage = (win) => !win.gBrowser.selectedTab.hasAttribute("zen-empty-tab");
	const inGlance = (win) => win.gBrowser.selectedTab.hasAttribute("glance-id");
	const inCompactMode = (win) => !!win.gZenCompactModeManager?.preference;
	const pinnedChanged = (win) => {
		const tab = win.gBrowser.selectedTab;
		return tab.pinned && tab.hasAttribute("zen-pinned-changed");
	};

	function fromTabContextMenu(itemId) {
		return (win) => {
			win.TabContextMenu.contextTab = win.gBrowser.selectedTab;
			win.document.getElementById(itemId)?.doCommand();
		};
	}

	function restart(clearCache) {
		if (clearCache) Services.appinfo.invalidateCachesOnRestart();
		const cancelQuit = Cc["@mozilla.org/supports-PRBool;1"].createInstance(
			Ci.nsISupportsPRBool,
		);
		Services.obs.notifyObservers(cancelQuit, "quit-application-requested", "restart");
		if (cancelQuit.data) return;
		Services.startup.quit(Services.startup.eAttemptQuit | Services.startup.eRestart);
	}

	const COMMANDS = [
		["Move Tab Up", "arrow-up", (win) => win.gBrowser.moveTabBackward()],
		["Move Tab Down", "arrow-down", (win) => win.gBrowser.moveTabForward()],
		["Move Tab to New Window", "window", (win) => win.gBrowser.replaceTabWithWindow(win.gBrowser.selectedTab), onPage],
		["Mute or Unmute Tab", "media-mute", "cmd_toggleMute", onPage],
		["Unload Tab", "forget", (win) => win.gBrowser.explicitUnloadTabs([win.gBrowser.selectedTab]), onPage],
		["Unload Other Tabs", "forget", (win) => win.gBrowser.explicitUnloadTabs(win.gBrowser.tabs.filter((t) => !t.selected && t.linkedPanel))],
		["Close Unpinned Tabs", "close", "cmd_zenCloseUnpinnedTabs"],
		["Rename Tab", "text-title-case", fromTabContextMenu("context_zen-edit-tab-title")],
		["Change Tab Icon", "palette", fromTabContextMenu("context_zen-edit-tab-icon")],
		["Replace Pinned Tab URL with Current", "pin", "cmd_zenReplacePinnedUrlWithCurrent", pinnedChanged],
		["Show All Tabs", "tab", "Browser:ShowAllTabs"],
		["Reopen Closed Window", "window", "History:UndoCloseWindow"],
		["Bookmark This Page", "bookmark", "Browser:AddBookmarkAs", onPage],
		["Bookmark All Tabs", "bookmark-star-on-tray", "Browser:BookmarkAllTabs"],
		["Toggle Bookmarks Toolbar", "bookmark-hollow", "viewBookmarksToolbarKb"],
		["Toggle Fullscreen", "fullscreen", "View:FullScreen"],
		["Reader Mode", "reader-mode", "View:ReaderView", onPage],
		["Zoom In", "plus", "cmd_fullZoomEnlarge", onPage],
		["Zoom Out", "zoom-out", "cmd_fullZoomReduce", onPage],
		["Reset Zoom", "arrow-rotate-anticlockwise", "cmd_fullZoomReset", onPage],
		["View Page Source", "brackets-curly", "View:PageSource", onPage],
		["Page Info", "info", "View:PageInfo", onPage],
		["Picture-in-Picture", "popup", "View:PictureInPicture", onPage],
		["Translate Page", "translations", "cmd_translate", onPage],
		["Developer Tools", "developer", "key_toggleToolboxF12"],
		["Inspector", "developer", "key_inspector", onPage],
		["Web Console", "developer", "key_webconsole", onPage],
		["Responsive Design Mode", "developer", "key_responsiveDesignMode", onPage],
		["Browser Toolbox", "hammer", "key_browserToolbox"],
		["Browser Console", "hammer", "key_browserConsole"],
		["Toggle Floating Sidebar", "sidebar", "cmd_zenCompactModeShowSidebar", inCompactMode],
		["Toggle Sidebar Width", "expand-sidebar", "cmd_zenToggleSidebar"],
		["Close Glance", "close", "cmd_zenGlanceClose", inGlance],
		["Expand Glance", "open", "cmd_zenGlanceExpand", inGlance],
		["Split Glance", "split", "cmd_zenGlanceSplit", inGlance],
		["Copy URL as Markdown", "link", "cmd_zenCopyCurrentURLMarkdown", onPage],
		["Rename Space", "text-title-case", "cmd_zenChangeWorkspaceName"],
		["Change Space Icon", "palette", "cmd_zenChangeWorkspaceIcon"],
		["Save Page As", "save", "Browser:SavePage", onPage],
		["Open File", "folder", "Browser:OpenFile"],
		["Clear Recent History", "forget", "Tools:Sanitize"],
		["Customize Toolbar", "customize", "cmd_CustomizeToolbars"],
		["Minimize Memory Usage", "algorithm", () =>
			Cc["@mozilla.org/memory-reporter-manager;1"]
				.getService(Ci.nsIMemoryReporterManager)
				.minimizeMemoryUsage(() => {})],
		["Restart Browser", "reload", () => restart(false)],
		["Clear Startup Cache and Restart", "trash", () => restart(true)],
		["Quit Browser", "close", "cmd_quitApplication"],
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
		const native = new Set(globalActions.map((a) => a.commandId));
		for (const [label, icon, command, when] of COMMANDS) {
			const isElement = typeof command === "string";
			if (isElement && native.has(command)) continue;
			globalActions.push({
				label,
				icon: `chrome://browser/skin/zen-icons/${icon}.svg`,
				commandId: isElement ? command : `nug:${label}`,
				isAvailable: (win) => {
					if (isElement) {
						const el = win.document.getElementById(command);
						if (!el || el.getAttribute("disabled") === "true") return false;
					}
					return when ? when(win) : true;
				},
				extraPayload: {},
				command,
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
