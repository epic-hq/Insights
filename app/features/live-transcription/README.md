# Live Transcription Feature

Real-time audio transcription with entity recognition and sliding window analysis using AssemblyAI and LeMUR.

## Architecture

### Backend Components

- **`assemblyai-streaming.server.ts`**: WebSocket client for real-time audio streaming to AssemblyAI
- **`lemur-analysis.server.ts`**: Entity extraction and sliding window analysis using LeMUR
- **`api.live-transcription.tsx`**: API route for managing live transcription sessions

### Frontend Components

- **`pages/index.tsx`**: Main live transcription interface with controls and real-time display

### Database Integration

The feature integrates with your existing interview pipeline:

1. **Live Session**: Temporary in-memory storage during recording
2. **Save as Interview**: Converts live session to permanent interview record
3. **Analysis Pipeline**: Can trigger full interview analysis using existing `processInterview` pipeline

## Features

### Real-time Transcription
- Live audio capture from microphone
- Streaming to AssemblyAI WebSocket API
- Real-time display of partial and final transcripts

### Entity Recognition
- Real-time entity extraction using LeMUR
- Support for: people, organizations, locations, topics, pain points, needs, emotions
- Confidence scoring and context

### Sliding Window Analysis
- Configurable window sizes (30s, 1min, 2min, 5min)
- Continuous analysis of transcript segments
- Key insights, sentiment analysis, topic detection

### Integration with Existing Pipeline
- Save sessions as interviews
- Trigger full analysis pipeline
- Project association and custom instructions

## Usage

1. Navigate to `/a/{accountId}/{projectId}/live-transcription`
2. Configure project, window size, and custom instructions
3. Start recording session
4. Monitor real-time transcription and entity extraction
5. Optionally save as interview for full analysis

## Configuration

### Environment Variables
- `ASSEMBLYAI_API_KEY`: Required for streaming and LeMUR analysis

### Window Sizes
- 30 seconds: Quick entity detection
- 1 minute: Balanced performance and insight depth
- 2 minutes: Deeper context analysis
- 5 minutes: Comprehensive insight extraction

## Technical Notes

### WebSocket Implementation
- Uses native WebSocket API for real-time communication
- Handles reconnection and error states
- Audio processing at 16kHz PCM format

### Entity Extraction
- Uses LeMUR's Claude-3.5-Sonnet for comprehensive analysis
- Claude-3-Haiku for fast real-time entity detection
- Structured JSON responses with confidence scoring

### Memory Management
- In-memory session storage (consider Redis for production)
- Automatic cleanup of inactive sessions
- Sliding window buffer management

### Performance Optimizations
- Separate partial/final transcript handling
- Batched entity updates
- Progressive enhancement for real-time features

## Future Enhancements

1. **WebSocket Integration**: Full bidirectional WebSocket support
2. **Redis Storage**: Persistent session storage for scalability
3. **Speaker Detection**: Multi-participant conversation support
4. **Audio Quality**: Enhanced noise cancellation and processing
5. **Export Options**: Multiple format exports (JSON, CSV, PDF)
6. **Integration**: Connect with existing interview templates and workflows