/**
 * ConversationLensInsights — Canvas widget for conversation lens analysis
 *
 * Renders JTBD analyses with a rich layout (job statement hero, forces quadrant,
 * journey matrix, recommendations). Non-JTBD lenses fall back to a simpler
 * section card layout with key/value pairs.
 *
 * Data shape mirrors `conversation_lens_analyses.analysis_data` — no reshaping
 * needed from the agent. Helper functions extracted from GenericLensView.tsx.
 */

import { AlertTriangle, ArrowRight, BookOpen, ExternalLink, MessageSquare } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

// ── Types ──

export interface ConversationLensInsightsData {
	templateKey: string;
	templateName: string;
	interviewCount: number;
	mode: "single" | "aggregated";
	analysisData: Record<string, unknown> | null;
	synthesisData: Record<string, unknown> | null;
	lensDetailUrl: string | null;
	interviewTitle: string | null;
	interviewUrl: string | null;
	personName: string | null;
}

type SectionData = { fields: Array<Record<string, unknown>>; summary?: string };
type SectionDataMap = Record<string, SectionData>;

type JobMapStep = {
	step_key?: string;
	step_name: string;
	summary?: string;
	pains?: string[];
	workarounds?: string[];
	metrics?: string[];
	evidence_ids?: string[];
};

// ── Pure helpers (extracted from GenericLensView.tsx) ──

function parseTextArrayValue(value: unknown): string[] | null {
	if (Array.isArray(value)) {
		return value.length > 0 ? value : null;
	}
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
			try {
				const parsed = JSON.parse(trimmed);
				if (Array.isArray(parsed) && parsed.length > 0) {
					return parsed;
				}
			} catch {
				const inner = trimmed.slice(1, -1).trim();
				if (inner) {
					const items = inner
						.split(/,\s*(?=[A-Z])/)
						.map((s) => s.trim())
						.filter(Boolean);
					if (items.length > 0) return items;
				}
			}
		}
		if (trimmed) return [trimmed];
	}
	return null;
}

function normalizeStringArray(value: unknown): string[] {
	const parsed = parseTextArrayValue(value);
	if (!parsed) return [];
	return parsed
		.map((item) => `${item}`)
		.map((item) => item.trim())
		.filter(Boolean);
}

function parseJSONValue<T>(value: unknown): T | null {
	if (typeof value !== "string") return null;
	try {
		return JSON.parse(value) as T;
	} catch {
		return null;
	}
}

function getSectionField(
	sectionDataMap: SectionDataMap,
	sectionKey: string,
	fieldKey: string
): Record<string, unknown> | undefined {
	return sectionDataMap[sectionKey]?.fields?.find((field) => field?.field_key === fieldKey);
}

function getSectionFieldFromPath(
	sectionDataMap: SectionDataMap,
	defaultSectionKey: string,
	pathOrField: string | undefined,
	fallbackFieldKey: string
): Record<string, unknown> | undefined {
	const target = pathOrField || fallbackFieldKey;
	if (!target) return undefined;
	if (target.includes(".")) {
		const [sectionKey, fieldKey] = target.split(".", 2);
		if (!sectionKey || !fieldKey) return undefined;
		return getSectionField(sectionDataMap, sectionKey, fieldKey);
	}
	return getSectionField(sectionDataMap, defaultSectionKey, target);
}

function parseJobMapSteps(value: unknown): JobMapStep[] {
	const fromObjectList = (items: unknown[]): JobMapStep[] =>
		items
			.map((item, index) => {
				if (!item || typeof item !== "object") return null;
				const c = item as Record<string, unknown>;
				const stepName =
					typeof c.step_name === "string"
						? c.step_name
						: typeof c.name === "string"
							? c.name
							: typeof c.step === "string"
								? c.step
								: `Step ${index + 1}`;
				const step: JobMapStep = {
					step_name: stepName.trim(),
					pains: normalizeStringArray(c.pains),
					workarounds: normalizeStringArray(c.workarounds),
					metrics: normalizeStringArray(c.metrics),
					evidence_ids: normalizeStringArray(c.evidence_ids),
				};
				if (typeof c.step_key === "string") step.step_key = c.step_key;
				if (typeof c.summary === "string") {
					step.summary = c.summary;
				} else if (typeof c.detail === "string") {
					step.summary = c.detail;
				}
				return step;
			})
			.filter((step): step is JobMapStep => !!step && !!step.step_name);

	if (Array.isArray(value)) {
		if (value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
			return fromObjectList(value);
		}
		return normalizeStringArray(value).map((line, index) => {
			const [head, ...rest] = line.split(":");
			const detail = rest.join(":").trim();
			const step: JobMapStep = {
				step_key: `step_${index + 1}`,
				step_name: head?.trim() || `Step ${index + 1}`,
			};
			if (detail || line) step.summary = detail || line;
			return step;
		});
	}

	const parsedJson = parseJSONValue<unknown>(value);
	if (Array.isArray(parsedJson)) {
		return parseJobMapSteps(parsedJson);
	}

	return normalizeStringArray(value).map((line, index) => {
		const [head, ...rest] = line.split(":");
		const detail = rest.join(":").trim();
		const step: JobMapStep = {
			step_key: `step_${index + 1}`,
			step_name: head?.trim() || `Step ${index + 1}`,
		};
		if (detail || line) step.summary = detail || line;
		return step;
	});
}

function dedupeItems(items: string[]): string[] {
	return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function distributeItemsByStep(steps: JobMapStep[], items: string[]): string[][] {
	const buckets = steps.map(() => [] as string[]);
	if (steps.length === 0 || items.length === 0) return buckets;

	const normalizedSteps = steps.map((step) =>
		`${step.step_name} ${step.summary || ""}`
			.toLowerCase()
			.replace(/[^a-z0-9\s]+/g, " ")
			.replace(/\s+/g, " ")
			.trim()
	);
	const leftovers: string[] = [];

	for (const item of items) {
		const normalizedItem = item
			.toLowerCase()
			.replace(/[^a-z0-9\s]+/g, " ")
			.replace(/\s+/g, " ")
			.trim();
		const matchedIndex = normalizedSteps.findIndex(
			(stepName) => stepName.length > 2 && normalizedItem.includes(stepName)
		);
		if (matchedIndex >= 0) {
			buckets[matchedIndex].push(item);
		} else {
			leftovers.push(item);
		}
	}

	leftovers.forEach((item, index) => {
		buckets[index % steps.length].push(item);
	});

	return buckets;
}

// ── Data extraction helpers ──

function buildSectionDataMap(analysisData: Record<string, unknown>): SectionDataMap {
	const map: SectionDataMap = {};
	const sections = analysisData.sections;
	if (!Array.isArray(sections)) return map;

	for (const section of sections) {
		if (!section || typeof section !== "object") continue;
		const s = section as Record<string, unknown>;
		const key = typeof s.section_key === "string" ? s.section_key : null;
		if (!key) continue;
		map[key] = {
			fields: Array.isArray(s.fields) ? s.fields : [],
			summary: typeof s.summary === "string" ? s.summary : undefined,
		};
	}
	return map;
}

function getFieldValue(field: Record<string, unknown> | undefined): unknown {
	if (!field) return undefined;
	return field.value ?? field.text_value ?? field.text_array_value;
}

function getStringValue(field: Record<string, unknown> | undefined): string | null {
	const val = getFieldValue(field);
	if (typeof val === "string" && val.trim()) return val.trim();
	return null;
}

function getArrayValue(field: Record<string, unknown> | undefined): string[] {
	return normalizeStringArray(getFieldValue(field));
}

function isJtbd(templateKey: string): boolean {
	return templateKey.includes("jtbd") || templateKey.includes("jobs-to-be-done");
}

// ── Sub-components ──

function SectionHeader({
	icon,
	title,
	subtitle,
	trailing,
}: {
	icon: ReactNode;
	title: string;
	subtitle?: string | null;
	trailing?: ReactNode;
}) {
	return (
		<div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
			<div className="flex items-center gap-2">
				{icon}
				<div>
					<h4 className="font-semibold">{title}</h4>
					{subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
				</div>
			</div>
			{trailing}
		</div>
	);
}

function ForceQuadrant({ label, color, items }: { label: string; color: string; items: string[] }) {
	if (items.length === 0) return null;
	return (
		<div className="min-w-0 flex-1 space-y-1.5">
			<div className="flex items-center gap-1.5">
				<span className={cn("inline-block h-2.5 w-2.5 rounded-full", color)} />
				<span className="font-medium text-xs">
					{label} ({items.length})
				</span>
			</div>
			<ul className="space-y-1">
				{items.slice(0, 4).map((item, i) => (
					<li key={i} className="text-muted-foreground text-xs leading-snug">
						{item}
					</li>
				))}
				{items.length > 4 && <li className="text-muted-foreground/60 text-xs">+{items.length - 4} more</li>}
			</ul>
		</div>
	);
}

function JourneyStep({
	step,
	index,
	insights,
	opportunities,
}: {
	step: JobMapStep;
	index: number;
	insights: string[];
	opportunities: string[];
}) {
	const hasPains = (step.pains?.length ?? 0) > 0;
	return (
		<div className="min-w-[180px] max-w-[220px] shrink-0 space-y-2 rounded-md border bg-muted/30 p-3">
			<div className="flex items-center gap-1.5">
				{hasPains && <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />}
				<span className="truncate font-medium text-sm">{step.step_name}</span>
			</div>
			{step.summary && <p className="line-clamp-2 text-muted-foreground text-xs">{step.summary}</p>}
			{insights.length > 0 && (
				<div className="space-y-0.5">
					<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">Insights</span>
					{insights.slice(0, 2).map((item, i) => (
						<p key={i} className="line-clamp-2 text-xs leading-snug">
							{item}
						</p>
					))}
				</div>
			)}
			{opportunities.length > 0 && (
				<div className="space-y-0.5">
					<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">Opportunities</span>
					{opportunities.slice(0, 2).map((item, i) => (
						<p key={i} className="line-clamp-2 text-primary text-xs leading-snug">
							{item}
						</p>
					))}
				</div>
			)}
		</div>
	);
}

function RecommendationRow({ priority, description }: { priority: string; description: string }) {
	const color = priority === "high" ? "bg-red-500" : priority === "medium" ? "bg-amber-500" : "bg-blue-400";
	return (
		<div className="flex items-start gap-2 px-4 py-2">
			<span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", color)} />
			<div className="min-w-0 flex-1">
				<span className="text-sm">{description}</span>
				<span className="ml-1.5 text-muted-foreground text-xs">({priority})</span>
			</div>
		</div>
	);
}

// ── JTBD Layout ──

function JtbdLayout({
	data,
	analysisData,
}: {
	data: ConversationLensInsightsData;
	analysisData: Record<string, unknown>;
}) {
	const sectionMap = buildSectionDataMap(analysisData);

	// Job statement
	const jobStatementField = getSectionFieldFromPath(sectionMap, "core_job", undefined, "job_statement");
	const jobStatement = getStringValue(jobStatementField);

	// Forces of progress
	const pushField = getSectionField(sectionMap, "forces_of_progress", "push_forces");
	const pullField = getSectionField(sectionMap, "forces_of_progress", "pull_forces");
	const anxietyField = getSectionField(sectionMap, "forces_of_progress", "anxieties");
	const habitField = getSectionField(sectionMap, "forces_of_progress", "habits_inertia");

	const pushItems = getArrayValue(pushField);
	const pullItems = getArrayValue(pullField);
	const anxietyItems = getArrayValue(anxietyField);
	const habitItems = getArrayValue(habitField);
	const hasForces = pushItems.length > 0 || pullItems.length > 0 || anxietyItems.length > 0 || habitItems.length > 0;

	// Journey matrix
	const jobStepsField = getSectionField(sectionMap, "job_map", "job_steps_summary");
	const steps = parseJobMapSteps(getFieldValue(jobStepsField));

	// Distribute insights and opportunities across steps
	const desiredOutcomes = getArrayValue(getSectionField(sectionMap, "outcomes", "desired_outcomes"));
	const unmetOutcomes = getArrayValue(getSectionField(sectionMap, "outcomes", "unmet_outcomes"));
	const allInsights = dedupeItems([...desiredOutcomes, ...unmetOutcomes]);
	const insightBuckets = distributeItemsByStep(steps, allInsights);

	const oppCandidates = getArrayValue(getSectionField(sectionMap, "opportunity_board", "opportunity_candidates"));
	const topOpp = getArrayValue(getSectionField(sectionMap, "opportunity_board", "highest_priority_opportunity"));
	const allOpps = dedupeItems([...oppCandidates, ...topOpp]);
	const oppBuckets = distributeItemsByStep(steps, allOpps);

	// Recommendations
	const recommendations = Array.isArray(analysisData.recommendations)
		? (analysisData.recommendations as Array<Record<string, unknown>>)
		: [];

	return (
		<>
			{/* Job Statement Hero */}
			{jobStatement && (
				<div className="border-b bg-primary/5 px-4 py-4">
					<p className="font-medium text-sm italic leading-relaxed">&ldquo;{jobStatement}&rdquo;</p>
				</div>
			)}

			{/* Forces of Progress 2×2 */}
			{hasForces && (
				<div className="border-b px-4 py-3">
					<h5 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
						Forces of Progress
					</h5>
					<div className="grid grid-cols-2 gap-3">
						<ForceQuadrant label="Push" color="bg-red-500" items={pushItems} />
						<ForceQuadrant label="Pull" color="bg-emerald-500" items={pullItems} />
						<ForceQuadrant label="Anxieties" color="bg-amber-500" items={anxietyItems} />
						<ForceQuadrant label="Habits" color="bg-slate-400" items={habitItems} />
					</div>
				</div>
			)}

			{/* Journey Matrix (horizontal scroll) */}
			{steps.length > 0 && (
				<div className="border-b px-4 py-3">
					<h5 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Journey Map</h5>
					<div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
						{steps.map((step, i) => (
							<JourneyStep
								key={step.step_key ?? i}
								step={step}
								index={i}
								insights={insightBuckets[i] ?? []}
								opportunities={oppBuckets[i] ?? []}
							/>
						))}
					</div>
				</div>
			)}

			{/* Recommendations */}
			{recommendations.length > 0 && (
				<div className="border-b py-1">
					<h5 className="mb-1 px-4 pt-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
						Recommendations
					</h5>
					{recommendations.map((rec, i) => (
						<RecommendationRow
							key={i}
							priority={typeof rec.priority === "string" ? rec.priority : "medium"}
							description={typeof rec.description === "string" ? rec.description : String(rec.description ?? "")}
						/>
					))}
				</div>
			)}
		</>
	);
}

// ── Generic (non-JTBD) Layout ──

function GenericLensLayout({ analysisData }: { analysisData: Record<string, unknown> }) {
	const sections = Array.isArray(analysisData.sections)
		? (analysisData.sections as Array<Record<string, unknown>>)
		: [];

	if (sections.length === 0) {
		return <div className="px-4 py-6 text-center text-muted-foreground text-sm">No analysis data available.</div>;
	}

	return (
		<div className="divide-y">
			{sections.map((section, si) => {
				const sectionKey = typeof section.section_key === "string" ? section.section_key : `s${si}`;
				const sectionLabel = typeof section.section_label === "string" ? section.section_label : sectionKey;
				const fields = Array.isArray(section.fields) ? section.fields : [];
				const summary = typeof section.summary === "string" ? section.summary : null;

				return (
					<div key={sectionKey} className="px-4 py-3">
						<h5 className="mb-1.5 font-medium text-sm">{sectionLabel}</h5>
						{summary && <p className="mb-2 text-muted-foreground text-xs">{summary}</p>}
						<div className="space-y-1.5">
							{fields.map((field: Record<string, unknown>, fi: number) => {
								const fieldLabel =
									typeof field.field_label === "string"
										? field.field_label
										: typeof field.field_key === "string"
											? field.field_key
											: `Field ${fi + 1}`;
								const val = field.value ?? field.text_value ?? field.text_array_value;
								const items = normalizeStringArray(val);
								const singleVal = typeof val === "string" ? val.trim() : null;

								if (items.length > 1) {
									return (
										<div key={fi}>
											<span className="font-medium text-muted-foreground text-xs">{fieldLabel}</span>
											<ul className="mt-0.5 space-y-0.5">
												{items.slice(0, 5).map((item, ii) => (
													<li key={ii} className="text-xs leading-snug">
														{item}
													</li>
												))}
												{items.length > 5 && (
													<li className="text-muted-foreground/60 text-xs">+{items.length - 5} more</li>
												)}
											</ul>
										</div>
									);
								}

								if (singleVal) {
									return (
										<div key={fi}>
											<span className="font-medium text-muted-foreground text-xs">{fieldLabel}:</span>{" "}
											<span className="text-xs">{singleVal}</span>
										</div>
									);
								}

								return null;
							})}
						</div>
					</div>
				);
			})}
		</div>
	);
}

// ── Main Component ──

interface ConversationLensInsightsProps {
	data: ConversationLensInsightsData;
	isStreaming?: boolean;
}

export function ConversationLensInsights({ data, isStreaming }: ConversationLensInsightsProps) {
	const { analysisData, templateKey, templateName } = data;

	// Subtitle: person name + interview title
	const subtitle = [data.personName, data.interviewTitle].filter(Boolean).join(" \u00b7 ");

	return (
		<div className={cn("overflow-hidden rounded-lg border bg-card", isStreaming && "animate-pulse")}>
			{/* Header */}
			<SectionHeader
				icon={<BookOpen className="h-4 w-4 text-primary" />}
				title={templateName}
				subtitle={subtitle || null}
				trailing={
					<div className="flex items-center gap-2">
						{data.interviewUrl && (
							<Link
								to={data.interviewUrl}
								className="flex items-center gap-1 text-muted-foreground text-xs hover:text-primary"
							>
								<MessageSquare className="h-3 w-3" />
								Interview
							</Link>
						)}
						{data.lensDetailUrl && (
							<Link to={data.lensDetailUrl} className="flex items-center gap-1 text-primary text-sm hover:underline">
								View full analysis
								<ExternalLink className="h-3 w-3" />
							</Link>
						)}
					</div>
				}
			/>

			{/* Body */}
			{!analysisData ? (
				<div className="px-4 py-6 text-center text-muted-foreground text-sm">No analysis data available yet.</div>
			) : isJtbd(templateKey) ? (
				<JtbdLayout data={data} analysisData={analysisData} />
			) : (
				<GenericLensLayout analysisData={analysisData} />
			)}

			{/* Footer actions */}
			<div className="flex items-center gap-3 border-t px-4 py-2.5">
				{data.lensDetailUrl && (
					<Link to={data.lensDetailUrl} className="inline-flex items-center gap-1 text-primary text-sm hover:underline">
						View Full Analysis <ArrowRight className="h-3 w-3" />
					</Link>
				)}
			</div>
		</div>
	);
}
