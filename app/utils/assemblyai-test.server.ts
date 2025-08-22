import { AssemblyAI } from "assemblyai"
import consola from "consola"

// Simple test to verify AssemblyAI connection and API key
export async function testAssemblyAIConnection(apiKey: string) {
  try {
    consola.log("Testing AssemblyAI connection with API key:", apiKey.substring(0, 8) + "...")
    
    const client = new AssemblyAI({ apiKey })
    
    // Test 1: Try to create a transcriber (lightweight test)
    consola.log("Creating streaming transcriber...")
    
    const transcriber = client.streaming.transcriber({
      sampleRate: 16000,
    })
    
    let connectionOpened = false
    let connectionError = null
    
    // Set up event handlers
    transcriber.on("open", (data: any) => {
      consola.log("✅ AssemblyAI connection opened successfully:", data)
      connectionOpened = true
    })
    
    transcriber.on("error", (error: Error) => {
      consola.error("❌ AssemblyAI connection error:", error)
      connectionError = error
    })
    
    transcriber.on("close", (code: number, reason: string) => {
      consola.log("AssemblyAI connection closed:", { code, reason })
    })
    
    // Try to connect
    consola.log("Attempting to connect to AssemblyAI...")
    await transcriber.connect()
    
    // Give it a moment to establish connection
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    if (connectionOpened) {
      consola.log("✅ AssemblyAI connection test passed!")
      await transcriber.close()
      return { success: true, message: "Connection successful" }
    } else if (connectionError) {
      throw connectionError
    } else {
      throw new Error("Connection did not open within timeout")
    }
    
  } catch (error) {
    consola.error("❌ AssemblyAI connection test failed:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }
  }
}