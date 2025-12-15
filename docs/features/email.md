# Email Setup & Deliverability

Guide for configuring transactional/marketing email domains on Cloudflare and wiring providers in the app.

## Current implementation
- Transactional invites are sent via `app/routes/api.share-invite.tsx` using `sendEmail` from `app/emails/clients.server.ts` with the `emails/share-invite.tsx` React template.
- `sendEmail` currently targets Engage (`ENGAGE_API_KEY` + `ENGAGE_API_SECRET`). `RESEND_API_KEY` is present but unused; prefer Engage for now. Keep transactional mail separate from any marketing blasts.

## Domain & provider topology (Cloudflare)
- Use a dedicated transactional subdomain, e.g. `mail.getupsight.com` (Resend/Engage). Keep marketing on a different subdomain, e.g. `news.getupsight.com`, to isolate reputation.
- All email DNS records must be set to **DNS only** (gray cloud) in Cloudflare; proxied records break SPF/DKIM/tracking.

### Required DNS records (per sending subdomain)
Add these using the exact host/target values your provider issues:
- **SPF (TXT)**: `v=spf1 include:<provider include> -all` (Resend: `include:spf.resend.com`). Avoid stacking multiple includes on one domain—use separate subdomains if you need multiple providers.
- **DKIM (CNAME)**: Provider-supplied host(s) like `resend._domainkey.mail` (Resend) or `dkim1._domainkey.mail` (Engage). Add every DKIM record they give you.
- **Return-Path/Bounce (CNAME)**: Provider bounce domain aligned to the sending subdomain (e.g. `<hash>.mail.getupsight.com` → provider bounce host).
- **Tracking domain (CNAME)**: Optional but recommended for branded click/open tracking, e.g. `t.mail.getupsight.com` → provider tracking host. Use a distinct tracking CNAME per provider.
- **DMARC (TXT, on the org domain or subdomain)**: Start relaxed to collect reports, then tighten:
  - `v=DMARC1; p=none; rua=mailto:dmarc@getupsight.com; ruf=mailto:dmarc@getupsight.com; fo=1; pct=100; sp=quarantine`
  - After 1–2 weeks of clean reports, move `p` to `quarantine`, then `reject` when stable. Keep `sp=quarantine` to protect subdomains.

## App configuration
Set these in `.env` (dotenvx loads them):
- `ENGAGE_API_KEY` / `ENGAGE_API_SECRET`: Engage credentials.
- `DEFAULT_FROM_EMAIL` / `DEFAULT_FROM_EMAIL_NAME`: Sender identity (use the transactional subdomain, e.g. `notify@mail.getupsight.com`).
- Optional: `RESEND_API_KEY` if you switch providers later.

## Sending hygiene for invites
- Keep the From name stable and human (`Upsight Team`), Reply-To monitored.
- Include the plain-text body when possible (`sendEmail` accepts `text`); keep links on your branded/tracking domain and avoid URL shorteners.
- Content already includes an “ignore this invite” note; keep it. Avoid promo language and excessive images (the invite is text-first).

## Warm-up & monitoring
- Ramp volume gradually on a new subdomain; start with engaged recipients and increase daily. Back off on 4xx responses.
- Track spam placement with a few seed inboxes (Gmail/Outlook/iCloud/Yahoo) using the actual sending domain.
- Review DMARC aggregate reports weekly; fix alignment issues before tightening policy.
