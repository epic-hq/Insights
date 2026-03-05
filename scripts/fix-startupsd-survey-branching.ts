#!/usr/bin/env tsx
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { getNextQuestionId } from "../app/features/research-links/branching";

type Question = {
	id: string;
	prompt: string;
	options?: string[] | null;
	hidden?: boolean;
	branching?: unknown;
	[key: string]: unknown;
};

const DEFAULT_SURVEY_ID = "1a328420-163b-4846-9a05-c4d1dc981bc6";

function buildRoleRule(params: {
	id: string;
	roleQuestionId: string;
	roles: string[];
	action: "skip_to" | "end_survey";
	targetQuestionId?: string;
	summary: string;
}) {
	return {
		id: params.id,
		action: params.action,
		source: "user_ui",
		summary: params.summary,
		conditions: {
			logic: "or",
			conditions: params.roles.map((role) => ({
				questionId: params.roleQuestionId,
				operator: "equals",
				value: role,
			})),
		},
		...(params.targetQuestionId ? { targetQuestionId: params.targetQuestionId } : {}),
	};
}

function normalizePrompt(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function findQuestion(questions: Question[], label: string, matcher: (prompt: string) => boolean): Question {
	const match = questions.find((question) => matcher(normalizePrompt(question.prompt || "")));
	if (!match) {
		throw new Error(`Could not locate required question: ${label}`);
	}
	return match;
}

function withSection(question: Question, sectionId: string, sectionTitle: string): Question {
	return {
		...question,
		sectionId,
		sectionTitle,
		branching: null,
	};
}

async function main() {
	dotenv.config({ path: ".env" });
	const surveyId = process.argv[2]?.trim() || DEFAULT_SURVEY_ID;
	const supabaseUrl = process.env.SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !serviceRoleKey) {
		throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
	}

	const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
	const { data: survey, error } = await supabase
		.from("research_links")
		.select("id, name, questions")
		.eq("id", surveyId)
		.single();
	if (error || !survey) {
		throw new Error(`Failed to load survey ${surveyId}: ${error?.message ?? "not found"}`);
	}

	const questions = (Array.isArray(survey.questions) ? survey.questions : []) as Question[];
	if (questions.length < 8) {
		throw new Error(`Survey ${surveyId} has ${questions.length} questions; expected at least 8.`);
	}

	const qRole = findQuestion(questions, "Role", (prompt) => prompt.includes("what best describes your primary role"));
	const qTenure = findQuestion(questions, "Tenure", (prompt) =>
		prompt.includes("how long have you been part of the san diego startup community")
	);
	const qStage = findQuestion(questions, "Path A stage", (prompt) =>
		prompt.includes("what stage are you at right now")
	);
	const qNeeds = findQuestion(questions, "Path A needs", (prompt) =>
		prompt.includes("what are your top 1 3 needs right now")
	);
	const qProgramsA = findQuestion(questions, "Path A programs", (prompt) =>
		prompt.includes("which startupsd programs or resources have been most valuable to you")
	);
	const qChange = findQuestion(questions, "Path A open text", (prompt) =>
		prompt.includes("what s one thing startupsd should add change or do more of")
	);
	const qNpsA = findQuestion(questions, "Path A NPS", (prompt) =>
		prompt.includes("recommend startupsd to a fellow founder or startup professional")
	);
	const qOrgType = findQuestion(questions, "Path B org type", (prompt) =>
		prompt.includes("what type of organization do you represent")
	);
	const qGoalB = findQuestion(questions, "Path B goals", (prompt) =>
		prompt.includes("what s your primary goal in engaging with the sd startup ecosystem")
	);
	const qProgramsB = findQuestion(questions, "Path B touchpoints", (prompt) =>
		prompt.includes("which startupsd programs or touchpoints deliver the most value for your organization")
	);
	const qGapB = findQuestion(questions, "Path B open text", (prompt) =>
		prompt.includes("what gap do you see in the san diego ecosystem that startupsd could help address")
	);
	const qNpsB = findQuestion(questions, "Path B NPS", (prompt) =>
		prompt.includes("recommend startupsd partnership sponsorship to a peer organization")
	);
	const upsetCandidates = questions.filter((question) =>
		normalizePrompt(question.prompt || "").includes("how upset would you be if startup san diego went away")
	);
	if (upsetCandidates.length < 1) {
		throw new Error("Could not locate required question: Shared close upset question");
	}
	const qUpset = upsetCandidates[0];
	const qIndustry = findQuestion(questions, "Shared close industry", (prompt) =>
		prompt.includes("which industry sector best fits your current work")
	);

	const pathARoles = ["Founder / Co-founder", "Startup employee or job seeker", "Student or academic", "Other"];
	const pathBRoles = [
		"Service provider (legal, finance, marketing, HR etc.)",
		"Investor (angel, VC, family office)",
		"Corporate / enterprise partner",
	];

	const repairedQuestions: Question[] = [
		withSection(
			{
				...qRole,
				options: [
					"Founder / Co-founder",
					"Startup employee or job seeker",
					"Service provider (legal, finance, marketing, HR etc.)",
					"Investor (angel, VC, family office)",
					"Corporate / enterprise partner",
					"Student or academic",
					"Other",
				],
			},
			"intro_shared",
			"Shared intro"
		),
		withSection(qTenure, "intro_shared", "Shared intro"),
		withSection(qStage, "path_a_founder_employee", "Founders, employees, students"),
		withSection(qNeeds, "path_a_founder_employee", "Founders, employees, students"),
		withSection(qProgramsA, "path_a_founder_employee", "Founders, employees, students"),
		withSection(qChange, "path_a_founder_employee", "Founders, employees, students"),
		withSection(qNpsA, "path_a_founder_employee", "Founders, employees, students"),
		withSection(
			{
				...qOrgType,
				options: [
					"Law firm",
					"Accounting / finance / CFO services",
					"Marketing, PR, or branding",
					"Recruiting or HR",
					"Technology / SaaS / tools",
					"Real estate / coworking",
					"Venture capital or angel group",
					"Corporate / enterprise",
					"Other",
				],
			},
			"path_b_provider_investor",
			"Providers, investors, corporate"
		),
		withSection(qGoalB, "path_b_provider_investor", "Providers, investors, corporate"),
		withSection(qProgramsB, "path_b_provider_investor", "Providers, investors, corporate"),
		withSection(qGapB, "path_b_provider_investor", "Providers, investors, corporate"),
		withSection(qNpsB, "path_b_provider_investor", "Providers, investors, corporate"),
		withSection(qUpset, "close_shared", "Shared close"),
		withSection(qIndustry, "close_shared", "Shared close"),
	];

	const [roleQuestion, tenureQuestion, stageQuestion, , , , npsAQuestion, orgQuestion, , , , npsBQuestion, closeStart] =
		repairedQuestions;

	tenureQuestion.branching = {
		rules: [
			buildRoleRule({
				id: "surgical-path-a",
				roleQuestionId: roleQuestion.id,
				roles: pathARoles,
				action: "skip_to",
				targetQuestionId: stageQuestion.id,
				summary: "Path A roles proceed to the founders/employees/student section.",
			}),
			buildRoleRule({
				id: "surgical-path-b",
				roleQuestionId: roleQuestion.id,
				roles: pathBRoles,
				action: "skip_to",
				targetQuestionId: orgQuestion.id,
				summary: "Path B roles proceed to the providers/investors/corporate section.",
			}),
		],
	};

	npsAQuestion.branching = {
		rules: [
			buildRoleRule({
				id: "surgical-path-a-to-close",
				roleQuestionId: roleQuestion.id,
				roles: pathARoles,
				action: "skip_to",
				targetQuestionId: closeStart.id,
				summary: "Route Path A respondents into shared closing questions.",
			}),
		],
	};

	npsBQuestion.branching = {
		rules: [
			buildRoleRule({
				id: "surgical-path-b-to-close",
				roleQuestionId: roleQuestion.id,
				roles: pathBRoles,
				action: "skip_to",
				targetQuestionId: closeStart.id,
				summary: "Route Path B respondents into shared closing questions.",
			}),
		],
	};

	const { error: updateError } = await supabase
		.from("research_links")
		.update({ questions: repairedQuestions })
		.eq("id", surveyId);
	if (updateError) {
		throw new Error(`Failed to save branching rewrite: ${updateError.message}`);
	}

	const { data: persisted, error: verifyError } = await supabase
		.from("research_links")
		.select("id, questions")
		.eq("id", surveyId)
		.single();
	if (verifyError || !persisted) {
		throw new Error(`Saved but failed verification read: ${verifyError?.message ?? "unknown error"}`);
	}

	const persistedQuestions = (Array.isArray(persisted.questions) ? persisted.questions : []) as Question[];
	const activeQuestions = persistedQuestions.filter((question) => !question.hidden);
	const roleOptions = Array.isArray(roleQuestion.options)
		? roleQuestion.options.filter(Boolean)
		: [...pathARoles, ...pathBRoles];
	console.log(`Survey repaired: ${survey.name} (${survey.id})`);
	console.log(`Question count after repair: ${activeQuestions.length}`);
	console.log("Section order after repair:");
	for (const question of activeQuestions) {
		console.log(`- ${question.sectionTitle ?? "Unsectioned"} :: ${question.prompt}`);
	}
	console.log("Path simulation by role option:");

	for (const option of roleOptions) {
		const responses: Record<string, string> = { [roleQuestion.id]: option };
		const visited: string[] = [];
		let current = activeQuestions[0] ?? null;
		let guard = 0;
		while (current && guard < activeQuestions.length * 3) {
			visited.push(current.prompt);
			const nextId = getNextQuestionId(current as any, activeQuestions as any, responses);
			if (!nextId) break;
			const next = activeQuestions.find((question) => question.id === nextId) ?? null;
			if (!next) break;
			current = next;
			guard += 1;
		}
		console.log(`- ${option}: ${visited.length} questions`);
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
