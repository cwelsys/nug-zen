// ==UserScript==
// @name           Global URL Bar Scroller
// @description    Makes normal URL bar results scrollable. Customizable via about:config (Strings).
// @include        *browser.xhtml
// ==/UserScript==

(function () {
	if (location.href !== "chrome://browser/content/browser.xhtml") return;

	const { whenReady, injectStyle } = window.Nug;

	const CONFIG = {
		URLBAR_ID: "urlbar",
		URLBAR_RESULTS_ID: "urlbar-results",
		MANUAL_ROW_HEIGHT_PX: 51, // <--- Your desired manual row height
		VISIBLE_RESULTS_LIMIT: 5, // The number of results to show before scrolling
		SCROLLABLE_CLASS: "zen-urlbar-scrollable-script",
		DEBOUNCE_DELAY_MS: 50,
	};

	CONFIG.INITIAL_CAP_HEIGHT_PX = CONFIG.VISIBLE_RESULTS_LIMIT * CONFIG.MANUAL_ROW_HEIGHT_PX;

	let urlbarElement, resultsElement;
	let updateTimeout = null;
	let lastResultCount = -1;
	let mutationObserver = null;
	let urlbarAttributeObserver = null;

	function updateViewState() {
		if (!resultsElement || !urlbarElement) return;

		clearTimeout(updateTimeout);

		updateTimeout = setTimeout(() => {
			const isCommandModeActive = window.ZenCommandPalette?.provider?._isInPrefixMode ?? false;
			if (isCommandModeActive) {
				resultsElement.classList.remove(CONFIG.SCROLLABLE_CLASS);
				resultsElement.style.removeProperty("height");
				resultsElement.style.removeProperty("max-height");
				resultsElement.style.removeProperty("overflow-y");
				return;
			}

			const isUrlbarOpen = urlbarElement.hasAttribute("open");
			const isUserTyping = urlbarElement.hasAttribute("usertyping");

			const computedStyle = resultsElement.ownerDocument.defaultView.getComputedStyle(resultsElement);
			const isUrlbarViewVisibleByCSS =
				computedStyle.getPropertyValue("display") !== "none" &&
				parseFloat(computedStyle.getPropertyValue("opacity")) > 0;

			if (!isUrlbarOpen && !isUserTyping) {
				resultsElement.classList.remove(CONFIG.SCROLLABLE_CLASS);
				resultsElement.style.removeProperty("height");
				resultsElement.style.removeProperty("max-height");
				resultsElement.style.removeProperty("overflow-y");
				resultsElement.scrollTop = 0;
				lastResultCount = -1;
				return;
			}

			if (isUrlbarOpen && !isUrlbarViewVisibleByCSS) {
				if (!resultsElement.style.height) {
					resultsElement.style.height = `${CONFIG.INITIAL_CAP_HEIGHT_PX}px`;
					resultsElement.style.overflowY = "hidden";
				}
				return;
			}

			resultsElement.style.removeProperty("max-height");

			const resultRows = resultsElement.querySelectorAll('.urlbarView-row:not([type="tip"], [type="dynamic"])');
			const currentResultCount = resultRows.length;

			if (currentResultCount === lastResultCount && lastResultCount !== -1) {
				return;
			}
			lastResultCount = currentResultCount;

			const isScrollable = currentResultCount > CONFIG.VISIBLE_RESULTS_LIMIT;
			resultsElement.classList.toggle(CONFIG.SCROLLABLE_CLASS, isScrollable);

			const targetHeight = isScrollable
				? CONFIG.VISIBLE_RESULTS_LIMIT * CONFIG.MANUAL_ROW_HEIGHT_PX
				: currentResultCount * CONFIG.MANUAL_ROW_HEIGHT_PX;

			resultsElement.style.height = `${targetHeight}px`;
			resultsElement.style.overflowY = isScrollable ? "auto" : "hidden";

			// Auto-scroll to selected row
			for (const row of resultRows) {
				if (row.hasAttribute("selected")) {
					row.scrollIntoView({ block: "nearest", behavior: "smooth" });
					break;
				}
			}
		}, CONFIG.DEBOUNCE_DELAY_MS);
	}

	function setupListeners() {
		mutationObserver = new MutationObserver(() => {
			updateViewState();
		});
		mutationObserver.observe(resultsElement, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["selected"],
		});

		urlbarAttributeObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.attributeName === "usertyping" || mutation.attributeName === "open") {
					updateViewState();
				}
			}
		});
		urlbarAttributeObserver.observe(urlbarElement, { attributes: true, attributeFilter: ["usertyping", "open"] });

		urlbarElement.addEventListener("popuphidden", () => {
			clearTimeout(updateTimeout);
			resultsElement.classList.remove(CONFIG.SCROLLABLE_CLASS);
			resultsElement.style.removeProperty("height");
			resultsElement.style.removeProperty("max-height");
			resultsElement.style.removeProperty("overflow-y");
			resultsElement.scrollTop = 0;
			lastResultCount = -1;
		});
	}

	function initialize() {
		urlbarElement = document.getElementById(CONFIG.URLBAR_ID);
		resultsElement = document.getElementById(CONFIG.URLBAR_RESULTS_ID);
		if (!urlbarElement || !resultsElement) return;

		injectStyle(
			"zen-urlbar-animated-height-styles-css-controlled",
			`
        #${CONFIG.URLBAR_RESULTS_ID} {
          /* Cap initial height to prevent flicker */
          max-height: ${CONFIG.INITIAL_CAP_HEIGHT_PX}px !important;
          overflow-y: hidden !important;

        }
        #${CONFIG.URLBAR_RESULTS_ID}.${CONFIG.SCROLLABLE_CLASS} {
          overflow-y: auto !important;
        }
      `,
		);

		setupListeners();
		updateViewState();

		window.addEventListener(
			"unload",
			() => {
				mutationObserver?.disconnect();
				urlbarAttributeObserver?.disconnect();
				clearTimeout(updateTimeout);
			},
			{ once: true },
		);
	}

	whenReady(initialize);
})();
