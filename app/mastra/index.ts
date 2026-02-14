import { chatRoute } from "@mastra/ai-sdk";
import type { RequestContext } from "@mastra/core/di";
import { Mastra } from "@mastra/core/mastra";
import { LangfuseExporter } from "@mastra/langfuse";
import { PinoLogger } from "@mastra/loggers";
import { Observability } from "@mastra/observability";
import { createClient } from "@supabase/supabase-js";
import { chiefOfStaffAgent } from "./agents/chief-of-staff-agent";
import { feedbackAgent } from "./agents/feedback-agent";
import { howtoAgent } from "./agents/howto-agent";
import { insightsAgent } from "./agents/insights-agent";
import { interviewStatusAgent } from "./agents/interview-status-agent";
import { mainAgent } from "./agents/main-agent";
import { opsAgent } from "./agents/ops-agent";
import { peopleAgent } from "./agents/people-agent";
import { projectSetupAgent } from "./agents/project-setup-agent";
import { projectStatusAgent } from "./agents/project-status-agent";
import { researchAgent } from "./agents/research-agent";
import { researchAssistantAgent } from "./agents/research-assistant-agent";
import { researchLinkChatAgent } from "./agents/research-link-chat-agent";
import { signupAgent } from "./agents/signup-agent";
import { surveyAgent } from "./agents/survey-agent";
import { webLeadAgent } from "./agents/weblead-agent";
import { getSharedPostgresStore } from "./storage/postgres-singleton";
import { dailyBriefWorkflow } from "./workflows/daily-brief";
import { signupOnboardingWorkflow } from "./workflows/signup-onboarding";

// Create global SupabaseClient for workflows
const _supabaseClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const DEFAULT_MASTRA_PORT = 4111;

function resolveMastraPort(): number {
	const rawPort = process.env.MASTRA_PORT;
	if (!rawPort) return DEFAULT_MASTRA_PORT;

	const parsed = Number(rawPort);
	if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
		return parsed;
	}

	return DEFAULT_MASTRA_PORT;
}

const mastraPort = resolveMastraPort();

export type UserContext = {
	user_id: string;
	account_id: string;
	project_id: string;
	jwt: string;
	supabase?: unknown; // Allow supabase client injection
};

const agents = {
	mainAgent,
	insightsAgent,
	signupAgent,
	projectSetupAgent,
	projectStatusAgent,
	howtoAgent,
	chiefOfStaffAgent,
	feedbackAgent,
	peopleAgent,
	researchAgent,
	opsAgent,
	interviewStatusAgent,
	researchAssistantAgent,
	researchLinkChatAgent,
	webLeadAgent,
	surveyAgent,
};

export const mastra = new Mastra({
	workflows: { dailyBriefWorkflow, signupOnboardingWorkflow },
	agents,
	storage: getSharedPostgresStore(),
	logger: new PinoLogger({
		name: "mastra",
		level: "warn", // Reduce noise - only show warnings and errors
	}),
	observability: process.env.LANGFUSE_PUBLIC_KEY
		? new Observability({
				configs: {
					langfuse: {
						serviceName: "ai",
						exporters: [
							new LangfuseExporter({
								publicKey: process.env.LANGFUSE_PUBLIC_KEY,
								secretKey: process.env.LANGFUSE_SECRET_KEY,
								baseUrl: process.env.LANGFUSE_HOST || "https://us.cloud.langfuse.com",
							}),
						],
					},
				},
			})
		: undefined,
	server: {
		cors: {
			origin: "*",
			allowMethods: ["*"],
			allowHeaders: ["*"],
		},
		port: mastraPort,
		middleware: [
			async (c, next) => {
				const user_id = c.req.header("x-userid");
				const account_id = c.req.header("x-accountid");
				const project_id = c.req.header("x-projectid");
				const jwt = c.req.header("authorization")?.replace("Bearer ", "");

				const requestContext = c.get("requestContext") as RequestContext<UserContext>;

				requestContext.set("user_id", user_id || "");
				requestContext.set("account_id", account_id || "");
				requestContext.set("project_id", project_id || "");
				requestContext.set("jwt", jwt || "");
				await next();
			},
		],
		apiRoutes: [
			chatRoute({
				path: "/chat/signup",
				agent: "signupAgent",
			}),
			chatRoute({
				path: "/chat/project-setup",
				agent: "projectSetupAgent",
			}),
			chatRoute({
				path: "/chat/project-status",
				agent: "projectStatusAgent",
			}),
			chatRoute({
				path: "/chat/research-assistant",
				agent: "researchAssistantAgent",
			}),
			chatRoute({
				path: "/chat/web-lead",
				agent: "webLeadAgent",
			}),
			chatRoute({
				path: "/chat/survey",
				agent: "surveyAgent",
			}),
			chatRoute({
				path: "/chat/feedback",
				agent: "feedbackAgent",
			}),
		],
	},
});
