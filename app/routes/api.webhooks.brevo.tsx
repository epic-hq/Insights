/**
 * Brevo Webhook Endpoint
 *
 * Receives email events from Brevo (opens, clicks, bounces, etc.) and forwards them to PostHog.
 * Supports both marketing automation webhooks and transactional email webhooks.
 *
 * Setup: Configure webhook URL in Brevo dashboard at https://app.brevo.com/settings/webhooks
 * - URL: https://getupsight.com/api/webhooks/brevo
 * - Events: opened, click, hardBounce, softBounce, unsubscribed, spam
 */

import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { getPostHogServerClient } from "~/lib/posthog.server";

// Marketing webhook event types (from automation campaigns)
interface BrevoMarketingWebhookPayload {
	event: "opened" | "click" | "hardBounce" | "softBounce" | "unsubscribed" | "spam" | "delivered" | "listAddition";
	id: number; // Webhook internal ID
	camp_id?: number; // Campaign ID (marketing only)
	email: string;
	"campaign name"?: string;
	date_sent?: string; // Local timezone (e.g., "2024-11-13 17:03:03")
	date_event?: string; // Local timezone
	tag?: string;
	segment_ids?: number[];
	ts_sent?: number; // UTC timestamp
	ts_event?: number; // UTC timestamp
	ts?: number; // UTC timestamp
	URL?: string; // Clicked URL (for click events)
}

// Transactional webhook event types (from Supabase auth emails)
interface BrevoTransactionalWebhookPayload {
	event:
		| "request"
		| "sent"
		| "delivered"
		| "hardBounce"
		| "softBounce"
		| "blocked"
		| "spam"
		| "invalid"
		| "deferred"
		| "click"
		| "opened"
		| "uniqueOpened"
		| "unsubscribed";
	email: string;
	id: number;
	date: string; // CET/CEST timezone
	ts: number; // Timestamp
	"message-id": string; // Transactional only
	ts_event?: number; // UTC timestamp
	ts_epoch?: number; // UTC timestamp
	subject?: string;
	template_id?: number;
	tags?: string[];
	link?: string; // Clicked URL (for click events)
	user_agent?: string;
	device_used?: string;
	contact_id?: number;
	sending_ip?: string;
	"X-Mailin-custom"?: string;
}

type BrevoWebhookPayload = BrevoMarketingWebhookPayload | BrevoTransactionalWebhookPayload;

// Map Brevo events to PostHog event names
const BREVO_TO_POSTHOG_EVENT_MAP: Record<string, string | null> = {
	opened: "email_opened",
	uniqueOpened: "email_opened",
	click: "email_clicked",
	hardBounce: "email_bounced",
	softBounce: "email_bounced",
	unsubscribed: "email_unsubscribed",
	spam: "email_spam",
	delivered: null, // Don't track (too noisy)
	sent: null, // Don't track
	request: null, // Don't track
	blocked: null, // Don't track
	invalid: null, // Don't track
	deferred: null, // Don't track
	listAddition: null, // Don't track
};

// Type guard for marketing webhook
function isMarketingWebhook(payload: BrevoWebhookPayload): payload is BrevoMarketingWebhookPayload {
	return "camp_id" in payload || "campaign name" in payload;
}

// Brevo validates webhook endpoints with GET requests
export async function loader() {
	consola.info("Brevo webhook endpoint validation (GET request)");
	return Response.json({ status: "ok", service: "brevo-webhook" }, { status: 200 });
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	try {
		const payload: BrevoWebhookPayload = await request.json();
		const eventType = payload.event;

		consola.log("Received Brevo webhook:", {
			event: eventType,
			email: payload.email,
			isMarketing: isMarketingWebhook(payload),
		});

		// Map to PostHog event name
		const posthogEventName = BREVO_TO_POSTHOG_EVENT_MAP[eventType];
		if (!posthogEventName) {
			// Event type we don't track - acknowledge but skip
			consola.debug("Skipping event type:", eventType);
			return Response.json({
				success: true,
				message: "Event type not tracked",
			});
		}

		// Extract common fields
		const email = payload.email;
		const timestamp = payload.ts_event || payload.ts_epoch || payload.ts || Date.now() / 1000;
		const timestampMs = Math.floor(timestamp * 1000);

		// Build properties based on webhook type
		let properties: Record<string, unknown>;
		if (isMarketingWebhook(payload)) {
			// Marketing automation webhook
			properties = {
				email,
				campaign_id: payload.camp_id,
				campaign_name: payload["campaign name"],
				event_type: eventType,
				segment_ids: payload.segment_ids,
				tag: payload.tag,
				webhook_type: "marketing",
				timestamp: new Date(timestampMs).toISOString(),
			};

			// Add URL for click events
			if (eventType === "click" && payload.URL) {
				properties.clicked_url = payload.URL;
			}

			// Add bounce type for bounce events
			if (eventType === "hardBounce" || eventType === "softBounce") {
				properties.bounce_type = eventType;
			}
		} else {
			// Transactional email webhook (e.g., Supabase auth emails)
			properties = {
				email,
				message_id: payload["message-id"],
				subject: payload.subject,
				template_id: payload.template_id,
				event_type: eventType,
				tags: payload.tags,
				webhook_type: "transactional",
				timestamp: new Date(timestampMs).toISOString(),
			};

			// Add URL for click events
			if ((eventType === "click" || eventType === "uniqueOpened") && payload.link) {
				properties.clicked_url = payload.link;
			}

			// Add device/user agent info if available
			if (payload.user_agent) {
				properties.user_agent = payload.user_agent;
			}
			if (payload.device_used) {
				properties.device = payload.device_used;
			}

			// Add bounce type for bounce events
			if (eventType === "hardBounce" || eventType === "softBounce") {
				properties.bounce_type = eventType;
			}
		}

		// Send to PostHog
		const posthog = getPostHogServerClient();

		// Use email as distinct ID (PostHog should have this user from native Brevo destination)
		posthog.capture({
			distinctId: email,
			event: posthogEventName,
			properties,
			timestamp: new Date(timestampMs),
		});

		// Flush to ensure event is sent
		await posthog.shutdown();

		consola.success("Forwarded Brevo event to PostHog:", {
			event: posthogEventName,
			email,
		});

		return Response.json({ success: true });
	} catch (error) {
		consola.error("Brevo webhook processing failed:", error);
		const message = error instanceof Error ? error.message : "Webhook processing failed";
		return Response.json({ error: message }, { status: 500 });
	}
}
