import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { AnimatePresence, motion } from "framer-motion";
import consola from "consola";
import {
  Check,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Mic,
  Send,
  Square,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFetcher, useNavigate } from "react-router";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "~/components/ai-elements/conversation";
import { Response as AiResponse } from "~/components/ai-elements/response";
import { Suggestion, Suggestions } from "~/components/ai-elements/suggestion";
import { Textarea } from "~/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  VoiceButton,
  type VoiceButtonState,
} from "~/components/ui/voice-button";
import ContextualSuggestions from "~/features/onboarding/components/ContextualSuggestions";
import type { CapturedField } from "~/features/projects/components/CapturedPane";
import { useProjectSections } from "~/features/projects/contexts/project-setup-context";
import { useSpeechToText } from "~/features/voice/hooks/use-speech-to-text";
import { cn } from "~/lib/utils";
import type { UpsightMessage } from "~/mastra/message-types";

// Field detection patterns for contextual suggestions
const FIELD_PATTERNS: Record<
  string,
  {
    pattern: RegExp;
    suggestionType:
      | "roles"
      | "organizations"
      | "assumptions"
      | "unknowns"
      | "decision_questions";
  }
> = {
  roles: {
    pattern:
      /\b(roles?|job titles?|who.*talk|target.*roles?|buyers?|users?)\b/i,
    suggestionType: "roles",
  },
  organizations: {
    pattern:
      /\b(organizations?|companies|industries|target.*org|types? of.*compan)/i,
    suggestionType: "organizations",
  },
  assumptions: {
    pattern: /\b(assumptions?|hypothes[ie]s|believe|expect|assume)\b/i,
    suggestionType: "assumptions",
  },
  unknowns: {
    pattern: /\b(unknowns?|questions?|don'?t know|uncertain|explore)\b/i,
    suggestionType: "unknowns",
  },
  decision_questions: {
    pattern:
      /\b(decisions?|trying to (learn|decide|figure)|research goal|what.*learn)\b/i,
    suggestionType: "decision_questions",
  },
};

function WizardIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full border border-border bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm",
        className,
      )}
    >
      <svg
        viewBox="0 0 64 64"
        className="h-6 w-6 text-white"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        role="img"
        aria-label="Setup assistant"
      >
        <path
          d="M32 8l-10 18h20L32 8z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="32" cy="30" r="10" />
        <path d="M24 45h16v11H24z" />
        <path d="M26 30h2" strokeLinecap="round" />
        <path d="M36 30h2" strokeLinecap="round" />
        <path d="M28 35c1.5 1 6.5 1 8 0" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function ThinkingWave() {
  const gradientId = useId();
  const bars = [
    { delay: 0, x: 0 },
    { delay: 0.15, x: 12 },
    { delay: 0.3, x: 24 },
    { delay: 0.45, x: 36 },
  ];

  return (
    <span
      className="flex items-center gap-2 font-medium text-[11px] text-foreground/70 italic"
      aria-live="polite"
    >
      <span>Thinking</span>
      <svg
        className="h-4 w-10 text-foreground/50"
        viewBox="0 0 48 16"
        fill="none"
        role="presentation"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.6" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        {bars.map(({ delay, x }) => (
          <rect
            key={x}
            x={x}
            y={6}
            width={6}
            height={4}
            rx={3}
            fill={`url(#${gradientId})`}
          >
            <animate
              attributeName="height"
              values="4;12;4"
              dur="1.2s"
              begin={`${delay}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="y"
              values="10;2;10"
              dur="1.2s"
              begin={`${delay}s`}
              repeatCount="indefinite"
            />
          </rect>
        ))}
      </svg>
    </span>
  );
}

// Helper to check if a captured field has a value
function hasFieldValue(value: string | string[] | null): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" && value.trim().length > 0;
}

// Format captured field value for display
function formatFieldValue(value: string | string[] | null): string {
  if (!hasFieldValue(value)) return "";
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    if (value.length <= 2) return value.join(", ");
    return `${value.slice(0, 2).join(", ")} +${value.length - 2}`;
  }
  if (typeof value === "string") {
    return value.length > 40 ? `${value.slice(0, 40)}...` : value;
  }
  return "";
}

/**
 * Collapsible footer showing captured context progress
 * Integrated into chat panel per UI spec
 */
function CapturedFooter({
  fields,
  expanded,
  onToggle,
  onAskAboutField,
}: {
  fields: CapturedField[];
  expanded: boolean;
  onToggle: () => void;
  onAskAboutField?: (fieldKey: string) => void;
}) {
  const capturedCount = fields.filter((f) => hasFieldValue(f.value)).length;
  const totalCount = fields.length;

  // Group by category
  const companyFields = fields.filter((f) => f.category === "company");
  const projectFields = fields.filter((f) => f.category === "project");

  return (
    <div className="border-t border-border/60 bg-muted/30">
      {/* Collapsed header - always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 transition-colors hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground/80 text-xs">
            Context
          </span>
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-primary text-[10px]">
            {capturedCount}/{totalCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Progress dots */}
          <div className="flex items-center gap-0.5">
            {fields.slice(0, 6).map((field) => (
              <div
                key={field.key}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  hasFieldValue(field.value)
                    ? "bg-emerald-500"
                    : "bg-muted-foreground/30",
                )}
                title={`${field.label}: ${hasFieldValue(field.value) ? "Captured" : "Not captured"}`}
              />
            ))}
            {fields.length > 6 && (
              <span className="ml-0.5 text-muted-foreground text-[10px]">
                +{fields.length - 6}
              </span>
            )}
          </div>
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="max-h-48 space-y-3 overflow-y-auto border-t border-border/40 px-3 py-2">
              {/* Company fields */}
              {companyFields.length > 0 && (
                <div>
                  <h4 className="mb-1.5 font-medium text-muted-foreground text-[10px] uppercase tracking-wide">
                    Company
                  </h4>
                  <div className="grid grid-cols-2 gap-1.5">
                    {companyFields.map((field) => (
                      <CapturedFieldChip
                        key={field.key}
                        field={field}
                        onAsk={
                          onAskAboutField
                            ? () => onAskAboutField(field.key)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Project fields */}
              {projectFields.length > 0 && (
                <div>
                  <h4 className="mb-1.5 font-medium text-muted-foreground text-[10px] uppercase tracking-wide">
                    Research
                  </h4>
                  <div className="grid grid-cols-2 gap-1.5">
                    {projectFields.map((field) => (
                      <CapturedFieldChip
                        key={field.key}
                        field={field}
                        onAsk={
                          onAskAboutField
                            ? () => onAskAboutField(field.key)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* All captured message */}
              {capturedCount === totalCount && totalCount > 0 && (
                <div className="flex items-center justify-center gap-1.5 rounded-md bg-emerald-50 py-1.5 dark:bg-emerald-950/30">
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-medium text-emerald-700 text-xs dark:text-emerald-300">
                    All context captured
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Compact chip showing a single captured/uncaptured field
 */
function CapturedFieldChip({
  field,
  onAsk,
}: {
  field: CapturedField;
  onAsk?: () => void;
}) {
  const hasCaptured = hasFieldValue(field.value);

  if (hasCaptured) {
    return (
      <div className="flex items-start gap-1.5 rounded-md bg-card px-2 py-1.5 ring-1 ring-border/50">
        <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground text-[11px]">
            {field.label}
          </p>
          <p className="truncate text-muted-foreground text-[10px]">
            {formatFieldValue(field.value)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onAsk}
      className="flex items-start gap-1.5 rounded-md bg-muted/50 px-2 py-1.5 text-left ring-1 ring-border/30 transition-colors hover:bg-muted"
    >
      <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full border border-muted-foreground/30" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground/70 text-[11px]">
          {field.label}
        </p>
        {onAsk && (
          <span className="flex items-center gap-0.5 text-primary text-[10px]">
            <MessageCircle className="h-2.5 w-2.5" />
            Ask
          </span>
        )}
      </div>
    </button>
  );
}

// Opening prompt for the onboarding conversation
const OPENING_PROMPT = `I'll help you get insights from customer conversations.

Do you want to:`;

// Path-based suggested responses (per onboarding spec v2)
const INITIAL_PATH_SUGGESTIONS = [
  {
    emoji: "📋",
    text: "Help me figure out what to ask customers",
    path: "plan",
  },
  { emoji: "📊", text: "Find patterns in recordings I have", path: "analyze" },
  { emoji: "🎙️", text: "Take notes on a call for me", path: "record" },
  { emoji: "🔍", text: "See how it works first", path: "explore" },
] as const;

interface ProjectSetupChatProps {
  accountId: string;
  projectId: string;
  projectName: string;
  onSetupComplete?: () => void;
  /** Initial message to send automatically when chat opens */
  initialMessage?: string | null;
  /** Callback when user selects a path from initial suggestions */
  onPathSelect?: (path: "plan" | "analyze" | "record" | "explore") => void;
  /** Research context for contextual suggestions */
  researchContext?: {
    research_goal?: string | null;
    target_roles?: string[];
    target_orgs?: string[];
    assumptions?: string[];
    unknowns?: string[];
  };
  /** Captured fields to show in collapsible footer */
  capturedFields?: CapturedField[];
}

export function ProjectSetupChat({
  accountId,
  projectId,
  projectName,
  onSetupComplete,
  initialMessage,
  onPathSelect,
  researchContext,
  capturedFields,
}: ProjectSetupChatProps) {
  const [input, setInput] = useState("");
  const [capturedFooterExpanded, setCapturedFooterExpanded] = useState(false);
  const initialMessageSentRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const navigate = useNavigate();

  // History loading - use projectId as key to prevent reload on remount
  const historyFetcher = useFetcher<{ messages: UpsightMessage[] }>();
  const [historyLoadedForProject, setHistoryLoadedForProject] = useState<
    string | null
  >(null);

  const systemContext = useMemo(() => {
    return `Project: ${projectName}\nProject ID: ${projectId}\nAccount ID: ${accountId}`;
  }, [projectName, projectId, accountId]);

  const transport = useMemo(() => {
    const apiUrl = `/a/${accountId}/${projectId}/api/chat/project-setup`;
    return new DefaultChatTransport({
      api: apiUrl,
      body: { system: systemContext },
    });
  }, [accountId, projectId, systemContext]);

  const { messages, sendMessage, status, addToolResult, stop, setMessages } =
    useChat<UpsightMessage>({
      transport,
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
      onToolCall: async ({ toolCall }) => {
        if (toolCall.dynamic) return;

        // Handle navigation
        if (toolCall.toolName === "navigateToPage") {
          const rawPath = (toolCall.input as { path?: string })?.path || null;
          if (rawPath) {
            navigate(rawPath);
            addToolResult({
              tool: "navigateToPage",
              toolCallId: toolCall.toolCallId,
              output: { success: true, path: rawPath },
            });
          }
        }

        // Handle agent switching (setup complete → status agent)
        if (toolCall.toolName === "switchAgent") {
          const input = toolCall.input as {
            targetAgent?: string;
            reason?: string;
          };
          const targetAgent = input?.targetAgent;
          const reason = input?.reason || "Switching...";

          consola.info("switchAgent tool called:", { targetAgent, reason });

          if (targetAgent === "project-status") {
            // Setup complete - navigate to dashboard
            addToolResult({
              tool: "switchAgent",
              toolCallId: toolCall.toolCallId,
              output: { success: true, targetAgent, message: reason },
            });
            // Trigger completion callback
            onSetupComplete?.();
          } else {
            addToolResult({
              tool: "switchAgent",
              toolCallId: toolCall.toolCallId,
              output: {
                success: true,
                targetAgent,
                message: "Already in setup mode.",
              },
            });
          }
        }
      },
    });

  // Load history once per project
  useEffect(() => {
    // Skip if already loaded for this project or if fetcher is busy
    if (
      historyLoadedForProject === projectId ||
      historyFetcher.state !== "idle"
    )
      return;

    const historyUrl = `/a/${accountId}/${projectId}/api/chat/project-setup/history`;
    consola.info("Loading setup chat history from:", historyUrl);
    historyFetcher.load(historyUrl);
    setHistoryLoadedForProject(projectId);
  }, [accountId, projectId, historyLoadedForProject, historyFetcher.state]);

  // Update messages when history loads
  useEffect(() => {
    if (
      historyFetcher.data?.messages &&
      historyFetcher.data.messages.length > 0
    ) {
      consola.info(
        "Setup chat history loaded:",
        historyFetcher.data.messages.length,
        "messages",
      );
      setMessages(historyFetcher.data.messages);
    }
  }, [historyFetcher.data, setMessages]);

  const handleVoiceTranscription = useCallback(
    (transcript: string) => {
      const trimmed = transcript.trim();
      if (!trimmed) return;
      sendMessage({ text: trimmed });
      setInput("");
    },
    [sendMessage],
  );

  const {
    startRecording: startVoiceRecording,
    stopRecording: stopVoiceRecording,
    isRecording: isVoiceRecording,
    isTranscribing,
    error: voiceError,
    isSupported: isVoiceSupported,
  } = useSpeechToText({ onTranscription: handleVoiceTranscription });

  const isBusy = status === "streaming" || status === "submitted";
  const isError = status === "error";
  const awaitingAssistant = isBusy;

  const voiceButtonState: VoiceButtonState = voiceError
    ? "error"
    : isTranscribing
      ? "processing"
      : isVoiceRecording
        ? "recording"
        : "idle";

  const statusMessage =
    voiceError ||
    (isError
      ? "Something went wrong. Try again."
      : isTranscribing
        ? "Transcribing voice..."
        : isBusy
          ? "Thinking..."
          : isVoiceRecording
            ? "Recording..."
            : null);

  const displayableMessages = useMemo(() => {
    if (!messages) return [];
    const lastMessage = messages[messages.length - 1];
    return messages.filter((message) => {
      if (message.role !== "assistant") return true;
      const hasContent = message.parts?.some(
        (part) =>
          part.type === "text" &&
          typeof part.text === "string" &&
          part.text.trim() !== "",
      );
      const isLatestAssistantPlaceholder =
        awaitingAssistant && message === lastMessage;
      return hasContent || isLatestAssistantPlaceholder;
    });
  }, [messages, awaitingAssistant]);

  // Auto-focus textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Auto-send initial message when chat opens (from entry screen)
  useEffect(() => {
    if (
      initialMessage &&
      !initialMessageSentRef.current &&
      status === "idle" &&
      historyFetcher.state === "idle"
    ) {
      initialMessageSentRef.current = true;
      sendMessage({ text: initialMessage });
    }
  }, [initialMessage, status, historyFetcher.state, sendMessage]);

  // State for LLM-generated suggestions (fallback)
  const [generatedSuggestions, setGeneratedSuggestions] = useState<string[]>(
    [],
  );
  const lastProcessedMessageId = useRef<string | null>(null);

  // Track if we're in initial state (showing opening prompt with path options)
  const isInitialState = displayableMessages.length === 0;

  // Extract suggestions from assistant's response via tool invocations
  const toolSuggestions = useMemo(() => {
    // Initial path-based suggestions when no messages
    if (isInitialState) {
      return INITIAL_PATH_SUGGESTIONS.map((s) => `${s.emoji} ${s.text}`);
    }

    // Find the last assistant message
    const lastAssistantMsg = [...displayableMessages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (!lastAssistantMsg) return [];

    // Check for suggestNextSteps tool invocation
    const suggestionToolCall = lastAssistantMsg.toolInvocations?.find(
      (t) => t.toolName === "suggestNextSteps" && "result" in t,
    );

    if (suggestionToolCall && "args" in suggestionToolCall) {
      const args = suggestionToolCall.args as { suggestions?: string[] };
      if (
        args.suggestions &&
        Array.isArray(args.suggestions) &&
        args.suggestions.length > 0
      ) {
        return args.suggestions;
      }
    }

    return [];
  }, [displayableMessages, isInitialState]);

  // Fallback: Generate suggestions if no tool calls found
  useEffect(() => {
    if (displayableMessages.length === 0) return;

    const lastMsg = displayableMessages[displayableMessages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant" || status === "streaming")
      return;

    // If we already processed this message, skip
    if (lastProcessedMessageId.current === lastMsg.id) return;

    // If we have tool suggestions, use those (clear generated)
    if (toolSuggestions.length > 0) {
      setGeneratedSuggestions([]);
      lastProcessedMessageId.current = lastMsg.id;
      return;
    }

    // Otherwise, generate new ones via API
    lastProcessedMessageId.current = lastMsg.id;

    const lastText =
      lastMsg.parts
        ?.filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("\n") || "";
    if (!lastText) return;

    fetch("/api/generate-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lastMessage: lastText,
        context: `Project Setup: ${projectName}`,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.suggestions && Array.isArray(data.suggestions)) {
          setGeneratedSuggestions(data.suggestions);
        }
      })
      .catch((err) => console.error("Failed to generate suggestions:", err));
  }, [
    displayableMessages,
    toolSuggestions,
    status,
    accountId,
    projectId,
    projectName,
  ]);

  const suggestions =
    toolSuggestions.length > 0 ? toolSuggestions : generatedSuggestions;

  // Detect which field the AI is asking about from the last assistant message
  const detectedFieldType = useMemo(() => {
    if (!researchContext?.research_goal || isInitialState || isBusy)
      return null;

    const lastAssistantMsg = [...displayableMessages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (!lastAssistantMsg) return null;

    const textParts =
      lastAssistantMsg.parts
        ?.filter((p) => p.type === "text")
        .map((p) => p.text) ?? [];
    const messageText = textParts.join(" ").toLowerCase();

    // Check each pattern to find what field AI is asking about
    for (const [_key, { pattern, suggestionType }] of Object.entries(
      FIELD_PATTERNS,
    )) {
      if (pattern.test(messageText)) {
        return suggestionType;
      }
    }
    return null;
  }, [
    displayableMessages,
    researchContext?.research_goal,
    isInitialState,
    isBusy,
  ]);

  // Get existing items for the detected field type
  const existingItemsForField = useMemo(() => {
    if (!detectedFieldType || !researchContext) return [];
    switch (detectedFieldType) {
      case "roles":
        return researchContext.target_roles ?? [];
      case "organizations":
        return researchContext.target_orgs ?? [];
      case "assumptions":
        return researchContext.assumptions ?? [];
      case "unknowns":
        return researchContext.unknowns ?? [];
      case "decision_questions":
        return []; // No existing items to show
      default:
        return [];
    }
  }, [detectedFieldType, researchContext]);

  // Handle contextual suggestion click - sends as chat message
  const handleContextualSuggestionClick = useCallback(
    (suggestion: string) => {
      sendMessage({ text: suggestion });
    },
    [sendMessage],
  );

  // Handle "ask about field" from captured footer
  const handleAskAboutField = useCallback(
    (fieldKey: string) => {
      const field = capturedFields?.find((f) => f.key === fieldKey);
      if (!field) return;

      // Send a message asking about this field
      const prompt = field.description
        ? `Help me with ${field.label.toLowerCase()}. ${field.description}`
        : `Help me fill in ${field.label.toLowerCase()}.`;
      sendMessage({ text: prompt });

      // Collapse the footer after asking
      setCapturedFooterExpanded(false);
    },
    [capturedFields, sendMessage],
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      // Check if this is an initial path-based suggestion
      if (isInitialState) {
        const matchedPath = INITIAL_PATH_SUGGESTIONS.find(
          (s) => `${s.emoji} ${s.text}` === suggestion,
        );
        if (matchedPath) {
          // Route based on the path
          switch (matchedPath.path) {
            case "analyze":
              // Navigate to upload page
              navigate(`/a/${accountId}/${projectId}/interviews/upload`);
              return;
            case "record":
              // Navigate to new interview (which has recording option)
              navigate(`/a/${accountId}/${projectId}/interviews/new`);
              return;
            case "explore":
              // Navigate to dashboard with sample data
              navigate(`/a/${accountId}/${projectId}`);
              return;
            case "plan":
              // Continue in chat for planning flow
              onPathSelect?.("plan");
              sendMessage({ text: suggestion });
              return;
          }
        }
      }
      sendMessage({ text: suggestion });
    },
    [sendMessage, isInitialState, navigate, accountId, projectId, onPathSelect],
  );

  const submitMessage = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage({ text: trimmed });
    setInput("");
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitMessage();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  };

  return (
    <div className="flex h-[85vh] flex-col overflow-hidden md:rounded-xl md:border md:border-border/60 md:bg-background/80 md:shadow-sm md:backdrop-blur">
      <div className="flex min-h-0 flex-1 flex-col px-2 py-4 md:p-6">
        {/* Messages area with auto-scroll */}
        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="space-y-4 p-0 pr-2">
            {displayableMessages.length === 0 ? (
              <div className="flex flex-col pt-4 md:pt-8">
                {/* Opening prompt as initial AI message */}
                <div className="flex justify-start">
                  <div className="flex max-w-[95%] flex-col gap-2 md:max-w-[85%] md:flex-row md:gap-3">
                    <div className="flex items-center gap-2 md:block">
                      <WizardIcon className="h-6 w-6 flex-shrink-0 md:mt-1 md:h-8 md:w-8" />
                      <span className="text-[10px] text-foreground/60 uppercase tracking-wide md:hidden">
                        UpSight
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 hidden text-[10px] text-foreground/60 uppercase tracking-wide md:block">
                        UpSight
                      </div>
                      <div className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-muted/50 px-3 py-2 text-foreground shadow-sm ring-1 ring-border/60 md:rounded-lg md:px-4 md:py-3">
                        <AiResponse>{OPENING_PROMPT}</AiResponse>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              displayableMessages.map((message, index) => {
                const key = message.id || `${message.role}-${index}`;
                const isUser = message.role === "user";
                const textParts =
                  message.parts
                    ?.filter((part) => part.type === "text")
                    .map((part) => part.text) ?? [];
                const messageText = textParts.filter(Boolean).join("\n").trim();
                return (
                  <div
                    key={key}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={cn(
                        "max-w-[95%] md:max-w-[85%]",
                        !isUser && "flex flex-col gap-2 md:flex-row md:gap-3",
                      )}
                    >
                      {!isUser && (
                        <div className="flex items-center gap-2 md:block">
                          <WizardIcon className="h-6 w-6 flex-shrink-0 md:mt-1 md:h-8 md:w-8" />
                          <span className="text-[10px] text-foreground/60 uppercase tracking-wide md:hidden">
                            UpSight
                          </span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 hidden text-[10px] text-foreground/60 uppercase tracking-wide md:block">
                          {isUser ? "You" : "Setup Assistant"}
                        </div>
                        <div
                          className={cn(
                            "whitespace-pre-wrap px-3 py-2 shadow-sm md:px-4 md:py-3",
                            isUser
                              ? "rounded-2xl rounded-br-sm bg-blue-600 text-white"
                              : "rounded-2xl rounded-tl-sm bg-muted/50 text-foreground ring-1 ring-border/60 md:rounded-lg",
                          )}
                        >
                          {messageText ? (
                            isUser ? (
                              <span className="whitespace-pre-wrap">
                                {messageText}
                              </span>
                            ) : (
                              <AiResponse key={key}>{messageText}</AiResponse>
                            )
                          ) : !isUser ? (
                            <ThinkingWave />
                          ) : (
                            <span className="text-foreground/70">
                              (No text response)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Input area */}
        <div className="mt-4 flex-shrink-0 border-t pt-4">
          {/* Path-based suggestions (initial state) */}
          {isInitialState && !isBusy && (
            <div className="mb-4 grid gap-2">
              {INITIAL_PATH_SUGGESTIONS.map((pathOption) => (
                <button
                  key={pathOption.path}
                  type="button"
                  onClick={() =>
                    handleSuggestionClick(
                      `${pathOption.emoji} ${pathOption.text}`,
                    )
                  }
                  className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/50"
                >
                  <span className="text-xl">{pathOption.emoji}</span>
                  <div className="flex-1">
                    <span className="font-medium text-foreground text-sm">
                      {pathOption.text}
                    </span>
                    <span className="mt-0.5 block text-muted-foreground text-xs">
                      {pathOption.path === "plan" &&
                        "Get interview questions & a research plan"}
                      {pathOption.path === "analyze" &&
                        "Upload calls, get insights in minutes"}
                      {pathOption.path === "record" &&
                        "Record a call now, I'll capture everything"}
                      {pathOption.path === "explore" &&
                        "Explore with sample data, no commitment"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {/* Regular suggestions (after initial state) */}
          {!isInitialState && suggestions.length > 0 && !isBusy && (
            <Suggestions className="mb-3">
              {suggestions.map((suggestion) => (
                <Suggestion
                  key={suggestion}
                  suggestion={suggestion}
                  onClick={handleSuggestionClick}
                />
              ))}
            </Suggestions>
          )}
          {/* Contextual suggestions based on detected field */}
          {detectedFieldType && researchContext?.research_goal && !isBusy && (
            <div className="mb-3">
              <ContextualSuggestions
                suggestionType={detectedFieldType}
                currentInput={input}
                researchGoal={researchContext.research_goal}
                existingItems={existingItemsForField}
                onSuggestionClick={handleContextualSuggestionClick}
                isActive={true}
                responseCount={3}
                apiPath={`/a/${accountId}/${projectId}/api/contextual-suggestions`}
              />
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.currentTarget.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isInitialState
                  ? "Or type something else..."
                  : "Tell me about your business..."
              }
              rows={isInitialState ? 2 : 3}
              disabled={isBusy}
              className="min-h-[60px] resize-none"
            />
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-muted-foreground text-xs"
                aria-live="polite"
              >
                {statusMessage}
              </span>
              <div className="flex items-center gap-2">
                {isVoiceSupported && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <VoiceButton
                          state={voiceButtonState}
                          onPress={() => {
                            if (isVoiceRecording) {
                              stopVoiceRecording();
                            } else {
                              startVoiceRecording();
                            }
                          }}
                          icon={<Mic className="h-4 w-4" />}
                          size="icon"
                          variant="outline"
                          disabled={isTranscribing}
                          className="h-9 w-9"
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Use voice input</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {isBusy ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="flex h-9 items-center gap-1.5 rounded-md bg-red-600 px-4 font-medium text-sm text-white hover:bg-red-700"
                  >
                    <Square className="h-3.5 w-3.5" />
                    Stop
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-4 font-medium text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Captured context footer - collapsible at bottom of chat */}
      {capturedFields && capturedFields.length > 0 && (
        <CapturedFooter
          fields={capturedFields}
          expanded={capturedFooterExpanded}
          onToggle={() => setCapturedFooterExpanded((prev) => !prev)}
          onAskAboutField={handleAskAboutField}
        />
      )}
    </div>
  );
}
