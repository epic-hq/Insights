import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload/config'
import { Posts } from './src/collections/Posts.js'
import { Users } from './src/collections/Users.js'
import { Media } from './src/collections/Media.js'
import { cloudStorage } from '@payloadcms/plugin-cloud-storage'
import { S3Client } from '@aws-sdk/client-s3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const s3 = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,             // e.g., https://<ref>.supabase.co/storage/v1/s3
  forcePathStyle: true,                           // required for Supabase S3
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
})

export default buildConfig({
  serverURL: process.env.CMS_PUBLIC_URL,
  admin: { user: 'users', meta: { titleSuffix: ' · CMS' } },
  collections: [Users, Media, Posts],
  globals: [],
  csrf: [process.env.SITE_ORIGIN || 'http://localhost:3000'],
  cors: [process.env.SITE_ORIGIN || 'http://localhost:3000'],
  typescript: { outputFile: path.resolve(__dirname, 'payload-types.ts') },
  rateLimit: { trustProxy: true },
  plugins: [
    cloudStorage({
      collections: {
        media: {
          adapter: 's3',
          client: s3,
          bucket: process.env.S3_BUCKET,         // create in Supabase Storage
          prefix: 'uploads',                     // optional
          acl: 'public-read'
        },
      },
    }),
  ],
})
