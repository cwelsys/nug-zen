// Inject CSS into chrome subdialogs (preferences dialogs, commonDialog, etc.)
// Uses document-element-inserted observer to catch subdialog documents as they load
const NUG_SUBDIALOG_CSS = `
@media (prefers-color-scheme: dark) {
	/* Catppuccin Mocha */
	@media (-moz-pref('nug-catppuccin-flavor', 0)) {
		:root {
			--base: #1e1e2e; --mantle: #181825; --crust: #11111b;
			--surface0: #313244; --surface1: #45475a; --surface2: #585b70;
			--text: #cdd6f4; --subtext1: #bac2de;
			--blue: #89b4fa; --lavender: #b4befe; --sapphire: #74c7ec;
			--sky: #89dceb; --teal: #94e2d5; --green: #a6e3a1;
			--yellow: #f9e2af; --peach: #fab387; --maroon: #eba0ac;
			--red: #f38ba8; --mauve: #cba6f7; --pink: #f5c2e7;
			--flamingo: #f2cdcd; --rosewater: #f5e0dc;
		}
	}
	/* Catppuccin Macchiato */
	@media (-moz-pref('nug-catppuccin-flavor', 1)) {
		:root {
			--base: #24273a; --mantle: #1e2030; --crust: #181926;
			--surface0: #363a4f; --surface1: #494d64; --surface2: #5b6078;
			--text: #cad3f5; --subtext1: #b8c0e0;
			--blue: #8aadf4; --lavender: #b7bdf8; --sapphire: #7dc4e4;
			--sky: #91d7e3; --teal: #8bd5ca; --green: #a6da95;
			--yellow: #eed49f; --peach: #f5a97f; --maroon: #ee99a0;
			--red: #ed8796; --mauve: #c6a0f6; --pink: #f5bde6;
			--flamingo: #f0c6c6; --rosewater: #f4dbd6;
		}
	}
	/* Accent color */
	@media (-moz-pref('nug-accent-color', 0)) { :root { --nug-accent: var(--blue); } }
	@media (-moz-pref('nug-accent-color', 1)) { :root { --nug-accent: var(--lavender); } }
	@media (-moz-pref('nug-accent-color', 2)) { :root { --nug-accent: var(--sapphire); } }
	@media (-moz-pref('nug-accent-color', 3)) { :root { --nug-accent: var(--sky); } }
	@media (-moz-pref('nug-accent-color', 4)) { :root { --nug-accent: var(--teal); } }
	@media (-moz-pref('nug-accent-color', 5)) { :root { --nug-accent: var(--green); } }
	@media (-moz-pref('nug-accent-color', 6)) { :root { --nug-accent: var(--yellow); } }
	@media (-moz-pref('nug-accent-color', 7)) { :root { --nug-accent: var(--peach); } }
	@media (-moz-pref('nug-accent-color', 8)) { :root { --nug-accent: var(--maroon); } }
	@media (-moz-pref('nug-accent-color', 9)) { :root { --nug-accent: var(--red); } }
	@media (-moz-pref('nug-accent-color', 10)) { :root { --nug-accent: var(--mauve); } }
	@media (-moz-pref('nug-accent-color', 11)) { :root { --nug-accent: var(--pink); } }
	@media (-moz-pref('nug-accent-color', 12)) { :root { --nug-accent: var(--flamingo); } }
	@media (-moz-pref('nug-accent-color', 13)) { :root { --nug-accent: var(--rosewater); } }

	/* Canvas/dialog background (overrides Zen's --zen-dialog-background → #161C31) */
	:root {
		--zen-dialog-background: var(--base) !important;
		--background-color-canvas: var(--base) !important;
		--zen-primary-color: var(--nug-accent) !important;
		--color-accent-primary: var(--nug-accent) !important;
	}

	/* Dialog buttons via shadow DOM parts */
	dialog::part(dialog-button) {
		--button-background-color: var(--surface0) !important;
		--button-background-color-hover: var(--surface1) !important;
		--button-background-color-active: var(--surface2) !important;
		--button-background-color-primary: var(--nug-accent) !important;
		--button-background-color-primary-hover: color-mix(in srgb, var(--nug-accent) 85%, var(--text)) !important;
		--button-background-color-primary-active: color-mix(in srgb, var(--nug-accent) 70%, var(--text)) !important;
		--button-text-color: var(--text) !important;
		--button-text-color-primary: var(--crust) !important;
	}

	/* Groupbox buttons and menulists */
	groupbox button, groupbox menulist {
		background-color: var(--surface0) !important;
		color: var(--text) !important;
	}
	groupbox button:hover, groupbox menulist:hover {
		background-color: var(--surface1) !important;
	}
	groupbox button:active, groupbox menulist:active {
		background-color: var(--surface2) !important;
	}
}
`

;(function () {
	const subdialogObserver = {
		observe(subject) {
			try {
				const url = subject.documentURI || ''
				if (
					!url.startsWith('chrome://') ||
					!url.endsWith('.xhtml') ||
					url === 'chrome://extensions/content/dummy.xhtml'
				)
					return

				subject.addEventListener(
						'DOMContentLoaded',
						() => {
							try {
								const style = subject.createElement('style')
								style.textContent = NUG_SUBDIALOG_CSS
								subject.documentElement.appendChild(style)
							} catch (e) {
							}

							// Fix dialog cut-off caused by theme CSS increasing
							// subdialog content height after SubDialog.sys.mjs
							// measures and sets min-height on .dialogBox. Wait for
							// SubDialog to finish sizing, then expand if needed.
							try {
								const win = subject.defaultView
								const frame = win?.frameElement
								const box = frame?.closest('.dialogBox')
								if (box) {
									const pWin = win.parent
									let ticks = 0
									const waitForSizing = () => {
										ticks++
										if (box.getAttribute('style')) {
											ticks = 0
											pWin.requestAnimationFrame(checkOverflow)
										} else if (ticks < 120) {
											pWin.requestAnimationFrame(waitForSizing)
										}
									}
									const checkOverflow = () => {
										ticks++
										try {
											const contentH = subject.documentElement.scrollHeight
											const frameH = frame.getBoundingClientRect().height
											if (contentH > frameH + 5 && frameH > 0) {
												const diff = Math.ceil(contentH - frameH) + 4
												const curMinH = parseFloat(pWin.getComputedStyle(box).minHeight) || 0
												let newMinH = curMinH + diff
												const maxAllowed = Math.floor(pWin.innerHeight * 0.9)
												if (newMinH > maxAllowed) {
													newMinH = maxAllowed
													subject.documentElement.style.setProperty('overflow', 'auto', 'important')
												}
												box.style.setProperty('min-height', newMinH + 'px', 'important')
												return
											}
											if (ticks < 60) {
												pWin.requestAnimationFrame(checkOverflow)
											}
										} catch (e) { /* measurement failed */ }
									}
									pWin.requestAnimationFrame(waitForSizing)
								}
							} catch (e) { /* parent access failed */ }
						},
						{ once: true }
					)
			} catch (e) {
				/* non-document subject, ignore */
			}
		},
	}

	Services.obs.addObserver(subdialogObserver, 'document-element-inserted')

	window.addEventListener(
		'unload',
		() => {
			try {
				Services.obs.removeObserver(subdialogObserver, 'document-element-inserted')
			} catch (e) {}
		},
		{ once: true }
	)
})()
// ==UserScript==
// @ignorecache
// @name          Global URL Bar Scroller
// @description   Makes normal URL bar results scrollable. Customizable via about:config (Strings).
// ==/UserScript==
;(function () {
	if (location.href !== 'chrome://browser/content/browser.xhtml') {
		return
	}

	const CONFIG = {
		URLBAR_ID: 'urlbar',
		URLBAR_RESULTS_ID: 'urlbar-results',
		MANUAL_ROW_HEIGHT_PX: 51, // <--- Your desired manual row height
		VISIBLE_RESULTS_LIMIT: 5, // The number of results to show before scrolling
		SCROLLABLE_CLASS: 'zen-urlbar-scrollable-script',
		DEBOUNCE_DELAY_MS: 50,
	}

	// Pre-calculate the initial cap height for easier reference in CSS
	CONFIG.INITIAL_CAP_HEIGHT_PX = CONFIG.VISIBLE_RESULTS_LIMIT * CONFIG.MANUAL_ROW_HEIGHT_PX

	let urlbarElement, resultsElement
	let updateTimeout = null
	let lastResultCount = -1
	let mutationObserver = null
	let urlbarAttributeObserver = null

	function updateViewState() {
		if (!resultsElement || !urlbarElement) return

		clearTimeout(updateTimeout)

		updateTimeout = setTimeout(() => {
			// Zen command palette active — bail out
			const isCommandModeActive = window.ZenCommandPalette?.provider?._isInPrefixMode ?? false
			if (isCommandModeActive) {
				resultsElement.classList.remove(CONFIG.SCROLLABLE_CLASS)
				resultsElement.style.removeProperty('height')
				resultsElement.style.removeProperty('max-height')
				resultsElement.style.removeProperty('overflow-y')
				return // Exit immediately.
			}

			const isUrlbarOpen = urlbarElement.hasAttribute('open')
			const isUserTyping = urlbarElement.hasAttribute('usertyping')

			const computedStyle = resultsElement.ownerDocument.defaultView.getComputedStyle(resultsElement)
			const isUrlbarViewVisibleByCSS =
				computedStyle.getPropertyValue('display') !== 'none' &&
				parseFloat(computedStyle.getPropertyValue('opacity')) > 0

			if (!isUrlbarOpen && !isUserTyping) {
				resultsElement.classList.remove(CONFIG.SCROLLABLE_CLASS)
				resultsElement.style.removeProperty('height')
				resultsElement.style.removeProperty('max-height')
				resultsElement.style.removeProperty('overflow-y')
				resultsElement.scrollTop = 0
				lastResultCount = -1
				return
			}

			if (isUrlbarOpen && !isUrlbarViewVisibleByCSS) {
				// Not visible yet (CSS animation pending)
				if (!resultsElement.style.height) {
					resultsElement.style.height = `${CONFIG.INITIAL_CAP_HEIGHT_PX}px`
					resultsElement.style.overflowY = 'hidden'
				}
				return
			}

			resultsElement.style.removeProperty('max-height') // clear Zen's max-height

			const resultRows = resultsElement.querySelectorAll('.urlbarView-row:not([type="tip"], [type="dynamic"])')
			const currentResultCount = resultRows.length

			if (currentResultCount === lastResultCount && lastResultCount !== -1) {
				return
			}
			lastResultCount = currentResultCount

			const isScrollable = currentResultCount > CONFIG.VISIBLE_RESULTS_LIMIT
			resultsElement.classList.toggle(CONFIG.SCROLLABLE_CLASS, isScrollable)

			let targetHeight
			if (isScrollable) {
				targetHeight = CONFIG.VISIBLE_RESULTS_LIMIT * CONFIG.MANUAL_ROW_HEIGHT_PX
			} else {
				targetHeight = currentResultCount * CONFIG.MANUAL_ROW_HEIGHT_PX
			}

			resultsElement.style.height = `${targetHeight}px`
			resultsElement.style.overflowY = isScrollable ? 'auto' : 'hidden'

			// Auto-scroll to selected row
			for (const row of resultRows) {
				if (row.hasAttribute('selected')) {
					row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
					break
				}
			}
		}, CONFIG.DEBOUNCE_DELAY_MS)
	}

	/**
	 * Sets up the necessary listeners.
	 */
	function setupListeners() {
		mutationObserver = new MutationObserver(() => {
			updateViewState()
		})
		mutationObserver.observe(resultsElement, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['selected'],
		})

		urlbarAttributeObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.attributeName === 'usertyping' || mutation.attributeName === 'open') {
					updateViewState()
				}
			}
		})
		urlbarAttributeObserver.observe(urlbarElement, { attributes: true, attributeFilter: ['usertyping', 'open'] })

		urlbarElement.addEventListener('popuphidden', () => {
			clearTimeout(updateTimeout)
			resultsElement.classList.remove(CONFIG.SCROLLABLE_CLASS)
			resultsElement.style.removeProperty('height')
			resultsElement.style.removeProperty('max-height')
			resultsElement.style.removeProperty('overflow-y')
			resultsElement.scrollTop = 0
			lastResultCount = -1
		})
	}

	function initialize() {
		urlbarElement = document.getElementById(CONFIG.URLBAR_ID)
		resultsElement = document.getElementById(CONFIG.URLBAR_RESULTS_ID)

		if (!urlbarElement || !resultsElement) {
			setTimeout(initialize, 500)
			return
		}

		const styleId = 'zen-urlbar-animated-height-styles-css-controlled'
		if (!document.getElementById(styleId)) {
			const css = `
        #${CONFIG.URLBAR_RESULTS_ID} {
          /* Cap initial height to prevent flicker */
          max-height: ${CONFIG.INITIAL_CAP_HEIGHT_PX}px !important;
          overflow-y: hidden !important;

        }
        #${CONFIG.URLBAR_RESULTS_ID}.${CONFIG.SCROLLABLE_CLASS} {
          overflow-y: auto !important;
        }
      `
			const style = document.createElement('style')
			style.id = styleId
			style.textContent = css
			document.head.appendChild(style)
		}

		setupListeners()
		updateViewState()

		window.addEventListener('unload', () => {
			mutationObserver?.disconnect()
			urlbarAttributeObserver?.disconnect()
			clearTimeout(updateTimeout)
		}, { once: true })
	}

	if (document.readyState === 'complete') {
		initialize()
	} else {
		window.addEventListener('load', initialize, { once: true })
	}
})()

// ==UserScript==
// @ignorecache
// @name           Tab Explode Animation
// @version        1.0
// @description    Adds a bubble explosion animation when a tab or tab group is closed.
// @compatibility  Firefox 100+
// ==/UserScript==
;(() => {
	// Live-reactive pref: cache value and observe for changes so toggling
	// the pref in the theme panel takes effect without a restart.
	const TAB_EXPLODE_PREF = 'nug.tab.explode'
	let tabExplodeEnabled = false
	try {
		tabExplodeEnabled = Services.prefs.getBoolPref(TAB_EXPLODE_PREF, true)
	} catch (e) {}
	const tabExplodePrefObserver = {
		observe(_subject, _topic, data) {
			if (data !== TAB_EXPLODE_PREF) return
			try {
				tabExplodeEnabled = Services.prefs.getBoolPref(TAB_EXPLODE_PREF, true)
			} catch (e) {}
		},
	}
	Services.prefs.addObserver(TAB_EXPLODE_PREF, tabExplodePrefObserver)
	window.addEventListener(
		'unload',
		() => {
			try {
				Services.prefs.removeObserver(TAB_EXPLODE_PREF, tabExplodePrefObserver)
			} catch (e) {}
		},
		{ once: true }
	)

		const TAB_EXPLODE_ANIMATION_ID = 'tab-explode-animation-styles'
		const BUBBLE_COUNT = 25 // Number of bubbles
		const ANIMATION_DURATION = 600 // Milliseconds

		function injectStyles() {
			if (document.getElementById(TAB_EXPLODE_ANIMATION_ID)) {
				return
			}

			const css = `
            .tab-explosion-container {
                position: absolute;
                top: 0;
                left: 0;
                width: 0;
                height: 0;
                pointer-events: none;
                z-index: 99999;
            }

            .bubble-particle {
                position: absolute;
                background-color: light-dark( #cac2b6, #808080) !important;
                border-radius: 50%;
                opacity: 0.8;
                animation-name: bubbleExplode;
                animation-duration: ${ANIMATION_DURATION}ms;
                animation-timing-function: ease-out;
                animation-fill-mode: forwards;
                will-change: transform, opacity;
            }

            @keyframes bubbleExplode {
                0% {
                    transform: scale(0.2);
                    opacity: 0.8;
                }
                100% {
                    transform: translate(var(--tx, 0px), var(--ty, 0px)) scale(var(--s, 1));
                    opacity: 0;
                }
            }
        `

			const styleElement = document.createElement('style')
			styleElement.id = TAB_EXPLODE_ANIMATION_ID
			styleElement.textContent = css
			document.head.appendChild(styleElement)
		}

		function animateElementClose(element) {
			if (!element || !element.isConnected) return
			// Honor OS-level reduced-motion preference
			if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

			const elementRect = element.getBoundingClientRect() // Viewport-relative
			const explosionContainer = document.createElement('div')
			explosionContainer.className = 'tab-explosion-container' // Has position: absolute

			// Find animation parent
			let parentForAnimation = document.getElementById('browser')
			if (!parentForAnimation || !parentForAnimation.isConnected) {
				parentForAnimation = document.getElementById('main-window') || document.documentElement
			}

			const parentRect = parentForAnimation.getBoundingClientRect()

			// Position relative to parent
			explosionContainer.style.left = `${elementRect.left - parentRect.left}px`
			explosionContainer.style.top = `${elementRect.top - parentRect.top}px`
			explosionContainer.style.width = `${elementRect.width}px`
			explosionContainer.style.height = `${elementRect.height}px`

			parentForAnimation.appendChild(explosionContainer)

			for (let i = 0; i < BUBBLE_COUNT; i++) {
				const bubble = document.createElement('div')
				bubble.className = 'bubble-particle'

				let initialX, initialY
				let edge
				if (i < 4) {
					edge = i
				} else {
					edge = Math.floor(Math.random() * 4)
				}

				const bubbleSizeOffset = 5 // Half of average bubble size, to keep them visually on edge

				switch (edge) {
					case 0: // Top edge
						initialX = Math.random() * elementRect.width
						initialY = -bubbleSizeOffset
						break
					case 1: // Right edge
						initialX = elementRect.width + bubbleSizeOffset
						initialY = Math.random() * elementRect.height
						break
					case 2: // Bottom edge
						initialX = Math.random() * elementRect.width
						initialY = elementRect.height + bubbleSizeOffset
						break
					case 3: // Left edge
						initialX = -bubbleSizeOffset
						initialY = Math.random() * elementRect.height
						break
				}

				bubble.style.left = `${initialX}px`
				bubble.style.top = `${initialY}px`
				bubble.style.width = `${Math.random() * 4 + 4}px` // Random size (4px to 8px)
				bubble.style.height = bubble.style.width

				const angle = Math.random() * Math.PI * 2
				let distance = Math.random() * 1 + 1 // Explosion radius, even further reduced spread
				let finalTranslateX = Math.cos(angle) * distance
				let finalTranslateY = Math.sin(angle) * distance

				// Bias explosion outwards from the edge
				const outwardBias = 10 // Reduced outward bias
				if (edge === 0) finalTranslateY -= outwardBias // Upwards from top
				if (edge === 1) finalTranslateX += outwardBias // Rightwards from right
				if (edge === 2) finalTranslateY += outwardBias // Downwards from bottom
				if (edge === 3) finalTranslateX -= outwardBias // Leftwards from left

				const finalScale = Math.random() * 0.4 + 0.7 // Scale up a bit

				bubble.style.setProperty('--tx', `${finalTranslateX}px`)
				bubble.style.setProperty('--ty', `${finalTranslateY}px`)
				bubble.style.setProperty('--s', finalScale)

				bubble.style.animationDelay = `${Math.random() * 120}ms`

				explosionContainer.appendChild(bubble)
			}

			element.style.opacity = '0'
			element.style.transition = 'opacity 0.1s linear'

			setTimeout(() => {
				if (explosionContainer.parentNode) {
					explosionContainer.parentNode.removeChild(explosionContainer)
				}
			}, ANIMATION_DURATION + 100) // Add slight buffer for animation delay
		}

		function onTabClose(event) {
			if (!tabExplodeEnabled) return
			const tab = event.target
			// Skip pinned/disconnected tabs
			if (tab.localName === 'tab' && !tab.pinned && tab.isConnected) {
				// Check if the tab is part of a group
				const groupParent = tab.closest('tab-group')
				if (!groupParent) {
					animateElementClose(tab)
				}
			}
		}

		function onTabGroupRemove(event) {
			if (!tabExplodeEnabled) return
			const group = event.target
			if (group && group.localName === 'tab-group' && group.isConnected) {
				animateElementClose(group)
			}
		}

		function init() {
			injectStyles()
			if (typeof gBrowser !== 'undefined' && gBrowser.tabContainer) {
				gBrowser.tabContainer.addEventListener('TabClose', onTabClose, false)
				gBrowser.tabContainer.addEventListener('TabGroupRemoved', onTabGroupRemove, false)
			} else {
				setTimeout(init, 1000)
			}
		}

		if (document.readyState === 'complete') {
			init()
		} else {
			window.addEventListener('load', init, { once: true })
		}
})()

// ==UserScript==
// @name           Findbar Mods
// @version        1.4.2
// @author         aminomancer
// @homepageURL    https://github.com/aminomancer

class FindbarMods {
	get forceMiniFindbar() {
		try {
			return Services.prefs.getBoolPref('nug.findbar.compact.indicator', true)
		} catch (e) {
			return true
		}
	}

	// firefox has no localization strings for these phrases, since they can only
	// be configured in about:config. change the label and accesskey values for
	// your language. keep the quotes.
	static l10n = {
		// match case popup submenu
		caseInsensitive: {
			label: 'Case Insensitive',
			accesskey: 'I',
		},
		caseSensitive: {
			label: 'Case Sensitive',
			accesskey: 'S',
		},
		// ignore case when your search string is all lowercase;
		// match case when your search string contains at least one capitalized character.
		auto: {
			label: 'Auto',
			accesskey: 'A',
		},
		// diacritics popup submenu
		// e matches e and é, é matches é and e
		matchAllDiacritics: {
			label: 'Match All Diacritics',
			accesskey: 'A',
		},
		// e matches e but not é, é matches é but not e
		exclusiveMatch: {
			label: 'Exclusive Matching',
			accesskey: 'E',
		},
		// e matches e and é, é matches é but not e
		smartMatch: {
			label: 'Smart Matching',
			accesskey: 'S',
		},
	}
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
		let el = isHTML ? aDoc.createElement(tag) : aDoc.createXULElement(tag)
		for (let prop in props) el.setAttribute(prop, props[prop])
		return el
	}
	constructor() {
		ChromeUtils.defineLazyGetter(this, 'isMini', () => {
			if (this.forceMiniFindbar) return true
			let file = Cc['@mozilla.org/chrome/chrome-registry;1']
				.getService(Ci.nsIChromeRegistry)
				.convertChromeURL(Services.io.newURI('chrome://userchrome/content/material/'))
				?.QueryInterface(Ci.nsIFileURL)?.file
			return file?.exists() && file?.isDirectory()
		})
		this.buildContextMenu()
		// callback to execute for every new findbar created
		// (each loaded tab has its own findbar)
		gBrowser.tabContainer.addEventListener('TabFindInitialized', this)
		addEventListener('findbaropen', this)
	}
	handleEvent(e) {
		switch (e.type) {
			case 'TabFindInitialized':
				this.onTabFindInitialized(e)
				break
			case 'findbaropen':
				this.onFindbarOpen(e)
				break
			case 'popupshowing':
				this.onPopupShowing(e)
				break
			case 'popuphiding':
				this.onPopupHiding(e)
				break
			case 'command':
				this.onCommand(e)
				break
		}
	}
	// we want to use firefox's built-in localized strings wherever possible
	async buildStrings() {
		let msgs = await document.l10n.formatMessages([
			'findbar-highlight-all2',
			'findbar-entire-word',
			'findbar-case-sensitive',
			'findbar-match-diacritics',
		])
		let attrs = msgs.map((msg) => {
			msg.attributes = msg.attributes.reduce((entries, { name, value }) => {
				entries[name] = value
				return entries
			}, {})
			return msg.attributes
		})
		let [highlight, entireWord, caseSense, diacritics] = attrs
		return {
			highlight,
			entireWord,
			caseSense,
			diacritics,
		}
	}
	async buildContextMenu() {
		let { l10n } = FindbarMods
		// ensure the .ftl file is loaded; this will almost always execute
		// before firefox's own findbar code does.
		MozXULElement.insertFTLIfNeeded('toolkit/main-window/findbar.ftl')
		this.fluentStrings = await this.buildStrings()
		this.contextMenu = document.getElementById('mainPopupSet').appendChild(
			this.create(document, 'menupopup', {
				id: 'findbar-context-menu',
			})
		)
		this.contextMenu.addEventListener('popupshowing', this)
		this.contextMenu.addEventListener('popuphiding', this)
		this.contextMenu.addEventListener('command', this)

		this.contextMenu._menuitemHighlightAll = this.contextMenu.appendChild(
			this.create(document, 'menuitem', {
				id: 'findbar-menu-highlight-all',
				type: 'checkbox',
				label: this.fluentStrings.highlight.label,
				accesskey: this.fluentStrings.highlight.accesskey,
			})
		)
		this.contextMenu._menuitemEntireWord = this.contextMenu.appendChild(
			this.create(document, 'menuitem', {
				id: 'findbar-menu-entire-word',
				type: 'checkbox',
				label: this.fluentStrings.entireWord.label,
				accesskey: this.fluentStrings.entireWord.accesskey,
			})
		)

		this.contextMenu._menuMatchCase = this.contextMenu.appendChild(
			this.create(document, 'menu', {
				id: 'findbar-menu-match-case',
				label: this.fluentStrings.caseSense.label,
				accesskey: this.fluentStrings.caseSense.accesskey,
			})
		)
		let matchCasePopup = this.contextMenu._menuMatchCase.appendChild(document.createXULElement('menupopup'))
		matchCasePopup.addEventListener('popupshowing', this)
		this.contextMenu._menuMatchCasePopup = matchCasePopup

		// we make these options permanent by using the preferences service
		this.contextMenu._menuitemCaseInsensitive = matchCasePopup.appendChild(
			this.create(document, 'menuitem', {
				id: 'findbar-menu-case-insensitive',
				type: 'radio',
				label: l10n.caseInsensitive.label,
				accesskey: l10n.caseInsensitive.accesskey,
				'data-index': 0,
			})
		)
		this.contextMenu._menuitemCaseSensitive = matchCasePopup.appendChild(
			this.create(document, 'menuitem', {
				id: 'findbar-menu-case-sensitive',
				type: 'radio',
				label: l10n.caseSensitive.label,
				accesskey: l10n.caseSensitive.accesskey,
				'data-index': 1,
			})
		)
		this.contextMenu._menuitemCaseAuto = matchCasePopup.appendChild(
			this.create(document, 'menuitem', {
				id: 'findbar-menu-case-auto',
				type: 'radio',
				label: l10n.auto.label,
				accesskey: l10n.auto.accesskey,
				'data-index': 2,
			})
		)

		this.contextMenu._menuMatchDiacritics = this.contextMenu.appendChild(
			this.create(document, 'menu', {
				id: 'findbar-menu-match-diacritics',
				label: this.fluentStrings.diacritics.label,
				accesskey: this.fluentStrings.diacritics.accesskey,
			})
		)
		let diacriticsPopup = this.contextMenu._menuMatchDiacritics.appendChild(document.createXULElement('menupopup'))
		diacriticsPopup.addEventListener('popupshowing', this)
		this.contextMenu._menuMatchDiacriticsPopup = diacriticsPopup

		this.contextMenu._menuitemMatchAllDiacritics = diacriticsPopup.appendChild(
			this.create(document, 'menuitem', {
				id: 'findbar-menu-match-all-diacritics',
				type: 'radio',
				label: l10n.matchAllDiacritics.label,
				accesskey: l10n.matchAllDiacritics.accesskey,
				'data-index': 0,
			})
		)
		this.contextMenu._menuitemExclusiveMatching = diacriticsPopup.appendChild(
			this.create(document, 'menuitem', {
				id: 'findbar-menu-exclusive-matching',
				type: 'radio',
				label: l10n.exclusiveMatch.label,
				accesskey: l10n.exclusiveMatch.accesskey,
				'data-index': 1,
			})
		)
		this.contextMenu._menuitemSmartMatching = diacriticsPopup.appendChild(
			this.create(document, 'menuitem', {
				id: 'findbar-menu-smart-matching',
				type: 'radio',
				label: l10n.smartMatch.label,
				accesskey: l10n.smartMatch.accesskey,
				'data-index': 2,
			})
		)
	}
	modClassMethods() {
		let findbarClass = customElements.get('findbar').prototype
		findbarClass.ucFindbarMods = this
		// override the native method that sets some findbar UI properties,
		// e.g. switching between normal and find-as-you-type mode.
		findbarClass._updateFindUI = function () {
			let showMinimalUI = this.findMode != this.FIND_NORMAL
			let nodes = this.getElement('findbar-container').children
			let wrapper = this.getElement('findbar-textbox-wrapper')
			let foundMatches = this._foundMatches
			let tinyIndicator = this._tinyIndicator
			for (let node of nodes) {
				if (node == wrapper || node == foundMatches) continue
				node.hidden = showMinimalUI
			}
			this.getElement('find-next').hidden = this.getElement('find-previous').hidden = showMinimalUI
			foundMatches.hidden = showMinimalUI || !foundMatches.value
			tinyIndicator.style.display = showMinimalUI ? 'none' : 'inline-block'
			if (showMinimalUI) this._findField.classList.add('minimal')
			else this._findField.classList.remove('minimal')
			this._updateCaseSensitivity()
			this._updateDiacriticMatching()
			this._setEntireWord()
			this._setHighlightAll()
			let l10nId
			switch (this.findMode) {
				case this.FIND_TYPEAHEAD:
					l10nId = 'findbar-fast-find'
					break
				case this.FIND_LINKS:
					l10nId = 'findbar-fast-find-links'
					break
				default:
					l10nId = 'findbar-normal-find'
			}
			document.l10n.setAttributes(this._findField, l10nId)
		}
		// override the native on-results function so it updates both labels.
		findbarClass.onMatchesCountResult = function (result) {
			let l10nId
			switch (result.total) {
				case 0:
					delete this._foundMatches.dataset.l10nId
					this._foundMatches.hidden = true
					this._foundMatches.setAttribute('value', '')
					this._tinyIndicator.textContent = '   '
					// hide the indicator background with CSS if it's blank.
					this._tinyIndicator.setAttribute('empty', 'true')
					return
				case -1:
					l10nId = 'findbar-found-matches-count-limit'
					// Keep verbose label hidden, only show compact indicator
					this._foundMatches.hidden = true
					this._tinyIndicator.textContent = `${result.limit}+`
					// bring it back if it's not blank.
					this._tinyIndicator.removeAttribute('empty')
					break
				default:
					l10nId = 'findbar-found-matches'
					// Keep verbose label hidden, only show compact indicator
					this._foundMatches.hidden = true
					this._tinyIndicator.textContent = `${result.current}/${result.total}`
					this._tinyIndicator.removeAttribute('empty')
			}
			// Still set the l10n attributes for accessibility, even though it's hidden
			document.l10n.setAttributes(this._foundMatches, l10nId, result)
		}
	}
	onCommand(e) {
		let { target } = e
		let node = this.contextMenu.triggerNode
		switch (target) {
			case this.contextMenu._menuitemHighlightAll: {
				if (!node) return
				let findbar = node.tagName === 'findbar' ? node : node.closest('findbar')
				findbar?.toggleHighlight(!findbar._highlightAll)
				break
			}
			case this.contextMenu._menuitemEntireWord: {
				if (!node) return
				let findbar = node.tagName === 'findbar' ? node : node.closest('findbar')
				findbar?.toggleEntireWord(!findbar.browser.finder._entireWord)
				break
			}
			case this.contextMenu._menuitemCaseInsensitive:
			case this.contextMenu._menuitemCaseSensitive:
			case this.contextMenu._menuitemCaseAuto: {
				Services.prefs.setIntPref('accessibility.typeaheadfind.casesensitive', target.dataset.index)
				break
			}
			case this.contextMenu._menuitemMatchAllDiacritics:
			case this.contextMenu._menuitemExclusiveMatching:
			case this.contextMenu._menuitemSmartMatching: {
				Services.prefs.setIntPref('findbar.matchdiacritics', target.dataset.index)
				break
			}
		}
	}
	// sync checked state on popup open
	onPopupShowing(e) {
		let node = e.target.triggerNode
		if (!node) return
		let findbar = node.tagName === 'findbar' ? node : node.closest('findbar')
		if (!findbar) return
		if (e.currentTarget !== this.contextMenu) {
			return this.onSubmenuShowing(e, findbar)
		}
		this.contextMenu._menuitemHighlightAll.setAttribute('checked', !!findbar._highlightAll)
		this.contextMenu._menuitemEntireWord.setAttribute('checked', !!findbar._entireWord)
		if (findbar._quickFindTimeout) {
			clearTimeout(findbar._quickFindTimeout)
			findbar._quickFindTimeout = null
			findbar._updateBrowserWithState()
		}
	}
	onPopupHiding(e) {
		if (e.target !== this.contextMenu) return
		let node = e.target.triggerNode
		if (!node) return
		let findbar = node.tagName === 'findbar' ? node : node.closest('findbar')
		if (!findbar) return
		if (findbar.findMode != findbar.FIND_NORMAL) findbar._setFindCloseTimeout()
	}
	// do the same with the submenus, except since they have type="radio" we don't
	// need to uncheck anything. checking any of a radio menuitem's siblings will
	// automatically uncheck it, just like a radio input.
	onSubmenuShowing(e, findbar) {
		if (e.target === this.contextMenu._menuMatchDiacriticsPopup) {
			let diacriticsStatus = Services.prefs.getIntPref('findbar.matchdiacritics', 0) || findbar._matchDiacritics
			let activeItem = this.contextMenu._menuMatchDiacriticsPopup.children[diacriticsStatus]
			activeItem.setAttribute('checked', true)
		}
		if (e.target === this.contextMenu._menuMatchCasePopup) {
			let caseStatus =
				Services.prefs.getIntPref('accessibility.typeaheadfind.casesensitive', 0) || findbar._typeAheadCaseSensitive
			let activeItem = this.contextMenu._menuMatchCasePopup.children[caseStatus]
			activeItem.setAttribute('checked', true)
		}
	}
	domSetup(findbar) {
		findbar.setAttribute('context', 'findbar-context-menu')
		if (this.isMini) {
			findbar.setAttribute('compact-indicator', 'true')
			this.miniaturize(findbar)
		} else {
			findbar.removeAttribute('compact-indicator')
		}
	}
	miniaturize(findbar) {
		// 1/N instead of 1 of N matches.
		findbar._tinyIndicator = this.create(document, 'label', {
			class: 'matches-indicator',
			style:
				'box-sizing: border-box; display: inline-block; align-items: center; margin: 0; line-height: 20px; position: absolute; font-size: 10px; right: 110px; color: var(--matches-indicator-text-color, hsla(0, 0%, 100%, 0.25)); pointer-events: none; padding-inline-start: 20px; mask-image: linear-gradient(to right, transparent 0px, black 20px);',
			empty: true,
		})
		// just append it to the findbar container without moving other elements
		findbar.querySelector('.findbar-container').appendChild(findbar._tinyIndicator)
	}
	// for a given findbar, move its label into the proper position.
	updateLabelPosition(findbar) {
		let distanceFromEdge =
			findbar.getBoundingClientRect().right - findbar.querySelector('.findbar-textbox').getBoundingClientRect().right
		findbar._tinyIndicator.style.right = `${distanceFromEdge + 1}px`
	}
	// when a new tab is opened and the findbar somehow activated, a new findbar
	// is born. so we have to manage it every time.
	onTabFindInitialized(e) {
		if (e.target.ownerGlobal !== window) return
		if (!this.initialized) {
			this.initialized = true
			if (this.isMini) this.modClassMethods()
		}
		let findbar = e.target._findBar

		// determine what to do when the hotkey is pressed
		function exitFindBar(e) {
			if (e.repeat || e.shiftKey || e.altKey) return
			if (e.code === 'KeyF' && (e.ctrlKey || e.metaKey)) {
				if (this.hidden) return // if it's already hidden then let the built-in command open it.
				let field = this._findField
				try {
					// if we're in 'find as you type' mode...
					if (this.findMode > 0) {
						// switch to normal find mode.
						this.open(0)
					} else if (
						field.contains(document.activeElement) &&
						field.selectionEnd - field.selectionStart === field.textLength
					) {
						this.close()
					} else {
						field.select()
						field.focus()
					}
				} catch (e) {
					this.open(0)
				}
				e.preventDefault()
			}
		}

		this.domSetup(findbar)
		// set up hotkey ctrl+F to close findbar when it's already open
		if (!findbar._nugExitFindBarAttached) {
			findbar.addEventListener('keypress', exitFindBar, true)
			findbar._nugExitFindBarAttached = true
		}
	}
	onFindbarOpen(e) {
		if (e.target.findMode == e.target.FIND_NORMAL) {
			requestAnimationFrame(() => this.updateLabelPosition(e.target))
		}
	}
}

// check that startup has finished and gBrowser is initialized before we add an event listener
if (gBrowserInit.delayedStartupFinished) {
	new FindbarMods()
} else {
	let delayedListener = (subject, topic) => {
		if (topic == 'browser-delayed-startup-finished' && subject == window) {
			Services.obs.removeObserver(delayedListener, topic)
			new FindbarMods()
		}
	}
	Services.obs.addObserver(delayedListener, 'browser-delayed-startup-finished')
}

// Override urlbar placeholder text
;(function () {
	if (location.href !== 'chrome://browser/content/browser.xhtml') return
	Services.prefs.setStringPref('browser.urlbar.placeholder.value', '…')
})()
