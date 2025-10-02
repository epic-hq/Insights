import consola from "consola"
import { type CreateEmailOptions, type CreateEmailRequestOptions, Resend } from "resend"
import { getServerEnv } from "~/env.server"

export const resend = new Resend(getServerEnv().RESEND_API_KEY)

export const DEFAULT_FROM_EMAIL = getServerEnv().DEFAULT_FROM_EMAIL
export const DEFAULT_FROM_NAME = getServerEnv().DEFAULT_FROM_EMAIL_NAME
export const DEFAULT_FROM = DEFAULT_FROM_NAME
	? `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`
	: DEFAULT_FROM_EMAIL

if (!DEFAULT_FROM_EMAIL) {
	consola.error("Missing DEFAULT_FROM_EMAIL")
}
consola.log("DEFAULT_FROM_EMAIL", DEFAULT_FROM_EMAIL)
consola.log("DEFAULT_FROM_NAME", DEFAULT_FROM_NAME)
consola.log("DEFAULT_FROM", DEFAULT_FROM)

export type EmailPayload = Omit<CreateEmailOptions, "from">

export const sendEmail = async (payload: EmailPayload, options?: CreateEmailRequestOptions) => {
	try {
		consola.info("[EMAIL] Sending", {
			from: DEFAULT_FROM,
			to: payload.to,
			subject: payload.subject,
		})
		const result = await resend.emails.send(
			{
				from: DEFAULT_FROM,
				...payload,
			} as CreateEmailOptions,
			options
		)
		const r = result as unknown as { id?: string; error?: unknown }
		if (r && typeof r === "object" && "error" in r && r.error) {
			consola.error("[EMAIL] Failed", { to: payload.to, subject: payload.subject, error: r.error })
		} else {
			consola.success("[EMAIL] Sent", { to: payload.to, subject: payload.subject, id: r?.id })
		}
		return result
	} catch (err) {
		consola.error("[EMAIL] Exception", err)
		throw err
	}
}
