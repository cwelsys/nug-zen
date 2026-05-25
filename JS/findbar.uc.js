// ==UserScript==
// @name           Findbar
// @include        *browser.xhtml
// ==/UserScript==

// Modified third-party script. "Findbar Mods" by aminomancer, from
// https://github.com/aminomancer/uc.css.js/blob/master/JS/findbarMods.uc.js,
// licensed CC BY-NC-SA 4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/).
// Provided as-is, no warranty. ShareAlike keeps this file under CC BY-NC-SA 4.0,
// so it's the one exception to the repo's MIT license. It started from v1.4.2 and
// has since diverged; treat this copy as the source of truth, not a tracked mirror.

(() => {
	class FindbarMods {
		get forceMiniFindbar() {
			try {
				return Services.prefs.getBoolPref(
					"nug.findbar.compact.indicator",
					true,
				);
			} catch (e) {
				return true;
			}
		}

		// firefox has no localization strings for these phrases, since they can only
		// be configured in about:config. change the label and accesskey values for
		// your language. keep the quotes.
		static l10n = {
			// match case popup submenu
			caseInsensitive: {
				label: "Case Insensitive",
				accesskey: "I",
			},
			caseSensitive: {
				label: "Case Sensitive",
				accesskey: "S",
			},
			// ignore case when your search string is all lowercase;
			// match case when your search string contains at least one capitalized character.
			auto: {
				label: "Auto",
				accesskey: "A",
			},
			// diacritics popup submenu
			// e matches e and é, é matches é and e
			matchAllDiacritics: {
				label: "Match All Diacritics",
				accesskey: "A",
			},
			// e matches e but not é, é matches é but not e
			exclusiveMatch: {
				label: "Exclusive Matching",
				accesskey: "E",
			},
			// e matches e and é, é matches é but not e
			smartMatch: {
				label: "Smart Matching",
				accesskey: "S",
			},
		};
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
			ChromeUtils.defineLazyGetter(this, "isMini", () => {
				if (this.forceMiniFindbar) return true;
				let file = Cc["@mozilla.org/chrome/chrome-registry;1"]
					.getService(Ci.nsIChromeRegistry)
					.convertChromeURL(
						Services.io.newURI(
							"chrome://userchrome/content/material/",
						),
					)
					?.QueryInterface(Ci.nsIFileURL)?.file;
				return file?.exists() && file?.isDirectory();
			});
			this.buildContextMenu();
			// callback to execute for every new findbar created
			// (each loaded tab has its own findbar)
			gBrowser.tabContainer.addEventListener("TabFindInitialized", this);
			addEventListener("findbaropen", this);
		}
		handleEvent(e) {
			switch (e.type) {
				case "TabFindInitialized":
					this.onTabFindInitialized(e);
					break;
				case "findbaropen":
					this.onFindbarOpen(e);
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
			}
		}
		// we want to use firefox's built-in localized strings wherever possible
		async buildStrings() {
			let msgs = await document.l10n.formatMessages([
				"findbar-highlight-all2",
				"findbar-entire-word",
				"findbar-case-sensitive",
				"findbar-match-diacritics",
			]);
			let attrs = msgs.map((msg) => {
				msg.attributes = msg.attributes.reduce(
					(entries, { name, value }) => {
						entries[name] = value;
						return entries;
					},
					{},
				);
				return msg.attributes;
			});
			let [highlight, entireWord, caseSense, diacritics] = attrs;
			return {
				highlight,
				entireWord,
				caseSense,
				diacritics,
			};
		}
		async buildContextMenu() {
			let { l10n } = FindbarMods;
			// ensure the .ftl file is loaded; this will almost always execute
			// before firefox's own findbar code does.
			MozXULElement.insertFTLIfNeeded("toolkit/main-window/findbar.ftl");
			this.fluentStrings = await this.buildStrings();
			this.contextMenu = document
				.getElementById("mainPopupSet")
				.appendChild(
					this.create(document, "menupopup", {
						id: "findbar-context-menu",
					}),
				);
			this.contextMenu.addEventListener("popupshowing", this);
			this.contextMenu.addEventListener("popuphiding", this);
			this.contextMenu.addEventListener("command", this);

			this.contextMenu._menuitemHighlightAll =
				this.contextMenu.appendChild(
					this.create(document, "menuitem", {
						id: "findbar-menu-highlight-all",
						type: "checkbox",
						label: this.fluentStrings.highlight.label,
						accesskey: this.fluentStrings.highlight.accesskey,
					}),
				);
			this.contextMenu._menuitemEntireWord = this.contextMenu.appendChild(
				this.create(document, "menuitem", {
					id: "findbar-menu-entire-word",
					type: "checkbox",
					label: this.fluentStrings.entireWord.label,
					accesskey: this.fluentStrings.entireWord.accesskey,
				}),
			);

			this.contextMenu._menuMatchCase = this.contextMenu.appendChild(
				this.create(document, "menu", {
					id: "findbar-menu-match-case",
					label: this.fluentStrings.caseSense.label,
					accesskey: this.fluentStrings.caseSense.accesskey,
				}),
			);
			let matchCasePopup = this.contextMenu._menuMatchCase.appendChild(
				document.createXULElement("menupopup"),
			);
			matchCasePopup.addEventListener("popupshowing", this);
			this.contextMenu._menuMatchCasePopup = matchCasePopup;

			// we make these options permanent by using the preferences service
			this.contextMenu._menuitemCaseInsensitive =
				matchCasePopup.appendChild(
					this.create(document, "menuitem", {
						id: "findbar-menu-case-insensitive",
						type: "radio",
						label: l10n.caseInsensitive.label,
						accesskey: l10n.caseInsensitive.accesskey,
						"data-index": 0,
					}),
				);
			this.contextMenu._menuitemCaseSensitive =
				matchCasePopup.appendChild(
					this.create(document, "menuitem", {
						id: "findbar-menu-case-sensitive",
						type: "radio",
						label: l10n.caseSensitive.label,
						accesskey: l10n.caseSensitive.accesskey,
						"data-index": 1,
					}),
				);
			this.contextMenu._menuitemCaseAuto = matchCasePopup.appendChild(
				this.create(document, "menuitem", {
					id: "findbar-menu-case-auto",
					type: "radio",
					label: l10n.auto.label,
					accesskey: l10n.auto.accesskey,
					"data-index": 2,
				}),
			);

			this.contextMenu._menuMatchDiacritics =
				this.contextMenu.appendChild(
					this.create(document, "menu", {
						id: "findbar-menu-match-diacritics",
						label: this.fluentStrings.diacritics.label,
						accesskey: this.fluentStrings.diacritics.accesskey,
					}),
				);
			let diacriticsPopup =
				this.contextMenu._menuMatchDiacritics.appendChild(
					document.createXULElement("menupopup"),
				);
			diacriticsPopup.addEventListener("popupshowing", this);
			this.contextMenu._menuMatchDiacriticsPopup = diacriticsPopup;

			this.contextMenu._menuitemMatchAllDiacritics =
				diacriticsPopup.appendChild(
					this.create(document, "menuitem", {
						id: "findbar-menu-match-all-diacritics",
						type: "radio",
						label: l10n.matchAllDiacritics.label,
						accesskey: l10n.matchAllDiacritics.accesskey,
						"data-index": 0,
					}),
				);
			this.contextMenu._menuitemExclusiveMatching =
				diacriticsPopup.appendChild(
					this.create(document, "menuitem", {
						id: "findbar-menu-exclusive-matching",
						type: "radio",
						label: l10n.exclusiveMatch.label,
						accesskey: l10n.exclusiveMatch.accesskey,
						"data-index": 1,
					}),
				);
			this.contextMenu._menuitemSmartMatching =
				diacriticsPopup.appendChild(
					this.create(document, "menuitem", {
						id: "findbar-menu-smart-matching",
						type: "radio",
						label: l10n.smartMatch.label,
						accesskey: l10n.smartMatch.accesskey,
						"data-index": 2,
					}),
				);
		}
		modClassMethods() {
			let findbarClass = customElements.get("findbar").prototype;
			findbarClass.ucFindbarMods = this;
			// override the native method that sets some findbar UI properties,
			// e.g. switching between normal and find-as-you-type mode.
			findbarClass._updateFindUI = function () {
				let showMinimalUI = this.findMode != this.FIND_NORMAL;
				let nodes = this.getElement("findbar-container").children;
				let wrapper = this.getElement("findbar-textbox-wrapper");
				let foundMatches = this._foundMatches;
				let tinyIndicator = this._tinyIndicator;
				for (let node of nodes) {
					if (node == wrapper || node == foundMatches) continue;
					node.hidden = showMinimalUI;
				}
				this.getElement("find-next").hidden = this.getElement(
					"find-previous",
				).hidden = showMinimalUI;
				foundMatches.hidden = showMinimalUI || !foundMatches.value;
				tinyIndicator.style.display = showMinimalUI
					? "none"
					: "inline-block";
				if (showMinimalUI) this._findField.classList.add("minimal");
				else this._findField.classList.remove("minimal");
				this._updateCaseSensitivity();
				this._updateDiacriticMatching();
				this._setEntireWord();
				this._setHighlightAll();
				let l10nId;
				switch (this.findMode) {
					case this.FIND_TYPEAHEAD:
						l10nId = "findbar-fast-find";
						break;
					case this.FIND_LINKS:
						l10nId = "findbar-fast-find-links";
						break;
					default:
						l10nId = "findbar-normal-find";
				}
				document.l10n.setAttributes(this._findField, l10nId);
			};
			// override the native on-results function so it updates both labels.
			findbarClass.onMatchesCountResult = function (result) {
				let l10nId;
				switch (result.total) {
					case 0:
						delete this._foundMatches.dataset.l10nId;
						this._foundMatches.hidden = true;
						this._foundMatches.setAttribute("value", "");
						this._tinyIndicator.textContent = "   ";
						// hide the indicator background with CSS if it's blank.
						this._tinyIndicator.setAttribute("empty", "true");
						return;
					case -1:
						l10nId = "findbar-found-matches-count-limit";
						// Keep verbose label hidden, only show compact indicator
						this._foundMatches.hidden = true;
						this._tinyIndicator.textContent = `${result.limit}+`;
						// bring it back if it's not blank.
						this._tinyIndicator.removeAttribute("empty");
						break;
					default:
						l10nId = "findbar-found-matches";
						// Keep verbose label hidden, only show compact indicator
						this._foundMatches.hidden = true;
						this._tinyIndicator.textContent = `${result.current}/${result.total}`;
						this._tinyIndicator.removeAttribute("empty");
				}
				// Still set the l10n attributes for accessibility, even though it's hidden
				document.l10n.setAttributes(this._foundMatches, l10nId, result);
			};
		}
		onCommand(e) {
			let { target } = e;
			let node = this.contextMenu.triggerNode;
			switch (target) {
				case this.contextMenu._menuitemHighlightAll: {
					if (!node) return;
					let findbar =
						node.tagName === "findbar"
							? node
							: node.closest("findbar");
					findbar?.toggleHighlight(!findbar._highlightAll);
					break;
				}
				case this.contextMenu._menuitemEntireWord: {
					if (!node) return;
					let findbar =
						node.tagName === "findbar"
							? node
							: node.closest("findbar");
					findbar?.toggleEntireWord(
						!findbar.browser.finder._entireWord,
					);
					break;
				}
				case this.contextMenu._menuitemCaseInsensitive:
				case this.contextMenu._menuitemCaseSensitive:
				case this.contextMenu._menuitemCaseAuto: {
					Services.prefs.setIntPref(
						"accessibility.typeaheadfind.casesensitive",
						target.dataset.index,
					);
					break;
				}
				case this.contextMenu._menuitemMatchAllDiacritics:
				case this.contextMenu._menuitemExclusiveMatching:
				case this.contextMenu._menuitemSmartMatching: {
					Services.prefs.setIntPref(
						"findbar.matchdiacritics",
						target.dataset.index,
					);
					break;
				}
			}
		}
		// sync checked state on popup open
		onPopupShowing(e) {
			let node = e.target.triggerNode;
			if (!node) return;
			let findbar =
				node.tagName === "findbar" ? node : node.closest("findbar");
			if (!findbar) return;
			if (e.currentTarget !== this.contextMenu) {
				return this.onSubmenuShowing(e, findbar);
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
			let node = e.target.triggerNode;
			if (!node) return;
			let findbar =
				node.tagName === "findbar" ? node : node.closest("findbar");
			if (!findbar) return;
			if (findbar.findMode != findbar.FIND_NORMAL)
				findbar._setFindCloseTimeout();
		}

		onSubmenuShowing(e, findbar) {
			if (e.target === this.contextMenu._menuMatchDiacriticsPopup) {
				let diacriticsStatus =
					Services.prefs.getIntPref("findbar.matchdiacritics", 0) ||
					findbar._matchDiacritics;
				let activeItem =
					this.contextMenu._menuMatchDiacriticsPopup.children[
						diacriticsStatus
					];
				activeItem.setAttribute("checked", true);
			}
			if (e.target === this.contextMenu._menuMatchCasePopup) {
				let caseStatus =
					Services.prefs.getIntPref(
						"accessibility.typeaheadfind.casesensitive",
						0,
					) || findbar._typeAheadCaseSensitive;
				let activeItem =
					this.contextMenu._menuMatchCasePopup.children[caseStatus];
				activeItem.setAttribute("checked", true);
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
			// 1/N instead of 1 of N matches.
			findbar._tinyIndicator = this.create(document, "label", {
				class: "matches-indicator",
				style: "box-sizing: border-box; display: inline-block; align-items: center; margin: 0; line-height: 20px; position: absolute; font-size: 10px; right: 110px; color: var(--matches-indicator-text-color, hsla(0, 0%, 100%, 0.25)); pointer-events: none; padding-inline-start: 20px; mask-image: linear-gradient(to right, transparent 0px, black 20px);",
				empty: true,
			});
			findbar
				.querySelector(".findbar-container")
				.appendChild(findbar._tinyIndicator);
		}
		updateLabelPosition(findbar) {
			let distanceFromEdge =
				findbar.getBoundingClientRect().right -
				findbar
					.querySelector(".findbar-textbox")
					.getBoundingClientRect().right;
			findbar._tinyIndicator.style.right = `${distanceFromEdge + 1}px`;
		}
		onTabFindInitialized(e) {
			if (e.target.ownerGlobal !== window) return;
			if (!this.initialized) {
				this.initialized = true;
				if (this.isMini) this.modClassMethods();
			}
			let findbar = e.target._findBar;

			function exitFindBar(e) {
				if (e.repeat || e.shiftKey || e.altKey) return;
				if (e.code === "KeyF" && (e.ctrlKey || e.metaKey)) {
					if (this.hidden) return; // if it's already hidden then let the built-in command open it.
					let field = this._findField;
					try {
						// if we're in 'find as you type' mode...
						if (this.findMode > 0) {
							// switch to normal find mode.
							this.open(0);
						} else if (
							field.contains(document.activeElement) &&
							field.selectionEnd - field.selectionStart ===
								field.textLength
						) {
							this.close();
						} else {
							field.select();
							field.focus();
						}
					} catch (e) {
						this.open(0);
					}
					e.preventDefault();
				}
			}

			this.domSetup(findbar);
			// set up hotkey ctrl+F to close findbar when it's already open
			if (!findbar._nugExitFindBarAttached) {
				findbar.addEventListener("keypress", exitFindBar, true);
				findbar._nugExitFindBarAttached = true;
			}
		}
		onFindbarOpen(e) {
			if (e.target.findMode == e.target.FIND_NORMAL) {
				requestAnimationFrame(() => this.updateLabelPosition(e.target));
			}
		}
	}

	// check that startup has finished and gBrowser is initialized before we add an event listener
	if (gBrowserInit.delayedStartupFinished) {
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
