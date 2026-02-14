/**
 * A2UI Surface Context
 *
 * Simplified replacement for GenUiContext (258 lines → ~80 lines).
 * Holds a single active SurfaceState and provides methods to apply messages.
 *
 * Responsibilities:
 * - Store the active A2UI surface state
 * - Apply incoming A2UI messages (surfaceUpdate, dataModelUpdate, etc.)
 * - Emit user actions to a callback
 * - Dismiss the surface
 */

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { type A2UIMessage, applySurfaceMessage, createEmptySurface, type SurfaceState } from "~/lib/gen-ui/a2ui";

interface A2UISurfaceContextValue {
	/** Current surface state */
	surface: SurfaceState | null;
	/** Whether a surface is active and ready to render */
	isActive: boolean;
	/** Apply an A2UI message to the surface */
	applyMessage: (message: A2UIMessage) => void;
	/** Apply multiple A2UI messages (e.g., from a tool result) */
	applyMessages: (messages: A2UIMessage[]) => void;
	/** Dismiss the active surface */
	dismiss: () => void;
}

const A2UISurfaceContext = createContext<A2UISurfaceContextValue | null>(null);

export function A2UISurfaceProvider({ children }: { children: ReactNode }) {
	const [surface, setSurface] = useState<SurfaceState | null>(null);

	const applyMessage = useCallback((message: A2UIMessage) => {
		setSurface((prev) => {
			const current = prev ?? createEmptySurface(message.surfaceId);
			if (message.type === "deleteSurface") {
				return null;
			}
			return applySurfaceMessage(current, message);
		});
	}, []);

	const applyMessages = useCallback(
		(messages: A2UIMessage[]) => {
			for (const msg of messages) {
				applyMessage(msg);
			}
		},
		[applyMessage]
	);

	const dismiss = useCallback(() => {
		setSurface(null);
	}, []);

	const isActive = useMemo(() => {
		return surface !== null && surface.components.size > 0;
	}, [surface]);

	const value = useMemo<A2UISurfaceContextValue>(
		() => ({ surface, isActive, applyMessage, applyMessages, dismiss }),
		[surface, isActive, applyMessage, applyMessages, dismiss]
	);

	return <A2UISurfaceContext.Provider value={value}>{children}</A2UISurfaceContext.Provider>;
}

export function useA2UISurface(): A2UISurfaceContextValue {
	const ctx = useContext(A2UISurfaceContext);
	if (!ctx) {
		throw new Error("useA2UISurface must be used within <A2UISurfaceProvider>");
	}
	return ctx;
}

export function useA2UISurfaceOptional(): A2UISurfaceContextValue | null {
	return useContext(A2UISurfaceContext);
}
