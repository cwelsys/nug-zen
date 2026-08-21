// ==UserScript==
// @name           Findbar
// @include        *browser.xhtml
// ==/UserScript==

// based on "Findbar Mods" by aminomancer, https://github.com/aminomancer/uc.css.js/blob/master/JS/findbarMods.uc.js,
// licensed CC BY-NC-SA 4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/).
// Provided as-is, no warranty. ShareAlike keeps this file under CC BY-NC-SA 4.0,

(() => {
	const { prefs } = window.Nug;

	// Firefox has no localization strings for these phrases, since they can only
	// be configured in about:config. Change the label and accesskey values for your language. Keep the quotes.
	const L10N = {
		// match case popup submenu
		caseInsensitive: { label: "Case Insensitive", accesskey: "I" },
		caseSensitive: { label: "Case Sensitive", accesskey: "S" },
		// ignore case when your search string is all lowercase; match case when
		// your search string contains at least one capitalized character.
		auto: { label: "Auto", accesskey: "A" },
		// diacritics popup submenu
		// e matches e and é, é matches é and e
		matchAllDiacritics: { label: "Match All Diacritics", accesskey: "A" },
		// e matches e but not é, é matches é but not e
		exclusiveMatch: { label: "Exclusive Matching", accesskey: "E" },
		// e matches e and é, é matches é but not e
		smartMatch: { label: "Smart Matching", accesskey: "S" },
	};

	const CASE_PREF = "accessibility.typeaheadfind.casesensitive";
	const DIACRITICS_PREF = "findbar.matchdiacritics";

	const CUSTOM_SIDES = ["top", "right", "bottom", "left"];
	const CUSTOM_PREFS = CUSTOM_SIDES.map((s) => `nug.findbar.custom.${s}`);

	function applyCustomPosition() {
		const root = document.documentElement;
		if (!root) return;
		for (const side of CUSTOM_SIDES) {
			const value = prefs.getString(`nug.findbar.custom.${side}`, "").trim();
			const name = `--nug-findbar-custom-${side}`;
			if (value) root.style.setProperty(name, value);
			else root.style.removeProperty(name);
		}
	}

	applyCustomPosition();
	const unsubscribeCustomPosition = prefs.subscribe(
		CUSTOM_PREFS,
		applyCustomPosition,
	);
	window.addEventListener("unload", unsubscribeCustomPosition, { once: true });

	// Ctrl/Cmd+F closes the findbar when it's already open and focused.
	function exitFindBar(e) {
		if (e.repeat || e.shiftKey || e.altKey) return;
		if (e.code !== "KeyF" || !(e.ctrlKey || e.metaKey)) return;
		// if it's already hidden then let the built-in command open it.
		if (this.hidden) return;
		let field = this._findField;
		try {
			if (this.findMode > 0) {
				// we're in 'find as you type' mode; switch to normal find.
				this.open(0);
			} else if (
				field.contains(this.ownerDocument.activeElement) &&
				field.selectionEnd - field.selectionStart === field.textLength
			) {
				this.close();
			} else {
				field.select();
				field.focus();
			}
		} catch (err) {
			this.open(0);
		}
		e.preventDefault();
	}

	class FindbarMods {
		/**
		 * create a DOM node with given parameters
		 * @param {object} aDoc (which document to create the element in)
		 * @param {string} tag (an HTML tag name, like "button" or "p")
		 * @param {object} props (an object containing attribute name/value pairs,
		 *                       e.g. class: ".bookmark-item")
		 * @param {boolean} isHTML (if true, create an HTML element. if omitted or
		 *                         false, create a XUL element. generally avoid HTML
		 *                         when modding the UI, most UI elements are actually
		 *                         XUL elements.)
		 * @returns the created DOM node
		 */
		create(aDoc, tag, props, isHTML = false) {
			let el = isHTML
				? aDoc.createElement(tag)
				: aDoc.createXULElement(tag);
			for (let prop in props) el.setAttribute(prop, props[prop]);
			return el;
		}

		constructor() {
			this.isMini = Services.prefs.getBoolPref(
				"nug.findbar.compact.indicator",
				true,
			);
			this.buildContextMenu();
			// callback to execute for every new findbar created
			// (each loaded tab has its own findbar)
			gBrowser.tabContainer.addEventListener("TabFindInitialized", this);
			window.addEventListener("unload", this, { once: true });
		}

		handleEvent(e) {
			switch (e.type) {
				case "TabFindInitialized":
					this.onTabFindInitialized(e);
					break;
				case "popupshowing":
					this.onPopupShowing(e);
					break;
				case "popuphiding":
					this.onPopupHiding(e);
					break;
				case "command":
					this.onCommand(e);
					break;
				case "unload":
					this.destroy();
					break;
			}
		}

		destroy() {
			gBrowser.tabContainer.removeEventListener(
				"TabFindInitialized",
				this,
			);
			this.contextMenu?.remove();
			this.contextMenu = null;
		}

		// The context menu's triggerNode can be the findbar itself or anything inside it.
		findbarFor(node) {
			if (!node) return null;
			return node.tagName === "findbar" ? node : node.closest("findbar");
		}

		async buildStrings() {
			let msgs = await document.l10n.formatMessages([
				"findbar-highlight-all2",
				"findbar-entire-word",
				"findbar-case-sensitive",
				"findbar-match-diacritics",
			]);
			let [highlight, entireWord, caseSense, diacritics] = msgs.map(
				(msg) =>
					msg.attributes.reduce((entries, { name, value }) => {
						entries[name] = value;
						return entries;
					}, {}),
			);
			return { highlight, entireWord, caseSense, diacritics };
		}

		async buildContextMenu() {
			MozXULElement.insertFTLIfNeeded("toolkit/main-window/findbar.ftl");
			this.fluentStrings = await this.buildStrings();
			let menu = this.create(document, "menupopup", {
				id: "findbar-context-menu",
			});
			menu.addEventListener("popupshowing", this);
			menu.addEventListener("popuphiding", this);
			menu.addEventListener("command", this);

			menu._menuitemHighlightAll = menu.appendChild(
				this.create(document, "menuitem", {
					id: "findbar-menu-highlight-all",
					type: "checkbox",
					label: this.fluentStrings.highlight.label,
					accesskey: this.fluentStrings.highlight.accesskey,
				}),
			);
			menu._menuitemEntireWord = menu.appendChild(
				this.create(document, "menuitem", {
					id: "findbar-menu-entire-word",
					type: "checkbox",
					label: this.fluentStrings.entireWord.label,
					accesskey: this.fluentStrings.entireWord.accesskey,
				}),
			);

			menu._menuMatchCase = menu.appendChild(
				this.create(document, "menu", {
					id: "findbar-menu-match-case",
					label: this.fluentStrings.caseSense.label,
					accesskey: this.fluentStrings.caseSense.accesskey,
				}),
			);
			menu._menuMatchCasePopup = this.buildRadioSubmenu(
				menu._menuMatchCase,
				"findbar-menu-case",
				[L10N.caseInsensitive, L10N.caseSensitive, L10N.auto],
			);

			menu._menuMatchDiacritics = menu.appendChild(
				this.create(document, "menu", {
					id: "findbar-menu-match-diacritics",
					label: this.fluentStrings.diacritics.label,
					accesskey: this.fluentStrings.diacritics.accesskey,
				}),
			);
			menu._menuMatchDiacriticsPopup = this.buildRadioSubmenu(
				menu._menuMatchDiacritics,
				"findbar-menu-diacritics",
				[L10N.matchAllDiacritics, L10N.exclusiveMatch, L10N.smartMatch],
			);

			// Attach last so a findbar right-click can't race a half-built menu.
			this.contextMenu = document
				.getElementById("mainPopupSet")
				.appendChild(menu);
		}

		buildRadioSubmenu(parentMenu, idPrefix, items) {
			let popup = parentMenu.appendChild(
				document.createXULElement("menupopup"),
			);
			popup.addEventListener("popupshowing", this);
			items.forEach((item, index) => {
				popup.appendChild(
					this.create(document, "menuitem", {
						id: `${idPrefix}-${index}`,
						type: "radio",
						name: idPrefix,
						label: item.label,
						accesskey: item.accesskey,
						"data-index": index,
					}),
				);
			});
			return popup;
		}

		modClassMethods() {
			let findbarClass = customElements.get("findbar").prototype;
			findbarClass.ucFindbarMods = this;
			// Override the native on-results function so it drives the compact
			// indicator. The verbose label stays hidden (Findbar.css) but keeps its l10n attribute
			findbarClass.onMatchesCountResult = function (result) {
				let indicator = this._tinyIndicator;
				// `total` is 0 when there are no matches, -1 when the match
				// count hit accessibility.typeaheadfind.matchesCountLimit.
				if (!result.total) {
					delete this._foundMatches.dataset.l10nId;
					this._foundMatches.setAttribute("value", "");
					if (indicator) {
						indicator.textContent = "";
						// hide the indicator background with CSS if it's blank.
						indicator.setAttribute("empty", "true");
					}
					return;
				}
				let l10nId, l10nArgs;
				if (result.total === -1) {
					l10nId = "findbar-found-matches-count-limit";
					l10nArgs = { limit: result.limit };
					if (indicator) indicator.textContent = `${result.limit}+`;
				} else {
					l10nId = "findbar-found-matches";
					l10nArgs = { current: result.current, total: result.total };
					if (indicator) {
						indicator.textContent = `${result.current}/${result.total}`;
					}
				}
				// bring it back if it's not blank.
				if (indicator) indicator.removeAttribute("empty");
				// Pass explicit args rather than the whole result object
				// Firefox now includes a `snippets` array on it, which would be
				// JSON-stringified into data-l10n-args on every keystroke.
				this.ownerDocument.l10n.setAttributes(
					this._foundMatches,
					l10nId,
					l10nArgs,
				);
			};
		}

		onCommand(e) {
			let { target } = e;
			let menu = this.contextMenu;
			let findbar = this.findbarFor(menu.triggerNode);
			switch (target) {
				case menu._menuitemHighlightAll:
					findbar?.toggleHighlight(!findbar._highlightAll);
					break;
				case menu._menuitemEntireWord:
					findbar?.toggleEntireWord(
						!findbar.browser.finder._entireWord,
					);
					break;
				default:
					if (target.parentNode === menu._menuMatchCasePopup) {
						Services.prefs.setIntPref(
							CASE_PREF,
							Number(target.dataset.index),
						);
					} else if (
						target.parentNode === menu._menuMatchDiacriticsPopup
					) {
						Services.prefs.setIntPref(
							DIACRITICS_PREF,
							Number(target.dataset.index),
						);
					}
			}
		}

		// sync checked state on popup open
		onPopupShowing(e) {
			let findbar = this.findbarFor(e.target.triggerNode);
			if (!findbar) return;
			if (e.currentTarget !== this.contextMenu) {
				return this.onSubmenuShowing(e);
			}
			this.contextMenu._menuitemHighlightAll.setAttribute(
				"checked",
				!!findbar._highlightAll,
			);
			this.contextMenu._menuitemEntireWord.setAttribute(
				"checked",
				!!findbar._entireWord,
			);
			if (findbar._quickFindTimeout) {
				clearTimeout(findbar._quickFindTimeout);
				findbar._quickFindTimeout = null;
				findbar._updateBrowserWithState();
			}
		}

		onPopupHiding(e) {
			if (e.target !== this.contextMenu) return;
			let findbar = this.findbarFor(e.target.triggerNode);
			if (!findbar) return;
			if (findbar.findMode != findbar.FIND_NORMAL) {
				findbar._setFindCloseTimeout();
			}
		}

		onSubmenuShowing(e) {
			let pref;
			if (e.target === this.contextMenu._menuMatchDiacriticsPopup) {
				pref = DIACRITICS_PREF;
			} else if (e.target === this.contextMenu._menuMatchCasePopup) {
				pref = CASE_PREF;
			} else {
				return;
			}
			let active = Services.prefs.getIntPref(pref, 0);
			for (let item of e.target.children) {
				let index = Number(item.dataset.index);
				// Set both ways; XUL won't uncheck siblings on its own here.
				if (index === active) item.setAttribute("checked", "true");
				else item.removeAttribute("checked");
			}
		}

		domSetup(findbar) {
			findbar.setAttribute("context", "findbar-context-menu");
			if (this.isMini) {
				findbar.setAttribute("compact-indicator", "true");
				this.miniaturize(findbar);
			} else {
				findbar.removeAttribute("compact-indicator");
			}
		}

		miniaturize(findbar) {
			if (findbar._tinyIndicator) return;
			findbar._tinyIndicator = this.create(
				findbar.ownerDocument,
				"label",
				{ class: "matches-indicator", empty: "true" },
			);
			findbar
				.querySelector(".findbar-container")
				.appendChild(findbar._tinyIndicator);
		}

		onTabFindInitialized(e) {
			if (e.target.ownerDocument !== document) return;
			let findbar = e.target._findBar;
			if (!findbar) return;

			if (!this.initialized) {
				this.initialized = true;
				if (this.isMini) this.modClassMethods();
			}

			this.domSetup(findbar);
			if (!findbar._nugExitFindBarAttached) {
				findbar.addEventListener("keypress", exitFindBar, true);
				findbar._nugExitFindBarAttached = true;
			}
		}
	}

	// check that startup has finished and gBrowser is initialized before we add an event listener
	if (window.gBrowserInit?.delayedStartupFinished) {
		new FindbarMods();
	} else {
		let delayedListener = (subject, topic) => {
			if (
				topic == "browser-delayed-startup-finished" &&
				subject == window
			) {
				Services.obs.removeObserver(delayedListener, topic);
				new FindbarMods();
			}
		};
		Services.obs.addObserver(
			delayedListener,
			"browser-delayed-startup-finished",
		);
	}
})();
