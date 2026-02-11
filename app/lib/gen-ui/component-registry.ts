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
