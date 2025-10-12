# Payload CMS Deployment with Neon Postgres and Cloudflare R2

This guide explains how to configure environment variables, DNS, Fly.io, and Cloudflare R2 so the standalone Payload CMS instance under `/cms` can run in production. Follow the steps in order—local `.env`, Fly secrets, database, object storage, and DNS.

## Prerequisites

- Fly.io CLI installed (`flyctl`) and authenticated against the correct organization.
- Neon account with a provisioned Postgres database.
- Cloudflare account with R2 enabled (available on all paid plans and pay-as-you-go).
- Domain control for `getupsight.com` (or the domain you plan to host the CMS on).

## 1. Create and populate `cms/.env`

Copy the example file and populate it with production values:

```bash
cp cms/.env.example cms/.env
```

| Variable | Where to find / how to set |
| --- | --- |
| `PAYLOAD_SECRET` | Generate a long random string. This secures session tokens. `openssl rand -base64 32` works well. |
| `DATABASE_URL` | In Neon console → Project → `Connection Details`. Copy the **Postgres** connection string with `sslmode=require`. Example: `postgresql://<user>:<password>@<hostname>.neon.tech/neondb?sslmode=require`. |
| `CMS_PUBLIC_URL` | The public HTTPS URL for the CMS, e.g. `https://cms.getupsight.com`. Must match the Fly certificate/DNS you will create. |
| `SITE_ORIGIN` | The main web app origin that is allowed to call the CMS, e.g. `https://getupsight.com`. Use staging origin(s) when testing. |
| `S3_ENDPOINT` | Cloudflare R2 S3 endpoint in the form `https://<account-id>.r2.cloudflarestorage.com`. You can find the account ID in Cloudflare’s dashboard (R2 → **S3 API** tab). Leave blank when using AWS S3. |
| `S3_REGION` | Cloudflare recommends `auto` but the AWS SDK expects something. Use `auto` or `us-east-1`. Either works because the endpoint controls routing. |
| `S3_BUCKET` | Name of your R2 bucket (e.g., `marketing-media`). Must be globally unique inside your account. |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Create an R2 API token with Object Read + Write for the bucket (R2 → **Manage R2 API tokens**). Copy the Access Key ID and Secret Access Key. |
| `S3_FORCE_PATH_STYLE` | R2 supports virtual-host-style URLs so keep the default `false`. Set to `true` only for providers that require path-style routing. |

> 🚫 Do not commit `cms/.env` to source control. It should stay local.

## 2. Apply secrets to Fly

Fly deployments read secrets from the platform. From the repo root, run:

```bash
fly apps create getupsight-cms   # only once
fly secrets set --app getupsight-cms \
  PAYLOAD_SECRET="$(cat cms/.env | grep ^PAYLOAD_SECRET | cut -d'=' -f2-)" \
  DATABASE_URL="$(cat cms/.env | grep ^DATABASE_URL | cut -d'=' -f2-)" \
  CMS_PUBLIC_URL="https://cms.getupsight.com" \
  SITE_ORIGIN="https://getupsight.com" \
  S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com" \
  S3_REGION="auto" \
  S3_BUCKET="marketing-media" \
  S3_ACCESS_KEY_ID="<r2-access-key>" \
  S3_SECRET_ACCESS_KEY="<r2-secret-key>" \
  S3_FORCE_PATH_STYLE="false"
```

You can paste literal values instead of shelling through `grep`. Rerun `fly secrets set` whenever a value changes.

## 3. Deploy the CMS

With secrets in place:

```bash
fly deploy --config cms/fly.toml --dockerfile cms/Dockerfile --app getupsight-cms
```

Fly will build the Docker image, provision the app, and keep one machine running. Use `fly status --app getupsight-cms` to inspect health and logs.

## 4. Configure DNS for `cms.getupsight.com`

Yes—you need DNS for the public CMS URL.

1. Run `fly certs add cms.getupsight.com --app getupsight-cms` to request a Fly-managed TLS cert.
2. Fly will output one or two DNS records (typically a CNAME to `getupsight-cms.fly.dev` and an optional `_acme-challenge` TXT).
3. In your DNS provider (likely Cloudflare if you manage `getupsight.com` there), add the requested records.
4. Wait for Fly to validate (`fly certs show cms.getupsight.com --app getupsight-cms`). Once ready, the CMS will be reachable at `https://cms.getupsight.com`.

If you skip DNS, you can still reach the app at `https://getupsight-cms.fly.dev`, but `CMS_PUBLIC_URL` must match the domain you actually use, so production should rely on the custom subdomain.

## 5. Set up Cloudflare R2

1. **Create a bucket**
   - In Cloudflare dashboard → R2 → **Create bucket**.
   - Name it (e.g., `marketing-media`). Leave the region on the default (R2 is global).

2. **Generate S3 API credentials**
   - Navigate to R2 → **Manage R2 API Tokens** → **Create API token**.
   - Choose **Scoped Access** and select your bucket with _Object Read_ and _Write_ permissions.
   - Copy the Access Key ID and Secret Access Key immediately (you won’t see the secret again).

3. **Find the S3 endpoint**
   - R2 → **S3 API** tab lists the Account ID and the primary endpoint. Use `https://<account-id>.r2.cloudflarestorage.com`.
   - Optional: If you later add a custom domain to the bucket, update `S3_ENDPOINT` accordingly.

4. **Public access**
   - Payload serves media through signed URLs by default, but the sample config marks uploads as `public-read`. To expose files directly, enable **Public access** on the bucket or front it with Cloudflare Workers for signed delivery. Adjust the ACL/policy if you prefer private objects.

5. **Test connectivity**
   - After deploying, upload a media item in the Payload admin. Confirm the file appears in the R2 bucket.
   - The file URL should resemble `https://<account-id>.r2.cloudflarestorage.com/marketing-media/uploads/<filename>` (or the custom domain if configured).

## 6. Neon database checklist

- Create a dedicated role and database for the CMS.
- Rotate the Neon password after initial setup and update both the Fly secret and local `.env`.
- Optionally enable [Neon connection pooling](https://neon.tech/docs/connect/connection-pooling) for better performance. Update `DATABASE_URL` to point at the pooled endpoint (`?sslmode=require&options=project%3D...`).

## 7. Local development tips

- `npm install` inside `/cms` to pull dependencies, then run `npm run dev` to boot the admin locally.
- When running locally against production services, copy `.env` and adjust `SITE_ORIGIN` to `http://localhost:3000` (your Remix dev server).
- Remember to use a separate Neon branch or database for local experimentation to avoid polluting production data.

## 8. Verification checklist

After deploying and configuring DNS + storage:

- `https://cms.getupsight.com/cms` loads the Payload admin login.
- `https://cms.getupsight.com/cms/api/posts` responds with JSON (likely empty initially).
- `https://getupsight.com/sitemap.xml` lists published posts (ensure at least one post is published).
- Uploading an image in the CMS results in an object in R2 under `uploads/`.

Once everything checks out, you’re ready to onboard content editors.
