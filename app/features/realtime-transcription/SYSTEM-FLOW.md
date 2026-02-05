# Realtime Transcription & Evidence Extraction System Flow

This document describes the two approaches for capturing and processing real-time conversations:

1. **Browser Prototype** - For quick demos and prototyping
2. **Desktop Electron App** - For production use with Recall.ai integration

## Architecture Comparison

```mermaid
flowchart TB
    subgraph Browser["Browser Prototype (Demo)"]
        direction TB
        B_Mic[Browser Microphone] --> B_Worklet[AudioWorklet PCM16]
        B_Worklet --> B_WS[WebSocket to Server]
        B_WS --> B_AAI[AssemblyAI Realtime STT]
        B_AAI --> B_Trans[Transcript Turns]
        B_Trans --> B_Extract[Evidence Extraction API]
        B_Extract --> B_UI[Live UI Display]

        B_Note[Note: Single audio stream<br/>Cannot distinguish speakers]
    end

    subgraph Desktop["Desktop Electron App (Production)"]
        direction TB
        D_Meet[Meeting Detected<br/>Zoom/Meet/Teams/Slack] --> D_SDK[Recall Desktop SDK]
        D_SDK --> D_Trans[Real-time Transcript<br/>with Speaker Names]
        D_SDK --> D_Capture[Audio + Video Capture]
        D_Trans --> D_Local[Local AI Summary]
        D_Capture --> D_Upload[Upload to Recall Cloud]
        D_Upload --> D_Webhook[Webhook to UpSight]
        D_Webhook --> D_Pipeline[Trigger.dev Pipeline]
        D_Pipeline --> D_Evidence[Evidence Extraction]
        D_Evidence --> D_DB[(Supabase)]

        D_Note[Note: Silent recording<br/>No bot joins meeting<br/>Speaker names from platform]
    end

    style B_Note fill:#ffeaa7,stroke:#fdcb6e
    style D_Note fill:#81ecec,stroke:#00cec9
```

## Detailed Flows

### Browser Prototype Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Server as UpSight Server
    participant AAI as AssemblyAI
    participant BAML as BAML Evidence

    User->>Browser: Click "Record"
    Browser->>Browser: Request microphone
    Browser->>Server: WebSocket connect /ws/realtime-transcribe
    Server->>AAI: WebSocket connect (proxy)

    loop During Recording
        Browser->>Browser: AudioWorklet captures PCM
        Browser->>Server: Send PCM16 audio chunks
        Server->>AAI: Forward audio
        AAI->>Server: Transcript turns
        Server->>Browser: Forward transcript
        Browser->>Browser: Display live transcript

        alt Every 4 turns or 2s idle
            Browser->>Server: POST /api/realtime-evidence
            Server->>BAML: Extract evidence
            BAML->>Server: Evidence + People
            Server->>Browser: Return evidence
            Browser->>Browser: Display evidence cards
        end
    end

    User->>Browser: Click "Stop"
    Browser->>Server: Close WebSocket
```

### Desktop Electron App Flow

```mermaid
sequenceDiagram
    participant User
    participant Desktop as UpSight Desktop
    participant RecallSDK as Recall SDK
    participant RecallCloud as Recall.ai Cloud
    participant Backend as UpSight Backend
    participant Trigger as Trigger.dev
    participant DB as Supabase

    User->>Desktop: Join meeting in Zoom/Meet/Teams
    RecallSDK-->>Desktop: "meeting-detected" event
    Desktop->>User: Show recording notification

    User->>Desktop: Click to record
    Desktop->>Backend: GET /api/desktop/context
    Backend->>Desktop: Account + Project info
    Desktop->>Backend: POST /api/desktop/recall-token
    Backend->>RecallCloud: Request upload token
    RecallCloud->>Backend: Upload token + metadata
    Backend->>Desktop: Token with embedded metadata

    Desktop->>RecallSDK: startRecording(uploadToken)

    loop During Meeting
        RecallSDK-->>Desktop: "realtime-event" transcript
        Desktop->>Desktop: Display live transcript
        RecallSDK-->>Desktop: "participant_events.join"
        Desktop->>Desktop: Track participants
    end

    User->>Desktop: End meeting / Click stop
    RecallSDK-->>Desktop: "recording-ended" event
    Desktop->>Desktop: Generate local AI summary
    Desktop->>RecallSDK: uploadRecording()
    RecallSDK->>RecallCloud: Upload video + transcript

    RecallCloud->>Backend: Webhook "sdk_upload.complete"
    Backend->>Backend: Verify signature
    Backend->>DB: Create interview record
    Backend->>Trigger: Trigger processRecallMeeting
    Trigger->>Trigger: Download media to R2
    Trigger->>Trigger: Transform Recall transcript
    Trigger->>Trigger: Extract evidence (BAML)
    Trigger->>DB: Save evidence + themes
```

## Key Differences

| Feature | Browser Prototype | Desktop App |
|---------|-------------------|-------------|
| **Recording Method** | Browser MediaRecorder | Recall Desktop SDK |
| **Meeting Support** | Any audio source | Zoom, Meet, Teams, Slack |
| **Bot Required?** | No | No (silent capture) |
| **Speaker Names** | Generic (SPEAKER A/B) | From meeting platform |
| **Real-time Transcript** | Yes (AssemblyAI) | Yes (Recall + Deepgram) |
| **Video Capture** | No | Yes |
| **Evidence Extraction** | Real-time in browser | Backend pipeline |
| **Persistence** | Demo only | Saved to database |
| **Local Summary** | No | Yes (OpenRouter) |

## URL Parameters (Browser Demo)

Access the browser prototype at `/realtime-demo` with optional params:

```
/realtime-demo?participants=Alice,Bob&projectId=xxx&interviewId=yyy
```

| Parameter | Description |
|-----------|-------------|
| `participants` | Comma-separated participant names to label speakers |
| `projectId` | Project ID for saving evidence to database |
| `interviewId` | Interview ID for linking evidence |

## When to Use Which

**Use Browser Prototype when:**
- Quick demos or prototyping
- Testing evidence extraction logic
- No desktop app installed
- Simple audio-only capture is sufficient

**Use Desktop App when:**
- Production usage
- Need speaker identification
- Need video recording
- Want seamless meeting platform integration
- Need persistent storage and full pipeline processing
