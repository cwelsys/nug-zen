// ==UserScript==
// @ignorecache
// @name          Dynamic URLBar Background Height
// @description   Adjusts the height of #browser::before to match .urlbarView height.
// ==/UserScript==
if (Services.prefs.getBoolPref('browser.tabs.allow_transparent_browser', false)) {
	;(function () {
		// Only run in the main browser window
		if (window.location.href !== 'chrome://browser/content/browser.xhtml') {
			return
		}

		console.log('DynamicUrlbarHeight script loading...')

		const BROWSER_ELEMENT_ID = 'browser'
		const URLBAR_ELEMENT_ID = 'urlbar'
		const URLBAR_VIEW_SELECTOR = '.urlbarView' // Selector for the results container
		const HEIGHT_VARIABLE_NAME = '--urlbar-view-dynamic-height'

		let browserElement = document.getElementById(BROWSER_ELEMENT_ID)
		let urlbarElement = document.getElementById(URLBAR_ELEMENT_ID)
		let urlbarViewElement = null // Will store the results view element when found
		let resizeObserver = null
		let mutationObserver = null

		// --- Function to find the Urlbar View ---
		// Needs to be robust as it might not be a direct child
		function findUrlbarViewElement() {
			if (!urlbarElement) return null
			// First, try direct descendant of urlbar (most common)
			let view = urlbarElement.querySelector(`:scope > ${URLBAR_VIEW_SELECTOR}`)
			if (view) return view
			// Fallback: search within the broader browser element (less specific)
			if (browserElement) {
				view = browserElement.querySelector(URLBAR_VIEW_SELECTOR)
				if (view) return view
			}
			// Fallback: Search the whole document (least ideal)
			view = document.querySelector(URLBAR_VIEW_SELECTOR)

			// You might need to inspect the DOM in your specific FF version/theme
			// if .urlbarView isn't the right container. .urlbarView-body-outer or
			// .urlbarView-results might be needed in some cases.
			// console.log("Searching for urlbar view, found:", view);
			return view
		}

		// --- Function to measure and update the CSS variable ---
		function updateHeightVariable() {
			if (!browserElement) return

			// Check if urlbar is open and view element exists
			if (urlbarElement && urlbarElement.hasAttribute('open') && urlbarViewElement) {
				try {
					// getBoundingClientRect().height is often more accurate than offsetHeight
					const height = urlbarViewElement.getBoundingClientRect().height

					if (height > 0) {
						// console.log(`Updating ${HEIGHT_VARIABLE_NAME} to: ${height}px`);
						browserElement.style.setProperty(HEIGHT_VARIABLE_NAME, `${height}px`)
					} else {
						// If height is 0 (maybe transitioning out), remove the variable
						// console.log("Urlbar view height is 0, removing variable.");
						browserElement.style.removeProperty(HEIGHT_VARIABLE_NAME)
					}
				} catch (e) {
					console.error('DynamicUrlbarHeight Error measuring/setting height:', e)
					browserElement.style.removeProperty(HEIGHT_VARIABLE_NAME) // Reset on error
				}
			} else {
				// Urlbar is closed or view not found, remove the variable
				// console.log("Urlbar closed or view not found, removing variable.");
				browserElement.style.removeProperty(HEIGHT_VARIABLE_NAME)
			}
		}

		// --- Initialize ResizeObserver ---
		// This watches the results view itself for size changes while it's open
		function setupResizeObserver() {
			if (resizeObserver) return // Already setup

			resizeObserver = new ResizeObserver((entries) => {
				// Only update if the urlbar is still open; debounce might be needed
				// if updates are too frequent, but usually fine.
				if (urlbarElement && urlbarElement.hasAttribute('open')) {
					// console.log("ResizeObserver detected change on .urlbarView");
					window.requestAnimationFrame(updateHeightVariable) // Update smoothly
				} else {
					// Stop observing if urlbar closed unexpectedly between resize and callback
					console.log('ResizeObserver detected change, but urlbar closed. Stopping observation.')
					if (urlbarViewElement) {
						try {
							resizeObserver.unobserve(urlbarViewElement)
						} catch (e) {}
					}
				}
			})
			console.log('ResizeObserver initialized.')
		}

		// --- Initialize MutationObserver ---
		// This watches the #urlbar for the 'open' attribute
		function setupMutationObserver() {
			if (!urlbarElement || mutationObserver) return // Need urlbar, or already setup

			mutationObserver = new MutationObserver((mutations) => {
				let urlbarStateChanged = false
				for (let mutation of mutations) {
					if (mutation.attributeName === 'open') {
						urlbarStateChanged = true
						break
					}
				}

				if (!urlbarStateChanged) return // Only care about the 'open' attribute

				if (urlbarElement.hasAttribute('open')) {
					// --- URL Bar Opened ---
					console.log('MutationObserver: URL Bar Opened')
					// Try to find the view element *now*
					urlbarViewElement = findUrlbarViewElement()

					if (urlbarViewElement) {
						// Update height immediately
						updateHeightVariable()
						// Start observing the view for resize changes
						if (resizeObserver) {
							try {
								resizeObserver.observe(urlbarViewElement)
								console.log('ResizeObserver started observing .urlbarView')
							} catch (e) {
								console.error('Error starting ResizeObserver:', e)
							}
						}
					} else {
						console.warn("URL Bar opened, but '.urlbarView' element not found immediately.")
						// Optionally, try again after a tiny delay
						setTimeout(() => {
							urlbarViewElement = findUrlbarViewElement()
							if (urlbarViewElement && urlbarElement.hasAttribute('open')) {
								console.log('Found .urlbarView on second attempt.')
								updateHeightVariable()
								if (resizeObserver)
									try {
										resizeObserver.observe(urlbarViewElement)
									} catch (e) {}
							} else if (urlbarElement.hasAttribute('open')) {
								console.error("Still couldn't find .urlbarView after delay.")
							}
						}, 100) // 100ms delay
					}
				} else {
					// --- URL Bar Closed ---
					console.log('MutationObserver: URL Bar Closed')
					// Stop observing the (now potentially hidden) view element
					if (resizeObserver && urlbarViewElement) {
						try {
							resizeObserver.unobserve(urlbarViewElement)
							console.log('ResizeObserver stopped observing .urlbarView')
						} catch (e) {
							// Ignore errors if element is already gone
						}
					}
					urlbarViewElement = null // Clear reference
					// Ensure the variable is removed
					updateHeightVariable()
				}
			})

			mutationObserver.observe(urlbarElement, { attributes: true })
			console.log("MutationObserver started observing #urlbar for 'open' attribute.")
		}

		// --- Initialization Logic ---
		function initialize() {
			browserElement = document.getElementById(BROWSER_ELEMENT_ID)
			urlbarElement = document.getElementById(URLBAR_ELEMENT_ID)

			if (!browserElement || !urlbarElement) {
				console.error('DynamicUrlbarHeight Error: #browser or #urlbar element not found. Retrying...')
				// Retry initialization after a short delay in case elements aren't ready yet
				setTimeout(initialize, 1000)
				return
			}

			console.log('DynamicUrlbarHeight: Found #browser and #urlbar elements.')

			setupResizeObserver()
			setupMutationObserver()

			// Initial check in case the URL bar is already open when the script loads
			// (less common, but good practice)
			if (urlbarElement.hasAttribute('open')) {
				console.log('URL bar already open on script load. Performing initial check.')
				urlbarViewElement = findUrlbarViewElement()
				if (urlbarViewElement) {
					updateHeightVariable()
					if (resizeObserver)
						try {
							resizeObserver.observe(urlbarViewElement)
						} catch (e) {}
				}
			}
		}

		// Start initialization logic
		// Use requestIdleCallback or setTimeout to ensure the DOM is more likely ready
		if (document.readyState === 'complete') {
			initialize()
		} else {
			window.addEventListener('load', initialize, { once: true })
		}
	})()
}

// ==UserScript==
// @ignorecache
// @name          Global URL Bar Scroller
// @description   Makes normal URL bar results scrollable. Customizable via about:config (Strings).
// ==/UserScript==
;(function () {
	if (location.href !== 'chrome://browser/content/browser.xhtml') {
		return
	}

	console.log('Zen URL Bar Animated Height (CSS-Controlled Easing) script loading...')

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

	/**
	 * The core logic for animating and managing the results panel height.
	 */
	function updateViewState() {
		if (!resultsElement || !urlbarElement) return

		clearTimeout(updateTimeout)

		updateTimeout = setTimeout(() => {
			// --- ZEN COMMAND PALETTE COMPATIBILITY CHECK ---
			// This is the crucial logic from your original script.
			const isCommandModeActive = window.ZenCommandPalette?.provider?._isInPrefixMode ?? false
			if (isCommandModeActive) {
				// If the command palette is active, our script must do nothing and clean up its styles.
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
				// If urlbar is completely closed and not typing, reset our state.
				resultsElement.classList.remove(CONFIG.SCROLLABLE_CLASS)
				resultsElement.style.removeProperty('height')
				resultsElement.style.removeProperty('max-height')
				resultsElement.style.removeProperty('overflow-y')
				resultsElement.scrollTop = 0
				lastResultCount = -1
				return
			}

			if (isUrlbarOpen && !isUrlbarViewVisibleByCSS) {
				// urlbar is open but your CSS is still animating its display/opacity, or it's not yet considered visible.
				// Reinforce the initial cap if our script hasn't taken over height yet.
				if (!resultsElement.style.height) {
					resultsElement.style.height = `${CONFIG.INITIAL_CAP_HEIGHT_PX}px`
					resultsElement.style.overflowY = 'hidden'
				}
				return
			}

			// At this point, the URL bar view should be visible and ready for height calculation.
			resultsElement.style.removeProperty('max-height') // Ensure we override any lingering max-height from Zen's CSS or our temp styles.

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

			// Apply the height, which will trigger the CSS transition
			resultsElement.style.height = `${targetHeight}px`
			resultsElement.style.overflowY = isScrollable ? 'auto' : 'hidden'

			// Universal auto-scroll logic for arrow keys.
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
		const mutationObserver = new MutationObserver(() => {
			updateViewState()
		})
		mutationObserver.observe(resultsElement, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['selected'],
		})

		const urlbarAttributeObserver = new MutationObserver((mutations) => {
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

	/**
	 * Waits for all necessary UI elements to exist before initializing.
	 */
	function initialize() {
		urlbarElement = document.getElementById(CONFIG.URLBAR_ID)
		resultsElement = document.getElementById(CONFIG.URLBAR_RESULTS_ID)

		if (!urlbarElement || !resultsElement) {
			setTimeout(initialize, 500)
			return
		}

		// Inject the CSS. This CSS now uses custom properties for transition.
		const styleId = 'zen-urlbar-animated-height-styles-css-controlled'
		if (!document.getElementById(styleId)) {
			const css = `
        /* Default values for custom properties if not defined in userChrome.css */


        #${CONFIG.URLBAR_RESULTS_ID} {
          /* Flicker-Free: Immediately cap height and hide overflow until JS takes over */
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
			console.log('Zen URL Bar Animated Height (CSS-Controlled Easing) styles injected.')
		}

		setupListeners()
		updateViewState()
		console.log('Zen URL Bar Animated Height (CSS-Controlled Easing) Initialized.')
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
if (Services.prefs.getBoolPref('nug.tab.explode')) {
	// Run script

	;(() => {
		console.log('Tab Explode Animation: Script execution started.')

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
                top: 0; /* Will be set by JS */
                left: 0; /* Will be set by JS */
                width: 0; /* Will be set by JS */
                height: 0; /* Will be set by JS */
                pointer-events: none; /* Don't interfere with mouse events */
                z-index: 99999; /* Above other tab elements */
            }

            .bubble-particle {
                position: absolute;
                /* background-color: var(--toolbarbutton-icon-fill-attention, dodgerblue); */ /* Use a theme-aware color or a fixed one */
                background-color: light-dark( #cac2b6, #808080) !important;
                border-radius: 50%;
                opacity: 0.8;
                animation-name: bubbleExplode;
                animation-duration: ${ANIMATION_DURATION}ms;
                animation-timing-function: ease-out;
                animation-fill-mode: forwards; /* Stay at the end state (invisible) */
                will-change: transform, opacity; /* Hint for browser optimization */
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
			console.log('Tab Explode Animation: Styles injected.')
		}

		function animateElementClose(element) {
			if (!element || !element.isConnected) return

			const elementRect = element.getBoundingClientRect() // Viewport-relative
			const explosionContainer = document.createElement('div')
			explosionContainer.className = 'tab-explosion-container' // Has position: absolute

			// Determine the parent for the animation.
			// #browser is a high-level container for the browser content area.
			let parentForAnimation = document.getElementById('browser')
			if (!parentForAnimation || !parentForAnimation.isConnected) {
				// Fallback to main-window or even documentElement if #browser is not suitable
				parentForAnimation = document.getElementById('main-window') || document.documentElement
			}

			const parentRect = parentForAnimation.getBoundingClientRect()

			// Calculate position of explosionContainer relative to parentForAnimation,
			// such that it aligns with the element's viewport position.
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
					// Assign the first four bubbles to distinct edges (0, 1, 2, 3)
					edge = i
				} else {
					// For subsequent bubbles, assign to a random edge
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

				// Random final translation and scale for each bubble
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

				// Stagger animation start slightly
				bubble.style.animationDelay = `${Math.random() * 120}ms`

				explosionContainer.appendChild(bubble)
			}

			// Make the original element content invisible immediately
			element.style.opacity = '0'
			element.style.transition = 'opacity 0.1s linear'

			// Remove the explosion container after the animation
			setTimeout(() => {
				if (explosionContainer.parentNode) {
					explosionContainer.parentNode.removeChild(explosionContainer)
				}
			}, ANIMATION_DURATION + 100) // Add slight buffer for animation delay
		}

		function onTabClose(event) {
			const tab = event.target
			// Ensure it's a normal tab and not something else
			if (tab.localName === 'tab' && !tab.pinned && tab.isConnected) {
				// Check if the tab is part of a group
				const groupParent = tab.closest('tab-group')
				if (!groupParent) {
					console.log('Tab Explode Animation: TabClose event triggered for tab:', tab)
					animateElementClose(tab)
				}
			}
		}

		function onTabGroupRemove(event) {
			console.log('Tab Explode Animation: TabGroupRemove event received:', event)
			const group = event.target
			if (group && group.localName === 'tab-group' && group.isConnected) {
				console.log('Tab Explode Animation: TabGroupRemove event triggered for group:', group)
				animateElementClose(group)
			}
		}

		function init() {
			console.log('Tab Explode Animation: init() function called.')
			injectStyles()
			if (typeof gBrowser !== 'undefined' && gBrowser.tabContainer) {
				console.log('Tab Explode Animation: gBrowser and gBrowser.tabContainer are available.')
				gBrowser.tabContainer.addEventListener('TabClose', onTabClose, false)

				// Add multiple event listeners to catch tab group removal
				gBrowser.tabContainer.addEventListener('TabGroupRemove', onTabGroupRemove, false)
				gBrowser.tabContainer.addEventListener('TabGroupClosed', onTabGroupRemove, false)
				gBrowser.tabContainer.addEventListener('TabGroupRemoved', onTabGroupRemove, false)

				// Also listen for the custom event that might be used
				document.addEventListener('TabGroupRemoved', onTabGroupRemove, false)

				console.log('Tab Explode Animation: Listeners attached to TabClose and TabGroup events.')
			} else {
				// Retry if gBrowser is not ready
				console.log('Tab Explode Animation: gBrowser not ready, scheduling retry.')
				setTimeout(init, 1000)
			}
		}

		// Wait for the browser to be fully loaded
		console.log('Tab Explode Animation: Setting up load event listener or calling init directly.')
		if (document.readyState === 'complete') {
			console.log('Tab Explode Animation: Document already complete, calling init().')
			init()
		} else {
			console.log('Tab Explode Animation: Document not complete, adding load event listener for init().')
			window.addEventListener('load', init, { once: true })
		}
	})()
}

// ==UserScript==
// @ignorecache
// @name           Get Search Engines Color
// @namespace      colorofsearchengines
// @description    helps in providing color of search engine favicon
// @version        1.7b
// ==/UserScript==

;(function () {
	'use strict'

	if (typeof Services === 'undefined' || !Services.search) {
		console.error('[NugSearchColor] Firefox Services not available. Script cannot run.')
		return
	}

	if (window.NugSearchColor) {
		window.NugSearchColor.destroy()
	}

	window.NugSearchColor = {
		// --- The 2 CSS variables this script provides ---
		GRADIENT_START_VAR: '--nug-search-gradient-start',
		GRADIENT_END_VAR: '--nug-search-gradient-end',

		init() {
			console.log('[NugSearchColor] Initializing Script v12.0 (Auto-Darkening)...')
			this.initSearchColor()
			window.addEventListener('unload', () => this.destroy(), { once: true })
		},

		initSearchColor() {
			this.searchSwitcher = document.getElementById('urlbar-searchmode-switcher')
			if (!this.searchSwitcher) {
				requestIdleCallback(() => this.initSearchColor())
				return
			}
			const observerCallback = () => this.updateSearchColor()
			this.searchObserver = new MutationObserver(observerCallback)
			this.searchObserver.observe(this.searchSwitcher, {
				attributes: true,
				attributeFilter: ['tooltiptext'],
			})
			console.log('[NugSearchColor] Module is active.')
			this.updateSearchColor()
		},

		async updateSearchColor() {
			const root = document.documentElement
			const tooltip = this.searchSwitcher?.getAttribute('tooltiptext')
			if (!tooltip) {
				this.clearCssVars(root)
				return
			}

			try {
				const engines = await Services.search.getVisibleEngines()
				const currentEngine = engines.find((engine) => tooltip.includes(engine.name))

				if (currentEngine?.searchForm) {
					const domain = new URL(currentEngine.searchForm).hostname
					const iconUrl = `https://www.google.com/s2/favicons?sz=64&domain_url=${domain}`

					const gradient = await this.extractAutoDarkeningGradient(iconUrl)

					if (gradient) {
						root.style.setProperty(
							this.GRADIENT_START_VAR,
							`rgb(${gradient.start.r}, ${gradient.start.g}, ${gradient.start.b})`
						)
						root.style.setProperty(
							this.GRADIENT_END_VAR,
							`rgb(${gradient.end.r}, ${gradient.end.g}, ${gradient.end.b})`
						)
						console.log(
							`%c[NugSearchColor] SUCCESS: Set auto-darkened gradient for "${domain}"`,
							'color: lightgreen; font-weight: bold;'
						)
					} else {
						this.clearCssVars(root)
					}
				} else {
					this.clearCssVars(root)
				}
			} catch (err) {
				console.error('[NugSearchColor] FATAL ERROR during search update:', err)
				this.clearCssVars(root)
			}
		},

		clearCssVars(root) {
			root.style.removeProperty(this.GRADIENT_START_VAR)
			root.style.removeProperty(this.GRADIENT_END_VAR)
		},

		// --- NEW "AUTO-DARKENING GRADIENT" ALGORITHM ---
		async extractAutoDarkeningGradient(url) {
			const img = new Image()
			img.crossOrigin = 'anonymous'
			img.src = url
			await new Promise((resolve, reject) => {
				img.onload = resolve
				img.onerror = reject
			})

			if (!this.canvas) {
				this.canvas = document.createElement('canvas')
				this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })
			}

			const size = 16
			this.canvas.width = size
			this.canvas.height = size
			this.ctx.clearRect(0, 0, size, size)
			this.ctx.drawImage(img, 0, 0, size, size)

			const pixelData = this.ctx.getImageData(0, 0, size, size).data
			const colorCounts = new Map()

			for (let i = 0; i < pixelData.length; i += 4) {
				const [r, g, b, a] = [pixelData[i], pixelData[i + 1], pixelData[i + 2], pixelData[i + 3]]
				if (a < 128) continue
				const key = `${r >> 4},${g >> 4},${b >> 4}`
				if (colorCounts.has(key)) {
					colorCounts.get(key).freq++
				} else {
					colorCounts.set(key, { r, g, b, freq: 1 })
				}
			}

			if (colorCounts.size === 0) return null

			let scoredColors = []
			for (const color of colorCounts.values()) {
				const { r, g, b, freq } = color
				const hsl = this.rgbToHsl(r, g, b)
				const isBoring = hsl.s < 0.05 && hsl.l > 0.95 // Only filter out pure white
				if (isBoring && colorCounts.size > 3) continue
				scoredColors.push({ ...color, score: freq * (1 + hsl.s), hsl })
			}

			if (scoredColors.length === 0) return null
			scoredColors.sort((a, b) => b.score - a.score)

			const gradientStart = scoredColors[0]
			let gradientEnd =
				scoredColors.find((c) => {
					const hueDiff = Math.abs(c.hsl.h - gradientStart.hsl.h)
					return hueDiff > 0.15 && hueDiff < 0.85 // Find a color with a different hue
				}) || gradientStart // Fallback to a solid color if no second hue is found

			// --- AUTO-DARKENING LOGIC ---
			const adjustIfNeeded = (color) => {
				const luminance = (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) / 255
				if (luminance > 0.9) {
					// Is the color extremely bright (like white)?
					let hsl = color.hsl
					hsl.l = 0.75 // Drastically reduce lightness to a pleasant gray/pastel
					hsl.s = Math.max(hsl.s, 0.1) // Ensure it's not totally desaturated
					return this.hslToRgb(hsl.h, hsl.s, hsl.l)
				}
				return color // Return original if it's not too bright
			}

			const finalStart = adjustIfNeeded(gradientStart)
			const finalEnd = adjustIfNeeded(gradientEnd)

			return { start: finalStart, end: finalEnd }
		},

		// --- Color Conversion Helpers ---
		rgbToHsl(r, g, b) {
			r /= 255
			g /= 255
			b /= 255
			const M = Math.max(r, g, b),
				m = Math.min(r, g, b)
			let h,
				s,
				l = (M + m) / 2
			if (M == m) {
				h = s = 0
			} else {
				const d = M - m
				s = l > 0.5 ? d / (2 - M - m) : d / (M + m)
				switch (M) {
					case r:
						h = (g - b) / d + (g < b ? 6 : 0)
						break
					case g:
						h = (b - r) / d + 2
						break
					case b:
						h = (r - g) / d + 4
						break
				}
				h /= 6
			}
			return { h, s, l }
		},
		hslToRgb(h, s, l) {
			let r, g, b
			if (s == 0) {
				r = g = b = l
			} else {
				const hue2rgb = (p, q, t) => {
					if (t < 0) t += 1
					if (t > 1) t -= 1
					if (t < 1 / 6) return p + (q - p) * 6 * t
					if (t < 1 / 2) return q
					if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
					return p
				}
				const q = l < 0.5 ? l * (1 + s) : l + s - l * s
				const p = 2 * l - q
				r = hue2rgb(p, q, h + 1 / 3)
				g = hue2rgb(p, q, h)
				b = hue2rgb(p, q, h - 1 / 3)
			}
			return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
		},

		destroy() {
			console.log('[NugSearchColor] Destroying script...')
			this.searchObserver?.disconnect()
			this.clearCssVars(document.documentElement)
			delete window.NugSearchColor
		},
	}

	requestIdleCallback(() => window.NugSearchColor.init())
})()

// ==UserScript==
// @ignorecache
// @name           zen-media-coverart-enhanced-bg-wrapper-hoverfix
// @namespace      zenMediaCoverArtEnhancedBgWrapperHoverFix
// @description    Set Zen media coverart via wrapper (v1.7b - Adjusts opacity on hover for consistent brightness). Affects background ONLY.
// @version        1.7b
// ==/UserScript==

if (Services.prefs.getBoolPref('nug.cover.art.js')) {
	const ZenCoverArtCSSProvider = {
		lastArtworkUrl: null,
		_toolbarItem: null,
		_currentController: null,
		_boundMetadataListener: null,

		_getToolbarItem() {
			if (!this._toolbarItem) {
				this._toolbarItem = document.querySelector('#zen-media-controls-toolbar > toolbaritem')
				if (!this._toolbarItem) console.error('[ZenCoverArt] Toolbar item not found.')
			}
			return this._toolbarItem
		},

		_selectLargestArtwork(artworkList) {
			if (!Array.isArray(artworkList) || artworkList.length === 0) return null
			return artworkList.reduce((max, cur) => {
				const [mw, mh] = max.sizes?.split('x').map(Number) || [0, 0]
				const [cw, ch] = cur.sizes?.split('x').map(Number) || [0, 0]
				return cw * ch > mw * mh ? cur : max
			})
		},

		_setCoverArtVariable(coverUrl) {
			const toolbarItem = this._getToolbarItem()
			if (!toolbarItem) return
			this.lastArtworkUrl = coverUrl
			toolbarItem.style.setProperty('--zen-cover-art-url', `url("${CSS.escape(coverUrl)}")`)
		},

		_removeCoverArtVariable() {
			const toolbarItem = this._getToolbarItem()
			if (toolbarItem && this.lastArtworkUrl !== null) {
				this.lastArtworkUrl = null
				toolbarItem.style.removeProperty('--zen-cover-art-url')
			}
		},

		_update(controller) {
			const metadata = controller?.getMetadata?.()
			const bestArtwork = this._selectLargestArtwork(metadata?.artwork)
			const coverUrl = bestArtwork?.src
			if (coverUrl) {
				if (coverUrl !== this.lastArtworkUrl) this._setCoverArtVariable(coverUrl)
			} else {
				this._removeCoverArtVariable()
			}
		},

		_attachToController(controller) {
			if (this._currentController && this._boundMetadataListener) {
				this._currentController.removeEventListener('metadatachange', this._boundMetadataListener)
			}
			this._currentController = controller
			if (!controller) {
				this._removeCoverArtVariable()
				return
			}
			this._boundMetadataListener = this._update.bind(this, controller)
			controller.addEventListener('metadatachange', this._boundMetadataListener)
			this._update(controller)
		},

		init() {
			const wait = () => {
				if (typeof window.gZenMediaController?.setupMediaController !== 'function') {
					setTimeout(wait, 300)
					return
				}
				const originalSetup = window.gZenMediaController.setupMediaController.bind(window.gZenMediaController)
				window.gZenMediaController.setupMediaController = (controller, browser) => {
					this._attachToController(controller)
					return originalSetup(controller, browser)
				}
				if (window.gZenMediaController._currentMediaController) {
					this._attachToController(window.gZenMediaController._currentMediaController)
				}
			}
			wait()
		},
	}

	ZenCoverArtCSSProvider.init()
}

// ==UserScript==
// @ignorecache
// @name           GradientOpacityadjuster
// @namespace      variableopacity
// @description    it help in adjust dynamically opacity and contrast of icons and other elements
// @version        1.7b
// ==/UserScript==

// ;(function () {
// 	console.log('[UserChromeScript] custom-input-to-dual-css-vars-persistent.uc.js starting...')

// 	// --- Configuration ---
// 	const INPUT_ELEMENT_ID = 'PanelUI-zen-gradient-generator-opacity'
// 	const CSS_VARIABLE_DIRECT_NAME = '--zen-gradient-opacity'
// 	const CSS_VARIABLE_INVERTED_NAME = '--zen-gradient-opacity-inverted'
// 	const TARGET_ELEMENT_FOR_CSS_VAR = document.documentElement // Apply globally to <html>
// 	const PREF_NAME = `userchrome.custom.${INPUT_ELEMENT_ID}.value`

// 	// IMPORTANT: Define how to interpret the input's value for inversion
// 	// If input.value is naturally 0-1 (e.g. for opacity):
// 	const INPUT_VALUE_MIN = 0
// 	const INPUT_VALUE_MAX = 1
// 	// If input.value is 0-100 (e.g. a percentage slider):
// 	// const INPUT_VALUE_MIN = 0;
// 	// const INPUT_VALUE_MAX = 100;
// 	// --- End Configuration ---

// 	let inputElement = null
// 	let Services

// 	try {
// 		Services = globalThis.Services || ChromeUtils.import('resource://gre/modules/Services.jsm').Services
// 		console.log('[UserChromeScript] Services module loaded.')
// 	} catch (e) {
// 		console.error('[UserChromeScript] CRITICAL: Failed to load Services module:', e)
// 		Services = null // Ensure it's null if loading failed
// 	}

// 	function saveValueToPrefs(value) {
// 		if (!Services || !Services.prefs) {
// 			console.warn('[UserChromeScript] Services.prefs not available. Cannot save preference.')
// 			return
// 		}
// 		try {
// 			Services.prefs.setStringPref(PREF_NAME, String(value)) // Save as string
// 			// console.log(`[UserChromeScript] Saved to prefs (${PREF_NAME}):`, value);
// 		} catch (e) {
// 			console.error(`[UserChromeScript] Error saving preference ${PREF_NAME}:`, e)
// 		}
// 	}

// 	function loadValueFromPrefs() {
// 		if (!Services || !Services.prefs) {
// 			console.warn('[UserChromeScript] Services.prefs not available. Cannot load preference.')
// 			return null
// 		}
// 		if (Services.prefs.prefHasUserValue(PREF_NAME)) {
// 			try {
// 				const value = Services.prefs.getStringPref(PREF_NAME)
// 				// console.log(`[UserChromeScript] Loaded from prefs (${PREF_NAME}):`, value);
// 				return value // Return as string, will be parsed later
// 			} catch (e) {
// 				console.error(`[UserChromeScript] Error loading preference ${PREF_NAME}:`, e)
// 				return null
// 			}
// 		}
// 		// console.log(`[UserChromeScript] No user value found for preference ${PREF_NAME}.`);
// 		return null
// 	}

// 	function applyCssVariables(directValueStr) {
// 		if (!TARGET_ELEMENT_FOR_CSS_VAR) {
// 			console.warn(`[UserChromeScript] Target element for CSS variables not found.`)
// 			return
// 		}

// 		let directValueNum = parseFloat(directValueStr)

// 		// Validate and clamp the directValueNum based on defined min/max
// 		if (isNaN(directValueNum)) {
// 			console.warn(
// 				`[UserChromeScript] Invalid number parsed from input: '${directValueStr}'. Using default of ${INPUT_VALUE_MIN}.`
// 			)
// 			directValueNum = INPUT_VALUE_MIN
// 		}
// 		directValueNum = Math.max(INPUT_VALUE_MIN, Math.min(INPUT_VALUE_MAX, directValueNum))

// 		// Calculate inverted value
// 		// Formula for inversion: inverted = MAX - (value - MIN)
// 		// Or simpler if MIN is 0: inverted = MAX - value
// 		const invertedValueNum = INPUT_VALUE_MAX + INPUT_VALUE_MIN - directValueNum

// 		TARGET_ELEMENT_FOR_CSS_VAR.style.setProperty(CSS_VARIABLE_DIRECT_NAME, directValueNum)
// 		TARGET_ELEMENT_FOR_CSS_VAR.style.setProperty(CSS_VARIABLE_INVERTED_NAME, invertedValueNum)

// 		console.log(
// 			`[UserChromeScript] Synced CSS Vars: ${CSS_VARIABLE_DIRECT_NAME}=${directValueNum}, ${CSS_VARIABLE_INVERTED_NAME}=${invertedValueNum}`
// 		)
// 	}

// 	function handleInputChange() {
// 		if (!inputElement) {
// 			console.warn('[UserChromeScript] handleInputChange called but inputElement is null.')
// 			return
// 		}
// 		const valueStr = inputElement.value // Value from input is a string
// 		console.log(`[UserChromeScript] Input changed. New string value: '${valueStr}'`)
// 		applyCssVariables(valueStr)
// 		saveValueToPrefs(valueStr) // Save the original string value
// 	}

// 	function setupInputListener() {
// 		inputElement = document.getElementById(INPUT_ELEMENT_ID)

// 		if (inputElement) {
// 			console.log(`[UserChromeScript] Found input element #${INPUT_ELEMENT_ID}.`)

// 			const savedValueStr = loadValueFromPrefs()
// 			let initialValueStr

// 			if (savedValueStr !== null) {
// 				inputElement.value = savedValueStr
// 				initialValueStr = savedValueStr
// 				console.log(`[UserChromeScript] Applied saved value '${savedValueStr}' to #${INPUT_ELEMENT_ID}.`)
// 			} else {
// 				initialValueStr = inputElement.value // Use current value of input if no pref
// 				console.log(`[UserChromeScript] No saved value. Using current input value: '${initialValueStr}'.`)
// 			}

// 			applyCssVariables(initialValueStr) // Apply CSS vars based on initial/loaded value

// 			inputElement.removeEventListener('input', handleInputChange)
// 			inputElement.addEventListener('input', handleInputChange)
// 			console.log(`[UserChromeScript] Attached 'input' event listener to #${INPUT_ELEMENT_ID}.`)
// 		} else {
// 			console.warn(
// 				`[UserChromeScript] Element #${INPUT_ELEMENT_ID} not found during setup. Will retry if element appears.`
// 			)
// 			// If element not found, try to apply from prefs if available
// 			const savedValueStr = loadValueFromPrefs()
// 			if (savedValueStr !== null) {
// 				console.log(
// 					`[UserChromeScript] Element not found, but applying saved pref value '${savedValueStr}' to CSS vars.`
// 				)
// 				applyCssVariables(savedValueStr)
// 			}
// 		}
// 	}

// 	function initializeScript() {
// 		console.log('[UserChromeScript] initializeScript called.')
// 		setupInputListener()
// 	}

// 	let observer
// 	function observeForElement() {
// 		const targetNode = document.body || document.documentElement
// 		if (!targetNode) {
// 			console.warn('[UserChromeScript] Cannot find document.body or document.documentElement to observe.')
// 			setTimeout(observeForElement, 1000)
// 			return
// 		}

// 		initializeScript() // Try to init immediately

// 		if (!inputElement) {
// 			console.log(`[UserChromeScript] Input element #${INPUT_ELEMENT_ID} not found yet. Setting up MutationObserver.`)
// 			if (observer) observer.disconnect()

// 			observer = new MutationObserver((mutations) => {
// 				if (document.getElementById(INPUT_ELEMENT_ID)) {
// 					console.log(`[UserChromeScript] Element #${INPUT_ELEMENT_ID} detected by MutationObserver.`)
// 					initializeScript()
// 					obs.disconnect()
// 					observer = null
// 				}
// 			})
// 			observer.observe(targetNode, { childList: true, subtree: true })
// 			console.log(`[UserChromeScript] MutationObserver started on ${targetNode.nodeName}.`)
// 		}
// 	}

// 	if (document.readyState === 'loading') {
// 		console.log('[UserChromeScript] DOM is loading, waiting for DOMContentLoaded.')
// 		document.addEventListener('DOMContentLoaded', observeForElement, { once: true })
// 	} else {
// 		console.log('[UserChromeScript] DOM already loaded, running observeForElement immediately.')
// 		observeForElement()
// 	}
// 	console.log('[UserChromeScript] custom-input-to-dual-css-vars-persistent.uc.js finished initial execution.')
// })()

// ==UserScript==
// @ignorecache
// @name          Zen Top Position Globalizer
// @namespace      globalizier
// @version        1.7b
// ==/UserScript==
if (Services.prefs.getBoolPref('browser.tabs.allow_transparent_browser', false)) {
	;(function () {
		console.log('[Zen Globalizer] Script has loaded. Waiting for window to be ready...')

		function runZenTopGlobalizer() {
			console.log('[Zen Globalizer] Window is ready. Script starting...')

			const rootElement = document.documentElement
			const urlbarElement = document.getElementById('urlbar')

			if (!urlbarElement) {
				console.error('[Zen Globalizer] FATAL ERROR: Could not find #urlbar element.')
				return
			}

			function syncVariable() {
				const value = window.getComputedStyle(urlbarElement).getPropertyValue('--zen-urlbar-top')
				if (value) {
					rootElement.style.setProperty('--my-global-zen-top', value.trim())
				}
			}

			const observer = new MutationObserver(syncVariable)

			observer.observe(urlbarElement, {
				attributes: true,
				attributeFilter: ['style'],
			})

			syncVariable()
			console.log('[Zen Globalizer] Observer is now active on #urlbar.')
		}

		// A simpler way to wait for the window to be ready
		if (document.readyState === 'complete') {
			runZenTopGlobalizer()
		} else {
			window.addEventListener('load', runZenTopGlobalizer, { once: true })
		}
	})()
}

// ==UserScript==
// @ignorecache
// @name          Zen Media Player Peak height
// @namespace      height
// @description   calculate zen media player height on hover and store it in a variable
// @version        1.7b
// ==/UserScript==

const MediaPlayerPeakHeight = {
	_mediaPlayer: null,
	_parentToolbar: null,
	_currentPeakHeight: 0,
	_isHovering: false,

	_getElements() {
		if (!this._mediaPlayer) this._mediaPlayer = document.querySelector('#zen-media-controls-toolbar > toolbaritem')
		if (!this._parentToolbar) this._parentToolbar = document.querySelector('#zen-media-controls-toolbar')
	},

	/**
	 * The core measurement function.
	 */
	_measureAndSetPeakHeight() {
		this._getElements()
		if (!this._mediaPlayer || !this._parentToolbar) return

		// 1. Create a clone of the player element.
		const clone = this._mediaPlayer.cloneNode(true)

		// 2. Style the clone to be completely invisible and not affect page layout.
		clone.style.position = 'fixed'
		clone.style.visibility = 'hidden'
		clone.style.zIndex = '-1000'
		clone.style.left = '-9999px' // Move it far off-screen to be safe
		clone.style.transition = 'none !important'

		// 3. Find the '.show-on-hover' element WITHIN the clone.
		const showOnHoverClone = clone.querySelector('.show-on-hover')
		if (showOnHoverClone) {
			// 4. Manually apply the EXACT styles from the browser's default :hover rule.
			//    This forces the clone into its fully expanded state for measurement.
			showOnHoverClone.style.transition = 'none !important'
			showOnHoverClone.style.maxHeight = '50px'
			showOnHoverClone.style.padding = '5px'
			showOnHoverClone.style.marginBottom = '0'
			showOnHoverClone.style.opacity = '0'
			showOnHoverClone.style.transform = 'translateY(0)'
		}

		// 5. Append the clone to the original parent to ensure it inherits all contextual styles.
		this._parentToolbar.appendChild(clone)

		// 6. Get the height. This is the definitive peak height.
		const peakHeight = clone.getBoundingClientRect().height

		// 7. Destroy the clone immediately.
		this._parentToolbar.removeChild(clone)

		// 8. Update the CSS variable only if the height is valid and has actually changed.
		if (peakHeight > 0 && peakHeight !== this._currentPeakHeight) {
			this._currentPeakHeight = peakHeight
			document.documentElement.style.setProperty('--zen-media-player-peak-height', `${peakHeight}px`)
		}
	},

	init() {
		this._getElements()
		if (!this._mediaPlayer) {
			setTimeout(() => this.init(), 500)
			return
		}

		console.log('[MediaPlayerPeakHeight] Initializing.')

		// ---- Listener 1: Mouse Enter ----
		// This is our primary trigger to calculate the height.
		this._mediaPlayer.addEventListener('mouseenter', () => {
			// The _isHovering flag prevents this from running multiple times if the mouse jitters.
			if (!this._isHovering) {
				this._isHovering = true
				this._measureAndSetPeakHeight()
			}
		})

		// ---- Listener 2: Mouse Leave ----
		this._mediaPlayer.addEventListener('mouseleave', () => {
			this._isHovering = false
		})

		// ---- Listener 3: Mutation Observer ----
		// This handles the case where the song changes, which might alter the peak height.
		const observer = new MutationObserver(() => {
			// If the content changes while we are hovering, we need to re-calculate.
			// Otherwise, the next mouseenter will handle it.
			if (this._isHovering) {
				this._measureAndSetPeakHeight()
			}
		})
		observer.observe(this._mediaPlayer, {
			childList: true,
			subtree: true,
			characterData: true,
		})

		// Run one initial measurement on startup to set a default value.
		this._measureAndSetPeakHeight()
	},
}

window.addEventListener(
	'load',
	() => {
		MediaPlayerPeakHeight.init()
	},
	{ once: true }
)

// ==UserScript==
// @ignorecache
// @name         Move Unified Extension Button
// @version      1.0
// @description  Moves the unified extension button to identity-box and hides it on blank pages or when URL bar is floating.
// @author       bxthesda
// @match        chrome://browser/content/browser.xhtml
// @grant        none
// ==/UserScript==
// ;(function () {
// 	'use strict'

// 	let attempts = 0

// 	const MAX_ATTEMPTS = 20 // Try for about 10 seconds (20 * 500ms)
// 	let scriptObserver = null

// 	function updateButtonVisibilityAndPosition() {
// 		// console.log("Attempting to updateButtonVisibilityAndPosition");
// 		let unifiedExtensionsButton = document.getElementById('unified-extensions-button')
// 		let pageActionButtons = document.getElementById('page-action-buttons')
// 		let urlbar = document.getElementById('urlbar')

// 		if (!unifiedExtensionsButton) {
// 			// console.log('unifiedExtensionsButton not found in updateButtonVisibilityAndPosition.');
// 			// If button doesn't exist yet, try to run doTheMove again if attempts remain.
// 			if (attempts < MAX_ATTEMPTS) {
// 				setTimeout(doTheMove, 100) // Try to make sure it's there
// 			}
// 			return
// 		}

// 		let isFloating = false
// 		if (urlbar) {
// 			isFloating =
// 				urlbar.getAttribute('breakout-extend') === 'true' || urlbar.getAttribute('zen-floating-urlbar') === 'true'
// 		}

// 		let isBlankPage = false
// 		let identityBox = document.getElementById('identity-box')
// 		if (identityBox) {
// 			isBlankPage = identityBox.getAttribute('pageproxystate') === 'invalid'
// 		} else if (typeof gBrowser !== 'undefined' && gBrowser.selectedBrowser) {
// 			const currentSpec = gBrowser.selectedBrowser.currentURI.spec
// 			isBlankPage = ['about:blank', 'about:newtab', 'about:home'].includes(currentSpec)
// 		} else {
// 			// Default to considering it a blank page if identityBox and gBrowser are unavailable for checks.
// 			isBlankPage = true
// 			// console.log("Could not determine page state accurately, assuming blank page to hide button.");
// 		}

// 		if (isFloating || isBlankPage) {
// 			// console.log(`Hiding button. Floating: ${isFloating}, BlankPage: ${isBlankPage}`);
// 			unifiedExtensionsButton.style.display = 'none'
// 		} else {
// 			// console.log(`Showing button. Floating: ${isFloating}, BlankPage: ${isBlankPage}`);
// 			unifiedExtensionsButton.style.display = '' // Revert to default display (e.g., flex, inline-flex)

// 			// Use CSS order to ensure the button appears at the extreme right
// 			unifiedExtensionsButton.style.order = '9999' // High order value to ensure it's last
// 			unifiedExtensionsButton.style.marginLeft = 'auto'
// 			unifiedExtensionsButton.style.marginRight = '-4px'

// 			if (pageActionButtons) {
// 				// Ensure page-action-buttons uses flexbox layout for order to work
// 				pageActionButtons.style.display = 'flex'
// 				pageActionButtons.style.alignItems = 'center'

// 				if (unifiedExtensionsButton.parentElement !== pageActionButtons) {
// 					pageActionButtons.appendChild(unifiedExtensionsButton)
// 					// console.log('Button moved/ensured in page-action-buttons by update logic.');
// 				}
// 			} else {
// 				// console.error('page-action-buttons not found when trying to show/position button. Will be retried by doTheMove.');
// 				// If pageActionButtons is missing when we need to show the button, trigger doTheMove's retry.
// 				if (attempts < MAX_ATTEMPTS) {
// 					setTimeout(doTheMove, 100)
// 				}
// 			}
// 		}
// 	}

// 	function doTheMove() {
// 		try {
// 			// console.log('Attempting to doTheMove...');
// 			let unifiedExtensionsButton = document.getElementById('unified-extensions-button')
// 			let pageActionButtons = document.getElementById('page-action-buttons')

// 			if (unifiedExtensionsButton && pageActionButtons) {
// 				if (unifiedExtensionsButton.parentElement !== pageActionButtons) {
// 					pageActionButtons.appendChild(unifiedExtensionsButton)
// 					console.log('Unified Extensions Button initially moved to page-action-buttons.')
// 				}

// 				// Apply order styling immediately
// 				unifiedExtensionsButton.style.order = '9999'
// 				unifiedExtensionsButton.style.marginLeft = 'auto'
// 				unifiedExtensionsButton.style.marginRight = '-4px'

// 				// Ensure page-action-buttons uses flexbox layout for order to work
// 				pageActionButtons.style.display = 'flex'
// 				pageActionButtons.style.alignItems = 'center'

// 				attempts = MAX_ATTEMPTS // Stop timed retries for finding these specific elements
// 				updateButtonVisibilityAndPosition() // Initial visibility update
// 			} else {
// 				if (attempts < MAX_ATTEMPTS) {
// 					attempts++
// 					setTimeout(doTheMove, 500)
// 				} else {
// 					console.error(
// 						'Max attempts reached by timer. Could not find unifiedExtensionsButton and/or pageActionButtons for initial move.'
// 					)
// 				}
// 			}
// 		} catch (e) {
// 			console.error('Error in doTheMove:', e)
// 		}
// 	}

// 	scriptObserver = new MutationObserver(function (mutationsList) {
// 		let needsUpdate = false
// 		for (const mutation of mutationsList) {
// 			if (mutation.type === 'childList') {
// 				for (const node of [...mutation.addedNodes, ...mutation.removedNodes]) {
// 					if (
// 						node.nodeType === Node.ELEMENT_NODE &&
// 						(node.id === 'unified-extensions-button' || node.id === 'page-action-buttons' || node.id === 'urlbar')
// 					) {
// 						needsUpdate = true
// 						break
// 					}
// 				}
// 				const btn = document.getElementById('unified-extensions-button')
// 				const pageActionBtns = document.getElementById('page-action-buttons')
// 				if (btn && pageActionBtns && btn.parentElement !== pageActionBtns) {
// 					needsUpdate = true // Button exists but is not in page-action-buttons, re-evaluate
// 				}
// 			} else if (mutation.type === 'attributes') {
// 				const target = mutation.target
// 				if (target.nodeType === Node.ELEMENT_NODE) {
// 					if (
// 						(target.id === 'urlbar' &&
// 							(mutation.attributeName === 'breakout-extend' || mutation.attributeName === 'zen-floating-urlbar')) ||
// 						(target.id === 'identity-box' && mutation.attributeName === 'pageproxystate')
// 					) {
// 						needsUpdate = true
// 					}
// 				}
// 			}
// 			if (needsUpdate) break
// 		}

// 		if (needsUpdate) {
// 			// console.log("Observer triggered updateButtonVisibilityAndPosition");
// 			updateButtonVisibilityAndPosition()
// 		}
// 	})

// 	// Observe the documentElement for broader changes initially.
// 	// The observer callback will filter for relevant element/attribute changes.
// 	scriptObserver.observe(document.documentElement, {
// 		childList: true,
// 		subtree: true,
// 		attributes: true,
// 	})

// 	// Initial attempt to move the button after a short delay.
// 	setTimeout(doTheMove, 1500)
// })()

// ==UserScript==
// @name            Reopen Closed Tabs
// @description     A popup menu to view and restore recently closed tabs. Includes a toolbar button and keyboard shortcut.
// @author          BibekBhusal
// ==/UserScript==
;(function () {
	'use strict'

	// Only run in main browser window
	if (window.location.href !== 'chrome://browser/content/browser.xhtml') {
		return
	}

	const Prefs = {
		DEBUG_MODE: 'extensions.reopen-closed-tabs.debug-mode',
		SHORTCUT_KEY: 'extensions.reopen-closed-tabs.shortcut-key',
		SHOW_OPEN_TABS: 'extensions.reopen-closed-tabs.show-open-tabs',

		defaultValues: {},

		/**
		 * Retrieves a preference value.
		 * @param {string} key - The preference key.
		 * @param {*} [defaultValue=undefined] - The default value to return if the preference is not set.
		 * @returns {*} The preference value or the default value.
		 */
		getPref(key, defaultValue = undefined) {
			try {
				const pref = UC_API.Prefs.get(key)
				if (!pref) return defaultValue !== undefined ? defaultValue : Prefs.defaultValues[key]
				if (!pref.exists()) return defaultValue !== undefined ? defaultValue : Prefs.defaultValues[key]
				return pref.value
			} catch (e) {
				console.error(`ReopenClosedTabs Prefs: Error getting pref ${key}:`, e)
				return defaultValue !== undefined ? defaultValue : Prefs.defaultValues[key]
			}
		},

		setPref(prefKey, value) {
			UC_API.Prefs.set(prefKey, value)
		},

		setInitialPrefs() {
			for (const [key, value] of Object.entries(Prefs.defaultValues)) {
				UC_API.Prefs.setIfUnset(key, value)
			}
		},

		get debugMode() {
			return this.getPref(this.DEBUG_MODE)
		},
		set debugMode(value) {
			this.setPref(this.DEBUG_MODE, value)
		},

		get shortcutKey() {
			return this.getPref(this.SHORTCUT_KEY)
		},
		set shortcutKey(value) {
			this.setPref(this.SHORTCUT_KEY, value)
		},

		get showOpenTabs() {
			return this.getPref(this.SHOW_OPEN_TABS)
		},
		set showOpenTabs(value) {
			this.setPref(this.SHOW_OPEN_TABS, value)
		},
	}

	Prefs.defaultValues = {
		[Prefs.DEBUG_MODE]: false,
		[Prefs.SHORTCUT_KEY]: 'Alt+A',
		[Prefs.SHOW_OPEN_TABS]: false,
	}

	const debugLog = (...args) => {
		if (Prefs.debugMode) {
			console.log('ReopenClosedTabs :', ...args)
		}
	}

	const debugError = (...args) => {
		if (Prefs.debugMode) {
			console.error('ReopenClosedTabs :', ...args)
		}
	}

	/**
	 * Parses a shortcut string (e.g., "Ctrl+Shift+K") into an object for a <key> element.
	 * @param {string} str - The shortcut string.
	 * @returns {{key: string|null, keycode: string|null, modifiers: string}}
	 */
	function parseShortcutString(str) {
		if (!str) return {}
		const parts = str.split('+').map((p) => p.trim().toLowerCase())
		const keyPart = parts.pop()

		const modifiers = {
			accel: false,
			alt: false,
			shift: false,
			meta: false,
		}

		for (const part of parts) {
			switch (part) {
				case 'ctrl':
				case 'control':
					modifiers.accel = true
					break
				case 'alt':
				case 'option':
					modifiers.alt = true
					break
				case 'shift':
					modifiers.shift = true
					break
				case 'cmd':
				case 'meta':
				case 'win':
					modifiers.meta = true
					break
			}
		}

		// A rough mapping for special keys.
		const KEYCODE_MAP = {
			f1: 'VK_F1',
			f2: 'VK_F2',
			f3: 'VK_F3',
			f4: 'VK_F4',
			f5: 'VK_F5',
			f6: 'VK_F6',
			f7: 'VK_F7',
			f8: 'VK_F8',
			f9: 'VK_F9',
			f10: 'VK_F10',
			f11: 'VK_F11',
			f12: 'VK_F12',
			enter: 'VK_RETURN',
			escape: 'VK_ESCAPE',
			delete: 'VK_DELETE',
			backspace: 'VK_BACK',
		}

		const keycode = KEYCODE_MAP[keyPart] || null
		const key = keycode ? null : keyPart

		return {
			key: key,
			keycode: keycode,
			modifiers: Object.entries(modifiers)
				.filter(([, val]) => val)
				.map(([mod]) => mod)
				.join(','),
		}
	}

	const parseElement = (elementString, type = 'html') => {
		if (type === 'xul') {
			return window.MozXULElement.parseXULToFragment(elementString).firstChild
		}

		let element = new DOMParser().parseFromString(elementString, 'text/html')
		if (element.body.children.length) element = element.body.firstChild
		else element = element.head.firstChild
		return element
	}

	const escapeXmlAttribute = (str) => {
		if (typeof str !== 'string') return str
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;')
	}

	function timeAgo(timestamp) {
		const now = new Date()
		const then = new Date(timestamp)
		const seconds = Math.round((now - then) / 1000)
		const minutes = Math.round(seconds / 60)
		const hours = Math.round(minutes / 60)
		const days = Math.round(hours / 24)
		const weeks = Math.round(days / 7)
		const months = Math.round(days / 30.44)
		const years = Math.round(days / 365.25)

		if (seconds < 5) return 'Just now'
		if (seconds < 60) return `${seconds} seconds ago`
		if (minutes < 60) return `${minutes} minutes ago`
		if (hours < 24) return `${hours} hours ago`
		if (days === 1) return 'Yesterday'
		if (days < 7) return `${days} days ago`
		if (weeks === 1) return '1 week ago'
		if (weeks < 4) return `${weeks} weeks ago`
		if (months === 1) return '1 month ago'
		if (months < 12) return `${months} months ago`
		if (years === 1) return '1 year ago'
		return `${years} years ago`
	}

	const TabManager = {
		/**
		 * Fetches a list of recently closed tabs.
		 * @returns {Promise<Array<object>>} A promise resolving to an array of closed tab data.
		 */
		async getRecentlyClosedTabs() {
			debugLog('Fetching recently closed tabs.')
			try {
				if (typeof SessionStore !== 'undefined' && SessionStore.getClosedTabData) {
					const closedTabsData = SessionStore.getClosedTabData(window)
					const closedTabs = closedTabsData
						.map((tab, index) => {
							const url = tab.state.entries[0]?.url
							return {
								url: url,
								title: tab.title || tab.state.entries[0]?.title,
								isClosed: true,
								sessionData: tab,
								sessionIndex: index,
								faviconUrl: tab.image,
								closedAt: tab.closedAt,
							}
						})
						.sort((a, b) => b.closedAt - a.closedAt)
					debugLog('Recently closed tabs fetched:', closedTabs)
					return closedTabs
				} else {
					debugError('SessionStore.getClosedTabData not available.')
					return []
				}
			} catch (e) {
				debugError('Error fetching recently closed tabs:', e)
				return []
			}
		},

		/**
		 * Removes a closed tab from the session store.
		 * @param {object} tabData - The data of the closed tab to remove, specifically containing sessionIndex.
		 */
		removeClosedTab(tabData) {
			debugLog('Removing closed tab from session store:', tabData)
			try {
				if (typeof SessionStore !== 'undefined' && SessionStore.forgetClosedTab) {
					SessionStore.forgetClosedTab(window, tabData.sessionIndex)
					debugLog('Closed tab removed successfully.')
				} else {
					debugError('SessionStore.forgetClosedTab not available.')
				}
			} catch (e) {
				debugError('Error removing closed tab:', e)
			}
		},

		_getFolderBreadcrumbs(group) {
			const path = []
			let currentGroup = group
			while (currentGroup && currentGroup.isZenFolder) {
				path.unshift(currentGroup.label)
				currentGroup = currentGroup.group
			}
			return path.join(' / ')
		},

		/**
		 * Fetches a list of currently open tabs across all browser windows and workspaces.
		 * @returns {Promise<Array<object>>} A promise resolving to an array of open tab data.
		 */
		async getOpenTabs() {
			debugLog('Fetching open tabs.')
			const openTabs = []
			try {
				const workspaceTabs = gZenWorkspaces.allStoredTabs
				const essentialTabs = Array.from(document.querySelectorAll('tab[zen-essential="true"]'))
				const allTabs = [...new Set([...workspaceTabs, ...essentialTabs])]

				for (const tab of allTabs) {
					if (tab.hasAttribute('zen-empty-tab') || tab.closing) continue
					const isEssential = tab.hasAttribute('zen-essential')

					const browser = tab.linkedBrowser
					const win = tab.ownerGlobal
					const workspaceId = tab.getAttribute('zen-workspace-id')
					const workspace = workspaceId && win.gZenWorkspaces.getWorkspaceFromId(workspaceId)
					const folder = tab.group?.isZenFolder ? this._getFolderBreadcrumbs(tab.group) : null

					const tabInfo = {
						id: tab.id,
						url: browser.currentURI.spec,
						title: browser.contentTitle || tab.label,
						isPinned: tab.pinned,
						isEssential,
						folder: folder,
						workspace: isEssential ? undefined : workspace?.name,
						isClosed: false,
						faviconUrl: tab.image,
						tabElement: tab,
						lastAccessed: tab._lastAccessed,
					}

					openTabs.push(tabInfo)
				}
				debugLog('Open tabs fetched:', openTabs)
				return openTabs
			} catch (e) {
				debugError('Error fetching open tabs:', e)
				return []
			}
		},

		/**
		 * Reopens a tab based on its data.
		 * If the tab is already open, it switches to it. Otherwise, it opens a new tab.
		 * @param {object} tabData - The data of the tab to reopen.
		 */
		async reopenTab(tabData) {
			debugLog('Reopening tab:', tabData)
			try {
				// If the tab is already open, switch to it.
				if (!tabData.isClosed && tabData.tabElement) {
					const tab = tabData.tabElement
					const win = tab.ownerGlobal
					win.gZenWorkspaces.switchTabIfNeeded(tab)
					return
				}

				// If it's a closed tab, manually restore it.
				if (tabData.isClosed && tabData.sessionData) {
					const tabState = tabData.sessionData.state
					const url = tabState.entries[0]?.url
					if (!url) {
						debugError('Cannot reopen tab: URL not found in session data.', tabData)
						return
					}

					const newTab = gBrowser.addTab(url, {
						triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
						userContextId: tabState.userContextId || 0,
						skipAnimation: true,
					})
					gBrowser.selectedTab = newTab

					// Remove the tab from the closed tabs list after successful reopening
					this.removeClosedTab(tabData)

					const workspaceId = tabState.zenWorkspace
					const activeWorkspaceId = gZenWorkspaces.activeWorkspace

					// Switch workspace if necessary
					if (workspaceId && workspaceId !== activeWorkspaceId) {
						await gZenWorkspaces.changeWorkspaceWithID(workspaceId)
						gZenWorkspaces.moveTabToWorkspace(newTab, workspaceId)
					}

					// Pin if it was previously pinned
					if (tabState.pinned) gBrowser.pinTab(newTab)

					// Restore to folder state
					const groupId = tabData.sessionData.closedInTabGroupId
					if (groupId) {
						const folder = document.getElementById(groupId)
						if (folder && typeof folder.addTabs === 'function') {
							folder.addTabs([newTab])
						}
					}
					gBrowser.selectedTab = newTab
					return
				}

				// Fallback for any other case.
				if (tabData.url) {
					const newTab = gBrowser.addTab(tabData.url, {
						triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
					})
					gBrowser.selectedTab = newTab
				} else {
					debugError('Cannot reopen tab: missing URL or session data.', tabData)
				}
			} catch (e) {
				debugError('Error reopening tab:', e)
			}
		},
	}

	const ReopenClosedTabs = {
		_boundToggleMenu: null,
		_boundHandleItemClick: null,
		_allTabsCache: [],
		_registeredHotkey: null,

		/**
		 * Initializes the Reopen Closed Tabs mod.
		 */
		async init() {
			debugLog('Initializing mod.')
			Prefs.setInitialPrefs()
			this._boundToggleMenu = this.toggleMenu.bind(this)
			this._boundHandleItemClick = this._handleItemClick.bind(this)
			this._registerKeyboardShortcut()
			this._registerToolbarButton()
			UC_API.Prefs.addListener(Prefs.SHORTCUT_KEY, this.onHotkeyChange.bind(this))
			debugLog('Mod initialized.')
		},

		async _registerKeyboardShortcut() {
			const shortcutString = Prefs.shortcutKey
			if (!shortcutString) {
				debugLog('No shortcut key defined.')
				return
			}

			const { key, modifiers } = parseShortcutString(shortcutString)
			if (!key) {
				debugError('Invalid shortcut string:', shortcutString)
				return
			}

			try {
				const translatedModifiers = modifiers.replace(/accel/g, 'ctrl').replace(',', ' ')

				const hotkey = {
					id: 'reopen-closed-tabs-hotkey',
					modifiers: translatedModifiers,
					key: key,
					command: this._boundToggleMenu,
				}
				this._registeredHotkey = await UC_API.Hotkeys.define(hotkey)
				if (this._registeredHotkey) {
					this._registeredHotkey.autoAttach({ suppressOriginal: true })
					debugLog(`Registered shortcut: ${shortcutString}`)
				}
			} catch (e) {
				debugError('Failed to register keyboard shortcut:', e)
			}
		},

		onHotkeyChange() {
			// TODO: Figure out how to apply changes real time (without restart)
			if (window.ucAPI && typeof window.ucAPI.showToast === 'function') {
				window.ucAPI.showToast(
					['Hotkey Changed', 'A restart is required for changes to take effect.'],
					1 // Restart button preset
				)
			}
		},

		_registerToolbarButton() {
			const buttonId = 'reopen-closed-tabs-button'

			try {
				UC_API.Utils.createWidget({
					id: buttonId,
					label: 'Reopen Closed Tabs',
					tooltip: 'View and reopen recently closed tabs',
					image: 'chrome://browser/skin/zen-icons/history.svg',
					type: 'toolbarbutton',
					callback: this.toggleMenu.bind(this),
				})
				debugLog(`Registered toolbar button: ${buttonId}`)
			} catch (e) {
				debugError('Failed to register toolbar button:', e)
			}
		},

		async toggleMenu(event) {
			debugLog('Toggle menu called.')
			let button
			if (event && event.target && event.target.id === 'reopen-closed-tabs-button') {
				button = event.target
			} else {
				// Called from hotkey, find the button in the current window
				button = document.getElementById('reopen-closed-tabs-button')
			}

			if (!button) {
				debugError('Reopen Closed Tabs button not found.')
				return
			}

			const panelId = 'reopen-closed-tabs-panel'

			if (!button._reopenClosedTabsPanel) {
				// Create panel if it doesn't exist for this button
				const panel = parseElement(
					`
				<panel id="${panelId}" type="arrow">
				</panel>
			`,
					'xul'
				)

				const mainPopupSet = document.getElementById('mainPopupSet')
				if (mainPopupSet) {
					mainPopupSet.appendChild(panel)
					button._reopenClosedTabsPanel = panel // Store panel on the button
					debugLog(`Created panel: ${panelId} for button: ${button.id}`)
				} else {
					debugError('Could not find #mainPopupSet to append panel.')
					return
				}
			}

			const panel = button._reopenClosedTabsPanel

			if (panel.state === 'open') {
				panel.hidePopup()
			} else {
				await this._populatePanel(panel) // Pass the panel to populate
				panel.openPopup(button, 'after_start', 0, 0, false, false)
			}
		},

		async _populatePanel(panel) {
			debugLog('Populating panel.')
			while (panel.firstChild) {
				panel.removeChild(panel.firstChild)
			}

			const mainVbox = parseElement(`<vbox flex="1"/>`, 'xul')
			panel.appendChild(mainVbox)

			// Search bar
			const searchBox = parseElement(
				`
			<div id="reopen-closed-tabs-search-container">
				<img src="chrome://global/skin/icons/search-glass.svg" class="search-icon"/>
				<input id="reopen-closed-tabs-search-input" type="search" placeholder="Search tabs..."/>
			</div>
		`,
				'html'
			)
			mainVbox.appendChild(searchBox)

			const allItemsContainer = parseElement(`<vbox id="reopen-closed-tabs-list-container" flex="1" />`, 'xul')
			mainVbox.appendChild(allItemsContainer)

			const closedTabs = await TabManager.getRecentlyClosedTabs()
			const showOpenTabs = Prefs.showOpenTabs
			let openTabs = []

			if (showOpenTabs) {
				openTabs = await TabManager.getOpenTabs()
			}

			if (closedTabs.length > 0) {
				this._renderGroup(allItemsContainer, 'Recently Closed', closedTabs)
			}

			if (openTabs.length > 0) {
				this._renderGroup(allItemsContainer, 'Open Tabs', openTabs)
			}

			if (closedTabs.length === 0 && openTabs.length === 0) {
				const noTabsItem = parseElement(
					`<label class="reopen-closed-tab-item-disabled" value="No tabs to display."/>`,
					'xul'
				)
				allItemsContainer.appendChild(noTabsItem)
			}

			this._allTabsCache = [...closedTabs, ...openTabs]

			const firstItem = allItemsContainer.querySelector('.reopen-closed-tab-item')
			if (firstItem) {
				firstItem.setAttribute('selected', 'true')
			}

			const searchInput = panel.querySelector('#reopen-closed-tabs-search-input')
			if (searchInput) {
				searchInput.addEventListener('input', (event) => this._filterTabs(event.target.value, panel))
				searchInput.addEventListener('keydown', (event) => this._handleSearchKeydown(event, panel))
				panel.addEventListener(
					'popupshown',
					() => {
						searchInput.focus()
						const listContainer = panel.querySelector('#reopen-closed-tabs-list-container')
						if (listContainer) {
							listContainer.scrollTop = 0
						}
					},
					{ once: true }
				)
			}
		},

		_renderGroup(container, groupTitle, tabs) {
			const groupHeader = parseElement(
				`
			<hbox class="reopen-closed-tabs-group-header" align="center">
				<label value="${escapeXmlAttribute(groupTitle)}"/>
			</hbox>
		`,
				'xul'
			)
			container.appendChild(groupHeader)

			tabs.forEach((tab) => {
				this._renderTabItem(container, tab)
			})
		},

		_renderTabItem(container, tab) {
			const label = escapeXmlAttribute(tab.title || tab.url || 'Untitled Tab')
			const url = escapeXmlAttribute(tab.url || '')
			const faviconSrc = escapeXmlAttribute(tab.faviconUrl || 'chrome://branding/content/icon32.png')

			let iconHtml = ''
			if (tab.isEssential) {
				iconHtml = `<image class="tab-status-icon" src="chrome://browser/skin/zen-icons/essential-add.svg" />`
			} else if (tab.isPinned) {
				iconHtml = `<image class="tab-status-icon" src="chrome://browser/skin/zen-icons/pin.svg" />`
			}

			let contextParts = []
			if (tab.isClosed) {
				if (tab.closedAt) {
					contextParts = ['Closed ' + timeAgo(tab.closedAt)]
				}
			} else {
				if (tab.lastAccessed) contextParts.push(timeAgo(tab.lastAccessed))
				if (tab.workspace) contextParts.push(escapeXmlAttribute(tab.workspace))
				if (tab.folder) contextParts.push(escapeXmlAttribute(tab.folder))
			}
			const contextLabel = contextParts.join(' ● ')

			const tabItem = parseElement(
				`
			<hbox class="reopen-closed-tab-item" align="center" tooltiptext="${url}">
				<image class="tab-favicon" src="${faviconSrc}" />
				<vbox class="tab-item-labels" flex="1">
					<label class="tab-item-label" value="${label}"/>
					${contextLabel ? `<label class="tab-item-context" value="${contextLabel}"/>` : ''}
				</vbox>
				<hbox class="tab-item-status-icons" align="center">
					${iconHtml}
					${
						tab.isClosed
							? `<image class="close-button" src="chrome://global/skin/icons/close.svg" tooltiptext="Remove from list" />`
							: ''
					}
				</hbox>
			</hbox>
		`,
				'xul'
			)

			tabItem.tabData = tab
			tabItem.addEventListener('click', this._boundHandleItemClick)
			const closeButton = tabItem.querySelector('.close-button')
			if (closeButton) {
				closeButton.addEventListener('click', (event) => this._handleRemoveTabClick(event, tabItem))
			}
			container.appendChild(tabItem)
		},

		_handleRemoveTabClick(event, tabItem) {
			event.stopPropagation()
			if (tabItem && tabItem.tabData && tabItem.tabData.isClosed) {
				TabManager.removeClosedTab(tabItem.tabData)
				tabItem.remove()
				this._allTabsCache = this._allTabsCache.filter((tab) => tab !== tabItem.tabData)
			} else {
				debugError('Cannot remove tab: Tab data not found or tab is not closed.', tabItem)
			}
		},

		_filterTabs(query, panel) {
			const lowerQuery = query.toLowerCase()
			const filteredTabs = this._allTabsCache.filter((tab) => {
				const title = (tab.title || '').toLowerCase()
				const url = (tab.url || '').toLowerCase()
				const workspace = (tab.workspace || '').toLowerCase()
				const folder = (tab.folder || '').toLowerCase()
				return (
					title.includes(lowerQuery) ||
					url.includes(lowerQuery) ||
					workspace.includes(lowerQuery) ||
					folder.includes(lowerQuery)
				)
			})

			const tabItemsContainer = panel.querySelector('#reopen-closed-tabs-list-container')
			if (tabItemsContainer) {
				while (tabItemsContainer.firstChild) {
					tabItemsContainer.removeChild(tabItemsContainer.firstChild)
				}
				if (filteredTabs.length === 0) {
					const noResultsItem = parseElement(
						`<label class="reopen-closed-tab-item-disabled" value="No matching tabs."/>`,
						'xul'
					)
					tabItemsContainer.appendChild(noResultsItem)
				} else {
					// Re-render groups with filtered tabs
					const closedTabs = filteredTabs.filter((t) => t.isClosed)
					const openTabs = filteredTabs.filter((t) => !t.isClosed)

					if (closedTabs.length > 0) {
						this._renderGroup(tabItemsContainer, 'Recently Closed', closedTabs)
					}
					if (openTabs.length > 0) {
						this._renderGroup(tabItemsContainer, 'Open Tabs', openTabs)
					}

					const firstItem = tabItemsContainer.querySelector('.reopen-closed-tab-item')
					if (firstItem) {
						firstItem.setAttribute('selected', 'true')
					}
				}
			}
		},

		_handleSearchKeydown(event, panel) {
			event.stopPropagation()
			const tabItemsContainer = panel.querySelector('#reopen-closed-tabs-list-container')
			if (!tabItemsContainer) return

			const currentSelected = tabItemsContainer.querySelector('.reopen-closed-tab-item[selected]')
			const allItems = Array.from(tabItemsContainer.querySelectorAll('.reopen-closed-tab-item'))
			let nextSelected = null

			if (event.key === 'ArrowDown') {
				event.preventDefault()
				if (currentSelected) {
					const currentIndex = allItems.indexOf(currentSelected)
					nextSelected = allItems[currentIndex + 1] || allItems[0]
				} else {
					nextSelected = allItems[0]
				}
			} else if (event.key === 'ArrowUp') {
				event.preventDefault()
				if (currentSelected) {
					const currentIndex = allItems.indexOf(currentSelected)
					nextSelected = allItems[currentIndex - 1] || allItems[allItems.length - 1]
				} else {
					nextSelected = allItems[allItems.length - 1]
				}
			} else if (event.key === 'Enter') {
				event.preventDefault()
				if (currentSelected) {
					currentSelected.click()
				}
			}

			if (currentSelected) {
				currentSelected.removeAttribute('selected')
			}
			if (nextSelected) {
				nextSelected.setAttribute('selected', 'true')
				nextSelected.scrollIntoView({ block: 'nearest' })

				// Adjust scroll position to prevent selected item from being hidden behind sticky group label
				const stickyHeader = tabItemsContainer.querySelector('.reopen-closed-tabs-group-header')
				if (stickyHeader) {
					const stickyHeaderHeight = stickyHeader.offsetHeight
					const selectedItemRect = nextSelected.getBoundingClientRect()
					const containerRect = tabItemsContainer.getBoundingClientRect()
					if (selectedItemRect.top < containerRect.top + stickyHeaderHeight) {
						tabItemsContainer.scrollTop -= containerRect.top + stickyHeaderHeight - selectedItemRect.top
					}
				}
			}
		},

		_handleItemClick(event) {
			let tabItem = event.target
			while (tabItem && !tabItem.classList.contains('reopen-closed-tab-item')) {
				tabItem = tabItem.parentElement
			}

			if (tabItem && tabItem.tabData) {
				TabManager.reopenTab(tabItem.tabData)
				const panel = tabItem.closest('panel')
				if (panel) {
					panel.hidePopup()
				} else {
					debugError('Could not find parent panel to hide.')
				}
			} else {
				debugError('Cannot reopen tab: Tab data not found on menu item.', event.target)
			}
		},
	}

	function setupCommandPaletteIntegration(retryCount = 0) {
		if (window.ZenCommandPalette) {
			debugLog('Integrating with Zen Command Palette...')
			window.ZenCommandPalette.addCommands([
				{
					key: 'reopen:closed-tabs-menu',
					label: 'Open Reopen closed tab menu',
					command: () => ReopenClosedTabs.toggleMenu(),
					icon: 'chrome://browser/skin/zen-icons/history.svg',
					tags: ['reopen', 'tabs', 'closed'],
				},
			])

			debugLog('Zen Command Palette integration successful.')
		} else {
			debugLog('Zen Command Palette not found, retrying in 1000ms')
			if (retryCount < 10) {
				setTimeout(() => setupCommandPaletteIntegration(retryCount + 1), 1000)
			} else {
				debugError('Could not integrate with Zen Command Palette after 10 retries.')
			}
		}
	}

	// Initialize when UC_API is ready
	if (typeof UC_API !== 'undefined' && UC_API.Runtime) {
		UC_API.Runtime.startupFinished().then(() => {
			ReopenClosedTabs.init()
			setupCommandPaletteIntegration()
		})
	} else {
		// Fallback for when UC_API is not immediately available
		setTimeout(() => {
			if (typeof UC_API !== 'undefined' && UC_API.Runtime) {
				UC_API.Runtime.startupFinished().then(() => {
					ReopenClosedTabs.init()
					setupCommandPaletteIntegration()
				})
			} else {
				console.error('UC_API not available for Reopen Closed Tabs')
			}
		}, 1000)
	}
})()

// ==UserScript==
// @name            Draggable Findbar
// @description     Simple draggable findbar
// ==/UserScript==
// ;(function () {
// 	'use strict'

// 	if (window.location.href !== 'chrome://browser/content/browser.xhtml') {
// 		return
// 	}

// 	console.log('Draggable Findbar: Starting...')

// 	let findbar = null
// 	let isDragging = false
// 	let hasMoved = false
// 	let startMouseX = 0
// 	let startMouseY = 0
// 	let currentTranslateX = 0
// 	let currentTranslateY = 0

// 	function findFindbar() {
// 		findbar = document.querySelector('findbar')
// 		if (findbar) {
// 			console.log('Draggable Findbar: Found findbar element')
// 			makeDraggable()
// 		} else {
// 			setTimeout(findFindbar, 500)
// 		}
// 	}

// 	function makeDraggable() {
// 		findbar.addEventListener('mousedown', startDrag)
// 		console.log('Draggable Findbar: Made findbar draggable')
// 	}

// 	function startDrag(e) {
// 		// If clicking on an input or button, allow default behavior
// 		if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') {
// 			return
// 		}

// 		isDragging = true
// 		hasMoved = false
// 		startMouseX = e.clientX
// 		startMouseY = e.clientY

// 		document.addEventListener('mousemove', drag)
// 		document.addEventListener('mouseup', stopDrag)

// 		e.preventDefault()
// 		console.log('Started potential drag at:', startMouseX, startMouseY)
// 	}

// 	function drag(e) {
// 		if (!isDragging) return

// 		// Calculate how far we've moved from start
// 		const deltaX = e.clientX - startMouseX
// 		const deltaY = e.clientY - startMouseY

// 		// Only start actually dragging if we've moved at least 3 pixels
// 		if (!hasMoved && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
// 			hasMoved = true
// 			console.log('Actually dragging now')
// 		}

// 		if (!hasMoved) return

// 		// Add to current translation
// 		const newTranslateX = currentTranslateX + deltaX
// 		const newTranslateY = currentTranslateY + deltaY

// 		// Apply transform
// 		findbar.style.transform = `translate(${newTranslateX}px, ${newTranslateY}px)`
// 	}

// 	function stopDrag(e) {
// 		if (isDragging) {
// 			if (hasMoved) {
// 				// Update current translation for next drag
// 				const deltaX = e.clientX - startMouseX
// 				const deltaY = e.clientY - startMouseY
// 				currentTranslateX += deltaX
// 				currentTranslateY += deltaY

// 				console.log('Stopped dragging, final position:', currentTranslateX, currentTranslateY)
// 			} else {
// 				// It was a click, not a drag - focus the input
// 				const input = findbar.querySelector('input[type="text"], .findbar-textbox, input')
// 				console.log('Looking for input, found:', input)
// 				if (input) {
// 					input.focus()
// 					console.log('Focused input after click')
// 				} else {
// 					console.log('No input found in findbar')
// 				}
// 			}
// 		}

// 		isDragging = false
// 		hasMoved = false

// 		document.removeEventListener('mousemove', drag)
// 		document.removeEventListener('mouseup', stopDrag)
// 	}

// 	// Start looking for the findbar
// 	findFindbar()

// 	// Also watch for findbar creation
// 	const observer = new MutationObserver((mutations) => {
// 		mutations.forEach((mutation) => {
// 			if (mutation.type === 'childList') {
// 				mutation.addedNodes.forEach((node) => {
// 					if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'findbar') {
// 						findbar = node
// 						makeDraggable()
// 						console.log('Draggable Findbar: Detected new findbar')
// 					}
// 				})
// 			}
// 		})
// 	})

// 	observer.observe(document.body, { childList: true, subtree: true })
// })()

// ==UserScript==
// @ignorecache
// @name           Nug :has() Polyfill
// @description    Replaces :has(:hover) selectors with JS for Wayland/Hyprland compatibility
// @author         cwel
// ==/UserScript==

function NugHasPolyfillInit() {
	'use strict'

	// Only run in main browser window
	if (window.location.href !== 'chrome://browser/content/browser.xhtml') {
		return
	}

	console.log('[Nug :has() Polyfill] Script loading...')

	const attachedElements = new WeakSet()

	function addHoverClass(element, parentSelector, className) {
		if (attachedElements.has(element)) return
		attachedElements.add(element)

		element.addEventListener('mouseenter', () => {
			const target = parentSelector ? element.closest(parentSelector) : element.parentElement
			if (target) {
				target.classList.add(className)
				console.log(`[Nug :has() Polyfill] Added ${className} to`, target)
			}
		})
		element.addEventListener('mouseleave', () => {
			const target = parentSelector ? element.closest(parentSelector) : element.parentElement
			if (target) {
				target.classList.remove(className)
				console.log(`[Nug :has() Polyfill] Removed ${className} from`, target)
			}
		})
	}

	function attachTabListeners() {
		// Tabs - close/reset buttons
		document.querySelectorAll('.tab-close-button, .tab-reset-button').forEach((btn) => {
			addHoverClass(btn, '.tabbrowser-tab', 'nug-child-hovered')
		})
		console.log('[Nug :has() Polyfill] Attached tab button listeners')
	}

	function attachExtensionListeners() {
		// Extensions - close/reset buttons
		document
			.querySelectorAll('.unified-extensions-item .close-button, .unified-extensions-item .reset-button')
			.forEach((btn) => {
				addHoverClass(btn, '.unified-extensions-item', 'nug-child-hovered')
			})
	}

	function initPolyfills() {
		console.log('[Nug :has() Polyfill] Initializing...')

		// Initial attachment
		attachTabListeners()
		attachExtensionListeners()

		// Watch for new tabs
		const tabContainer = document.querySelector('#tabbrowser-arrowscrollbox, #tabbrowser-tabs')
		if (tabContainer) {
			const tabObserver = new MutationObserver((mutations) => {
				attachTabListeners()
			})
			tabObserver.observe(tabContainer, { childList: true, subtree: true })
			console.log('[Nug :has() Polyfill] Tab observer active')
		}

		// Watch for extension panel
		const extensionPanel = document.querySelector('#unified-extensions-panel')
		if (extensionPanel) {
			const extObserver = new MutationObserver((mutations) => {
				attachExtensionListeners()
			})
			extObserver.observe(extensionPanel, { childList: true, subtree: true })
		}

		// Media.css - media controls hover
		const mediaToolbar = document.querySelector('#zen-media-controls-toolbar')
		if (mediaToolbar) {
			mediaToolbar.addEventListener('mouseenter', () => {
				document.querySelector('#TabsToolbar')?.classList.add('nug-media-hovered')
			})
			mediaToolbar.addEventListener('mouseleave', () => {
				document.querySelector('#TabsToolbar')?.classList.remove('nug-media-hovered')
			})

			// Media toolbaritems
			const mediaItems = document.querySelectorAll('#zen-media-controls-toolbar > toolbaritem')
			mediaItems.forEach((item) => {
				item.addEventListener('mouseenter', () => {
					document.querySelector('#TabsToolbar')?.classList.add('nug-media-item-hovered')
				})
				item.addEventListener('mouseleave', () => {
					document.querySelector('#TabsToolbar')?.classList.remove('nug-media-item-hovered')
				})
			})
		}

		console.log('[Nug :has() Polyfill] Initialized successfully')
	}

	// Initialize when DOM is ready
	if (document.readyState === 'complete') {
		setTimeout(initPolyfills, 1000)
	} else {
		window.addEventListener(
			'load',
			() => {
				setTimeout(initPolyfills, 1000)
			},
			{ once: true }
		)
	}
}

NugHasPolyfillInit()

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
	// when the context menu opens, ensure the menuitems are checked/unchecked appropriately.
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
		// ensure that our new context menu is opened on right-click.
		findbar.setAttribute('context', 'findbar-context-menu')
		// Set attribute to control compact indicator visibility via CSS
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
		findbar.addEventListener('keypress', exitFindBar, true)
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
