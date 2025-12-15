import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { z } from "zod"
import { sendEmail } from "~/emails/clients.server"
import ResourceShareEmail from "../../emails/resource-share"
import { userContext } from "~/server/user-context"

const ShareInviteSchema = z.object({
        targetEmail: z.string().email(),
        resourceLink: z.string().url(),
        resourceName: z.string().min(1),
        resourceType: z.string().min(1),
        note: z.string().max(1000).optional(),
})

export async function action({ request, context }: ActionFunctionArgs) {
        if (request.method !== "POST") {
                return Response.json({ error: "Method not allowed" }, { status: 405 })
        }

        const ctx = context.get(userContext)
        const supabase = ctx.supabase

        if (!supabase) {
                return Response.json({ error: "Unauthorized" }, { status: 401 })
        }

        const formData = await request.formData()
        const parsed = ShareInviteSchema.safeParse({
                targetEmail: formData.get("targetEmail"),
                resourceLink: formData.get("resourceLink") ?? formData.get("shareUrl"),
                resourceName: formData.get("resourceName"),
                resourceType: formData.get("resourceType"),
                note: formData.get("note") || undefined,
        })

        if (!parsed.success) {
                consola.warn("[share-invite] Invalid payload", parsed.error.flatten())
                return Response.json({ error: "Invalid share payload" }, { status: 400 })
        }

        const { targetEmail, resourceLink, resourceName, resourceType, note } = parsed.data
        const inviterName =
                ctx.user_metadata?.name ||
                (typeof ctx.claims?.name === "string" ? ctx.claims.name : null) ||
                (typeof ctx.claims?.email === "string" ? ctx.claims.email : null) ||
                "A teammate"
        const inviterEmail = typeof ctx.claims?.email === "string" ? ctx.claims.email : undefined

        try {
                consola.info("[share-invite] Sending", {
                        targetEmail,
                        resourceType,
                        resourceName,
                })
                await sendEmail({
                        to: targetEmail,
                        subject: `${inviterName} shared a ${resourceType} with you`,
                        react: (
                                <ResourceShareEmail
                                        inviterName={inviterName}
                                        resourceName={resourceName}
                                        resourceType={resourceType}
                                        resourceUrl={resourceLink}
                                        note={typeof note === "string" && note.trim() ? note : undefined}
                                />
                        ),
                        reply_to: inviterEmail,
                })
                return Response.json({ ok: true })
        } catch (error) {
                consola.error("[share-invite] Failed to send", { error })
                return Response.json({ error: "Unable to send invite right now" }, { status: 500 })
        }
}
