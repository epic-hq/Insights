/**
 * CanvasPanel - Full display context for A2UI widgets
 *
 * Replaces the Outlet when the agent has an active surface to show.
 * Designed to give widgets the full main content area instead of
 * competing with the existing page.
 */

import { useCallback, useEffect, useRef } from "react";
import { useA2UISurfaceOptional } from "~/contexts/a2ui-surface-context";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useProjectStatusAgent } from "~/contexts/project-status-agent-context";
import { persistCanvasAction } from "~/lib/gen-ui/canvas-persistence.client";
import type { CanvasActionEvent } from "~/lib/gen-ui/ui-events";
import { cn } from "~/lib/utils";
import { A2UIRenderer, type A2UIAction } from "./A2UIRenderer";

export function CanvasPanel() {
  const a2ui = useA2UISurfaceOptional();
  const { projectId } = useCurrentProject();
  const { sendUiEvent } = useProjectStatusAgent();
  const panelRef = useRef<HTMLDivElement>(null);

  // Scroll to top when a new surface arrives
  useEffect(() => {
    if (a2ui?.isActive) {
      panelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [a2ui?.surface?.surfaceId, a2ui?.isActive]);

  const handleAction = useCallback(
    async (action: A2UIAction) => {
      const persistResult = projectId
        ? await persistCanvasAction(action, projectId)
        : { saved: false, error: "Missing projectId" };

      const event: CanvasActionEvent = {
        type: "canvas_action",
        componentType: action.componentType,
        componentId: action.componentId,
        actionName: action.actionName,
        payload: action.payload ?? null,
        persisted: persistResult.saved,
        persistError: persistResult.error ?? null,
        source: "canvas",
        occurredAt: new Date().toISOString(),
      };

      sendUiEvent(event);
    },
    [projectId, sendUiEvent],
  );

  if (!a2ui?.isActive || !a2ui.surface) return null;

  return (
    <div
      ref={panelRef}
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-auto",
        "animate-in fade-in duration-200",
      )}
    >
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <A2UIRenderer
          surface={a2ui.surface}
          onAction={handleAction}
          onDismiss={() => a2ui.dismiss()}
          onToggleCollapse={() => a2ui.toggleCollapse()}
          isCollapsed={a2ui.isCollapsed}
        />
      </div>
    </div>
  );
}
