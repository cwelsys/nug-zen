// ==UserScript==
// @name           Tab Explode Animation
// @description    adds a bubble explosion animation when a tab or tab group is closed.
// @include        *browser.xhtml
// ==/UserScript==

(() => {
	const { whenReady, prefs, injectStyle, prefersReducedMotion } = window.Nug;

	const TAB_EXPLODE_PREF = "nug.tab.explode";
	let tabExplodeEnabled = prefs.getBool(TAB_EXPLODE_PREF, true);
	const unsubscribe = prefs.subscribe(TAB_EXPLODE_PREF, () => {
		tabExplodeEnabled = prefs.getBool(TAB_EXPLODE_PREF, true);
	});
	window.addEventListener("unload", unsubscribe, { once: true });

	const TAB_EXPLODE_ANIMATION_ID = "tab-explode-animation-styles";
	const BUBBLE_COUNT = 25; // Number of bubbles
	const ANIMATION_DURATION = 600; // Milliseconds

	function injectStyles() {
		injectStyle(
			TAB_EXPLODE_ANIMATION_ID,
			`
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
        `,
		);
	}

	function animateElementClose(element) {
		if (!element || !element.isConnected) return;
		if (prefersReducedMotion()) return;

		const elementRect = element.getBoundingClientRect(); // Viewport-relative
		const explosionContainer = document.createElement("div");
		explosionContainer.className = "tab-explosion-container"; // Has position: absolute

		let parentForAnimation = document.getElementById("browser");
		if (!parentForAnimation || !parentForAnimation.isConnected) {
			parentForAnimation =
				document.getElementById("main-window") ||
				document.documentElement;
		}

		const parentRect = parentForAnimation.getBoundingClientRect();

		explosionContainer.style.left = `${elementRect.left - parentRect.left}px`;
		explosionContainer.style.top = `${elementRect.top - parentRect.top}px`;
		explosionContainer.style.width = `${elementRect.width}px`;
		explosionContainer.style.height = `${elementRect.height}px`;

		parentForAnimation.appendChild(explosionContainer);

		for (let i = 0; i < BUBBLE_COUNT; i++) {
			const bubble = document.createElement("div");
			bubble.className = "bubble-particle";

			let initialX, initialY;
			let edge;
			if (i < 4) {
				edge = i;
			} else {
				edge = Math.floor(Math.random() * 4);
			}

			const bubbleSizeOffset = 5; // Half of average bubble size, to keep them visually on edge

			switch (edge) {
				case 0: // Top edge
					initialX = Math.random() * elementRect.width;
					initialY = -bubbleSizeOffset;
					break;
				case 1: // Right edge
					initialX = elementRect.width + bubbleSizeOffset;
					initialY = Math.random() * elementRect.height;
					break;
				case 2: // Bottom edge
					initialX = Math.random() * elementRect.width;
					initialY = elementRect.height + bubbleSizeOffset;
					break;
				case 3: // Left edge
					initialX = -bubbleSizeOffset;
					initialY = Math.random() * elementRect.height;
					break;
			}

			bubble.style.left = `${initialX}px`;
			bubble.style.top = `${initialY}px`;
			bubble.style.width = `${Math.random() * 4 + 4}px`; // Random size (4px to 8px)
			bubble.style.height = bubble.style.width;

			const angle = Math.random() * Math.PI * 2;
			const distance = Math.random() * 1 + 1; // Explosion radius, even further reduced spread
			let finalTranslateX = Math.cos(angle) * distance;
			let finalTranslateY = Math.sin(angle) * distance;

			// Bias explosion outwards from the edge
			const outwardBias = 10; // Reduced outward bias
			if (edge === 0) finalTranslateY -= outwardBias; // Upwards from top
			if (edge === 1) finalTranslateX += outwardBias; // Rightwards from right
			if (edge === 2) finalTranslateY += outwardBias; // Downwards from bottom
			if (edge === 3) finalTranslateX -= outwardBias; // Leftwards from left

			const finalScale = Math.random() * 0.4 + 0.7; // Scale up a bit

			bubble.style.setProperty("--tx", `${finalTranslateX}px`);
			bubble.style.setProperty("--ty", `${finalTranslateY}px`);
			bubble.style.setProperty("--s", finalScale);

			bubble.style.animationDelay = `${Math.random() * 120}ms`;

			explosionContainer.appendChild(bubble);
		}

		element.style.opacity = "0";
		element.style.transition = "opacity 0.1s linear";

		setTimeout(() => {
			if (explosionContainer.parentNode) {
				explosionContainer.parentNode.removeChild(explosionContainer);
			}
		}, ANIMATION_DURATION + 100); // Add slight buffer for animation delay
	}

	function onTabClose(event) {
		if (!tabExplodeEnabled) return;
		const tab = event.target;
		// Skip pinned/disconnected tabs
		if (tab.localName === "tab" && !tab.pinned && tab.isConnected) {
			// Tabs in a group are handled by the group-removal animation instead.
			const groupParent = tab.closest("tab-group");
			if (!groupParent) {
				animateElementClose(tab);
			}
		}
	}

	function onTabGroupRemove(event) {
		if (!tabExplodeEnabled) return;
		const group = event.target;
		if (group && group.localName === "tab-group" && group.isConnected) {
			animateElementClose(group);
		}
	}

	function init() {
		injectStyles();
		if (typeof gBrowser === "undefined" || !gBrowser.tabContainer) return;
		gBrowser.tabContainer.addEventListener("TabClose", onTabClose, false);
		gBrowser.tabContainer.addEventListener(
			"TabGroupRemoved",
			onTabGroupRemove,
			false,
		);
	}

	whenReady(init);
})();
