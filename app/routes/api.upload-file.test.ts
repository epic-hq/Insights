/**
 * Tests for api.upload-file route — PDF and TXT transcript upload support.
 *
 * Tests file type detection, text extraction, source type assignment,
 * and error handling for PDF/text uploads without hitting real services.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("consola", () => ({
  default: { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("~/features/people/services/internalPeople.server", () => ({
  ensureInterviewInterviewerLink: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/lib/database/project-answers.server", () => ({
  createPlannedAnswersForInterview: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/lib/feature-gate/check-limit.server", () => ({
  buildFeatureGateContext: vi.fn().mockResolvedValue({}),
  checkLimitAccess: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock("~/lib/supabase/client.server", () => ({
  getServerClient: vi.fn(),
}));

vi.mock("~/server/user-context", () => ({
  userContext: Symbol("userContext"),
}));

vi.mock("~/utils/assemblyai.server", () => ({
  transcribeAudioFromUrl: vi.fn(),
}));

vi.mock("~/utils/storeAudioFile.server", () => ({
  storeAudioFile: vi.fn().mockResolvedValue({
    mediaUrl: "https://r2.example.com/test.pdf",
    error: null,
  }),
}));

vi.mock("~/utils/transcript/sanitizeTranscriptData.server", () => ({
  safeSanitizeTranscriptPayload: vi.fn((input: Record<string, unknown>) => ({
    full_transcript: input.full_transcript,
    speaker_transcripts: [],
    topic_detection: null,
    sentiment_analysis_results: [],
  })),
}));

vi.mock("@trigger.dev/sdk", () => ({
  tasks: {
    trigger: vi.fn().mockResolvedValue({ id: "run-123" }),
  },
}));

// Dynamic import mock for pdf-parse
vi.mock("pdf-parse", () => ({
  default: vi.fn(),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { tasks } from "@trigger.dev/sdk";
import pdfParse from "pdf-parse";
import { action } from "./api.upload-file";
import { storeAudioFile } from "~/utils/storeAudioFile.server";
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server";

const mockPdfParse = vi.mocked(pdfParse);
const mockStoreAudioFile = vi.mocked(storeAudioFile);
const mockTrigger = vi.mocked(tasks.trigger);
const mockSanitize = vi.mocked(safeSanitizeTranscriptPayload);

// ── Helpers ──────────────────────────────────────────────────────────────────

const TEST_PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const TEST_ACCOUNT_ID = "00000000-0000-0000-0000-000000000002";
const TEST_INTERVIEW_ID = "00000000-0000-0000-0000-000000000099";

/** Build a chainable supabase mock that returns configurable data.
 *  Pre-creates table mocks so the same object is returned for repeated calls. */
function createMockSupabase(overrides: { interviewId?: string } = {}) {
  const interviewId = overrides.interviewId ?? TEST_INTERVIEW_ID;

  const updateChain = {
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  // Pre-create stable table mocks so assertions can reference them
  const projectsTable = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { account_id: TEST_ACCOUNT_ID },
          error: null,
        }),
      }),
    }),
  };

  const interviewsInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: { id: interviewId },
        error: null,
      }),
    }),
  });

  const interviewsTable = {
    insert: interviewsInsert,
    update: vi.fn().mockReturnValue(updateChain),
  };

  const fallbackTable = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
    update: vi.fn().mockReturnValue(updateChain),
  };

  const mock = {
    from: vi.fn((table: string) => {
      if (table === "projects") return projectsTable;
      if (table === "interviews") return interviewsTable;
      return fallbackTable;
    }),
    /** Direct access to the interviews insert spy for assertions */
    _interviewsInsert: interviewsInsert,
  };

  return mock;
}

function createMockContext(supabase?: ReturnType<typeof createMockSupabase>) {
  return {
    get: vi.fn().mockReturnValue({
      supabase: supabase ?? createMockSupabase(),
      claims: { sub: "test-user-id" },
      user_settings: null,
      user_metadata: null,
    }),
  };
}

function makeRequest(formData: FormData) {
  return new Request("http://localhost/api/upload-file", {
    method: "POST",
    body: formData,
  });
}

function makeFormData(file: File, projectId = TEST_PROJECT_ID) {
  const fd = new FormData();
  fd.set("file", file);
  fd.set("projectId", projectId);
  return fd;
}

// ── Sample content ───────────────────────────────────────────────────────────

const SAMPLE_TRANSCRIPT_TEXT = `Interviewer: Tell me about the onboarding experience.
Customer: The first week was rough. We couldn't figure out how to import our existing data.
Interviewer: What would have helped?
Customer: A simple CSV import wizard would have saved us hours. We ended up manually entering 200 contacts.`;

const SAMPLE_PDF_TEXT = `Meeting Transcript — Acme Corp
Date: 2026-01-15
Participants: Jane (PM), Bob (Customer)

Jane: How has your team been using the analytics dashboard?
Bob: Honestly, it's been confusing. The filters don't work intuitively and we keep losing our saved views.
Jane: Can you walk me through a specific example?
Bob: Sure. Yesterday I tried to filter by date range and segment simultaneously, and the UI just froze.`;

// Minimal valid PDF bytes (header + empty body) — for testing the binary path
// Real pdf-parse is mocked, so this just needs to be a valid File object
const MINIMAL_PDF_BYTES = new Uint8Array([
  0x25,
  0x50,
  0x44,
  0x46,
  0x2d,
  0x31,
  0x2e,
  0x34, // %PDF-1.4
  0x0a,
  0x25,
  0xe2,
  0xe3,
  0xcf,
  0xd3, // header
]);

// ── Tests ────────────────────────────────────────────────────────────────────

describe("api/upload-file", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default pdf-parse mock: returns extracted text
    mockPdfParse.mockResolvedValue({
      text: SAMPLE_PDF_TEXT,
      numpages: 2,
      numrender: 2,
      info: {},
      metadata: null,
      version: "1.4",
    } as any);
  });

  // ─── Basic validation ────────────────────────────────────────────────────

  describe("request validation", () => {
    it("rejects non-POST requests", async () => {
      const request = new Request("http://localhost/api/upload-file", {
        method: "GET",
      });
      const response = await action({
        request,
        context: createMockContext() as any,
        params: {},
      });
      expect(response.status).toBe(405);
    });

    it("rejects requests with no file", async () => {
      const fd = new FormData();
      fd.set("projectId", TEST_PROJECT_ID);
      const response = await action({
        request: makeRequest(fd),
        context: createMockContext() as any,
        params: {},
      });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/no file/i);
    });

    it("rejects requests with no projectId", async () => {
      const fd = new FormData();
      fd.set("file", new File(["hello"], "test.txt", { type: "text/plain" }));
      const response = await action({
        request: makeRequest(fd),
        context: createMockContext() as any,
        params: {},
      });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/projectId/i);
    });
  });

  // ─── Text file uploads ───────────────────────────────────────────────────

  describe("text file upload (.txt)", () => {
    it("processes a .txt file and triggers evidence pipeline", async () => {
      const file = new File([SAMPLE_TRANSCRIPT_TEXT], "interview-notes.txt", {
        type: "text/plain",
      });
      const fd = makeFormData(file);

      const response = await action({
        request: makeRequest(fd),
        context: createMockContext() as any,
        params: {},
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.interviewId).toBe(TEST_INTERVIEW_ID);

      // Should call sanitize with full transcript text
      expect(mockSanitize).toHaveBeenCalledWith(
        expect.objectContaining({
          full_transcript: SAMPLE_TRANSCRIPT_TEXT,
          file_type: "text",
          original_filename: "interview-notes.txt",
        }),
      );

      // Should NOT store in R2 (text files have no binary to store)
      expect(mockStoreAudioFile).not.toHaveBeenCalled();

      // Should trigger v2 orchestrator with resumeFrom: evidence
      expect(mockTrigger).toHaveBeenCalledWith(
        "interview.v2.orchestrator",
        expect.objectContaining({
          resumeFrom: "evidence",
          skipSteps: ["upload"],
          analysisJobId: TEST_INTERVIEW_ID,
        }),
      );
    });

    it("processes a .md file the same as .txt", async () => {
      const file = new File(
        ["# Customer feedback\nThey loved the feature."],
        "notes.md",
        {
          type: "text/markdown",
        },
      );
      const fd = makeFormData(file);

      const response = await action({
        request: makeRequest(fd),
        context: createMockContext() as any,
        params: {},
      });

      expect(response.status).toBe(200);
      expect(mockSanitize).toHaveBeenCalledWith(
        expect.objectContaining({ file_type: "text" }),
      );
    });

    it("rejects empty text files", async () => {
      const file = new File([""], "empty.txt", { type: "text/plain" });
      const fd = makeFormData(file);

      const response = await action({
        request: makeRequest(fd),
        context: createMockContext() as any,
        params: {},
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/empty|could not be read/i);
    });

    it("rejects whitespace-only text files", async () => {
      const file = new File(["   \n\t\n  "], "whitespace.txt", {
        type: "text/plain",
      });
      const fd = makeFormData(file);

      const response = await action({
        request: makeRequest(fd),
        context: createMockContext() as any,
        params: {},
      });

      expect(response.status).toBe(400);
    });

    it("sets source_type to 'transcript' for text files", async () => {
      const supabase = createMockSupabase();
      const file = new File([SAMPLE_TRANSCRIPT_TEXT], "transcript.txt", {
        type: "text/plain",
      });
      const fd = makeFormData(file);

      await action({
        request: makeRequest(fd),
        context: createMockContext(supabase) as any,
        params: {},
      });

      // Verify the insert call used source_type: "transcript"
      expect(supabase._interviewsInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          source_type: "transcript",
        }),
      );
    });

    it("sets title with 'Text Transcript' prefix for text files", async () => {
      const supabase = createMockSupabase();
      const file = new File([SAMPLE_TRANSCRIPT_TEXT], "notes.txt", {
        type: "text/plain",
      });
      const fd = makeFormData(file);

      await action({
        request: makeRequest(fd),
        context: createMockContext(supabase) as any,
        params: {},
      });

      expect(supabase._interviewsInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining("Text Transcript"),
        }),
      );
    });
  });

  // ─── PDF file uploads ────────────────────────────────────────────────────

  describe("PDF file upload", () => {
    it("extracts text from a PDF and triggers evidence pipeline", async () => {
      const file = new File([MINIMAL_PDF_BYTES], "meeting-transcript.pdf", {
        type: "application/pdf",
      });
      const fd = makeFormData(file);

      const response = await action({
        request: makeRequest(fd),
        context: createMockContext() as any,
        params: {},
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.interviewId).toBe(TEST_INTERVIEW_ID);

      // Should call pdf-parse
      expect(mockPdfParse).toHaveBeenCalled();

      // Should call sanitize with extracted PDF text
      expect(mockSanitize).toHaveBeenCalledWith(
        expect.objectContaining({
          full_transcript: SAMPLE_PDF_TEXT,
          file_type: "pdf",
          original_filename: "meeting-transcript.pdf",
        }),
      );

      // Should trigger v2 orchestrator
      expect(mockTrigger).toHaveBeenCalledWith(
        "interview.v2.orchestrator",
        expect.objectContaining({
          resumeFrom: "evidence",
          skipSteps: ["upload"],
        }),
      );
    });

    it("stores original PDF in R2 for download", async () => {
      const file = new File([MINIMAL_PDF_BYTES], "report.pdf", {
        type: "application/pdf",
      });
      const fd = makeFormData(file);

      await action({
        request: makeRequest(fd),
        context: createMockContext() as any,
        params: {},
      });

      // Should store original PDF in R2
      expect(mockStoreAudioFile).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: TEST_PROJECT_ID,
          interviewId: TEST_INTERVIEW_ID,
          originalFilename: "report.pdf",
          contentType: "application/pdf",
        }),
      );
    });

    it("detects PDF by file extension when MIME type is generic", async () => {
      // Some browsers send application/octet-stream for PDFs
      const file = new File([MINIMAL_PDF_BYTES], "transcript.pdf", {
        type: "application/octet-stream",
      });
      const fd = makeFormData(file);

      const response = await action({
        request: makeRequest(fd),
        context: createMockContext() as any,
        params: {},
      });

      expect(response.status).toBe(200);
      expect(mockPdfParse).toHaveBeenCalled();
    });

    it("sets source_type to 'transcript' for PDFs", async () => {
      const supabase = createMockSupabase();
      const file = new File([MINIMAL_PDF_BYTES], "call-notes.pdf", {
        type: "application/pdf",
      });
      const fd = makeFormData(file);

      await action({
        request: makeRequest(fd),
        context: createMockContext(supabase) as any,
        params: {},
      });

      expect(supabase._interviewsInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          source_type: "transcript",
        }),
      );
    });

    it("sets title with 'PDF Transcript' prefix", async () => {
      const supabase = createMockSupabase();
      const file = new File([MINIMAL_PDF_BYTES], "meeting.pdf", {
        type: "application/pdf",
      });
      const fd = makeFormData(file);

      await action({
        request: makeRequest(fd),
        context: createMockContext(supabase) as any,
        params: {},
      });

      expect(supabase._interviewsInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining("PDF Transcript"),
        }),
      );
    });

    it("rejects scanned/image-only PDFs (empty text extraction)", async () => {
      mockPdfParse.mockResolvedValueOnce({
        text: "",
        numpages: 3,
        numrender: 3,
        info: {},
        metadata: null,
        version: "1.4",
      } as any);

      const file = new File([MINIMAL_PDF_BYTES], "scanned-doc.pdf", {
        type: "application/pdf",
      });
      const fd = makeFormData(file);

      const response = await action({
        request: makeRequest(fd),
        context: createMockContext() as any,
        params: {},
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/scanned|image-based/i);
    });

    it("rejects PDFs with only whitespace text", async () => {
      mockPdfParse.mockResolvedValueOnce({
        text: "   \n\n  \t  ",
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: null,
        version: "1.4",
      } as any);

      const file = new File([MINIMAL_PDF_BYTES], "blank.pdf", {
        type: "application/pdf",
      });
      const fd = makeFormData(file);

      const response = await action({
        request: makeRequest(fd),
        context: createMockContext() as any,
        params: {},
      });

      expect(response.status).toBe(400);
    });

    it("handles pdf-parse throwing an error gracefully", async () => {
      mockPdfParse.mockRejectedValueOnce(new Error("Corrupted PDF stream"));

      const file = new File([MINIMAL_PDF_BYTES], "corrupted.pdf", {
        type: "application/pdf",
      });
      const fd = makeFormData(file);

      const response = await action({
        request: makeRequest(fd),
        context: createMockContext() as any,
        params: {},
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toMatch(/corrupted pdf/i);
    });
  });

  // ─── File type detection ─────────────────────────────────────────────────

  describe("file type detection", () => {
    it("detects .txt as document file, not audio/video", async () => {
      const file = new File(["content"], "notes.txt", { type: "text/plain" });
      const fd = makeFormData(file);

      await action({
        request: makeRequest(fd),
        context: createMockContext() as any,
        params: {},
      });

      // Should NOT try to transcribe via AssemblyAI (storeAudioFile not called for txt)
      expect(mockStoreAudioFile).not.toHaveBeenCalled();
    });

    it("detects .pdf with application/pdf MIME", async () => {
      const file = new File([MINIMAL_PDF_BYTES], "doc.pdf", {
        type: "application/pdf",
      });
      const fd = makeFormData(file);

      await action({
        request: makeRequest(fd),
        context: createMockContext() as any,
        params: {},
      });

      expect(mockPdfParse).toHaveBeenCalled();
    });

    it("does NOT use pdf-parse for audio files", async () => {
      // Mock storeAudioFile and transcribeAudioFromUrl for audio path
      const { transcribeAudioFromUrl } =
        await import("~/utils/assemblyai.server");
      vi.mocked(transcribeAudioFromUrl).mockResolvedValueOnce({
        full_transcript: "Hello world",
        audio_duration: 60,
      } as any);

      const file = new File(["fake audio"], "recording.mp3", {
        type: "audio/mpeg",
      });
      const fd = makeFormData(file);

      await action({
        request: makeRequest(fd),
        context: createMockContext() as any,
        params: {},
      });

      // Should NOT call pdf-parse for audio
      expect(mockPdfParse).not.toHaveBeenCalled();
    });
  });

  // ─── Orchestrator integration ────────────────────────────────────────────

  describe("orchestrator trigger", () => {
    it("passes mediaUrl from R2 storage for PDF uploads", async () => {
      mockStoreAudioFile.mockResolvedValueOnce({
        mediaUrl: "https://r2.example.com/stored-transcript.pdf",
        error: null,
      });

      const file = new File([MINIMAL_PDF_BYTES], "transcript.pdf", {
        type: "application/pdf",
      });
      const fd = makeFormData(file);

      await action({
        request: makeRequest(fd),
        context: createMockContext() as any,
        params: {},
      });

      expect(mockTrigger).toHaveBeenCalledWith(
        "interview.v2.orchestrator",
        expect.objectContaining({
          mediaUrl: "https://r2.example.com/stored-transcript.pdf",
        }),
      );
    });

    it("passes empty mediaUrl for text file uploads", async () => {
      const file = new File([SAMPLE_TRANSCRIPT_TEXT], "notes.txt", {
        type: "text/plain",
      });
      const fd = makeFormData(file);

      await action({
        request: makeRequest(fd),
        context: createMockContext() as any,
        params: {},
      });

      expect(mockTrigger).toHaveBeenCalledWith(
        "interview.v2.orchestrator",
        expect.objectContaining({
          mediaUrl: "",
        }),
      );
    });
  });
});
