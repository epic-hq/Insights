import { AssemblyAI } from "assemblyai"
import consola from "consola"

interface StreamingConfig {
  sampleRate: number
  wordBoost?: string[]
  encoding?: "pcm_s16le" | "pcm_mulaw"
}

interface TranscriptEvent {
  message_type?: string
  text?: string
  words?: Array<{
    text: string
    start: number
    end: number
    confidence: number
  }>
  audio_start?: number
  audio_end?: number
  confidence?: number
  created?: string
}

export class AssemblyAIStreaming {
  private client: AssemblyAI
  private transcriber: any = null
  private isConnected = false
  private messageHandlers: Map<string, (data: any) => void> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3

  constructor(
    private apiKey: string,
    private config: StreamingConfig = {
      sampleRate: 16000,
      encoding: "pcm_s16le"
    }
  ) {
    if (!apiKey) {
      throw new Error("AssemblyAI API key is required")
    }
    
    this.client = new AssemblyAI({
      apiKey: apiKey
    })
  }

  async connect(): Promise<void> {
    try {
      consola.log("Connecting to AssemblyAI streaming service...")
      consola.log("API Key check:", this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'NOT SET')
      consola.log("Config:", this.config)
      
      // Create streaming transcriber using official SDK
      this.transcriber = this.client.streaming.transcriber({
        sampleRate: this.config.sampleRate,
        encoding: this.config.encoding
      })
      
      consola.log("Transcriber created, setting up event handlers...")

      // Set up event handlers
      this.transcriber.on("open", ({ id, expires_at }: any) => {
        consola.log("✅ AssemblyAI session opened:", { id, expires_at })
        this.isConnected = true
        this.reconnectAttempts = 0
        this.emit("session_begins", { session_id: id, expires_at })
      })

      this.transcriber.on("close", (code: number, reason: string) => {
        consola.log("❌ AssemblyAI session closed:", { code, reason })
        this.isConnected = false
        this.emit("session_terminated", { code, reason })
        
        // Auto-reconnect on unexpected close
        if (code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          consola.log(`🔄 Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`)
          setTimeout(() => this.connect().catch(consola.error), 2000)
        }
      })

      this.transcriber.on("transcript", ({ message_type, text, confidence, words }: any) => {
        if (message_type === "FinalTranscript") {
          consola.log("📝 Final transcript received:", text)
          this.emit("final_transcript", { text, confidence, words })
        } else if (message_type === "PartialTranscript") {
          consola.log("📝 Partial transcript received:", text?.substring(0, 50) + "...")
          this.emit("partial_transcript", { text, confidence, words })
        }
      })

      this.transcriber.on("error", (error: Error) => {
        consola.error("❌ AssemblyAI streaming error:", error)
        consola.error("Error stack:", error.stack)
        this.isConnected = false
        this.emit("error", { error: error.message })
      })

      consola.log("Event handlers set up, attempting connection...")

      // Connect to AssemblyAI
      await this.transcriber.connect()
      consola.log("✅ AssemblyAI connection command completed")
      
      // Wait for connection to establish
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error("Connection timeout - AssemblyAI did not respond"))
          }
        }, 10000) // 10 second timeout
        
        const checkConnection = () => {
          if (this.isConnected) {
            clearTimeout(timeout)
            resolve(void 0)
          } else {
            setTimeout(checkConnection, 100)
          }
        }
        checkConnection()
      })
      
      consola.log("✅ Successfully connected to AssemblyAI streaming")
      
    } catch (error) {
      consola.error("❌ Failed to connect to AssemblyAI:", error)
      if (error instanceof Error) {
        consola.error("Error message:", error.message)
        consola.error("Error stack:", error.stack)
      }
      throw error
    }
  }

  sendAudio(audioData: Buffer) {
    if (!this.isConnected || !this.transcriber) {
      consola.warn("Cannot send audio - transcriber not connected")
      return false
    }

    try {
      // Validate audio data format
      if (!audioData || audioData.length === 0) {
        consola.warn("Empty audio data received")
        return false
      }
      
      // Send raw PCM audio data
      this.transcriber.sendAudio(audioData)
      return true
    } catch (error) {
      consola.error("Failed to send audio data:", error)
      this.isConnected = false
      return false
    }
  }

  async terminate() {
    if (this.transcriber) {
      try {
        await this.transcriber.close()
        consola.log("AssemblyAI streaming connection closed")
      } catch (error) {
        consola.error("Error closing AssemblyAI connection:", error)
      }
      this.transcriber = null
    }
    this.isConnected = false
  }

  on(event: string, handler: (data: any) => void) {
    this.messageHandlers.set(event, handler)
  }

  private emit(event: string, data: any) {
    const handler = this.messageHandlers.get(event)
    if (handler) {
      handler(data)
    }
  }

  get connected(): boolean {
    return this.isConnected
  }

  get session(): string | null {
    return this.transcriber?.sessionId || null
  }
}