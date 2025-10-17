import { createHmac, randomUUID } from "node:crypto"
import { createReadStream, createWriteStream } from "node:fs"
import { unlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pipeline } from "node:stream/promises"
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { task } from "@trigger.dev/sdk/v3"
import { execa } from "execa"
import ffmpeg from "ffmpeg-static"

interface TranscodePayload {
        key: string
        mediaId: string
        accountId: string
        projectId: string
        userId: string
        profile?: string
}

function requireEnv(name: string) {
        const value = process.env[name]
        if (!value) {
                throw new Error(`Missing required environment variable: ${name}`)
        }
        return value
}

function toBase64Url(buffer: Buffer) {
        return buffer
                .toString("base64")
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=+$/u, "")
}

function makeSignedReadUrl(key: string, ttlSec: number) {
        const secret = requireEnv("SHARED_SIGNING_SECRET")
        const gateway = requireEnv("FILE_GATEWAY_URL").replace(/\/$/u, "")
        const exp = Math.floor(Date.now() / 1000) + ttlSec
        const payload = `${key}.${exp}`
        const signature = toBase64Url(createHmac("sha256", secret).update(payload).digest())
        return `${gateway}/r/${encodeURIComponent(key)}?exp=${exp}&sig=${signature}`
}

const s3Client = new S3Client({
        region: process.env.R2_REGION ?? "auto",
        endpoint: process.env.R2_S3_ENDPOINT,
        credentials: {
                accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
                secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
        },
})

const bucket = requireEnv("R2_BUCKET")

export const transcodeAudio = task({
        id: "transcode-audio",
        run: async ({ payload }) => {
                const { key, mediaId, accountId, projectId, userId, profile } = payload as TranscodePayload

                if (!ffmpeg) {
                        throw new Error("ffmpeg binary not found")
                }

                const inputPath = join(tmpdir(), `orig-${randomUUID()}`)
                const outputPath = join(tmpdir(), `proc-${randomUUID()}.mp3`)

                try {
                        const object = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
                        if (!object.Body) {
                                throw new Error(`Object not found for key ${key}`)
                        }

                        await pipeline(object.Body as NodeJS.ReadableStream, createWriteStream(inputPath))

                        const ffmpegArgs = [
                                "-hide_banner",
                                "-y",
                                "-i",
                                inputPath,
                                "-ac",
                                "1",
                                "-ar",
                                "16000",
                                "-b:a",
                                "32k",
                                outputPath,
                        ]

                        await execa(ffmpeg, ffmpegArgs)

                        const processedKey = key.replace(/^originals\//u, "processed/").replace(/\.[^.]+$/u, ".mp3")

                        await s3Client.send(
                                new PutObjectCommand({
                                        Bucket: bucket,
                                        Key: processedKey,
                                        Body: createReadStream(outputPath),
                                        ContentType: "audio/mpeg",
                                        Metadata: {
                                                profile: profile ?? process.env.TRANSCODE_PROFILE ?? "speech_mp3_low",
                                                mediaId,
                                                accountId,
                                                projectId,
                                                userId,
                                        },
                                }),
                        )

                        const transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
                                method: "POST",
                                headers: {
                                        authorization: requireEnv("AAI_API_KEY"),
                                        "content-type": "application/json",
                                },
                                body: JSON.stringify({
                                        audio_url: makeSignedReadUrl(processedKey, 3600),
                                        webhook_url: new URL(
                                                `/api/assemblyai-webhook?media_id=${encodeURIComponent(mediaId)}`,
                                                requireEnv("HOST"),
                                        ).toString(),
                                        speaker_labels: true,
                                }),
                        })

                        if (!transcriptResponse.ok) {
                                const errorText = await transcriptResponse.text()
                                throw new Error(`AssemblyAI request failed: ${transcriptResponse.status} ${errorText}`)
                        }

                        return {
                                processedKey,
                        }
                } finally {
                        await Promise.allSettled([
                                unlink(inputPath),
                                unlink(outputPath),
                        ])
                }
        },
})
