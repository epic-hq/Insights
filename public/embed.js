/**
 * UpSight Embed Script
 *
 * This script creates an embeddable form widget on external websites.
 * Add this script to your page along with a container element.
 *
 * Usage:
 *   <div id="upsight-form" data-upsight-slug="your-form-slug"></div>
 *   <script src="https://getupsight.com/embed.js" async></script>
 *
 * Configuration options (data attributes):
 *   data-upsight-slug: Form slug (required)
 *   data-upsight-layout: "inline-email" | "inline-full" | "email-first" | "compact" (default: "inline-email")
 *   data-upsight-theme: "dark" | "light" | "auto" (default: "dark")
 *   data-upsight-accent: Accent color hex (default: "#ffffff")
 *   data-upsight-radius: Border radius in pixels (default: "12")
 *   data-upsight-branding: "true" | "false" - show powered by (default: "true")
 *   data-upsight-button-text: Custom button text
 *   data-upsight-placeholder: Custom email placeholder
 *   data-upsight-success: Custom success message
 *   data-upsight-video-thumbnail: "true" | "false" - show video as thumbnail (default: "true")
 *
 * Events:
 *   The embed posts messages to the parent window:
 *   - { type: "upsight:signup", email: string, responseId: string }
 *   - { type: "upsight:loaded", slug: string }
 *   - { type: "upsight:error", error: string }
 */
(function () {
	"use strict";

	// Configuration
	var BASE_URL = "https://getupsight.com";
	var EMBED_PATH = "/embed/";

	// Detect if we're running locally or in development
	if (
		typeof window !== "undefined" &&
		(window.location.hostname === "localhost" ||
			window.location.hostname === "127.0.0.1" ||
			window.location.hostname.endsWith(".local"))
	) {
		BASE_URL = window.location.origin;
	}

	// Find all embed containers
	function initEmbeds() {
		var containers = document.querySelectorAll(
			"[data-upsight-slug], .upsight-embed"
		);

		containers.forEach(function (container) {
			// Skip if already initialized
			if (container.dataset.upsightInitialized === "true") {
				return;
			}

			var slug = container.dataset.upsightSlug;
			if (!slug) {
				console.error("[UpSight] Missing data-upsight-slug attribute");
				return;
			}

			// Extract configuration from data attributes
			var config = {
				layout: container.dataset.upsightLayout || "inline-email",
				theme: container.dataset.upsightTheme || "dark",
				accent: container.dataset.upsightAccent || "#ffffff",
				radius: container.dataset.upsightRadius || "12",
				branding: container.dataset.upsightBranding !== "false",
				buttonText: container.dataset.upsightButtonText || "",
				placeholder: container.dataset.upsightPlaceholder || "you@company.com",
				success: container.dataset.upsightSuccess || "Thanks for signing up!",
				videoThumbnail: container.dataset.upsightVideoThumbnail !== "false",
			};

			// Build embed URL with parameters
			var url = new URL(BASE_URL + EMBED_PATH + slug);
			url.searchParams.set("layout", config.layout);
			url.searchParams.set("theme", config.theme);
			url.searchParams.set("accent", config.accent);
			url.searchParams.set("radius", config.radius);
			url.searchParams.set("branding", config.branding ? "true" : "false");
			if (config.buttonText) {
				url.searchParams.set("buttonText", config.buttonText);
			}
			url.searchParams.set("placeholder", config.placeholder);
			url.searchParams.set("success", config.success);
			url.searchParams.set(
				"videoThumbnail",
				config.videoThumbnail ? "true" : "false"
			);

			// Create iframe
			var iframe = document.createElement("iframe");
			iframe.src = url.toString();
			iframe.style.cssText =
				"width: 100%; border: none; overflow: hidden; background: transparent;";
			iframe.setAttribute("frameborder", "0");
			iframe.setAttribute("scrolling", "no");
			iframe.setAttribute(
				"allow",
				"camera; microphone; display-capture; autoplay"
			);
			iframe.setAttribute("title", "UpSight Form");

			// Set initial height based on layout
			var initialHeight = {
				compact: "60px",
				"inline-email": "200px",
				"email-first": "280px",
				"inline-full": "400px",
			};
			iframe.style.height = initialHeight[config.layout] || "200px";

			// Handle iframe load and resize messages
			window.addEventListener("message", function (event) {
				// Security check - only accept messages from our embed
				if (!event.origin.includes("getupsight.com") && event.origin !== BASE_URL) {
					// Allow localhost for development
					if (!event.origin.includes("localhost") && !event.origin.includes("127.0.0.1")) {
						return;
					}
				}

				if (event.data && event.data.type) {
					switch (event.data.type) {
						case "upsight:resize":
							if (event.data.height) {
								iframe.style.height = event.data.height + "px";
							}
							break;
						case "upsight:signup":
							// Re-dispatch to parent listeners
							container.dispatchEvent(
								new CustomEvent("upsight:signup", {
									detail: {
										email: event.data.email,
										responseId: event.data.responseId,
									},
								})
							);
							break;
						case "upsight:loaded":
							container.dispatchEvent(
								new CustomEvent("upsight:loaded", {
									detail: { slug: event.data.slug },
								})
							);
							break;
					}
				}
			});

			// Insert iframe
			container.innerHTML = "";
			container.appendChild(iframe);
			container.dataset.upsightInitialized = "true";

			// Dispatch loaded event
			container.dispatchEvent(
				new CustomEvent("upsight:loaded", { detail: { slug: slug } })
			);
		});
	}

	// Initialize on DOM ready
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initEmbeds);
	} else {
		initEmbeds();
	}

	// Re-initialize on dynamic content (for SPAs)
	if (typeof MutationObserver !== "undefined") {
		var observer = new MutationObserver(function (mutations) {
			var shouldInit = false;
			mutations.forEach(function (mutation) {
				if (mutation.addedNodes.length > 0) {
					mutation.addedNodes.forEach(function (node) {
						if (
							node.nodeType === 1 &&
							(node.dataset?.upsightSlug ||
								node.classList?.contains("upsight-embed") ||
								node.querySelector?.(
									"[data-upsight-slug], .upsight-embed"
								))
						) {
							shouldInit = true;
						}
					});
				}
			});
			if (shouldInit) {
				initEmbeds();
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});
	}

	// Expose API for programmatic control
	window.UpSight = window.UpSight || {};
	window.UpSight.init = initEmbeds;
	window.UpSight.create = function (containerId, slug, options) {
		var container = document.getElementById(containerId);
		if (!container) {
			console.error("[UpSight] Container not found: " + containerId);
			return;
		}

		options = options || {};
		container.dataset.upsightSlug = slug;
		if (options.layout) container.dataset.upsightLayout = options.layout;
		if (options.theme) container.dataset.upsightTheme = options.theme;
		if (options.accent) container.dataset.upsightAccent = options.accent;
		if (options.radius) container.dataset.upsightRadius = String(options.radius);
		if (options.branding !== undefined)
			container.dataset.upsightBranding = String(options.branding);
		if (options.buttonText)
			container.dataset.upsightButtonText = options.buttonText;
		if (options.placeholder)
			container.dataset.upsightPlaceholder = options.placeholder;
		if (options.success) container.dataset.upsightSuccess = options.success;
		if (options.videoThumbnail !== undefined)
			container.dataset.upsightVideoThumbnail = String(options.videoThumbnail);

		// Remove initialized flag to re-init
		delete container.dataset.upsightInitialized;
		initEmbeds();
	};
})();
