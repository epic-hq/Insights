/**
 * useAgentState - Bidirectional state sync between UI and Agent
 *
 * Creates a shared state that:
 * 1. UI can modify directly (optimistic updates)
 * 2. Agent can modify via tool calls
 * 3. Changes are tracked for agent awareness
 * 4. State can be serialized for agent context
 */

import { useCallback, useRef, useState } from "react";

export interface AgentStateChange<T> {
  type: "ui" | "agent";
  action: string;
  payload: unknown;
  timestamp: number;
  previousState: T;
  newState: T;
}

export interface AgentStateOptions<T> {
  initialState: T;
  /** Called when state changes from UI - can send to agent */
  onUIChange?: (change: AgentStateChange<T>) => void;
  /** Max changes to keep in history */
  maxHistory?: number;
}

export interface AgentStateReturn<T> {
  /** Current state */
  state: T;
  /** Update state from UI (tracks change) */
  updateFromUI: (action: string, updater: (prev: T) => T) => void;
  /** Update state from agent tool output */
  updateFromAgent: (action: string, newState: T) => void;
  /** Get state as string for agent context */
  getStateForAgent: () => string;
  /** Get recent changes for agent awareness */
  getRecentChanges: () => AgentStateChange<T>[];
  /** Clear change history */
  clearHistory: () => void;
}

export function useAgentState<T>(
  options: AgentStateOptions<T>,
): AgentStateReturn<T> {
  const { initialState, onUIChange, maxHistory = 10 } = options;

  const [state, setState] = useState<T>(initialState);
  const historyRef = useRef<AgentStateChange<T>[]>([]);

  const addToHistory = useCallback(
    (change: AgentStateChange<T>) => {
      historyRef.current = [
        change,
        ...historyRef.current.slice(0, maxHistory - 1),
      ];
    },
    [maxHistory],
  );

  const updateFromUI = useCallback(
    (action: string, updater: (prev: T) => T) => {
      setState((prev) => {
        const newState = updater(prev);
        const change: AgentStateChange<T> = {
          type: "ui",
          action,
          payload: null, // Could enhance to track specific payload
          timestamp: Date.now(),
          previousState: prev,
          newState,
        };
        addToHistory(change);
        onUIChange?.(change);
        return newState;
      });
    },
    [addToHistory, onUIChange],
  );

  const updateFromAgent = useCallback(
    (action: string, newState: T) => {
      setState((prev) => {
        const change: AgentStateChange<T> = {
          type: "agent",
          action,
          payload: newState,
          timestamp: Date.now(),
          previousState: prev,
          newState,
        };
        addToHistory(change);
        return newState;
      });
    },
    [addToHistory],
  );

  const getStateForAgent = useCallback(() => {
    return JSON.stringify(state, null, 2);
  }, [state]);

  const getRecentChanges = useCallback(() => {
    return historyRef.current;
  }, []);

  const clearHistory = useCallback(() => {
    historyRef.current = [];
  }, []);

  return {
    state,
    updateFromUI,
    updateFromAgent,
    getStateForAgent,
    getRecentChanges,
    clearHistory,
  };
}

/**
 * Helper to create agent tools that work with AgentState
 */
export function createAgentStateTools<T>(
  getState: () => T,
  updateState: (action: string, newState: T) => void,
) {
  return {
    /** Tool to read current state */
    readState: () => ({
      state: getState(),
      asString: JSON.stringify(getState(), null, 2),
    }),

    /** Tool to replace entire state */
    setState: (newState: T) => {
      updateState("setState", newState);
      return { success: true, state: newState };
    },

    /** Tool to patch state (shallow merge) */
    patchState: (patch: Partial<T>) => {
      const current = getState();
      const newState = { ...current, ...patch } as T;
      updateState("patchState", newState);
      return { success: true, state: newState };
    },
  };
}
