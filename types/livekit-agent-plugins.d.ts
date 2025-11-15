declare module "@livekit/agents-plugin-assemblyai" {
        export function createAssemblyAITranscriber(options: { apiKey: string; model?: string }): any
}

declare module "@livekit/agents-plugin-openai" {
        export function createOpenAIRealtimeModel(options: { apiKey: string; model: string }): any
}

declare module "@livekit/agents-plugin-elevenlabs" {
        export function createElevenLabsSynthesizer(options: { apiKey: string; voiceId?: string }): any
}

declare module "@livekit/agents-plugin-turn-detection" {
        export class TimeoutTurnDetector {
                constructor(options: {
                        type: string
                        minVoiceDurationSeconds?: number
                        minSilenceDurationSeconds?: number
                        activationThreshold?: number
                })
        }
}
