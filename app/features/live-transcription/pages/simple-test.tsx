import { useState, useRef } from "react"
import { Button } from "~/components/ui/button"
import consola from "consola"

export default function SimpleAudioTest() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState("")
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    try {
      consola.log("Starting simple recording test...")
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
          consola.log("Audio chunk received:", event.data.size, "bytes")
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        consola.log("Recording stopped, blob size:", audioBlob.size)
        
        // Convert to base64 and send
        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1]
          
          try {
            const response = await fetch('/api/simple-audio-test', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioData: base64 })
            })
            
            const result = await response.json()
            consola.log("Server response:", result)
            setTranscript(result.transcript || "No transcription received")
          } catch (error) {
            consola.error("Failed to process audio:", error)
          }
        }
        reader.readAsDataURL(audioBlob)
        
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start(1000) // Collect data every second
      setIsRecording(true)
      consola.log("Recording started")
      
    } catch (error) {
      consola.error("Failed to start recording:", error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      consola.log("Stopping recording...")
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Simple Audio Test</h1>
      
      <div className="space-y-4">
        <div>
          {!isRecording ? (
            <Button onClick={startRecording}>Start Recording</Button>
          ) : (
            <Button onClick={stopRecording} variant="destructive">Stop Recording</Button>
          )}
        </div>
        
        {isRecording && (
          <div className="text-red-500">🔴 Recording...</div>
        )}
        
        {transcript && (
          <div className="p-4 bg-gray-100 rounded">
            <strong>Transcript:</strong> {transcript}
          </div>
        )}
      </div>
    </div>
  )
}