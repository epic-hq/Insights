/**
 * Processes evidence rows into an empathy map structure.
 * Extracts says/does/thinks/feels/pains/gains from evidence,
 * deduplicates, and limits to a reasonable display count.
 */

export type EmpathyMapItem = {
	text: string;
	evidenceId: string;
	anchors?: unknown;
	personId?: string;
	personName?: string;
};

export type EmpathyMap = {
	says: EmpathyMapItem[];
	does: EmpathyMapItem[];
	thinks: EmpathyMapItem[];
	feels: EmpathyMapItem[];
	pains: EmpathyMapItem[];
	gains: EmpathyMapItem[];
};

type EvidenceRow = {
	id: string;
	anchors?: unknown;
	says?: unknown;
	does?: unknown;
	thinks?: unknown;
	feels?: unknown;
	pains?: unknown;
	gains?: unknown;
	evidence_people?: Array<{
		people?: {
			id?: string;
			name?: string | null;
		} | null;
	}>;
};

function deduplicateAndLimit(items: EmpathyMapItem[], limit = 8): EmpathyMapItem[] {
	const seen = new Set<string>();
	return items
		.filter((item) => {
			if (seen.has(item.text)) return false;
			seen.add(item.text);
			return true;
		})
		.slice(0, limit);
}

function pushCategory(
	target: EmpathyMapItem[],
	items: unknown,
	evidenceId: string,
	anchors: unknown,
	personId?: string,
	personName?: string
) {
	if (!Array.isArray(items)) return;
	for (const item of items) {
		if (typeof item === "string" && item.trim()) {
			target.push({
				text: item.trim(),
				evidenceId,
				anchors,
				personId,
				personName,
			});
		}
	}
}

export function processEmpathyMap(evidence: EvidenceRow[] | null | undefined): EmpathyMap {
	const empathyMap: EmpathyMap = {
		says: [],
		does: [],
		thinks: [],
		feels: [],
		pains: [],
		gains: [],
	};

	if (!evidence) return empathyMap;

	for (const e of evidence) {
		const personData = Array.isArray(e.evidence_people) && e.evidence_people.length > 0 ? e.evidence_people[0] : null;
		const personId = personData?.people?.id;
		const personName = personData?.people?.name ?? undefined;

		pushCategory(empathyMap.says, e.says, e.id, e.anchors, personId, personName);
		pushCategory(empathyMap.does, e.does, e.id, e.anchors, personId, personName);
		pushCategory(empathyMap.thinks, e.thinks, e.id, e.anchors, personId, personName);
		pushCategory(empathyMap.feels, e.feels, e.id, e.anchors, personId, personName);
		pushCategory(empathyMap.pains, e.pains, e.id, e.anchors, personId, personName);
		pushCategory(empathyMap.gains, e.gains, e.id, e.anchors, personId, personName);
	}

	empathyMap.says = deduplicateAndLimit(empathyMap.says);
	empathyMap.does = deduplicateAndLimit(empathyMap.does);
	empathyMap.thinks = deduplicateAndLimit(empathyMap.thinks);
	empathyMap.feels = deduplicateAndLimit(empathyMap.feels);
	empathyMap.pains = deduplicateAndLimit(empathyMap.pains);
	empathyMap.gains = deduplicateAndLimit(empathyMap.gains);

	return empathyMap;
}
