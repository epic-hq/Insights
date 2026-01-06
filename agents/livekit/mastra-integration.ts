/**
 * Mastra Integration with LiveKit Voice Agent
 *
 * This creates LiveKit-compatible tool wrappers that use existing database functions.
 * The agent has access to all project data via context passed in room name.
 */

import consola from "consola";
import { z } from "zod";
import { llm } from "@livekit/agents";
import { createClient } from "@supabase/supabase-js";
import { b } from "../../baml_client";
import { supabaseAdmin } from "../../app/lib/supabase/client.server";
import { getPeople, createPerson } from "../../app/features/people/db";
import { getProjectById } from "../../app/features/projects/db";
import { getThemes } from "../../app/features/themes/db";
import { getInsights } from "../../app/features/insights/db";
import { getTasks, updateTask, createTask } from "../../app/features/tasks/db";
import { getOpportunities } from "../../app/features/opportunities/db";
import { getInterviews } from "../../app/features/interviews/db";

/**
 * Get Supabase client with user context for auth.uid() to work in database triggers
 * Uses service role but sets JWT claims to impersonate the user
 */
async function getSupabaseForUser(userId: string) {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Use supabaseAdmin to generate an auth token for the user
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: "", // Not needed for service role
    options: {
      redirectTo: "",
    },
  });

  // For now, just use admin and manually set created_by in the db layer
  // The trigger will be bypassed by explicitly setting created_by AFTER spread
  return supabaseAdmin;
}

const PEOPLE_CACHE_TTL_MS = 30_000;
const peopleDatasetCache = new Map<
  string,
  { fetchedAt: number; people: any[] }
>();

/**
 * Fuzzy search scoring for people
 * Matches against name, title, company, role, and segment
 */
function computePeopleSearchScore({
  person,
  normalizedSearch,
  tokens,
}: {
  person: any;
  normalizedSearch: string;
  tokens: string[];
}): number {
  if (!normalizedSearch) return 0;

  // Build searchable text from all relevant fields
  const searchableFields = [
    person.name,
    person.title,
    person.company,
    person.role,
    person.segment,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase().trim())
    .join(" ");

  if (!searchableFields) return 0;

  let score = 0;
  let matchedTokens = 0;

  // Token matching (each word in search)
  for (const token of tokens) {
    if (token && searchableFields.includes(token)) {
      matchedTokens += 1;
      score += 2;
    }
  }

  // Bonus for matching all tokens
  if (matchedTokens === tokens.length && tokens.length > 0) {
    score += 3;
  }

  // Bonus for exact phrase match
  if (searchableFields.includes(normalizedSearch)) {
    score += 2;
  }

  // Name-specific matching (highest priority)
  const name = person.name?.toLowerCase().trim();
  if (name) {
    if (name === normalizedSearch) {
      score += 10; // Exact name match
    } else if (name.startsWith(normalizedSearch)) {
      score += 5; // Name starts with search
    } else if (name.includes(normalizedSearch)) {
      score += 3; // Name contains search
    }
  }

  return score;
}

/**
 * Creates LiveKit tools using existing database functions
 */
export function createMastraTools(context: {
  projectId: string;
  accountId: string;
  userId: string;
}) {
  const { projectId, accountId, userId } = context;

  // Define tools as plain objects first
  const toolDefinitions = {
    // Get people/contacts in the project
    getPeople: {
      description:
        "Get list of people, contacts, and customers in the project. Use this when the user asks about who is in the project, customer information, or specific people.",
      parameters: z.object({
        query: z
          .string()
          .optional()
          .describe(
            "Optional search query to filter people by name, title, company, or role. Supports fuzzy matching.",
          ),
      }),
      execute: async ({ query }: { query?: string }) => {
        try {
          const normalizedQuery = query?.trim() ?? "";
          const cacheKey = `${accountId}:${projectId}`;
          const now = Date.now();

          let cachedEntry = peopleDatasetCache.get(cacheKey);
          let people =
            cachedEntry && now - cachedEntry.fetchedAt < PEOPLE_CACHE_TTL_MS
              ? cachedEntry.people
              : null;

          if (people) {
            consola.info("getPeople: using cached dataset", {
              projectId,
              accountId,
              query: normalizedQuery || undefined,
              count: people.length,
              cacheAgeMs: now - (cachedEntry?.fetchedAt ?? now),
            });
          } else {
            consola.info("getPeople: fetching from database", {
              projectId,
              accountId,
              query: normalizedQuery || undefined,
            });
            const { data, error } = await getPeople({
              supabase: supabaseAdmin as any,
              accountId,
              projectId,
              scope: "project",
            });

            if (error) {
              consola.error("Database error fetching people", error);
              return "Sorry, I had trouble fetching the people list.";
            }

            people = data || [];
            peopleDatasetCache.set(cacheKey, { people, fetchedAt: now });
          }

          if (!people || people.length === 0) {
            return "No people found in this project yet.";
          }

          // Apply fuzzy search if query provided
          let filteredPeople = people;
          if (normalizedQuery) {
            const searchLower = normalizedQuery.toLowerCase();
            const tokens = searchLower.split(/\s+/).filter(Boolean);

            // Score and filter people
            const scoredPeople = people
              .map((person) => ({
                person,
                score: computePeopleSearchScore({
                  person,
                  normalizedSearch: searchLower,
                  tokens,
                }),
              }))
              .filter(({ score }) => score > 0) // Only keep matches
              .sort((a, b) => b.score - a.score); // Highest score first

            filteredPeople = scoredPeople.map(({ person }) => person);

            consola.info("getPeople: search results", {
              query: normalizedQuery || undefined,
              totalPeople: people.length,
              matchedPeople: filteredPeople.length,
              topMatch: filteredPeople[0]?.name,
            });
          }

          if (filteredPeople.length === 0) {
            return `No people found matching "${normalizedQuery}". Try a different search or ask for all people in the project.`;
          }

          // Limit to top 10 results for voice response
          const topPeople = filteredPeople.slice(0, 10);

          // Format detailed response with key information
          const peopleDetails = topPeople.map((p) => {
            const parts = [p.name];
            if (p.title) parts.push(p.title);
            if (p.company) parts.push(`at ${p.company}`);
            return parts.join(", ");
          });

          const response = normalizedQuery
            ? `Found ${filteredPeople.length} people matching "${normalizedQuery}": ${peopleDetails.slice(0, 5).join("; ")}${filteredPeople.length > 5 ? `, and ${filteredPeople.length - 5} others` : ""}.`
            : `There are ${topPeople.length} people in the project: ${peopleDetails.slice(0, 5).join("; ")}${people.length > 5 ? `, and ${people.length - 5} others` : ""}.`;

          return response;
        } catch (error) {
          consola.error("Error fetching people", error);
          return `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
      },
    },

    // Create a new person/contact
    createPerson: {
      description:
        "Create a new person, contact, or customer in the project. Use this when the user asks to add, create, or save a new person, contact, lead, or customer.",
      parameters: z.object({
        name: z.string().describe("Full name of the person"),
        email: z.string().email().optional().describe("Email address"),
        company: z.string().optional().describe("Company or organization name"),
        title: z.string().optional().describe("Job title or role"),
        phone: z.string().optional().describe("Phone number"),
        segment: z.string().optional().describe("Customer segment or category"),
        notes: z
          .string()
          .optional()
          .describe("Additional notes or context about the person"),
      }),
      execute: async ({
        name,
        email,
        company,
        title,
        phone,
        segment,
        notes,
      }: {
        name: string;
        email?: string;
        company?: string;
        title?: string;
        phone?: string;
        segment?: string;
        notes?: string;
      }) => {
        try {
          consola.info("createPerson: creating person", {
            projectId,
            accountId,
            name,
            email,
            company,
          });

          const contactInfo: any = {};
          if (email) contactInfo.email = email;
          if (phone) contactInfo.phone = phone;

          const { data: newPerson, error } = await createPerson({
            supabase: supabaseAdmin as any,
            data: {
              account_id: accountId,
              project_id: projectId,
              name,
              company: company || null,
              title: title || null,
              segment: segment || null,
              contact_info:
                Object.keys(contactInfo).length > 0 ? contactInfo : null,
              notes: notes || null,
            },
          });

          if (error) {
            consola.error("Error creating person", error);
            return `Sorry, I couldn't create that person: ${error.message}`;
          }

          // Clear people cache for this project
          const cacheKey = `${accountId}:${projectId}`;
          peopleDatasetCache.delete(cacheKey);

          const details = [
            name,
            title ? `Title: ${title}` : null,
            company ? `Company: ${company}` : null,
            email ? `Email: ${email}` : null,
          ]
            .filter(Boolean)
            .join(", ");

          return `Created contact: ${details}`;
        } catch (error) {
          consola.error("Error creating person", error);
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";
          return `Failed to create contact "${name}". Error: ${errorMsg}. Please check the details and try again.`;
        }
      },
    },

    // Get project status including themes, insights, and project details
    getProjectStatus: {
      description:
        "Get comprehensive project information including themes, insights, research goals, and project setup. Use this when the user asks about the project, research themes, insights, or project status.",
      parameters: z.object({
        includeThemes: z
          .boolean()
          .optional()
          .describe("Include research themes in the response. Default true."),
        includeInsights: z
          .boolean()
          .optional()
          .describe(
            "Include recent insights/evidence in the response. Default true.",
          ),
      }),
      execute: async ({
        includeThemes = true,
        includeInsights = true,
      }: {
        includeThemes?: boolean;
        includeInsights?: boolean;
      }) => {
        try {
          consola.info("getProjectStatus: fetching project data", {
            projectId,
            accountId,
            includeThemes,
            includeInsights,
          });

          // Fetch project details
          const { data: project, error: projectError } = await getProjectById({
            supabase: supabaseAdmin as any,
            id: projectId,
          });

          if (projectError || !project) {
            consola.error("Database error fetching project", projectError);
            return "Sorry, I had trouble fetching the project information.";
          }

          const response: string[] = [];

          // Project overview
          response.push(`Project: ${project.name}`);
          if (project.description) {
            response.push(`Description: ${project.description}`);
          }

          // Fetch themes if requested
          if (includeThemes) {
            const { data: themes, error: themesError } = await getThemes({
              supabase: supabaseAdmin as any,
              projectId,
            });

            if (!themesError && themes && themes.length > 0) {
              const themeList = themes
                .slice(0, 5)
                .map((t: any) => `"${t.name}"`)
                .join(", ");
              response.push(
                `Research themes (${themes.length} total): ${themeList}${themes.length > 5 ? ", and more" : ""}`,
              );
            } else {
              response.push("No research themes identified yet.");
            }
          }

          // Fetch recent insights if requested
          if (includeInsights) {
            const { data: insights, error: insightsError } = await getInsights({
              supabase: supabaseAdmin as any,
              accountId,
              projectId,
            });

            if (!insightsError && insights && insights.length > 0) {
              const topInsights = insights.slice(0, 5);
              response.push(
                `Recent insights (${insights.length}): ${topInsights.map((i: any) => i.name || i.statement?.slice(0, 50)).join("; ")}`,
              );
            }
          }

          return response.join(". ");
        } catch (error) {
          consola.error("Error fetching project status", error);
          return `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
      },
    },

    // Get tasks in the project
    getTasks: {
      description:
        "Get tasks and todos in the project. Use this when the user asks about tasks, todos, action items, or what needs to be done.",
      parameters: z.object({
        status: z
          .enum([
            "backlog",
            "todo",
            "in_progress",
            "done",
            "blocked",
            "archived",
          ])
          .optional()
          .describe(
            "Filter by task status. If not specified, returns all active tasks (todo and in_progress).",
          ),
        limit: z
          .number()
          .optional()
          .describe("Maximum number of tasks to return. Default 10."),
      }),
      execute: async ({
        status,
        limit = 10,
      }: {
        status?:
          | "backlog"
          | "todo"
          | "in_progress"
          | "done"
          | "blocked"
          | "archived";
        limit?: number;
      }) => {
        try {
          consola.info("getTasks: fetching tasks", {
            projectId,
            accountId,
            status,
            limit,
          });

          // Build options for getTasks
          const options: any = { limit };
          if (status) {
            options.filters = { status };
          } else {
            // Default: show todo and in_progress tasks
            options.filters = { status: ["todo", "in_progress"] };
          }

          const tasks = await getTasks({
            supabase: supabaseAdmin as any,
            accountId,
            projectId,
            options,
          });

          if (!tasks || tasks.length === 0) {
            const statusText = status ? ` with status "${status}"` : "";
            return `No tasks found${statusText}. ${status === "done" ? "All tasks are still pending." : "No pending tasks right now."}`;
          }

          // Format response with task IDs so the agent can reference them for updates
          const tasksList = tasks
            .slice(0, Math.min(5, tasks.length))
            .map((task: any) => {
              const parts = [];
              if (task.title) parts.push(`"${task.title}"`);
              if (task.status) parts.push(`status: ${task.status}`);
              if (task.assigned_to && task.assigned_to.length > 0) {
                const assignee = task.assigned_to[0];
                if (assignee.user_name)
                  parts.push(`assigned to ${assignee.user_name}`);
              }
              // Include task ID for reference
              parts.push(`[ID: ${task.id}]`);
              return parts.join(" ");
            });

          const statusText = status ? ` with status "${status}"` : "";
          return `Found ${tasks.length} tasks${statusText}: ${tasksList.join("; ")}${tasks.length > 5 ? `. Plus ${tasks.length - 5} more tasks not shown` : ""}`;
        } catch (error) {
          consola.error("Error fetching tasks", error);
          return `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
      },
    },

    // Update a task (change status, priority, assignment, etc.)
    updateTask: {
      description:
        "Update a task - change status (backlog, todo, in_progress, done, blocked, review, archived), priority, title, description, or assignment. Use this when the user asks to change, update, or modify a task.",
      parameters: z.object({
        taskId: z.string().describe("The ID of the task to update"),
        updates: z
          .object({
            status: z
              .enum([
                "backlog",
                "todo",
                "in_progress",
                "done",
                "blocked",
                "review",
                "archived",
              ])
              .optional()
              .describe("New task status"),
            priority: z
              .number()
              .min(1)
              .max(3)
              .optional()
              .describe("New priority (1=highest, 3=lowest)"),
            title: z.string().optional().describe("New title"),
            description: z.string().optional().describe("New description"),
          })
          .describe("Fields to update"),
      }),
      execute: async ({
        taskId,
        updates,
      }: {
        taskId: string;
        updates: {
          status?:
            | "backlog"
            | "todo"
            | "in_progress"
            | "done"
            | "blocked"
            | "review"
            | "archived";
          priority?: number;
          title?: string;
          description?: string;
        };
      }) => {
        try {
          consola.info("updateTask: updating task", {
            projectId,
            accountId,
            taskId,
            updates,
          });

          const updatedTask = await updateTask({
            supabase: supabaseAdmin as any,
            taskId,
            userId: userId, // Use the userId from context
            updates,
          });

          // Format success response
          const parts = [`Task "${updatedTask.title}" updated`];
          if (updates.status) parts.push(`Status: ${updates.status}`);
          if (updates.priority) parts.push(`Priority: ${updates.priority}`);

          return parts.join(". ");
        } catch (error) {
          consola.error("Error updating task", error);
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";
          return `Failed to update task with ID "${taskId}". Error: ${errorMsg}. Please verify the task ID and try again.`;
        }
      },
    },

    // Create a new task
    createTask: {
      description:
        "Create a new task. Use this when the user asks to create, add, or make a new task or todo item.",
      parameters: z.object({
        title: z.string().describe("Task title"),
        cluster: z.string().optional().describe("Category of task"),
        description: z.string().optional().describe("Task description"),
        status: z
          .enum([
            "backlog",
            "todo",
            "in_progress",
            "done",
            "blocked",
            "review",
            "archived",
          ])
          .optional()
          .describe("Initial status (default: backlog)"),
        priority: z
          .number()
          .min(1)
          .max(3)
          .optional()
          .describe("Priority 1-3 (1=highest, 3=lowest, default: 3)"),
      }),
      execute: async ({
        title,
        cluster,
        description,
        status,
        priority,
      }: {
        title: string;
        cluster?: string;
        description?: string;
        status?:
          | "backlog"
          | "todo"
          | "in_progress"
          | "done"
          | "blocked"
          | "review"
          | "archived";
        priority?: number;
      }) => {
        try {
          consola.info("createTask: creating task", {
            projectId,
            accountId,
            userId,
            title,
            status,
            priority,
          });

          const newTask = await createTask({
            supabase: supabaseAdmin as any,
            accountId,
            projectId,
            userId: userId,
            data: {
              title,
              cluster: cluster || "General",
              description,
              status,
              priority: priority as 1 | 2 | 3 | undefined,
            },
          });

          return `Created task: "${newTask.title}" (Status: ${newTask.status}, Priority: ${newTask.priority})`;
        } catch (error) {
          consola.error("Error creating task", error);
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";
          return `Failed to create task "${title}". Error: ${errorMsg}. Please try again or contact support if the issue persists.`;
        }
      },
    },

    // Get sales opportunities in the project
    getOpportunities: {
      description:
        "Get sales opportunities, deals, and pipeline information. Use this when the user asks about opportunities, deals, sales pipeline, or potential customers.",
      parameters: z.object({
        stage: z
          .enum([
            "discovery",
            "qualified",
            "proposal",
            "negotiation",
            "closed_won",
            "closed_lost",
          ])
          .optional()
          .describe("Filter by opportunity stage."),
      }),
      execute: async ({
        stage,
      }: {
        stage?:
          | "discovery"
          | "qualified"
          | "proposal"
          | "negotiation"
          | "closed_won"
          | "closed_lost";
      }) => {
        try {
          consola.info("getOpportunities: fetching opportunities", {
            projectId,
            accountId,
            stage,
          });

          const { data: opportunities, error } = await getOpportunities({
            supabase: supabaseAdmin as any,
            accountId,
            projectId,
          });

          if (error || !opportunities) {
            consola.error("Database error fetching opportunities", error);
            return "Sorry, I had trouble fetching the opportunities.";
          }

          // Filter by stage if specified
          let filteredOpps = opportunities;
          if (stage) {
            filteredOpps = opportunities.filter(
              (opp: any) => opp.stage === stage,
            );
          }

          if (filteredOpps.length === 0) {
            const stageText = stage ? ` in stage "${stage}"` : "";
            return `No opportunities found${stageText}.`;
          }

          // Format response with key details
          const oppsList = filteredOpps.slice(0, 10).map((opp: any) => {
            const parts = [opp.name];
            if (opp.stage) parts.push(`stage: ${opp.stage}`);
            if (opp.amount)
              parts.push(`value: $${opp.amount.toLocaleString()}`);
            if (opp.close_date)
              parts.push(
                `closes: ${new Date(opp.close_date).toLocaleDateString()}`,
              );
            return parts.join(", ");
          });

          const stageText = stage ? ` in stage "${stage}"` : "";
          return `Found ${filteredOpps.length} opportunities${stageText}: ${oppsList.join("; ")}${filteredOpps.length > 10 ? `, and ${filteredOpps.length - 10} more` : ""}`;
        } catch (error) {
          consola.error("Error fetching opportunities", error);
          return `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
      },
    },

    // Get research themes in the project
    getThemes: {
      description:
        "Get research themes and topics identified in the project. Themes are patterns, topics, or insights discovered across interviews and evidence.",
      parameters: z.object({
        limit: z
          .number()
          .optional()
          .describe("Maximum number of themes to return. Default 10."),
      }),
      execute: async ({ limit = 10 }: { limit?: number }) => {
        try {
          consola.info("getThemes: fetching themes", {
            projectId,
            accountId,
            limit,
          });

          const { data: themes, error } = await getThemes({
            supabase: supabaseAdmin as any,
            projectId,
          });

          if (error || !themes) {
            consola.error("Database error fetching themes", error);
            return "Sorry, I had trouble fetching the themes.";
          }

          if (themes.length === 0) {
            return "No research themes identified yet in this project.";
          }

          // Limit results
          const limitedThemes = themes.slice(0, limit);

          // Format response with theme details
          const themesList = limitedThemes.map((theme: any) => {
            const parts = [`"${theme.name}"`];
            if (theme.statement) parts.push(`- ${theme.statement}`);
            return parts.join(" ");
          });

          return `Found ${themes.length} research themes: ${themesList.join("; ")}${themes.length > limit ? `, and ${themes.length - limit} more` : ""}`;
        } catch (error) {
          consola.error("Error fetching themes", error);
          return `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
      },
    },

    // Get evidence and insights from interviews
    getEvidence: {
      description:
        "Get evidence, insights, and findings from research interviews. Use this to find specific quotes, observations, or data points collected during research.",
      parameters: z.object({
        limit: z
          .number()
          .optional()
          .describe("Maximum number of evidence items to return. Default 10."),
      }),
      execute: async ({ limit = 10 }: { limit?: number }) => {
        try {
          consola.info("getEvidence: fetching insights/evidence", {
            projectId,
            accountId,
            limit,
          });

          const { data: insights, error } = await getInsights({
            supabase: supabaseAdmin as any,
            accountId,
            projectId,
          });

          if (error || !insights) {
            consola.error("Database error fetching evidence", error);
            return "Sorry, I had trouble fetching the evidence.";
          }

          if (insights.length === 0) {
            return "No evidence found. Try collecting more interview data.";
          }

          // Limit results
          const limitedInsights = insights.slice(0, limit);

          // Format response with evidence details
          const evidenceList = limitedInsights
            .slice(0, 5)
            .map((insight: any) => {
              const parts = [];
              if (insight.name) parts.push(`"${insight.name}"`);
              if (insight.statement)
                parts.push(insight.statement.slice(0, 100));
              return parts.join(": ");
            });

          return `Found ${insights.length} pieces of evidence: ${evidenceList.join("; ")}${insights.length > 5 ? `, and ${insights.length - 5} more` : ""}`;
        } catch (error) {
          consola.error("Error fetching evidence", error);
          return `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
      },
    },

    // Get interviews and research recordings
    getInterviews: {
      description:
        "Get list of interviews, recordings, and research sessions. Use this to see who has been interviewed, when interviews took place, and interview status.",
      parameters: z.object({
        limit: z
          .number()
          .optional()
          .describe("Maximum number of interviews to return. Default 10."),
      }),
      execute: async ({ limit = 10 }: { limit?: number }) => {
        try {
          consola.info("getInterviews: fetching interviews", {
            projectId,
            accountId,
            limit,
          });

          const { data: interviews, error } = await getInterviews({
            supabase: supabaseAdmin as any,
            accountId,
            projectId,
          });

          if (error || !interviews) {
            consola.error("Database error fetching interviews", error);
            return "Sorry, I had trouble fetching the interviews.";
          }

          if (interviews.length === 0) {
            return "No interviews conducted yet in this project.";
          }

          // Limit results
          const limitedInterviews = interviews.slice(0, limit);

          // Format response with interview details
          const interviewsList = limitedInterviews.map((interview: any) => {
            const parts = [];

            // Get participant name from interview_people
            const primaryParticipant = interview.interview_people?.[0];
            const participantName =
              primaryParticipant?.people?.name ||
              interview.title ||
              "Unknown participant";
            parts.push(participantName);

            // Add date if available
            if (interview.interview_date) {
              const date = new Date(interview.interview_date);
              parts.push(`on ${date.toLocaleDateString()}`);
            }

            // Add evidence count
            if (interview.evidence_count && interview.evidence_count > 0) {
              parts.push(`(${interview.evidence_count} evidence items)`);
            }

            // Add status
            if (interview.status && interview.status !== "ready") {
              parts.push(`[${interview.status}]`);
            }

            return parts.join(" ");
          });

          return `Found ${interviews.length} interviews: ${interviewsList.join("; ")}${interviews.length > limit ? `, and ${interviews.length - limit} more` : ""}`;
        } catch (error) {
          consola.error("Error fetching interviews", error);
          return `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
      },
    },

    // Get current date and time
    getCurrentDate: {
      description:
        "Get the current date and time. Use this to know what day it is today, useful for discussing tasks, deadlines, and scheduling.",
      parameters: z.object({}),
      execute: async () => {
        const now = new Date();
        const dateStr = now.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        const timeStr = now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        return `Today is ${dateStr} at ${timeStr}`;
      },
    },

    // Get contextual suggestions for project setup fields
    getContextualSuggestions: {
      description:
        "Get AI-generated suggestions for project setup fields. Use this when helping the user define target roles, organizations, assumptions, unknowns, or research questions. This provides specific, relevant options the user can choose from.",
      parameters: z.object({
        suggestionType: z
          .enum([
            "roles",
            "organizations",
            "assumptions",
            "unknowns",
            "decision_questions",
          ])
          .describe(
            "Type of suggestions: roles (job titles to interview), organizations (company types to target), assumptions (hypotheses to test), unknowns (questions to explore), decision_questions (interview questions)",
          ),
        researchGoal: z
          .string()
          .optional()
          .describe(
            "The research goal or context. If not provided, will be fetched from the project.",
          ),
        existingItems: z
          .array(z.string())
          .optional()
          .describe("Items already added, to avoid duplicates."),
        count: z
          .number()
          .optional()
          .describe("Number of suggestions to generate. Default 3."),
      }),
      execute: async ({
        suggestionType,
        researchGoal,
        existingItems = [],
        count = 3,
      }: {
        suggestionType:
          | "roles"
          | "organizations"
          | "assumptions"
          | "unknowns"
          | "decision_questions";
        researchGoal?: string;
        existingItems?: string[];
        count?: number;
      }) => {
        try {
          consola.info("getContextualSuggestions: generating suggestions", {
            projectId,
            accountId,
            suggestionType,
            researchGoal: researchGoal?.slice(0, 50),
            existingItemsCount: existingItems.length,
            count,
          });

          // Get research goal from project if not provided
          let effectiveResearchGoal = researchGoal;
          if (!effectiveResearchGoal) {
            const { data: project } = await getProjectById({
              supabase: supabaseAdmin as any,
              id: projectId,
            });

            // Try to get research goal from project sections
            if (project?.project_sections) {
              const sections = project.project_sections as any[];
              const goalSection = sections?.find(
                (s: any) => s.kind === "research_goal",
              );
              effectiveResearchGoal =
                goalSection?.content_md || project.description || "";
            } else {
              effectiveResearchGoal = project?.description || "";
            }
          }

          if (!effectiveResearchGoal) {
            return `I need to know your research goal first before I can suggest ${suggestionType}. What are you trying to learn from this research?`;
          }

          // Check if BAML is available
          if (!b?.GenerateContextualSuggestions) {
            consola.warn(
              "getContextualSuggestions: BAML function not available",
            );
            return `Sorry, I can't generate suggestions right now. Please try again later.`;
          }

          // Call BAML to generate suggestions
          const suggestions = await b.GenerateContextualSuggestions(
            effectiveResearchGoal,
            "", // current_input
            suggestionType,
            existingItems, // exclude_items
            [], // rejected_items
            "", // project_context
            "", // custom_instructions
            count,
            null, // question_category
          );

          if (!suggestions || suggestions.length === 0) {
            return `I couldn't generate specific ${suggestionType} suggestions for your research goal. Could you tell me more about what you're looking for?`;
          }

          // Format suggestions for voice output
          const fieldNames: Record<string, string> = {
            roles: "target roles to interview",
            organizations: "types of companies to target",
            assumptions: "assumptions to test",
            unknowns: "questions to explore",
            decision_questions: "interview questions",
          };

          const fieldName = fieldNames[suggestionType] || suggestionType;

          if (suggestions.length === 1) {
            return `Here's a suggestion for ${fieldName}: ${suggestions[0]}. What do you think?`;
          }

          // Format multiple suggestions naturally for speech
          const formattedList = suggestions
            .slice(0, Math.min(3, suggestions.length))
            .map((s: string, i: number) => {
              if (i === 0) return s;
              if (i === suggestions.length - 1) return `or ${s}`;
              return s;
            })
            .join(", ");

          return `Here are some suggestions for ${fieldName}: ${formattedList}. Which of these sounds right, or would you like different options?`;
        } catch (error) {
          consola.error("Error generating contextual suggestions", error);
          return `Sorry, I had trouble generating suggestions. ${error instanceof Error ? error.message : "Please try again."}`;
        }
      },
    },
  };

  // Wrap each tool with llm.tool() to convert to LiveKit format
  return {
    getCurrentDate: llm.tool(toolDefinitions.getCurrentDate),
    getPeople: llm.tool(toolDefinitions.getPeople),
    createPerson: llm.tool(toolDefinitions.createPerson),
    getProjectStatus: llm.tool(toolDefinitions.getProjectStatus),
    getTasks: llm.tool(toolDefinitions.getTasks),
    updateTask: llm.tool(toolDefinitions.updateTask),
    createTask: llm.tool(toolDefinitions.createTask),
    getOpportunities: llm.tool(toolDefinitions.getOpportunities),
    getThemes: llm.tool(toolDefinitions.getThemes),
    getEvidence: llm.tool(toolDefinitions.getEvidence),
    getInterviews: llm.tool(toolDefinitions.getInterviews),
    getContextualSuggestions: llm.tool(
      toolDefinitions.getContextualSuggestions,
    ),
  };
}

// Export empty tools initially - will be populated with context at runtime
export const mastraTools = {};
