/**
 * Gen-UI Component Registry
 *
 * Tambo-inspired component registry that provides:
 * - Type-safe component registration with Zod schemas
 * - Capability summary generation for agent system prompts
 * - Props validation before rendering
 * - Registry-based component lookup
 */

import type { ComponentType } from "react";
import { z } from "zod";

/**
 * Schema for a single interview prompt
 */
export const interviewPromptSchema = z.object({
	id: z.string(),
	text: z.string(),
	status: z.enum(["planned", "answered", "skipped"]),
	isMustHave: z.boolean().optional(),
	category: z.string().optional(),
});

/**
 * Schema for InterviewPrompts component data
 */
export const interviewPromptsDataSchema = z.object({
	prompts: z.array(interviewPromptSchema).optional(),
	title: z.string().optional(),
	description: z.string().optional(),
});

/**
 * Schema for BANT facet score
 */
export const bantFacetSchema = z.object({
	score: z.number().min(0).max(100),
	note: z.string().optional(),
});

/**
 * Schema for SimpleBANT component data
 */
export const simpleBANTDataSchema = z.object({
	budget: bantFacetSchema.optional(),
	authority: bantFacetSchema.optional(),
	need: bantFacetSchema.optional(),
	timeline: bantFacetSchema.optional(),
	overall: z.number().min(0).max(100).optional(),
});

/**
 * Schema for AI Insight Card
 */
export const aiInsightCardDataSchema = z.object({
	insight: z.string(),
	source: z.string().optional(),
	href: z.string().optional(),
});

/**
 * Schema for Stat Card (KPI display)
 */
export const statCardDataSchema = z.object({
	label: z.string(),
	value: z.union([z.string(), z.number()]),
	change: z.string().optional(),
	description: z.string().optional(),
	icon: z.string().optional(),
});

/**
 * Schema for Persona Card
 */
export const personaDataSchema = z.object({
	id: z.string(),
	name: z.string().nullable(),
	description: z.string().nullable(),
	color_hex: z.string().nullable(),
	percentage: z.number().nullable(),
});

export const personaCardDataSchema = z.object({
	persona: personaDataSchema,
});

/**
 * Schema for Theme List
 */
export const themeItemSchema = z.object({
	tag: z.string(),
	text: z.string(),
	impact: z.number().min(1).max(5),
	novelty: z.number().min(1).max(5),
});

export const themeListDataSchema = z.object({
	themes: z.array(themeItemSchema),
});

/**
 * Schema for Project Context Status widget
 * Shows project goals, research questions, ICP, and progress
 */
export const projectContextStatusDataSchema = z.object({
	projectId: z.string(),
	name: z.string(),
	description: z.string().nullable().optional(),
	goals: z.array(z.string()).optional(),
	researchQuestions: z.array(z.string()).optional(),
	icp: z
		.object({
			description: z.string().nullable().optional(),
			characteristics: z.array(z.string()).optional(),
		})
		.optional(),
	progress: z
		.object({
			interviewCount: z.number().optional(),
			insightCount: z.number().optional(),
			themeCount: z.number().optional(),
		})
		.optional(),
	workflowType: z.string().optional(),
	editUrl: z.string().optional(),
});

/**
 * Schema for Survey Created confirmation widget
 */
export const surveyCreatedDataSchema = z.object({
	surveyId: z.string(),
	name: z.string(),
	questionCount: z.number(),
	editUrl: z.string(),
	publicUrl: z.string(),
});

/**
 * Schema for Insight Card (simplified for gen-ui)
 */
export const insightCardDataSchema = z.object({
	id: z.string(),
	name: z.string(),
	statement: z.string().nullable().optional(),
	pain: z.string().nullable().optional(),
	jtbd: z.string().nullable().optional(),
	category: z.string().nullable().optional(),
	evidenceCount: z.number().optional(),
	detailUrl: z.string().optional(),
});

/**
 * Schema for Evidence Card (simplified for gen-ui)
 */
export const evidenceCardDataSchema = z.object({
	id: z.string(),
	gist: z.string(),
	verbatim: z.string().nullable().optional(),
	topic: z.string().nullable().optional(),
	journeyStage: z.string().nullable().optional(),
	support: z.enum(["supports", "opposes", "neutral"]).nullable().optional(),
	speakerName: z.string().nullable().optional(),
	interviewTitle: z.string().nullable().optional(),
	detailUrl: z.string().optional(),
});

/**
 * Schema for Survey Response Card
 */
export const surveyResponseCardDataSchema = z.object({
	responseId: z.string(),
	surveyName: z.string(),
	respondentEmail: z.string().nullable().optional(),
	respondentName: z.string().nullable().optional(),
	completedAt: z.string().nullable().optional(),
	answers: z.array(
		z.object({
			question: z.string(),
			answer: z.string(),
			type: z.string().optional(),
		})
	),
	detailUrl: z.string().optional(),
});

/**
 * Schema for Survey Response List (multiple responses summary)
 */
export const surveyResponseListDataSchema = z.object({
	surveyName: z.string(),
	totalResponses: z.number(),
	responses: z.array(
		z.object({
			id: z.string(),
			respondentName: z.string().nullable().optional(),
			completedAt: z.string().nullable().optional(),
			highlightAnswer: z.string().optional(),
		})
	),
	viewAllUrl: z.string().optional(),
});

/**
 * Schema for People List items
 */
export const personListItemSchema = z.object({
	id: z.string(),
	name: z.string(),
	title: z.string().nullable(),
	orgName: z.string().nullable(),
	lastInteractionDate: z.string().nullable().optional(),
	evidenceCount: z.number().optional(),
	avatarUrl: z.string().nullable().optional(),
	detailUrl: z.string().optional(),
});

/**
 * Schema for PeopleList component data
 */
export const peopleListDataSchema = z.object({
	people: z.array(personListItemSchema),
	totalCount: z.number().optional(),
	viewAllUrl: z.string().optional(),
});

/**
 * Schema for PersonCard component data
 */
export const personCardDataSchema = z.object({
	id: z.string(),
	name: z.string(),
	title: z.string().nullable(),
	orgName: z.string().nullable(),
	email: z.string().nullable(),
	evidenceCount: z.number().optional(),
	conversationCount: z.number().optional(),
	surveyCount: z.number().optional(),
	icpBand: z.string().nullable().optional(),
	themes: z.array(z.string()).optional(),
	detailUrl: z.string().optional(),
});

/**
 * Schema for TaskList items
 */
export const taskItemSchema = z.object({
	id: z.string(),
	text: z.string(),
	status: z.enum(["pending", "done", "dismissed"]),
	priority: z.number().min(1).max(3),
	source: z.string().optional(),
	dueDate: z.string().optional(),
});

/**
 * Schema for TaskList component data
 */
export const taskListDataSchema = z.object({
	tasks: z.array(taskItemSchema),
	title: z.string().optional(),
});

/**
 * Schema for ActionCards items
 */
export const actionCardItemSchema = z.object({
	id: z.string(),
	action: z.string(),
	reasoning: z.string(),
	priority: z.number().min(1).max(3),
	personName: z.string().optional(),
	evidenceLink: z.string().optional(),
});

/**
 * Schema for ActionCards component data
 */
export const actionCardsDataSchema = z.object({
	actions: z.array(actionCardItemSchema),
	title: z.string().optional(),
});

/**
 * Schema for OrganizationContextStatus component data
 */
export const orgContextStatusDataSchema = z.object({
	id: z.string(),
	name: z.string(),
	industry: z.string().nullable(),
	size: z.string().nullable(),
	stage: z.string().nullable(),
	website: z.string().nullable(),
	contactCount: z.number().optional(),
	conversationCount: z.number().optional(),
	evidenceCount: z.number().optional(),
	detailUrl: z.string().optional(),
});

/**
 * Schema for ConversationLensInsights component data
 */
export const conversationLensInsightSchema = z.object({
	label: z.string(),
	summary: z.string(),
	confidence: z.number().min(0).max(100).nullable().optional(),
});

export const conversationLensInsightsDataSchema = z.object({
	interviewTitle: z.string(),
	frameworkName: z.string(),
	insights: z.array(conversationLensInsightSchema),
	overallSummary: z.string().optional(),
	detailUrl: z.string().optional(),
});

/**
 * Schema for SurveyResultsSummary component data
 */
export const surveyQuestionSummarySchema = z.object({
	question: z.string(),
	topAnswer: z.string(),
	responseCount: z.number(),
});

export const surveyResultsSummaryDataSchema = z.object({
	surveyName: z.string(),
	totalResponses: z.number(),
	completionRate: z.number().min(0).max(100).optional(),
	questionSummaries: z.array(surveyQuestionSummarySchema).optional(),
	topThemes: z.array(z.string()).optional(),
	detailUrl: z.string().optional(),
});

/**
 * Schema for UploadRecording widget data
 */
export const uploadRecordingDataSchema = z.object({
	projectId: z.string(),
	accountId: z.string(),
	title: z.string().optional(),
	description: z.string().optional(),
	/** Pre-fill participant name */
	participantName: z.string().optional(),
	/** Pre-fill participant org */
	participantOrganization: z.string().optional(),
	/** Accepted file categories */
	acceptTypes: z.array(z.enum(["audio", "video", "text", "pdf"])).optional(),
	/** URL to navigate after successful upload */
	interviewListUrl: z.string().optional(),
});

// ========================================
// JTBD Time-to-Aha Widget Schemas
// ========================================

/**
 * Schema for ProgressRail meta-widget
 */
export const progressRailPhaseSchema = z.object({
	id: z.enum(["frame", "collect", "validate", "commit", "measure"]),
	label: z.string(),
	status: z.enum(["complete", "active", "upcoming", "blocked"]),
	hint: z.string().optional(),
});

export const progressRailDataSchema = z.object({
	phases: z.array(progressRailPhaseSchema).min(1).max(5),
	activeMoment: z.number().min(1).max(9).optional(),
	statusLine: z.string(),
	nextAction: z.string().optional(),
	nextActionUrl: z.string().optional(),
});

/**
 * Schema for DecisionBrief (Moment 1)
 */
export const decisionBriefDataSchema = z.object({
	projectId: z.string(),
	decisionQuestion: z.string().nullable(),
	targetCustomer: z.string().nullable(),
	deadline: z.string().nullable(),
	successMetric: z.string().nullable(),
	researchQuestions: z.array(z.string()).optional(),
	completeness: z.object({
		hasDecision: z.boolean(),
		hasTarget: z.boolean(),
		hasDeadline: z.boolean(),
		hasMetric: z.boolean(),
		hasQuestions: z.boolean(),
	}),
	readinessLabel: z.string(),
	editUrl: z.string().optional(),
});

/**
 * Schema for IntakePathPicker (Moment 2)
 */
export const intakePathOptionSchema = z.object({
	id: z.enum(["upload", "record", "survey"]),
	label: z.string(),
	description: z.string(),
	hint: z.string().optional(),
	started: z.boolean().optional(),
	count: z.number().optional(),
	icon: z.string().optional(),
	actionUrl: z.string().optional(),
});

export const intakePathPickerDataSchema = z.object({
	projectId: z.string(),
	accountId: z.string(),
	title: z.string().optional(),
	prompt: z.string().optional(),
	paths: z.array(intakePathOptionSchema).min(1).max(4),
	recommendedPath: z.enum(["upload", "record", "survey"]).optional(),
});

/**
 * Schema for IntakeBatchStatus (Moment 3A companion)
 */
export const intakeItemSchema = z.object({
	id: z.string(),
	title: z.string(),
	source: z.enum(["upload", "recording", "survey", "import"]),
	status: z.enum(["queued", "processing", "ready", "failed"]),
	resultSummary: z.string().optional(),
	detailUrl: z.string().optional(),
});

export const intakeBatchStatusDataSchema = z.object({
	projectId: z.string(),
	items: z.array(intakeItemSchema),
	summary: z.object({
		total: z.number(),
		ready: z.number(),
		processing: z.number(),
		failed: z.number(),
	}),
	statusLine: z.string(),
	signalGate: z
		.object({
			sufficient: z.boolean(),
			message: z.string(),
		})
		.optional(),
	uploadMoreUrl: z.string().optional(),
});

/**
 * Schema for SurveyOutreach (Moment 3C)
 */
export const surveyOutreachRecipientSchema = z.object({
	email: z.string(),
	name: z.string().optional(),
	status: z.enum(["pending", "sent", "opened", "completed", "bounced"]).optional(),
});

export const surveyOutreachDataSchema = z.object({
	surveyId: z.string(),
	surveyName: z.string(),
	publicUrl: z.string(),
	recipients: z.array(surveyOutreachRecipientSchema).optional(),
	messagePreview: z.string().optional(),
	funnel: z
		.object({
			sent: z.number(),
			opened: z.number(),
			completed: z.number(),
			bounced: z.number(),
		})
		.optional(),
	statusLine: z.string(),
	editUrl: z.string().optional(),
	addRecipientsUrl: z.string().optional(),
});

/**
 * Schema for IntakeHealth (Moment 4 — the key confidence gate)
 */
export const coverageSegmentSchema = z.object({
	label: z.string(),
	count: z.number(),
	target: z.number().optional(),
	sources: z
		.object({
			interviews: z.number(),
			surveys: z.number(),
			documents: z.number(),
		})
		.optional(),
});

export const intakeHealthDataSchema = z.object({
	projectId: z.string(),
	confidenceTier: z.enum(["early_signal", "growing_confidence", "decision_ready"]),
	confidenceLabel: z.string(),
	summary: z.string(),
	coverage: z.array(coverageSegmentSchema).optional(),
	sourceMix: z.object({
		interviews: z.number(),
		surveys: z.number(),
		documents: z.number(),
	}),
	totalEvidence: z.number(),
	daysSinceLastIntake: z.number().optional(),
	gaps: z.array(z.string()).optional(),
	gateStatus: z.enum(["insufficient", "marginal", "sufficient"]),
	nextAction: z.string(),
	nextActionUrl: z.string().optional(),
});

/**
 * Schema for EvidenceWall (Moment 5)
 */
export const evidenceClusterSchema = z.object({
	label: z.string(),
	type: z.enum(["pain", "goal", "observation"]),
	items: z
		.array(
			z.object({
				id: z.string(),
				verbatim: z.string(),
				speakerName: z.string().nullable(),
				speakerTitle: z.string().nullable(),
				interviewTitle: z.string().nullable(),
				detailUrl: z.string().optional(),
			})
		)
		.min(1),
	totalCount: z.number(),
});

export const evidenceWallDataSchema = z.object({
	projectId: z.string(),
	headline: z.string().optional(),
	clusters: z.array(evidenceClusterSchema),
	totalEvidence: z.number(),
	uniqueSources: z.number(),
	viewAllUrl: z.string().optional(),
});

/**
 * Schema for PatternSynthesis (Moment 6)
 */
export const patternSchema = z.object({
	id: z.string(),
	name: z.string(),
	statement: z.string().nullable(),
	mentionCount: z.number(),
	confidenceTier: z.enum(["thin", "emerging", "strong", "validated"]),
	confidenceLabel: z.string(),
	topQuotes: z
		.array(
			z.object({
				verbatim: z.string(),
				speakerName: z.string().nullable(),
			})
		)
		.optional(),
	uniqueSources: z.number().optional(),
	detailUrl: z.string().optional(),
});

export const patternSynthesisDataSchema = z.object({
	projectId: z.string(),
	headline: z.string().optional(),
	narrativeSummary: z.string().optional(),
	patterns: z.array(patternSchema),
	distribution: z
		.object({
			strong: z.number(),
			emerging: z.number(),
			thin: z.number(),
		})
		.optional(),
	nextAction: z.string().optional(),
	nextActionUrl: z.string().optional(),
});

/**
 * Schema for DecisionForcing (Moment 7)
 */
export const decisionActionSchema = z.object({
	id: z.string(),
	action: z.string(),
	reasoning: z.string(),
	effort: z.enum(["low", "medium", "high"]),
	impact: z.enum(["low", "medium", "high"]),
	tradeoffs: z.array(z.string()).optional(),
	evidenceCount: z.number().optional(),
	evidenceUrl: z.string().optional(),
	owner: z.string().nullable().optional(),
	dueDate: z.string().nullable().optional(),
	committed: z.boolean().optional(),
});

export const decisionForcingDataSchema = z.object({
	projectId: z.string(),
	headline: z.string().optional(),
	decisionContext: z.string().optional(),
	actions: z.array(decisionActionSchema),
	informingPatterns: z
		.array(
			z.object({
				name: z.string(),
				confidenceLabel: z.string(),
			})
		)
		.optional(),
	narrative: z.string().optional(),
	actionsUrl: z.string().optional(),
});

/**
 * Schema for StakeholderMap (Moment 8)
 */
export const stakeholderEntrySchema = z.object({
	personId: z.string(),
	name: z.string(),
	title: z.string().nullable(),
	orgName: z.string().nullable(),
	linkedThemes: z.array(
		z.object({
			name: z.string(),
			evidenceCount: z.number(),
		})
	),
	topQuote: z.string().nullable(),
	icpBand: z.string().nullable(),
	detailUrl: z.string().optional(),
});

export const stakeholderMapDataSchema = z.object({
	projectId: z.string(),
	headline: z.string().optional(),
	summary: z.string().optional(),
	stakeholders: z.array(stakeholderEntrySchema),
	totalPeople: z.number(),
	viewAllUrl: z.string().optional(),
});

/**
 * Schema for ResearchPulse (Moment 9)
 */
export const weeklyDeltaSchema = z.object({
	label: z.string(),
	current: z.union([z.string(), z.number()]),
	previous: z.union([z.string(), z.number()]).optional(),
	change: z.string().optional(),
	direction: z.enum(["up", "down", "flat"]).optional(),
});

export const actionTrackingSchema = z.object({
	id: z.string(),
	action: z.string(),
	owner: z.string().nullable(),
	status: z.enum(["not_started", "in_progress", "complete", "blocked"]),
	dueDate: z.string().nullable(),
});

export const researchPulseDataSchema = z.object({
	projectId: z.string(),
	periodLabel: z.string(),
	confidenceTier: z.enum(["early_signal", "growing_confidence", "decision_ready"]),
	confidenceLabel: z.string(),
	confidenceChange: z.enum(["improved", "stable", "declined"]).optional(),
	deltas: z.array(weeklyDeltaSchema),
	actions: z.array(actionTrackingSchema).optional(),
	newSignalSummary: z.string().optional(),
	nextStep: z.string(),
	nextStepUrl: z.string().optional(),
});

/**
 * Component definition with metadata
 */
export interface ComponentDefinition<TData = unknown> {
	/** Unique component type identifier (e.g., "InterviewPrompts") */
	type: string;
	/** Human-readable description for agent prompts */
	description: string;
	/** Zod schema for validating component props/data */
	schema: z.ZodType<TData>;
	/** React component to render */
	component: ComponentType<{ data: TData; isStreaming?: boolean }>;
	/** Available actions the agent can perform on this component */
	actions?: string[];
	/** When should the agent use this component */
	useWhen: string;
	/** Example trigger phrases */
	triggerExamples?: string[];
}

/**
 * Registry of all available gen-ui components
 */
class ComponentRegistry {
	private components = new Map<string, ComponentDefinition>();

	/**
	 * Register a component with its schema and metadata
	 */
	register<TData>(definition: ComponentDefinition<TData>): void {
		this.components.set(definition.type, definition as ComponentDefinition);
	}

	/**
	 * Get a component definition by type
	 */
	get(type: string): ComponentDefinition | undefined {
		return this.components.get(type);
	}

	/**
	 * Check if a component type is registered
	 */
	has(type: string): boolean {
		return this.components.has(type);
	}

	/**
	 * Get all registered component types
	 */
	getTypes(): string[] {
		return Array.from(this.components.keys());
	}

	/**
	 * Get all component definitions
	 */
	getAll(): ComponentDefinition[] {
		return Array.from(this.components.values());
	}

	/**
	 * Validate component data against its schema
	 */
	validateProps(
		type: string,
		data: unknown
	): { success: true; data: unknown } | { success: false; errors: z.ZodError } {
		const definition = this.components.get(type);
		if (!definition) {
			return {
				success: false,
				errors: new z.ZodError([
					{
						code: "custom",
						message: `Unknown component type: ${type}`,
						path: ["type"],
					},
				]),
			};
		}

		const result = definition.schema.safeParse(data);
		if (result.success) {
			return { success: true, data: result.data };
		}
		return { success: false, errors: result.error };
	}

	/**
	 * Generate capability summary for agent system prompts
	 * Describes available components and when to use them
	 */
	getCapabilitySummary(): string {
		const components = this.getAll();
		if (components.length === 0) {
			return "No UI components are available.";
		}

		const lines = ["## Available UI Components\n"];

		for (const comp of components) {
			lines.push(`### ${comp.type}`);
			lines.push(comp.description);
			lines.push(`**Use when:** ${comp.useWhen}`);

			if (comp.triggerExamples?.length) {
				lines.push(`**Trigger phrases:** ${comp.triggerExamples.join(", ")}`);
			}

			if (comp.actions?.length) {
				lines.push(`**Available actions:** ${comp.actions.join(", ")}`);
			}

			lines.push(""); // blank line between components
		}

		return lines.join("\n");
	}

	/**
	 * Get capabilities snapshot for A2UI validation
	 */
	getCapabilitiesSnapshot(): {
		components: string[];
		actions: string[];
		componentProps: Record<string, string[]>;
	} {
		const components: string[] = [];
		const allActions = new Set<string>();
		const componentProps: Record<string, string[]> = {};

		for (const [type, def] of Array.from(this.components.entries())) {
			components.push(type);

			if (def.actions) {
				for (const action of def.actions) {
					allActions.add(action);
				}
			}

			// Extract prop names from schema (simplified - works for object schemas)
			if (def.schema instanceof z.ZodObject) {
				componentProps[type] = Object.keys(def.schema.shape);
			}
		}

		return {
			components,
			actions: Array.from(allActions),
			componentProps,
		};
	}
}

/**
 * Global component registry instance
 */
export const componentRegistry = new ComponentRegistry();

/**
 * Helper to create and register a component in one step
 */
export function defineComponent<TData>(definition: ComponentDefinition<TData>): ComponentDefinition<TData> {
	componentRegistry.register(definition);
	return definition;
}
