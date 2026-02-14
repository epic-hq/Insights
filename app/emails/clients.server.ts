import { render } from "@react-email/render";
import consola from "consola";
import wretch from "wretch";
import { getServerEnv } from "~/env.server";

const DEFAULT_FROM_EMAIL = getServerEnv().DEFAULT_FROM_EMAIL;
const DEFAULT_FROM_NAME = getServerEnv().DEFAULT_FROM_EMAIL_NAME;
const DEFAULT_FROM = DEFAULT_FROM_NAME ? `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>` : DEFAULT_FROM_EMAIL;

if (!DEFAULT_FROM_EMAIL) {
	consola.error("[EMAIL] Missing DEFAULT_FROM_EMAIL");
}

type EmailPayload = {
	to: string | string[];
	subject: string;
	html?: string;
	react?: React.ReactElement;
	cc?: string[];
	bcc?: string[];
	text?: string;
	template?: string;
	template_variables?: Record<string, unknown>;
	reply_to?: string;
	track_clicks?: boolean;
	track_opens?: boolean;
	send_intent?: "transactional" | "marketing";
	unsubscribe_url?: string;
	unsubscribe_email?: string;
};

type SendEmailResult = { id?: string; error?: unknown };

const DEFAULT_MIN_DELAY_MS = 500;
const DEFAULT_MAX_ATTEMPTS = 4;
let last_send_at_ms = 0;
let send_queue: Promise<void> = Promise.resolve();

const sleep = async (ms: number) => {
	await new Promise((resolve) => setTimeout(resolve, ms));
};

const jitter = (ms: number) => {
	const delta = Math.floor(ms * 0.2);
	return ms + Math.floor((Math.random() * 2 - 1) * delta);
};

const enqueue_send = async <T>(fn: () => Promise<T>) => {
	const run = async () => {
		const now = Date.now();
		const elapsed = now - last_send_at_ms;
		if (elapsed < DEFAULT_MIN_DELAY_MS) {
			await sleep(DEFAULT_MIN_DELAY_MS - elapsed);
		}
		try {
			return await fn();
		} finally {
			last_send_at_ms = Date.now();
		}
	};

	const task = send_queue.then(run);
	send_queue = task.then(
		() => undefined,
		() => undefined
	);
	return task;
};

class EngageEmailError extends Error {
	status: number;
	body: unknown;
	constructor(args: { status: number; body: unknown; message?: string }) {
		super(args.message ?? `Engage email send failed with status ${args.status}`);
		this.status = args.status;
		this.body = args.body;
	}
}

const should_retry = (err: unknown) => {
	if (err instanceof EngageEmailError) {
		return err.status === 429 || (err.status >= 500 && err.status <= 599);
	}
	return true;
};

const with_backoff = async <T>(fn: () => Promise<T>) => {
	let attempt = 0;
	let delay_ms = 500;

	while (true) {
		attempt += 1;
		try {
			return await fn();
		} catch (err) {
			if (attempt >= DEFAULT_MAX_ATTEMPTS || !should_retry(err)) {
				throw err;
			}

			await sleep(jitter(delay_ms));
			delay_ms = Math.min(delay_ms * 2, 10_000);
		}
	}
};

export const sendEmail = async (payload: EmailPayload) => {
	const apiKey = getServerEnv().ENGAGE_API_KEY;
	const apiSecret = getServerEnv().ENGAGE_API_SECRET;
	const send_intent = payload.send_intent ?? "transactional";

	if (!apiKey || !apiSecret) {
		consola.error("[EMAIL] Missing ENGAGE_API_KEY or ENGAGE_API_SECRET");
		throw new Error("Missing ENGAGE_API_KEY or ENGAGE_API_SECRET");
	}

	if (!DEFAULT_FROM_EMAIL) {
		throw new Error("Missing DEFAULT_FROM_EMAIL");
	}

	// Render React component to HTML if provided
	let html = payload.html;
	let text = payload.text;
	if (payload.react && !html) {
		html = await render(payload.react);
	}
	if (payload.react && !text) {
		try {
			text = await render(payload.react, { plainText: true });
		} catch {
			// Best-effort only
		}
	}

	if (!html && !payload.template) {
		throw new Error("Either html, react, or template prop must be provided");
	}

	try {
		consola.info("[EMAIL] Sending", {
			from: DEFAULT_FROM,
			to: payload.to,
			subject: payload.subject,
		});

		// Encode credentials for Basic Auth
		const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

		// Build request body with all optional parameters
		const requestBody: Record<string, unknown> = {
			subject: payload.subject,
			from: {
				email: DEFAULT_FROM_EMAIL,
				name: DEFAULT_FROM_NAME || undefined,
			},
			to: Array.isArray(payload.to) ? payload.to : [payload.to],
			track_clicks: payload.track_clicks ?? send_intent === "marketing",
			track_opens: payload.track_opens ?? send_intent === "marketing",
		};

		// Add optional fields if provided
		if (html) requestBody.html = html;
		if (text) requestBody.text = text;
		if (payload.cc) requestBody.cc = payload.cc;
		if (payload.bcc) requestBody.bcc = payload.bcc;
		if (payload.template) requestBody.template = payload.template;
		if (payload.template_variables) requestBody.template_variables = payload.template_variables;
		if (payload.reply_to) requestBody.reply_to = payload.reply_to;
		if (payload.unsubscribe_url || payload.unsubscribe_email) {
			const list_unsubscribe_parts: string[] = [];
			if (payload.unsubscribe_email) list_unsubscribe_parts.push(`<mailto:${payload.unsubscribe_email}>`);
			if (payload.unsubscribe_url) list_unsubscribe_parts.push(`<${payload.unsubscribe_url}>`);

			if (list_unsubscribe_parts.length > 0) {
				requestBody.headers = {
					"List-Unsubscribe": list_unsubscribe_parts.join(", "),
					...(payload.unsubscribe_url ? { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : {}),
				};
			}
		}

		const result = await enqueue_send(() =>
			with_backoff(async () => {
				const res = await wretch("https://api.engage.so/v1/send/email")
					.auth(`Basic ${credentials}`)
					.post(requestBody)
					.res();

				const body_text = await res.text();
				let parsed: SendEmailResult | undefined;
				try {
					parsed = body_text ? (JSON.parse(body_text) as SendEmailResult) : undefined;
				} catch {
					parsed = undefined;
				}

				if (!res.ok) {
					throw new EngageEmailError({
						status: res.status,
						body: parsed ?? body_text,
					});
				}

				return parsed;
			})
		);

		if (result && typeof result === "object" && "error" in result && result.error) {
			consola.error("[EMAIL] Failed", { to: payload.to, subject: payload.subject, error: result.error });
		} else {
			consola.success("[EMAIL] Sent", { to: payload.to, subject: payload.subject, id: result?.id });
		}

		return result;
	} catch (err) {
		consola.error("[EMAIL] Exception", err);
		throw err;
	}
};
