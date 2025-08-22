import consola from "consola"

interface LeMURRequest {
  transcript_ids?: string[]
  input_text?: string
  context?: string
  final_model?: "anthropic/claude-3-5-sonnet" | "anthropic/claude-3-haiku"
  max_output_size?: number
  temperature?: number
}

export interface ExtractedEntity {
  type: "person" | "organization" | "location" | "topic" | "key_phrase" | "pain_point" | "need" | "emotion"
  text: string
  confidence: number
  context?: string
  timestamp?: number
}

export interface WindowAnalysis {
  entities: ExtractedEntity[]
  key_insights: string[]
  sentiment: "positive" | "negative" | "neutral"
  topics: string[]
  summary: string
  timestamp: number
  window_start: number
  window_end: number
}

export class LeMURAnalyzer {
  private apiKey: string
  private baseUrl = "https://api.assemblyai.com/lemur/v3"

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("AssemblyAI API key is required")
    }
    this.apiKey = apiKey
  }

  /**
   * Analyze a window of transcript text for entities and insights
   */
  async analyzeWindow(
    text: string,
    windowStart: number,
    windowEnd: number,
    context?: string
  ): Promise<WindowAnalysis> {
    if (!text || text.trim().length === 0) {
      return this.getEmptyAnalysis(windowStart, windowEnd)
    }

    try {
      const prompt = this.buildAnalysisPrompt(text, context)
      
      const response = await fetch(`${this.baseUrl}/task`, {
        method: "POST",
        headers: {
          "Authorization": this.apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input_text: text,
          context: prompt,
          final_model: "anthropic/claude-3-5-sonnet",
          max_output_size: 4000,
          temperature: 0.1
        } as LeMURRequest)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`LeMUR API error: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      
      // Parse the structured response
      return this.parseAnalysisResult(result.response, windowStart, windowEnd)

    } catch (error) {
      consola.error("LeMUR analysis failed:", error)
      return this.getEmptyAnalysis(windowStart, windowEnd)
    }
  }

  /**
   * Quick entity extraction for real-time updates (lighter weight)
   */
  async extractEntities(text: string, timestamp: number): Promise<ExtractedEntity[]> {
    if (!text || text.trim().length === 0) {
      return []
    }

    try {
      const prompt = `Extract key entities from this transcript segment. Return ONLY a JSON array of entities with this structure:
[
  {
    "type": "person|organization|location|topic|key_phrase|pain_point|need|emotion",
    "text": "entity text",
    "confidence": 0.8,
    "context": "brief context"
  }
]

Transcript: "${text}"

Focus on:
- People mentioned (participants, customers, etc.)
- Organizations/companies
- Pain points and needs
- Key topics and themes
- Emotional responses
- Important phrases or quotes

Return valid JSON only:`

      const response = await fetch(`${this.baseUrl}/task`, {
        method: "POST",
        headers: {
          "Authorization": this.apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input_text: text,
          context: prompt,
          final_model: "anthropic/claude-3-haiku", // Faster model for real-time
          max_output_size: 2000,
          temperature: 0.1
        } as LeMURRequest)
      })

      if (!response.ok) {
        consola.warn("LeMUR entity extraction failed:", response.status)
        return []
      }

      const result = await response.json()
      
      // Parse JSON response
      try {
        const entities = JSON.parse(result.response)
        return entities.map((entity: any) => ({
          ...entity,
          timestamp
        }))
      } catch (parseError) {
        consola.warn("Failed to parse LeMUR entity response")
        return []
      }

    } catch (error) {
      consola.error("Entity extraction failed:", error)
      return []
    }
  }

  private buildAnalysisPrompt(text: string, context?: string): string {
    return `You are analyzing a segment of an interview transcript for user research insights. 

${context ? `Context: ${context}\n` : ''}

Please analyze this transcript segment and return a JSON object with the following structure:

{
  "entities": [
    {
      "type": "person|organization|location|topic|key_phrase|pain_point|need|emotion",
      "text": "entity text",
      "confidence": 0.8,
      "context": "brief context"
    }
  ],
  "key_insights": ["insight 1", "insight 2"],
  "sentiment": "positive|negative|neutral",
  "topics": ["topic1", "topic2"],
  "summary": "Brief 1-2 sentence summary of this segment"
}

Focus on extracting:
1. User needs, pain points, and motivations
2. Emotional responses and sentiment
3. Key people, organizations, and topics mentioned
4. Important quotes or phrases
5. Actionable insights for product development

Transcript segment: "${text}"

Return valid JSON only:`
  }

  private parseAnalysisResult(
    response: string, 
    windowStart: number, 
    windowEnd: number
  ): WindowAnalysis {
    try {
      const parsed = JSON.parse(response)
      
      return {
        entities: parsed.entities || [],
        key_insights: parsed.key_insights || [],
        sentiment: parsed.sentiment || "neutral",
        topics: parsed.topics || [],
        summary: parsed.summary || "",
        timestamp: Date.now(),
        window_start: windowStart,
        window_end: windowEnd
      }
    } catch (error) {
      consola.warn("Failed to parse LeMUR analysis result")
      return this.getEmptyAnalysis(windowStart, windowEnd)
    }
  }

  private getEmptyAnalysis(windowStart: number, windowEnd: number): WindowAnalysis {
    return {
      entities: [],
      key_insights: [],
      sentiment: "neutral",
      topics: [],
      summary: "",
      timestamp: Date.now(),
      window_start: windowStart,
      window_end: windowEnd
    }
  }
}

/**
 * Sliding window manager for processing transcript chunks
 */
export class SlidingWindowManager {
  private windows: Map<string, string> = new Map()
  private windowSize: number
  private overlapSize: number
  private lemur: LeMURAnalyzer

  constructor(
    apiKey: string,
    windowSizeSeconds: number = 60,
    overlapSeconds: number = 10
  ) {
    this.windowSize = windowSizeSeconds * 1000 // Convert to milliseconds
    this.overlapSize = overlapSeconds * 1000
    this.lemur = new LeMURAnalyzer(apiKey)
  }

  /**
   * Add transcript text with timestamp and get analysis for completed windows
   */
  async addTranscriptChunk(
    text: string,
    timestamp: number,
    isPartial: boolean = false
  ): Promise<{
    entities: ExtractedEntity[]
    completedWindows: WindowAnalysis[]
  }> {
    const results = {
      entities: [] as ExtractedEntity[],
      completedWindows: [] as WindowAnalysis[]
    }

    // Always extract entities from new text for real-time updates
    if (text && text.trim().length > 0) {
      results.entities = await this.lemur.extractEntities(text, timestamp)
    }

    // Only process full windows for complete transcripts
    if (!isPartial) {
      const windowKey = this.getWindowKey(timestamp)
      const existingWindow = this.windows.get(windowKey) || ""
      const updatedWindow = existingWindow + " " + text
      
      this.windows.set(windowKey, updatedWindow.trim())

      // Check if window is complete and ready for analysis
      if (this.isWindowComplete(timestamp)) {
        const windowAnalysis = await this.lemur.analyzeWindow(
          updatedWindow,
          timestamp - this.windowSize,
          timestamp
        )
        results.completedWindows.push(windowAnalysis)
        
        // Clean up old windows
        this.cleanupOldWindows(timestamp)
      }
    }

    return results
  }

  private getWindowKey(timestamp: number): string {
    const windowStart = Math.floor(timestamp / this.windowSize) * this.windowSize
    return `window_${windowStart}`
  }

  private isWindowComplete(timestamp: number): boolean {
    const windowStart = Math.floor(timestamp / this.windowSize) * this.windowSize
    return timestamp >= windowStart + this.windowSize
  }

  private cleanupOldWindows(currentTimestamp: number) {
    const cutoffTime = currentTimestamp - (this.windowSize * 3) // Keep 3 windows
    
    for (const [key] of this.windows) {
      const windowTime = parseInt(key.split('_')[1])
      if (windowTime < cutoffTime) {
        this.windows.delete(key)
      }
    }
  }

  /**
   * Update window size dynamically
   */
  setWindowSize(windowSizeSeconds: number, overlapSeconds: number = 10) {
    this.windowSize = windowSizeSeconds * 1000
    this.overlapSize = overlapSeconds * 1000
    // Clear existing windows as they're no longer valid
    this.windows.clear()
  }

  /**
   * Get current window configuration
   */
  getConfiguration() {
    return {
      windowSizeSeconds: this.windowSize / 1000,
      overlapSeconds: this.overlapSize / 1000,
      activeWindows: this.windows.size
    }
  }
}