interface R2ObjectBody {
        body: ReadableStream<Uint8Array> | null
        httpMetadata?: { contentType?: string; contentDisposition?: string }
        httpEtag?: string
}

interface R2Bucket {
        get(key: string): Promise<R2ObjectBody | null>
}

export interface Env {
        R2: R2Bucket
        SERVICE_TOKEN: string
        SHARED_SIGNING_SECRET: string
}

function b64url(buffer: ArrayBuffer) {
        const bytes = new Uint8Array(buffer)
        let binary = ""
        for (const byte of bytes) {
                binary += String.fromCharCode(byte)
        }
        return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "")
}

async function hmac(secret: string, data: string) {
        const key = await crypto.subtle.importKey(
                "raw",
                new TextEncoder().encode(secret),
                { name: "HMAC", hash: "SHA-256" },
                false,
                ["sign"],
        )
        const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data))
        return b64url(signature)
}

function unauthorized() {
        return new Response("Unauthorized", { status: 401 })
}

export default {
        async fetch(request: Request, env: Env): Promise<Response> {
                const url = new URL(request.url)

                if (url.pathname === "/health") {
                        return new Response("ok")
                }

                if (request.method === "POST" && url.pathname === "/read") {
                        const authHeader = request.headers.get("authorization") ?? ""
                        if (!authHeader.startsWith("Bearer ")) {
                                return unauthorized()
                        }
                        const token = authHeader.slice(7)
                        if (token !== env.SERVICE_TOKEN) {
                                return unauthorized()
                        }

                        const { key } = await request.json<{
                                key?: string
                        }>()
                        if (!key) {
                                return new Response("Missing key", { status: 400 })
                        }
                        const object = await env.R2.get(key)
                        if (!object) {
                                return new Response("Not found", { status: 404 })
                        }

                        const headers: Record<string, string> = {}
                        const metadata = object.httpMetadata
                        if (metadata?.contentType) {
                                headers["content-type"] = metadata.contentType
                        }
                        if (metadata?.contentDisposition) {
                                headers["content-disposition"] = metadata.contentDisposition
                        }

                        return new Response(object.body, { headers })
                }

                if (request.method === "GET" && url.pathname.startsWith("/r/")) {
                        const key = decodeURIComponent(url.pathname.slice(3))
                        const exp = url.searchParams.get("exp")
                        const sig = url.searchParams.get("sig") ?? ""

                        if (!exp) {
                                return unauthorized()
                        }
                        const expiresAt = Number(exp)
                        if (Number.isNaN(expiresAt)) {
                                return unauthorized()
                        }
                        const now = Math.floor(Date.now() / 1000)
                        if (expiresAt < now) {
                                return new Response("Link expired", { status: 403 })
                        }

                        const payload = `${key}.${exp}`
                        const expected = await hmac(env.SHARED_SIGNING_SECRET, payload)
                        if (sig !== expected) {
                                return unauthorized()
                        }

                        const object = await env.R2.get(key)
                        if (!object) {
                                return new Response("Not found", { status: 404 })
                        }

                        const headers: Record<string, string> = {}
                        if (object.httpEtag) {
                                headers.etag = object.httpEtag
                        }
                        const metadata = object.httpMetadata
                        if (metadata?.contentType) {
                                headers["content-type"] = metadata.contentType
                        }
                        if (metadata?.contentDisposition) {
                                headers["content-disposition"] = metadata.contentDisposition
                        }

                        return new Response(object.body, { headers })
                }

                return new Response("Not found", { status: 404 })
        },
}
