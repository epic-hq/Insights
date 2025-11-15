declare module "@livekit/agents" {
        export interface RealtimePipeline {
                respond(text: string): Promise<void>
                setInstructions(prompt: string): Promise<void>
                on(event: string, handler: (...args: any[]) => void): void
                start(): Promise<void>
        }

        export interface AgentContext {
                room: {
                        localParticipant: {
                                publishData(data: Uint8Array, kind?: number): Promise<void>
                        }
                        on(event: "data", handler: (payload: Uint8Array) => void): void
                }
                job?: { metadata?: Record<string, unknown> }
                createPipeline(options: any): Promise<RealtimePipeline>
        }

        export interface JobMetadata {
                [key: string]: unknown
        }

        export interface DefineAgentOptions {
                name: string
                entry(context: AgentContext): Promise<void>
        }

        export function defineAgent(options: DefineAgentOptions): any

        export interface AgentRuntimeOptions {
                        url: string
                        apiKey: string
                        apiSecret: string
                        agents: any[]
        }

        export class AgentRuntime {
                constructor(options: AgentRuntimeOptions)
                start(): Promise<void>
                createJob(options: {
                        agent: any
                        roomName: string
                        token: string
                        metadata?: Record<string, unknown>
                }): Promise<void>
        }
}
