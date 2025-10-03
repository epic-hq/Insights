import { render } from "@react-email/render"
import consola from "consola"
import wretch from "wretch"
import { getServerEnv } from "~/env.server"

export const DEFAULT_FROM_EMAIL = getServerEnv().DEFAULT_FROM_EMAIL
export const DEFAULT_FROM_NAME = getServerEnv().DEFAULT_FROM_EMAIL_NAME
export const DEFAULT_FROM = DEFAULT_FROM_NAME ? `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>` : DEFAULT_FROM_EMAIL

if (!DEFAULT_FROM_EMAIL) {
	consola.error("Missing DEFAULT_FROM_EMAIL")
}
consola.log("DEFAULT_FROM_EMAIL", DEFAULT_FROM_EMAIL)
consola.log("DEFAULT_FROM_NAME", DEFAULT_FROM_NAME)
consola.log("DEFAULT_FROM", DEFAULT_FROM)

export type EmailPayload = {
	to: string | string[]
	subject: string
	html?: string
	react?: React.ReactElement
}

export const sendEmail = async (payload: EmailPayload) => {
	const apiKey = getServerEnv().ENGAGE_API_KEY
	const apiSecret = getServerEnv().ENGAGE_API_SECRET

	if (!apiKey || !apiSecret) {
		consola.error("[EMAIL] Missing ENGAGE_API_KEY or ENGAGE_API_SECRET")
		throw new Error("Missing ENGAGE_API_KEY or ENGAGE_API_SECRET")
	}

	// Render React component to HTML if provided
	let html = payload.html
	if (payload.react && !html) {
		html = await render(payload.react)
	}

	if (!html) {
		throw new Error("Either html or react prop must be provided")
	}

	try {
		consola.info("[EMAIL] Sending", {
			from: DEFAULT_FROM,
			to: payload.to,
			subject: payload.subject,
		})

		// Encode credentials for Basic Auth
		const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")

		const result = await wretch("https://api.engage.so/v1/send/email")
			.auth(`Basic ${credentials}`)
			.post({
				subject: payload.subject,
				from: {
					email: DEFAULT_FROM_EMAIL,
					name: DEFAULT_FROM_NAME || undefined,
				},
				to: Array.isArray(payload.to) ? payload.to : [payload.to],
				html: html,
			})
			.json<{ id?: string; error?: unknown }>()

		if (result && typeof result === "object" && "error" in result && result.error) {
			consola.error("[EMAIL] Failed", { to: payload.to, subject: payload.subject, error: result.error })
		} else {
			consola.success("[EMAIL] Sent", { to: payload.to, subject: payload.subject, id: result?.id })
		}

		return result
	} catch (err) {
		consola.error("[EMAIL] Exception", err)
		throw err
	}
}
