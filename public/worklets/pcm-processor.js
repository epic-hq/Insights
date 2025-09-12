// Receives Float32 frames at AudioContext.sampleRate and posts them to main thread
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]
    if (!input || !input[0]) return true
    const channelData = input[0] // mono
    this.port.postMessage(channelData)
    return true
  }
}

registerProcessor("pcm-processor", PCMProcessor)

