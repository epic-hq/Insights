import { chatRoute } from "@mastra/ai-sdk";
import type { RequestContext } from "@mastra/core/di";
import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { createClient } from "@supabase/supabase-js";
import { chiefOfStaffAgent } from "./agents/chief-of-staff-agent";
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
import { weatherAgent } from "./agents/weather-agent";
import { webLeadAgent } from "./agents/weblead-agent";
import { getSharedPostgresStore } from "./storage/postgres-singleton";
import { dailyBriefWorkflow } from "./workflows/daily-brief";
import { signupOnboardingWorkflow } from "./workflows/signup-onboarding";
import { weatherWorkflow } from "./workflows/weather-workflow";

// Create global SupabaseClient for workflows
const _supabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);

export type UserContext = {
  user_id: string;
  account_id: string;
  project_id: string;
  jwt: string;
  supabase?: unknown; // Allow supabase client injection
};

const agents = {
  mainAgent,
  weatherAgent,
  insightsAgent,
  signupAgent,
  projectSetupAgent,
  projectStatusAgent,
  chiefOfStaffAgent,
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
  workflows: { dailyBriefWorkflow, weatherWorkflow, signupOnboardingWorkflow },
  agents,
  storage: getSharedPostgresStore(),
  logger: new PinoLogger({
    name: "mastra",
    level: "warn", // Reduce noise - only show warnings and errors
  }),
  server: {
    cors: {
      origin: "*",
      allowMethods: ["*"],
      allowHeaders: ["*"],
    },
    port: 4111,
    middleware: [
      async (c, next) => {
        // Use lowercase header names (case-insensitive per spec; some adapters normalize to lowercase)
        const user_id = c.req.header("x-userid");
        // consola.log("mastra_middleware user_id", user_id)
        // consola.log("mastra_middleware headers", c.req.header())
        const account_id = c.req.header("x-accountid");
        const project_id = c.req.header("x-projectid");
        const jwt = c.req.header("authorization")?.replace("Bearer ", ""); // Extract JWT from Authorization header

        const requestContext = c.get(
          "requestContext",
        ) as RequestContext<UserContext>;
        // consola.log("mastra_account_id", account_id)
        // consola.log("mastra_project_id", project_id)
        // consola.log("mastra_jwt", jwt ? "present" : "missing")

        requestContext.set("user_id", user_id || "FAKE_USER_ID");
        requestContext.set("account_id", account_id || "");
        requestContext.set("project_id", project_id || "");
        requestContext.set("jwt", jwt || ""); // Add JWT to requestContext
        // consola.log("mastra_requestContext", requestContext.get("user_id"))
        // consola.log("server middleware - user_id", user_id)
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
    ],
  },
});
