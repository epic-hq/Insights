import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import payload from 'payload'

// Basic express server; Payload mounts at /cms
const app = express()
app.use(cors({ origin: process.env.SITE_ORIGIN || true, credentials: false }))

await payload.init({
  secret: process.env.PAYLOAD_SECRET,
  express: app,
  serverURL: process.env.CMS_PUBLIC_URL, // e.g., https://cms.getupsight.com
  // Postgres (Supabase)
  db: { adapter: 'postgres', url: process.env.DATABASE_URL, pool: { min: 0, max: 10 } },
  onInit: () => {
    console.log('✅ Payload CMS ready at', process.env.CMS_PUBLIC_URL || '/cms')
  },
  // Use local config file
  configPath: new URL('./payload.config.js', import.meta.url).pathname,
})

// Mount admin+REST API router at /cms
app.use('/cms', payload.expressRouter)

// Healthcheck for Fly
app.get('/health', (_, res) => res.status(200).send('ok'))

const PORT = process.env.PORT || 8080
app.listen(PORT, () => console.log(`CMS listening on :${PORT}`))
