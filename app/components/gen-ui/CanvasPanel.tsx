/**
 * CanvasPanel - Full display context for A2UI widgets
 *
 * Replaces the Outlet when the agent has an active surface to show.
 * Designed to give widgets the full main content area instead of
 * competing with the existing page.
 */

import { useEffect, useRef } from "react";
import { useA2UISurfaceOptional } from "~/contexts/a2ui-surface-context";
import { cn } from "~/lib/utils";
import { A2UIRenderer } from "./A2UIRenderer";

export function CanvasPanel() {
	const a2ui = useA2UISurfaceOptional();
	const panelRef = useRef<HTMLDivElement>(null);

	// Scroll to top when a new surface arrives
	useEffect(() => {
		if (a2ui?.isActive) {
			panelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
		}
	}, [a2ui?.surface?.surfaceId, a2ui?.isActive]);

	if (!a2ui?.isActive || !a2ui.surface) return null;

	return (
		<div ref={panelRef} className={cn("flex min-h-0 flex-1 flex-col overflow-auto", "fade-in animate-in duration-200")}>
			<div className="mx-auto w-full max-w-4xl px-6 py-8">
				<A2UIRenderer
					surface={a2ui.surface}
					onDismiss={() => a2ui.dismiss()}
					onToggleCollapse={() => a2ui.toggleCollapse()}
					isCollapsed={a2ui.isCollapsed}
				/>
			</div>
		</div>
	);
}
