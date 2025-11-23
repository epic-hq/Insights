declare module "@livekit/agents" {
        export const cli: any
        export const defineAgent: any
        export const voice: any
        export const metrics: any
        export const WorkerOptions: any
        export type JobProcess = any
        export type JobContext = any
}

declare module "@livekit/agents-plugin-livekit" {
        export const turnDetector: any
}

declare module "@livekit/agents-plugin-silero" {
        export const VAD: { load: () => Promise<unknown> }
}

declare module "@livekit/agents-plugin-openai" {
        export class LLM {
                constructor(config: any)
        }
}

declare module "@livekit/agents-plugin-deepgram" {
        export class STT {
                constructor(config: any)
        }

        export class TTS {
                constructor(config: any)
        }
}

declare module "@livekit/components-react" {
        export const LiveKitRoom: any
        export const RoomAudioRenderer: any
        export const ControlBar: any
}

declare module "@livekit/components-styles"

declare module "livekit-client" {
        export type ConnectionState = string
}

declare module "livekit-server-sdk" {
        export class AccessToken {
                constructor(apiKey: string, apiSecret: string, options?: { identity?: string; ttl?: number })
                addGrant(grant: {
                        room?: string
                        roomJoin?: boolean
                        canPublish?: boolean
                        canSubscribe?: boolean
                        canPublishData?: boolean
                }): void
                toJwt(): Promise<string>
        }
}
