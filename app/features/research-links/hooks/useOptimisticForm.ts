/**
 * Optimistic form hook for the survey editor.
 * Resolves field values in priority order: dirty local edits > in-flight fetcher > loader data.
 * When the user navigates back, the dirty map is empty and loader data shows through.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router-dom";
import type { ResearchLinkQuestion } from "../schemas";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

export interface SurveyFormFields {
  name: string;
  slug: string;
  heroTitle: string;
  heroSubtitle: string;
  instructions: string;
  heroCtaLabel: string;
  heroCtaHelper: string;
  calendarUrl: string;
  redirectUrl: string;
  allowChat: boolean;
  allowVoice: boolean;
  allowVideo: boolean;
  defaultResponseMode: "form" | "chat" | "voice";
  isLive: boolean;
  aiAutonomy: "strict" | "moderate" | "adaptive";
  identityType: "anonymous" | "email" | "phone";
  questions: ResearchLinkQuestion[];
}

/** Convert raw loader `list` object + parsed questions to typed form fields. */
export function extractFormFields(
  list: Record<string, unknown>,
  questions: ResearchLinkQuestion[],
): SurveyFormFields {
  const identityMode = list.identity_mode as string | undefined;
  const identityField = list.identity_field as string | undefined;
  let identityType: "anonymous" | "email" | "phone" = "email";
  if (identityMode === "anonymous") {
    identityType = "anonymous";
  } else if (identityField === "phone") {
    identityType = "phone";
  }

  return {
    name: (list.name as string) ?? "",
    slug: (list.slug as string) ?? "",
    heroTitle: (list.hero_title as string) ?? "",
    heroSubtitle: (list.hero_subtitle as string) ?? "",
    instructions: (list.instructions as string) ?? "",
    heroCtaLabel: (list.hero_cta_label as string) ?? "Continue",
    heroCtaHelper: (list.hero_cta_helper as string) ?? "",
    calendarUrl: (list.calendar_url as string) ?? "",
    redirectUrl: (list.redirect_url as string) ?? "",
    allowChat: Boolean(list.allow_chat),
    allowVoice: Boolean(list.allow_voice),
    allowVideo: Boolean(list.allow_video),
    defaultResponseMode:
      (list.default_response_mode as "form" | "chat" | "voice") ?? "form",
    isLive: Boolean(list.is_live),
    aiAutonomy:
      (list.ai_autonomy as "strict" | "moderate" | "adaptive") ?? "strict",
    identityType,
    questions: questions.length > 0 ? questions : [],
  };
}

/** Convert typed form fields to the Record<string, string> the action expects. */
export function serializeToFormData(
  fields: SurveyFormFields,
): Record<string, string> {
  return {
    name: fields.name,
    slug: fields.slug,
    description: "",
    hero_title: fields.heroTitle,
    hero_subtitle: fields.heroSubtitle,
    instructions: fields.instructions,
    hero_cta_label: fields.heroCtaLabel,
    hero_cta_helper: fields.heroCtaHelper,
    calendar_url: fields.calendarUrl,
    redirect_url: fields.redirectUrl,
    allow_chat: String(fields.allowChat),
    allow_voice: String(fields.allowVoice),
    allow_video: String(fields.allowVideo),
    default_response_mode: fields.defaultResponseMode,
    is_live: String(fields.isLive),
    ai_autonomy: fields.aiAutonomy,
    identity_type: fields.identityType,
    questions: JSON.stringify(fields.questions),
  };
}

interface UseOptimisticFormOptions {
  debounceMs?: number;
  savedDisplayMs?: number;
}

export interface UseOptimisticFormReturn {
  fields: SurveyFormFields;
  setText(key: keyof SurveyFormFields, value: string): void;
  setImmediate<K extends keyof SurveyFormFields>(
    key: K,
    value: SurveyFormFields[K],
  ): void;
  setDirtyOnly<K extends keyof SurveyFormFields>(
    key: K,
    value: SurveyFormFields[K],
  ): void;
  setQuestions(questions: ResearchLinkQuestion[]): void;
  flush(): void;
  status: AutoSaveStatus;
  errors: Record<string, string> | undefined;
}

export function useOptimisticForm(
  loaderFields: SurveyFormFields,
  { debounceMs = 1000, savedDisplayMs = 2000 }: UseOptimisticFormOptions = {},
): UseOptimisticFormReturn {
  const fetcher = useFetcher<{
    ok?: boolean;
    errors?: Record<string, string>;
  }>();

  const [dirtyMap, setDirtyMap] = useState<Partial<SurveyFormFields>>({});
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Keep a ref to the current merged fields for flush-on-unmount
  const dirtyMapRef = useRef(dirtyMap);
  dirtyMapRef.current = dirtyMap;
  const loaderFieldsRef = useRef(loaderFields);
  loaderFieldsRef.current = loaderFields;

  // Resolve: loaderFields ← dirtyMap (skip fetcher.formData layer for simplicity — dirty map already has latest)
  const fields = useMemo<SurveyFormFields>(
    () => ({ ...loaderFields, ...dirtyMap }) as SurveyFormFields,
    [loaderFields, dirtyMap],
  );

  // Derive status from fetcher state
  useEffect(() => {
    if (fetcher.state === "submitting" || fetcher.state === "loading") {
      setStatus("saving");
    } else if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.errors) {
        setStatus("error");
      } else {
        // Save succeeded — clear dirty map
        setDirtyMap({});
        setStatus("saved");
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(
          () => setStatus("idle"),
          savedDisplayMs,
        );
      }
    }
  }, [fetcher.state, fetcher.data, savedDisplayMs]);

  const submitAll = useCallback(() => {
    const merged = {
      ...loaderFieldsRef.current,
      ...dirtyMapRef.current,
    } as SurveyFormFields;
    fetcher.submit(serializeToFormData(merged), { method: "post" });
  }, [fetcher]);

  const debouncedSubmit = useCallback(() => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      submitAll();
    }, debounceMs);
  }, [submitAll, debounceMs]);

  /** Update a text field: marks dirty + schedules debounced save. */
  const setText = useCallback(
    (key: keyof SurveyFormFields, value: string) => {
      setDirtyMap((prev) => ({ ...prev, [key]: value }));
      debouncedSubmit();
    },
    [debouncedSubmit],
  );

  /** Update any field: marks dirty + saves immediately. */
  const setImmediate = useCallback(
    <K extends keyof SurveyFormFields>(key: K, value: SurveyFormFields[K]) => {
      setDirtyMap((prev) => {
        const next = { ...prev, [key]: value };
        // Use queueMicrotask so the dirtyMapRef picks up the update before submitAll reads it
        dirtyMapRef.current = next;
        return next;
      });
      clearTimeout(timeoutRef.current);
      // Submit after state update is queued
      queueMicrotask(() => submitAll());
    },
    [submitAll],
  );

  /** Marks dirty without triggering a save — included in next debounced/immediate save. */
  const setDirtyOnly = useCallback(
    <K extends keyof SurveyFormFields>(key: K, value: SurveyFormFields[K]) => {
      setDirtyMap((prev) => {
        const next = { ...prev, [key]: value };
        dirtyMapRef.current = next;
        return next;
      });
    },
    [],
  );

  /** Alias for setImmediate("questions", ...). */
  const setQuestions = useCallback(
    (questions: ResearchLinkQuestion[]) => {
      setImmediate("questions", questions);
    },
    [setImmediate],
  );

  /** Force-submit any pending debounced edits immediately. */
  const flush = useCallback(() => {
    clearTimeout(timeoutRef.current);
    if (Object.keys(dirtyMapRef.current).length > 0) {
      submitAll();
    }
  }, [submitAll]);

  // Flush on unmount
  useEffect(() => {
    return () => flush();
  }, [flush]);

  // Flush on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => flush();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [flush]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
      clearTimeout(savedTimerRef.current);
    };
  }, []);

  const errors =
    fetcher.data && "errors" in fetcher.data ? fetcher.data.errors : undefined;

  return {
    fields,
    setText,
    setImmediate,
    setDirtyOnly,
    setQuestions,
    flush,
    status,
    errors,
  };
}
