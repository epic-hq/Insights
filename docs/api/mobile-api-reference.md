# Upsight Mobile API Reference

This document provides API endpoint specifications for the React Native mobile app integration with the Upsight backend. The API follows REST conventions and uses Supabase for authentication.

## Table of Contents

1. [Environment Configuration](#environment-configuration)
2. [Authentication (Google OAuth)](#authentication-google-oauth)
3. [Project Status Agent Chat](#project-status-agent-chat)
4. [Content Upload APIs](#content-upload-apis)
   - [Upload Recording/Interview](#upload-recordinginterview)
   - [Upload Voice Memo](#upload-voice-memo)
   - [Add Note](#add-note)
   - [Quick Record](#quick-record)
5. [CRM APIs](#crm-apis)
   - [People](#people)
   - [Organizations](#organizations)
   - [Opportunities](#opportunities)

---

## Environment Configuration

### Required Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `SUPABASE_URL` | Supabase project URL | ✅ | `https://your-project.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public key | ✅ | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

### Client-Side Configuration

```typescript
// React Native Supabase client setup
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // Important for React Native
      flowType: 'pkce', // Required for OAuth
    },
  }
)
```

---

## Authentication (Google OAuth)

Upsight uses Supabase Auth with Google OAuth provider using PKCE flow for secure mobile authentication.

### OAuth Flow Overview

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Mobile App     │────▶│  Google OAuth   │────▶│  Supabase Auth  │
│  (React Native) │◀────│  Consent Screen │◀────│  Token Exchange │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 1. Initiate Google OAuth Sign-In

#### Client-Side (React Native)

```typescript
import { makeRedirectUri } from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'

// For Expo apps
const redirectUri = makeRedirectUri({
  scheme: 'your-app-scheme',
  path: 'auth/callback',
})

async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUri,
      skipBrowserRedirect: true, // Handle redirect manually in RN
    },
  })

  if (data?.url) {
    // Open browser for OAuth
    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectUri
    )

    if (result.type === 'success') {
      // Extract the URL and handle the callback
      const url = result.url
      await supabase.auth.exchangeCodeForSession(extractCodeFromUrl(url))
    }
  }
}
```

### 2. OAuth Callback Endpoint

**Endpoint:** `GET /auth/callback`

This endpoint handles the OAuth callback from Google and exchanges the authorization code for a session.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | string | Authorization code from OAuth provider |
| `next` | string | (Optional) Redirect path after successful auth. Default: `/home` |
| `error` | string | (Optional) Error message if OAuth failed |

**Response:**

- On success: Redirects to `/login_success?next={next}` with session cookies
- On error: Redirects to `/login_failure`

### 3. Login Success Handler

**Endpoint:** `GET /login_success`

Handles post-authentication setup including:
- User account verification
- Default project creation for new users
- UTM parameter tracking
- PostHog analytics events

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `next` | string | (Optional) Final redirect destination |

**Response:**

- Redirects to the appropriate project dashboard or specified `next` path

### 4. Get Current Session

#### Client-Side

```typescript
// Get current session
const { data: { session }, error } = await supabase.auth.getSession()

// Get current user
const { data: { user }, error } = await supabase.auth.getUser()

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    // User signed in
  } else if (event === 'SIGNED_OUT') {
    // User signed out
  }
})
```

### 5. Sign Out

**Endpoint:** `GET /auth/signout`

#### Client-Side

```typescript
const { error } = await supabase.auth.signOut()
```

### Authentication Headers

For all authenticated API requests, include the JWT token:

```typescript
const { data: { session } } = await supabase.auth.getSession()

fetch(apiUrl, {
  headers: {
    'Authorization': `Bearer ${session?.access_token}`,
    'Content-Type': 'application/json',
  },
})
```

---

## Project Status Agent Chat

The Project Status Agent is an AI-powered assistant that helps users understand project traction, customer discovery, and sales fit.

### Base URL Pattern

```text
/a/{accountId}/{projectId}/api/chat/project-status
```

### 1. Send Chat Message

**Endpoint:** `POST /a/{accountId}/{projectId}/api/chat/project-status`

**Headers:**

| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer {access_token}` | ✅ |
| `Content-Type` | `application/json` | ✅ |

**Request Body:**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "What's the current status of customer discovery?"
    }
  ],
  "system": "Optional system context from the UI"
}
```

**Request Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `messages` | array | Array of message objects with `role` and `content` |
| `messages[].role` | string | Either `"user"` or `"assistant"` |
| `messages[].content` | string | The message content |
| `system` | string | (Optional) Additional context from the current UI view |

**Response:**

Returns a streaming response using the AI SDK data stream format.

```typescript
// Example client-side consumption
import { useChat } from 'ai/react'

const { messages, input, handleInputChange, handleSubmit } = useChat({
  api: `/a/${accountId}/${projectId}/api/chat/project-status`,
})
```

**Response Format (Streaming):**

The response is a Server-Sent Events (SSE) stream with the following event types:

```text
data: {"type":"text-delta","textDelta":"Hello"}
data: {"type":"text-delta","textDelta":" world"}
data: {"type":"finish","finishReason":"stop"}
```

### 2. Get Chat History

**Endpoint:** `GET /a/{accountId}/{projectId}/api/chat/project-status/history`

**Headers:**

| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer {access_token}` | ✅ |

**Response:**

```json
{
  "messages": [
    {
      "id": "msg_123",
      "role": "user",
      "content": "What's the project status?",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": "msg_124",
      "role": "assistant",
      "content": "Based on the current data...",
      "createdAt": "2024-01-15T10:30:05Z"
    }
  ]
}
```

### Agent Capabilities

The Project Status Agent has access to the following tools:

| Tool | Description |
|------|-------------|
| `fetchProjectStatusContext` | Load project data (insights, evidence, themes, etc.) |
| `fetchPeopleDetails` | Get comprehensive person details |
| `fetchPersonas` | Get persona definitions |
| `fetchEvidence` | Get evidence records |
| `fetchOpportunities` | Get sales opportunities |
| `fetchThemes` | Get research themes |
| `fetchSegments` | Get customer segments |
| `semanticSearchEvidence` | Search evidence by topic |
| `semanticSearchPeople` | Search people by traits |
| `createOpportunity` | Create new sales opportunity |
| `updateOpportunity` | Update existing opportunity |
| `upsertPerson` | Create or update person record |
| `manageDocuments` | Save project documents |
| `manageAnnotations` | Add notes to entities |

---

## Content Upload APIs

These endpoints allow uploading audio/video recordings, voice memos, and text notes to be processed and analyzed.

### Upload Recording/Interview

Upload an audio or video file for full transcription and AI analysis (insight extraction, evidence creation, etc.).

**Endpoint:** `POST /api/upload-file`

**Headers:**

| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer {access_token}` | ✅ |
| `Content-Type` | `multipart/form-data` | ✅ |

**Form Data:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | ✅ | Audio/video file (mp3, mp4, m4a, wav, webm, mov, etc.) or text file (.txt, .md) |
| `projectId` | string (UUID) | ✅ | Project ID to associate the interview with |
| `userCustomInstructions` | string | | Custom instructions for AI analysis |

**Supported File Types:**

- **Audio:** mp3, m4a, wav, aac, ogg, flac, wma
- **Video:** mp4, mov, avi, mkv, webm
- **Text:** txt, md, markdown

**Response:**

```json
{
  "success": true,
  "insights": [...],
  "interviewId": "uuid"
}
```

**Processing Flow:**

1. File is uploaded and stored in Cloudflare R2
2. Audio/video files are sent to AssemblyAI for transcription
3. Transcript is processed by AI to extract insights, evidence, and metadata
4. Interview record is created with status progression: `uploading` → `transcribed` → `processing` → `ready`

**Error Response:**

```json
{
  "error": "Error message description"
}
```

### Upload Voice Memo

Upload a voice memo for transcription only (no AI analysis). Useful for quick audio notes.

**Endpoint:** `POST /api/onboarding-start`

**Headers:**

| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer {access_token}` | ✅ |
| `Content-Type` | `multipart/form-data` | ✅ |

**Form Data:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | ✅ | Audio file (mp3, m4a, wav, etc.) |
| `projectId` | string (UUID) | | Project ID (optional - will use last used or create new) |
| `onboardingData` | string (JSON) | ✅ | JSON object with `mediaType: "voice_memo"` |

**Example Request:**

```typescript
const formData = new FormData()
formData.append('file', audioFile)
formData.append('projectId', projectId)
formData.append('onboardingData', JSON.stringify({
  mediaType: 'voice_memo',
  questions: [],
}))

const response = await fetch('/api/onboarding-start', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData,
})
```

**Response:**

```json
{
  "success": true,
  "interviewId": "uuid",
  "projectId": "uuid",
  "status": "transcribing",
  "message": "Voice memo is being transcribed"
}
```

**Processing Flow:**

1. Audio file is stored in Cloudflare R2
2. File is sent to AssemblyAI for transcription
3. Webhook callback updates interview with transcript when complete
4. Status progression: `uploaded` → `transcribing` → `ready`

### Add Note

Create a text note (meeting notes, observation, insight, follow-up) without any file upload.

**Endpoint:** `POST /api/notes/create`

**Headers:**

| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer {access_token}` | ✅ |
| `Content-Type` | `application/json` | ✅ |

**Request Body:**

```json
{
  "projectId": "uuid",
  "title": "Meeting with John - Product Feedback",
  "content": "Key points from the meeting:\n- User wants faster onboarding\n- Pricing is a concern\n- Loves the AI features",
  "noteType": "meeting_notes",
  "associations": {
    "personId": "uuid",
    "organizationId": "uuid"
  },
  "tags": ["feedback", "pricing", "onboarding"]
}
```

**Request Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string (UUID) | ✅ | Project ID |
| `content` | string | ✅ | Note content (markdown supported) |
| `title` | string | | Note title (auto-generated if not provided) |
| `noteType` | string | | Type: `meeting_notes`, `observation`, `insight`, `followup` |
| `associations` | object | | Link to person, organization, or opportunity |
| `tags` | string[] | | Tags for categorization |

**Response:**

```json
{
  "success": true,
  "id": "uuid",
  "message": "Note saved successfully"
}
```

### Quick Record

Create a new project and interview record for immediate recording. Useful for "Record Now" functionality.

**Endpoint:** `POST /a/{accountId}/api/interviews/record-now`

**Headers:**

| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer {access_token}` | ✅ |

**Request Body:** None required

**Response:**

```json
{
  "projectId": "uuid",
  "interviewId": "uuid"
}
```

**Usage:**

This endpoint creates:
1. A new project named "Quick Interview {timestamp}"
2. An interview record in `transcribing` status

After receiving the response, the mobile app should:
1. Start recording audio
2. When recording is complete, upload the file using the Upload Recording endpoint with the returned `projectId`

---

## CRM APIs

All CRM endpoints are project-scoped and require authentication. The base URL pattern is:

```text
/a/{accountId}/{projectId}/{resource}
```

### People

#### List People

**Endpoint:** `GET /a/{accountId}/{projectId}/people`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `scope` | string | `"project"` (default) or `"account"` |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "John Doe",
      "title": "Product Manager",
      "company": "Acme Corp",
      "primary_email": "john@acme.com",
      "primary_phone": "+1-555-0123",
      "segment": "Enterprise",
      "image_url": "https://...",
      "linkedin_url": "https://linkedin.com/in/johndoe",
      "location": "San Francisco, CA",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "people_personas": [
        {
          "personas": {
            "id": "uuid",
            "name": "Enterprise Buyer",
            "color_hex": "#4F46E5"
          },
          "confidence_score": 0.85,
          "source": "ai_assigned"
        }
      ],
      "people_organizations": [
        {
          "id": "uuid",
          "role": "Product Manager",
          "is_primary": true,
          "organization": {
            "id": "uuid",
            "name": "Acme Corp",
            "industry": "Technology"
          }
        }
      ]
    }
  ]
}
```

#### Get Person by ID

**Endpoint:** `GET /a/{accountId}/{projectId}/people/{personId}`

**Response:** Single person object with full details including:

- Basic info (name, title, contact info)
- Personas (via `people_personas` junction)
- Organizations (via `people_organizations` junction)
- Facets (via `person_facet`)
- Interview history (via `interview_people`)

#### Create Person

**Endpoint:** `POST /a/{accountId}/{projectId}/people/new`

**Request Body:**

```json
{
  "name": "Jane Smith",
  "title": "CTO",
  "company": "TechCorp",
  "primary_email": "jane@techcorp.com",
  "primary_phone": "+1-555-0456",
  "segment": "SMB",
  "location": "New York, NY",
  "linkedin_url": "https://linkedin.com/in/janesmith",
  "description": "Technical decision maker"
}
```

**Person Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Full name |
| `firstname` | string | | First name |
| `lastname` | string | | Last name |
| `title` | string | | Job title |
| `company` | string | | Company name |
| `primary_email` | string | | Email address |
| `primary_phone` | string | | Phone number |
| `segment` | string | | Customer segment |
| `location` | string | | Geographic location |
| `linkedin_url` | string | | LinkedIn profile URL |
| `website_url` | string | | Personal website |
| `image_url` | string | | Profile image URL |
| `description` | string | | Notes/description |
| `role` | string | | Role in organization |
| `industry` | string | | Industry |
| `seniority_level` | string | | Seniority level |
| `job_function` | string | | Job function |
| `age` | number | | Age |
| `age_range` | string | | Age range (e.g., "25-34") |
| `gender` | string | | Gender |
| `pronouns` | string | | Preferred pronouns |
| `timezone` | string | | Timezone |
| `languages` | string[] | | Languages spoken |
| `education` | string | | Education background |
| `income` | number | | Income level |
| `life_stage` | string | | Life stage |
| `lifecycle_stage` | string | | Customer lifecycle stage |
| `preferences` | string | | Preferences |
| `contact_info` | object | | Additional contact info (JSON) |

#### Update Person

**Endpoint:** `POST /a/{accountId}/{projectId}/people/{personId}/edit`

**Request Body:** Same as Create Person (partial updates supported)

#### Delete Person

**Endpoint:** `POST /a/{accountId}/{projectId}/people/{personId}/edit`

**Request Body:**

```json
{
  "_action": "delete"
}
```

---

### Organizations

#### List Organizations

**Endpoint:** `GET /a/{accountId}/{projectId}/organizations`

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Acme Corporation",
      "domain": "acme.com",
      "website_url": "https://acme.com",
      "industry": "Technology",
      "size_range": "51-200",
      "headquarters_location": "San Francisco, CA",
      "annual_revenue": 10000000,
      "employee_count": 150,
      "description": "Enterprise software company",
      "lifecycle_stage": "customer",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "people_organizations": [
        {
          "id": "uuid",
          "role": "CTO",
          "is_primary": true,
          "person": {
            "id": "uuid",
            "name": "John Doe",
            "image_url": "https://..."
          }
        }
      ]
    }
  ]
}
```

#### Get Organization by ID

**Endpoint:** `GET /a/{accountId}/{projectId}/organizations/{organizationId}`

**Response:** Single organization object with full details including linked people.

#### Create Organization

**Endpoint:** `POST /a/{accountId}/{projectId}/organizations/new`

**Request Body:**

```json
{
  "name": "TechCorp Inc",
  "domain": "techcorp.com",
  "website_url": "https://techcorp.com",
  "industry": "Software",
  "size_range": "201-500",
  "headquarters_location": "Austin, TX",
  "description": "B2B SaaS company"
}
```

**Organization Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Organization name |
| `legal_name` | string | | Legal entity name |
| `domain` | string | | Primary domain |
| `website_url` | string | | Website URL |
| `industry` | string | | Industry |
| `sub_industry` | string | | Sub-industry |
| `size_range` | string | | Size range (e.g., "51-200") |
| `employee_count` | number | | Number of employees |
| `annual_revenue` | number | | Annual revenue |
| `headquarters_location` | string | | HQ location |
| `company_type` | string | | Company type |
| `description` | string | | Description |
| `notes` | string | | Internal notes |
| `email` | string | | Contact email |
| `phone` | string | | Contact phone |
| `linkedin_url` | string | | LinkedIn URL |
| `twitter_url` | string | | Twitter URL |
| `timezone` | string | | Timezone |
| `lifecycle_stage` | string | | Lifecycle stage |
| `tags` | string[] | | Tags |
| `billing_address` | object | | Billing address (JSON) |
| `shipping_address` | object | | Shipping address (JSON) |
| `crm_external_id` | string | | External CRM ID |
| `parent_organization_id` | string | | Parent org ID |
| `primary_contact_id` | string | | Primary contact person ID |

#### Update Organization

**Endpoint:** `POST /a/{accountId}/{projectId}/organizations/{organizationId}/edit`

**Request Body:** Same as Create Organization (partial updates supported)

#### Link Person to Organization

**Endpoint:** `POST /a/{accountId}/{projectId}/organizations/{organizationId}/link-person`

**Request Body:**

```json
{
  "personId": "uuid",
  "role": "CTO",
  "relationshipStatus": "active",
  "isPrimary": true,
  "notes": "Key decision maker"
}
```

---

### Opportunities

#### List Opportunities

**Endpoint:** `GET /a/{accountId}/{projectId}/opportunities`

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Enterprise Deal - Acme Corp",
      "description": "Annual contract for enterprise tier",
      "stage": "negotiation",
      "amount": 50000,
      "currency": "USD",
      "close_date": "2024-03-31",
      "confidence": 0.75,
      "source": "inbound",
      "next_step": "Send proposal",
      "next_step_due": "2024-01-20",
      "kanban_status": "in_progress",
      "forecast_category": "commit",
      "organization_id": "uuid",
      "primary_contact_id": "uuid",
      "owner_id": "uuid",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "metadata": {}
    }
  ]
}
```

#### Get Opportunity by ID

**Endpoint:** `GET /a/{accountId}/{projectId}/opportunities/{opportunityId}`

**Response:** Single opportunity object with full details.

#### Create Opportunity

**Endpoint:** `POST /a/{accountId}/{projectId}/opportunities/new`

**Request Body:**

```json
{
  "title": "New Enterprise Deal",
  "description": "Potential annual contract",
  "stage": "discovery",
  "amount": 25000,
  "currency": "USD",
  "close_date": "2024-06-30",
  "confidence": 0.5,
  "source": "referral",
  "organization_id": "uuid",
  "primary_contact_id": "uuid"
}
```

**Opportunity Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | ✅ | Opportunity title |
| `description` | string | | Description |
| `stage` | string | | Sales stage (e.g., "discovery", "negotiation", "closed_won") |
| `amount` | number | | Deal value |
| `currency` | string | | Currency code (default: "USD") |
| `close_date` | string | | Expected close date (ISO 8601) |
| `confidence` | number | | Win probability (0-1) |
| `source` | string | | Lead source |
| `next_step` | string | | Next action item |
| `next_step_due` | string | | Next step due date (ISO 8601) |
| `kanban_status` | string | | Kanban board status |
| `forecast_category` | string | | Forecast category |
| `organization_id` | string | | Linked organization ID |
| `primary_contact_id` | string | | Primary contact person ID |
| `owner_id` | string | | Opportunity owner user ID |
| `related_insight_ids` | string[] | | Related insight IDs |
| `crm_external_id` | string | | External CRM ID |
| `metadata` | object | | Additional metadata (JSON) |

#### Update Opportunity

**Endpoint:** `POST /a/{accountId}/{projectId}/opportunities/{opportunityId}/edit`

**Request Body:** Same as Create Opportunity (partial updates supported)

#### Delete Opportunity

**Endpoint:** `POST /a/{accountId}/{projectId}/opportunities/{opportunityId}/edit`

**Request Body:**

```json
{
  "_action": "delete"
}
```

---

## Error Handling

All endpoints return standard HTTP status codes:

| Status | Description |
|--------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request - Invalid input |
| `401` | Unauthorized - Invalid or missing token |
| `403` | Forbidden - Insufficient permissions |
| `404` | Not Found - Resource doesn't exist |
| `500` | Internal Server Error |

**Error Response Format:**

```json
{
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": {}
}
```

---

## Rate Limiting

The API uses Supabase's built-in rate limiting. Be mindful of:

- Authentication endpoints: Avoid excessive `getUser()` calls
- Use session caching on the client side
- Batch operations when possible

---

## OpenAPI/Swagger Specification

For a machine-readable API specification, the following OpenAPI 3.0 schema can be used:

```yaml
openapi: 3.0.3
info:
  title: Upsight Mobile API
  version: 1.0.0
  description: API for Upsight React Native mobile app

servers:
  - url: https://getupsight.com
    description: Production
  - url: http://localhost:5173
    description: Development

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Person:
      type: object
      required:
        - name
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        title:
          type: string
        company:
          type: string
        primary_email:
          type: string
          format: email
        primary_phone:
          type: string
        segment:
          type: string
        location:
          type: string
        linkedin_url:
          type: string
          format: uri
        image_url:
          type: string
          format: uri
        description:
          type: string

    Organization:
      type: object
      required:
        - name
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        domain:
          type: string
        website_url:
          type: string
          format: uri
        industry:
          type: string
        size_range:
          type: string
        headquarters_location:
          type: string
        annual_revenue:
          type: number
        employee_count:
          type: integer

    Opportunity:
      type: object
      required:
        - title
      properties:
        id:
          type: string
          format: uuid
        title:
          type: string
        description:
          type: string
        stage:
          type: string
        amount:
          type: number
        currency:
          type: string
        close_date:
          type: string
          format: date
        confidence:
          type: number
          minimum: 0
          maximum: 1
        organization_id:
          type: string
          format: uuid
        primary_contact_id:
          type: string
          format: uuid

    ChatMessage:
      type: object
      required:
        - role
        - content
      properties:
        role:
          type: string
          enum: [user, assistant]
        content:
          type: string

paths:
  /auth/callback:
    get:
      summary: OAuth callback handler
      parameters:
        - name: code
          in: query
          schema:
            type: string
        - name: next
          in: query
          schema:
            type: string
      responses:
        '302':
          description: Redirect to login success or failure

  /a/{accountId}/{projectId}/api/chat/project-status:
    post:
      summary: Send message to Project Status Agent
      security:
        - bearerAuth: []
      parameters:
        - name: accountId
          in: path
          required: true
          schema:
            type: string
        - name: projectId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                messages:
                  type: array
                  items:
                    $ref: '#/components/schemas/ChatMessage'
                system:
                  type: string
      responses:
        '200':
          description: Streaming response

  /a/{accountId}/{projectId}/people:
    get:
      summary: List people
      security:
        - bearerAuth: []
      parameters:
        - name: accountId
          in: path
          required: true
          schema:
            type: string
        - name: projectId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: List of people
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Person'

  /a/{accountId}/{projectId}/organizations:
    get:
      summary: List organizations
      security:
        - bearerAuth: []
      responses:
        '200':
          description: List of organizations

  /a/{accountId}/{projectId}/opportunities:
    get:
      summary: List opportunities
      security:
        - bearerAuth: []
      responses:
        '200':
          description: List of opportunities
```

---

## Quick Start Example

```typescript
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Sign in with Google
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
})

// After authentication, make API calls
const session = await supabase.auth.getSession()
const token = session.data.session?.access_token

// Fetch people
const response = await fetch(
  `${API_BASE}/a/${accountId}/${projectId}/people`,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  }
)
const people = await response.json()

// Chat with Project Status Agent
const chatResponse = await fetch(
  `${API_BASE}/a/${accountId}/${projectId}/api/chat/project-status`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'What is the project status?' }],
    }),
  }
)
// Handle streaming response...
```
