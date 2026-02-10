/**
 * Derives unique speakers and per-person lens data from an empathy map.
 * Used by the interview detail page to display person-filtered empathy maps.
 */
import { useMemo } from "react";
import type { EmpathyMap } from "../lib/processEmpathyMap.server";

export type EmpathySpeaker = {
	id: string;
	name: string;
	count: number;
};

export type PersonLens = {
	id: string;
	name: string;
	painsAndGoals: {
		pains: Array<{ text: string; evidenceId: string; anchors: unknown }>;
		gains: Array<{ text: string; evidenceId: string; anchors: unknown }>;
	};
	empathyMap: {
		says: Array<{ text: string; evidenceId: string; anchors: unknown }>;
		does: Array<{ text: string; evidenceId: string; anchors: unknown }>;
		thinks: Array<{ text: string; evidenceId: string; anchors: unknown }>;
		feels: Array<{ text: string; evidenceId: string; anchors: unknown }>;
	};
};

export function useEmpathySpeakers(empathyMap: EmpathyMap): {
	uniqueSpeakers: EmpathySpeaker[];
	personLenses: PersonLens[];
} {
	const uniqueSpeakers = useMemo(() => {
		const speakerMap = new Map<string, { id: string; name: string; count: number }>();

		const allItems = [
			...empathyMap.says,
			...empathyMap.does,
			...empathyMap.thinks,
			...empathyMap.feels,
			...empathyMap.pains,
			...empathyMap.gains,
		];

		for (const item of allItems) {
			if (item.personId && item.personName) {
				const existing = speakerMap.get(item.personId);
				if (existing) {
					existing.count++;
				} else {
					speakerMap.set(item.personId, {
						id: item.personId,
						name: item.personName,
						count: 1,
					});
				}
			}
		}

		return Array.from(speakerMap.values()).sort((a, b) => {
			if (b.count !== a.count) return b.count - a.count;
			return a.name.localeCompare(b.name);
		});
	}, [empathyMap]);

	const personLenses = useMemo(() => {
		return uniqueSpeakers.map((speaker) => {
			const filterByPerson = (items: typeof empathyMap.says) => {
				return items
					.filter((item) => item.personId === speaker.id)
					.map((item) => ({
						text: item.text,
						evidenceId: item.evidenceId,
						anchors: item.anchors,
					}));
			};

			return {
				id: speaker.id,
				name: speaker.name,
				painsAndGoals: {
					pains: filterByPerson(empathyMap.pains),
					gains: filterByPerson(empathyMap.gains),
				},
				empathyMap: {
					says: filterByPerson(empathyMap.says),
					does: filterByPerson(empathyMap.does),
					thinks: filterByPerson(empathyMap.thinks),
					feels: filterByPerson(empathyMap.feels),
				},
			};
		});
	}, [uniqueSpeakers, empathyMap]);

	return { uniqueSpeakers, personLenses };
}
