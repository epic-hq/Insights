import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { createStore } from "zustand/vanilla";

const toArray = (value: string | string[]): string[] => (Array.isArray(value) ? value : [value]);
const dedupe = (ids: string[]): string[] =>
	Array.from(new Set(ids.filter((id) => typeof id === "string" && id.length > 0)));

export interface QuestionQueueState {
	orderedIds: string[];
	backlogIds: string[];
	mustHavesOnly: boolean;
	previousSelection: string[] | null;
	setOrderedIds: (ids: string[]) => void;
	setBacklogIds: (ids: string[]) => void;
	initialize: (orderedIds: string[], backlogIds: string[]) => void;
	setMustHavesOnly: (value: boolean) => void;
	setPreviousSelection: (ids: string[] | null) => void;
	appendIds: (ids: string | string[]) => string[];
	insertAfter: (anchorId: string | null, id: string) => string[];
	reorderVisible: (visibleIds: string[], fromIndex: number, toIndex: number) => string[];
	removeIds: (ids: string | string[]) => string[];
}

export type QuestionQueueStore = StoreApi<QuestionQueueState>;

export const createQuestionQueueStore = () =>
	createStore<QuestionQueueState>((set, get) => ({
		orderedIds: [],
		backlogIds: [],
		mustHavesOnly: false,
		previousSelection: null,
		setOrderedIds: (ids) => set({ orderedIds: dedupe(ids) }),
		setBacklogIds: (ids) => set({ backlogIds: dedupe(ids) }),
		initialize: (orderedIds, backlogIds) =>
			set({
				orderedIds: dedupe(orderedIds),
				backlogIds: dedupe(backlogIds),
				previousSelection: null,
			}),
		setMustHavesOnly: (value) => set({ mustHavesOnly: value }),
		setPreviousSelection: (ids) => set({ previousSelection: ids ? [...ids] : null }),
		appendIds: (ids) => {
			const next = dedupe([...get().orderedIds, ...toArray(ids)]);
			set({ orderedIds: next });
			return next;
		},
		insertAfter: (anchorId, id) => {
			const filtered = get().orderedIds.filter((existing) => existing !== id);
			const anchorIndex = anchorId ? filtered.indexOf(anchorId) : -1;
			if (anchorIndex >= 0) {
				filtered.splice(anchorIndex + 1, 0, id);
			} else {
				filtered.push(id);
			}
			set({ orderedIds: filtered });
			return filtered;
		},
		reorderVisible: (visibleIds, fromIndex, toIndex) => {
			const base = get().orderedIds;
			const normalized = visibleIds.filter((id) => base.includes(id));
			if (!normalized[fromIndex] || !normalized[toIndex]) return base;
			const reordered = [...normalized];
			const [moved] = reordered.splice(fromIndex, 1);
			reordered.splice(toIndex, 0, moved);
			const visibleSet = new Set(normalized);
			let pointer = 0;
			const next = base.map((id) => (visibleSet.has(id) ? (reordered[pointer++] ?? id) : id));
			set({ orderedIds: next });
			return next;
		},
		removeIds: (ids) => {
			const removalSet = new Set(toArray(ids));
			const nextOrdered = get().orderedIds.filter((id) => !removalSet.has(id));
			const nextBacklog = get().backlogIds.filter((id) => !removalSet.has(id));
			set({ orderedIds: nextOrdered, backlogIds: nextBacklog });
			return nextOrdered;
		},
	}));

export function useQuestionQueueStore<T>(store: QuestionQueueStore, selector: (state: QuestionQueueState) => T) {
	return useStore(store, selector);
}
