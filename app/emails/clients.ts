import { type CreateEmailOptions, type CreateEmailRequestOptions, Resend } from "resend"

export const resend = new Resend(process.env.RESEND_API_KEY)

export const DEFAULT_FROM = process.env.DEFAULT_FROM_EMAIL
	? process.env.DEFAULT_FROM_NAME
		? `${process.env.DEFAULT_FROM_NAME} <${process.env.DEFAULT_FROM_EMAIL}>`
		: process.env.DEFAULT_FROM_EMAIL
	: "[TEST APP] <onboarding@resend.dev>"

export type EmailPayload = Omit<CreateEmailOptions, "from">

export const sendEmail = async (payload: EmailPayload, options?: CreateEmailRequestOptions) => {
	await resend.emails.send(
		{
			...payload,
			from: DEFAULT_FROM,
		} as CreateEmailOptions,
		options
	)
}
