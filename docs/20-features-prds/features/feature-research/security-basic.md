# TODO basic noise hardening

**Default: ignore.** But add 2–3 cheap guards so it never costs you.

### Do this now (5-minute hardening)

1. **Fast-path 404 for common probes** (no SSR work):

```ts
// server.ts (before your Remix handler)
import { parse } from "node:url"

const PROBE_PATHS = [
  /^\/wp-/,
  /^\/xmlrpc\.php$/,
  /^\/wp-login\.php$/,
  /^\/wp-admin\//,
  /^\/\.env$/,
  /^\/phpmyadmin/i,
  /^\/vendor\//,
  /^\/\.git/
]

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const { pathname } = parse(new URL(request.url).toString())
    if (PROBE_PATHS.some((re) => re.test(pathname!))) {
      return new Response("Not found", { status: 404 })
    }
    // …fall through to your Remix request handler
    return remixHandler(request, env, ctx)
  }
}
```

2. **Basic rate-limit per IP** (cheap + good enough):

* **Single machine:** in-memory LRU.
* **Multiple machines:** Upstash/Redis or Cloudflare WAF (see below).

*In-memory (baseline):*

```ts
import LRU from "lru-cache"

const bucket = new LRU<string, { count: number; ts: number }>({ max: 5000 })
const LIMIT = 120;  // req per minute per IP

function tooMany(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const now = Date.now()
  const k = `ip:${ip}`
  const rec = bucket.get(k) ?? { count: 0, ts: now }
  if (now - rec.ts > 60_000) { rec.count = 0; rec.ts = now }
  rec.count++
  bucket.set(k, rec)
  return rec.count > LIMIT
}

// in your fetch handler, before SSR:
if (tooMany(request)) return new Response("Too many requests", { status: 429 })
```

3. **Security headers** (cheap signal + reduces attack surface):

```ts
const commonHeaders = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer-when-downgrade",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  // tighten CSP if you can:
  // "Content-Security-Policy": "default-src 'self'; img-src 'self' data: https:; ..."
}
```

### If you already use Cloudflare in front

Add a WAF rule to **Block** or **Rate Limit** when URI Path:

* contains `/wp-` OR equals `/xmlrpc.php` OR contains `/.env` OR contains `/phpmyadmin` OR contains `/.git`.

That stops the traffic at the edge so your Fly app never sees it.

### When to actually worry

* 4xx noise becomes **sustained thousands/minute**.
* You see **5xx** spikes or CPU/memory bumps tied to these paths.
* Probes hit **auth**, **/api** with payloads, or enumerate IDs.

Otherwise… keep it boring. 404 fast, rate-limit cheap, move on.
