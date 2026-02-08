import type { Insight } from "~/types";

export type SortKey = "newest" | "mostPinned" | "mostEvidence";
export type Filters = {
	q: string;
	emotion?: string;
	category?: string;
	// pinned?: boolean
	// hasEvidence?: boolean
};

export function applyFilters(list: Insight[], f: Filters) {
	const q = f.q?.toLowerCase().trim();
	return list.filter((x) => {
		if (q && !`${x.name} ${x.details ?? ""} ${x.category ?? ""}`.toLowerCase().includes(q)) return false;
		if (f.emotion && x.emotional_response !== f.emotion) return false;
		if (f.category && x.category !== f.category) return false;
		// if (f.pinned != null && !!x.pinned !== f.pinned) return false
		// if (f.hasEvidence && !(x.evidence_count && x.evidence_count > 0)) return false
		return true;
	});
}

export function sortInsights(list: Insight[], by: SortKey) {
	const copy = [...list];
	switch (by) {
		case "mostPinned":
			return copy.sort((a, b) => Number(b.pinned) - Number(a.pinned) || cmpDate(b, a));
		case "mostEvidence":
			return copy.sort((a, b) => (b.evidence_count ?? 0) - (a.evidence_count ?? 0) || cmpDate(b, a));
		default:
			return copy.sort((a, b) => cmpDate(b, a));
	}
}
const cmpDate = (a: Insight, b: Insight) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
