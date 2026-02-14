/**
 * Generates a text summary of participant facets (role, segment, personas)
 * for use in system context prompts and display.
 */
import { useMemo } from "react";

type Participant = {
	display_name?: string | null;
	transcript_key?: string | null;
	role?: string | null;
	people?: {
		name?: string | null;
		segment?: string | null;
		people_personas?: Array<{
			personas?: { name?: string | null } | null;
		}>;
	} | null;
};

export function usePersonalFacetSummary(participants: Participant[]): string {
	return useMemo(() => {
		if (!participants.length) return "";

		const lines = participants
			.map((participant) => {
				const person =
					(participant.people as {
						name?: string | null;
						segment?: string | null;
						people_personas?: Array<{
							personas?: { name?: string | null } | null;
						}>;
					} | null) || null;
				const personaNames = Array.from(
					new Set(
						(person?.people_personas || [])
							.map((entry) => entry?.personas?.name)
							.filter((name): name is string => typeof name === "string" && name.trim().length > 0)
					)
				);

				const facets: string[] = [];
				if (participant.role) facets.push(`Role: ${participant.role}`);
				if (person?.segment) facets.push(`Segment: ${person.segment}`);
				if (personaNames.length > 0) facets.push(`Personas: ${personaNames.join(", ")}`);

				const displayName =
					person?.name ||
					participant.display_name ||
					(participant.transcript_key ? `Speaker ${participant.transcript_key}` : null);

				if (!displayName && facets.length === 0) {
					return null;
				}

				return `- ${(displayName || "Participant").trim()}${facets.length ? ` (${facets.join("; ")})` : ""}`;
			})
			.filter((line): line is string => Boolean(line));

		return lines.slice(0, 8).join("\n");
	}, [participants]);
}
