import consola from "consola";
import { Hash, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { createClient } from "~/lib/supabase/client";

interface ThemesSectionProps {
	projectId?: string;
	accountId?: string;
	routes: any;
}

export function ThemesSection({ projectId, routes }: ThemesSectionProps) {
	const [themes, setThemes] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const supabase = createClient();

	useEffect(() => {
		if (!projectId) return;

		const fetchThemes = async () => {
			try {
				// Load themes with evidence counts
				const { data: themesData, error: themesError } = await supabase
					.from("themes")
					.select("id, name, statement, created_at")
					.eq("project_id", projectId)
					.order("created_at", { ascending: false });

				if (themesError) throw themesError;

				// Load theme evidence links to count frequency
				const { data: themeEvidence, error: evidenceError } = await supabase
					.from("theme_evidence")
					.select("theme_id, evidence:evidence_id(id, interview_id)")
					.eq("project_id", projectId);

				if (evidenceError) throw evidenceError;

				// Load evidence_people to get people count per theme
				const evidenceIds = themeEvidence?.map((te) => te.evidence?.id).filter(Boolean) || [];
				const { data: evidencePeople, error: peopleError } = await supabase
					.from("evidence_people")
					.select("evidence_id, person_id, person:person_id(id, name)")
					.eq("project_id", projectId)
					.in("evidence_id", evidenceIds);

				if (peopleError) throw peopleError;

				// Load people_personas to get personas per person
				const personIds = evidencePeople?.map((ep) => ep.person_id).filter(Boolean) || [];
				const { data: peoplePersonas, error: personasError } = await supabase
					.from("people_personas")
					.select("person_id, persona:persona_id(id, name)")
					.eq("project_id", projectId)
					.in("person_id", personIds);

				if (personasError) throw personasError;

				// Build theme data with counts
				const enrichedThemes =
					themesData?.map((theme) => {
						const themeEvidenceLinks = themeEvidence?.filter((te) => te.theme_id === theme.id) || [];
						const evidenceCount = themeEvidenceLinks.length;

						// Get unique people for this theme
						const themeEvidenceIds = themeEvidenceLinks.map((te) => te.evidence?.id).filter(Boolean);
						const themePeople = evidencePeople?.filter((ep) => themeEvidenceIds.includes(ep.evidence_id)) || [];
						const uniquePeople = new Set(themePeople.map((tp) => tp.person_id));
						const peopleCount = uniquePeople.size;

						// Get personas for this theme's people
						const themePersonas = new Set<string>();
						for (const personId of uniquePeople) {
							const personPersonas = peoplePersonas?.filter((pp) => pp.person_id === personId) || [];
							for (const pp of personPersonas) {
								if (pp.persona?.name) {
									themePersonas.add(pp.persona.name);
								}
							}
						}

						return {
							...theme,
							evidenceCount,
							peopleCount,
							personas: Array.from(themePersonas),
						};
					}) || [];

				// Sort by evidence count (frequency) descending
				enrichedThemes.sort((a, b) => b.evidenceCount - a.evidenceCount);

				setThemes(enrichedThemes);
			} catch (error) {
				consola.error("Failed to fetch themes:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchThemes();
	}, [projectId, supabase]);

	if (loading) {
		return (
			<div>
				<div className="mb-3 flex items-center gap-2">
					<Hash className="h-5 w-5 text-orange-600" />
					Top Themes
				</div>
				<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm">
					<CardContent className="p-3 sm:p-4">
						<div className="flex items-center justify-center py-4">
							<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-3 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Hash className="h-5 w-5 text-orange-600" />
					Top Themes
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => {
						if (routes?.themes?.index) {
							window.location.href = routes.themes.index();
						}
					}}
				>
					View All
				</Button>
			</div>
			<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm">
				<CardContent className="p-3 sm:p-4">
					{themes.length === 0 ? (
						<p className="text-muted-foreground text-sm">Pending</p>
					) : (
						<div className="space-y-3">
							{themes.slice(0, 3).map((theme) => (
								<div key={theme.id} className="rounded-lg border border-border bg-card/50 p-3">
									<div className="flex items-start justify-between gap-3">
										<div className="flex-1">
											<p className="font-medium text-foreground text-sm">{theme.name}</p>
											{theme.statement && (
												<p className="mt-1 line-clamp-2 text-muted-foreground text-xs">{theme.statement}</p>
											)}
											<div className="mt-2 flex flex-wrap gap-2">
												<span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-800 text-xs">
													{theme.evidenceCount} evidence
												</span>
												<span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-800 text-xs">
													{theme.peopleCount} people
												</span>
												{theme.personas.length > 0 && (
													<span className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-800 text-xs">
														{theme.personas.slice(0, 2).join(", ")}
														{theme.personas.length > 2 && ` +${theme.personas.length - 2}`}
													</span>
												)}
											</div>
										</div>
									</div>
								</div>
							))}
							{themes.length > 3 && (
								<p className="text-center text-muted-foreground text-xs">+{themes.length - 3} more themes</p>
							)}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
