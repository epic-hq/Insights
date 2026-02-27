/**
 * Auto-save hook for the survey editor.
 * Uses useFetcher to submit form data without navigation or loader revalidation.
 * Provides debounced save for text fields and immediate save for structural changes.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router-dom";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

interface UseSurveyAutoSaveOptions {
  /** Debounce delay in ms for text field changes. Default 1000. */
  debounceMs?: number;
  /** How long "Saved" status persists before returning to idle. Default 2000. */
  savedDisplayMs?: number;
}

export function useSurveyAutoSave({
  debounceMs = 1000,
  savedDisplayMs = 2000,
}: UseSurveyAutoSaveOptions = {}) {
  const fetcher = useFetcher<{
    ok?: boolean;
    errors?: Record<string, string>;
  }>();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const pendingDataRef = useRef<Record<string, string> | null>(null);

  // Derive status from fetcher state
  useEffect(() => {
    if (fetcher.state === "submitting" || fetcher.state === "loading") {
      setStatus("saving");
    } else if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.errors) {
        setStatus("error");
      } else {
        setStatus("saved");
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(
          () => setStatus("idle"),
          savedDisplayMs,
        );
      }
    }
  }, [fetcher.state, fetcher.data, savedDisplayMs]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
      clearTimeout(savedTimerRef.current);
    };
  }, []);

  /** Submit immediately (for structural changes like toggles, add/delete). */
  const save = useCallback(
    (formData: Record<string, string>) => {
      clearTimeout(timeoutRef.current);
      pendingDataRef.current = null;
      fetcher.submit(formData, { method: "post" });
    },
    [fetcher],
  );

  /** Submit after debounce delay (for text field typing). */
  const debouncedSave = useCallback(
    (formData: Record<string, string>) => {
      clearTimeout(timeoutRef.current);
      pendingDataRef.current = formData;
      timeoutRef.current = setTimeout(() => {
        pendingDataRef.current = null;
        fetcher.submit(formData, { method: "post" });
      }, debounceMs);
    },
    [fetcher, debounceMs],
  );

  /** Flush any pending debounced save immediately (for unmount / beforeunload). */
  const flush = useCallback(() => {
    if (pendingDataRef.current) {
      clearTimeout(timeoutRef.current);
      fetcher.submit(pendingDataRef.current, { method: "post" });
      pendingDataRef.current = null;
    }
  }, [fetcher]);

  // Flush pending save on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => flush();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [flush]);

  return { save, debouncedSave, flush, status, fetcher };
}
