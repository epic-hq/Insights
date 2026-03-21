import "~/lib/instrumentation"; // Must be the first import
import { AuthKitToken } from "@picahq/authkit-token";
import { AssemblyAI } from "assemblyai";
import consola from "consola";
import { bodyLimit } from "hono/body-limit";
import { createHonoServer } from "react-router-hono-server/node";
import { i18next } from "remix-hono/i18next";
import i18nextOpts from "../localization/i18n.server";
import { resolveApiKey } from "../lib/api-keys.server";
import {
  getOAuthMetadata,
  getProtectedResourceMetadata,
  registerClient,
  exchangeCodeForTokens,
  refreshAccessToken,
} from "../lib/oauth.server";
import { createSupabaseAdminClient } from "../lib/supabase/client.server";
import { getLoadContext } from "./load-context";

const PICA_SECRET_KEY = process.env.PICA_SECRET_KEY || process.env.PICA_API_KEY;

export default await createHonoServer({
  useWebSocket: true,
  configure(server, { upgradeWebSocket }) {
    // Increase body size limit for file uploads (2GB for large video files)
    server.use(
      "*",
      bodyLimit({
        maxSize: 2 * 1024 * 1024 * 1024, // 2GB in bytes
      }),
    );
    // CORS middleware - handle preflight and add headers to all responses
    server.use("*", async (c, next) => {
      const origin = c.req.header("Origin") || "*";

      // Handle OPTIONS preflight immediately
      if (c.req.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers":
              "Content-Type, x-user-id, x-account-id, Authorization",
            "Access-Control-Max-Age": "86400",
            "X-CORS-Handler": "custom-v2", // Debug header to verify new code
          },
        });
      }

      // For non-preflight, continue and add CORS headers to response
      await next();
      c.res.headers.set("Access-Control-Allow-Origin", origin);
    });

    server.use("*", i18next(i18nextOpts));

    // Pica AuthKit token endpoint - handled at Hono level for proper CORS
    // This is called from Pica's iframe at authkit.picaos.com
    server.options("/api/authkit/token", (c) => {
      return c.text("", 204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-user-id, x-account-id",
        "Access-Control-Max-Age": "86400",
      });
    });

    server.all("/api/authkit/token", async (c) => {
      const userId = c.req.header("x-user-id");

      if (!userId) {
        return c.json({ error: "x-user-id header required" }, 400, {
          "Access-Control-Allow-Origin": "*",
        });
      }

      if (!PICA_SECRET_KEY) {
        consola.error("[authkit] PICA_SECRET_KEY not configured");
        return c.json({ error: "AuthKit not configured" }, 503, {
          "Access-Control-Allow-Origin": "*",
        });
      }

      try {
        const authKitToken = new AuthKitToken(PICA_SECRET_KEY);
        const token = await authKitToken.create({
          identity: userId,
          identityType: "user",
        });

        consola.info("[authkit] Token generated for user", { userId });
        return c.json(token, 200, {
          "Access-Control-Allow-Origin": "*",
        });
      } catch (error) {
        consola.error("[authkit] Failed to generate token:", error);
        return c.json({ error: "Failed to generate token" }, 500, {
          "Access-Control-Allow-Origin": "*",
        });
      }
    });

    // Realtime transcription proxy (browser <-> server <-> AssemblyAI)

    server.get(
      "/ws/realtime-transcribe",
      upgradeWebSocket((_c) => {
        let writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
        let transcriber: any;
        return {
          onOpen: async (_event, ws) => {
            consola.info("[WS] proxy open");
            try {
              const apiKey = process.env.ASSEMBLYAI_API_KEY;
              if (!apiKey) {
                ws.send(
                  JSON.stringify({
                    type: "Error",
                    error: "Missing ASSEMBLYAI_API_KEY",
                  }),
                );
                ws.close(1011, "Server misconfigured");
                return;
              }

              const client = new AssemblyAI({ apiKey });
              const CONNECTION_PARAMS = {
                sampleRate: 16000,
                formatTurns: true,
                endOfTurnConfidenceThreshold: 0.7,
                minEndOfTurnSilenceWhenConfident: 160,
                maxTurnSilence: 2400,
                keytermsPrompt: [] as string[],
              };

              transcriber = client.streaming.transcriber(CONNECTION_PARAMS);

              transcriber.on("open", ({ id }: { id: string }) => {
                consola.info("[WS] upstream open", id);
                try {
                  ws.send(JSON.stringify({ type: "Begin", id }));
                } catch {}
              });

              transcriber.on("error", (error: any) => {
                consola.error("[WS] upstream error", error);
                try {
                  ws.send(
                    JSON.stringify({
                      type: "Error",
                      error: String(error?.message || error),
                    }),
                  );
                } catch {}
                try {
                  ws.close(1011, "Upstream error");
                } catch {}
              });

              transcriber.on("close", (code: number, reason: string) => {
                try {
                  ws.close(code || 1000, reason || "");
                } catch {}
              });

              transcriber.on("turn", (turn: any) => {
                try {
                  ws.send(JSON.stringify({ type: "Turn", ...turn }));
                } catch {}
              });

              await transcriber.connect();
              writer = transcriber.stream().getWriter();
            } catch (e: any) {
              try {
                ws.send(
                  JSON.stringify({
                    type: "Error",
                    error: e?.message || "Failed to connect",
                  }),
                );
              } catch {}
              try {
                ws.close(1011, "Init failure");
              } catch {}
            }
          },
          onMessage: async (event, _ws) => {
            try {
              if (!writer) return;
              const data = event.data;
              if (data instanceof ArrayBuffer) {
                consola.debug("[WS] recv bytes", data.byteLength);
                await writer.write(new Uint8Array(data));
              } else if (data instanceof Blob) {
                await writer.write(new Uint8Array(await data.arrayBuffer()));
              } else if (typeof data === "string") {
                if (data === "__end__") {
                  await writer.close();
                }
              }
            } catch {}
          },
          onClose: async () => {
            consola.info("[WS] proxy close");
            try {
              if (writer) {
                try {
                  await writer.close();
                } catch {}
              }
              if (transcriber) {
                try {
                  await transcriber.close();
                } catch {}
              }
            } catch {}
          },
          onError: async (_event, ws) => {
            consola.error("[WS] proxy error");
            try {
              ws.close(1011, "Server error");
            } catch {}
          },
        };
      }),
    );

    // -----------------------------------------------------------------------
    // MCP Server — hosted HTTP endpoint for AI agents
    // Auth: Authorization: Bearer upsk_...
    // -----------------------------------------------------------------------

    // Cache tool imports (expensive), create new MCPServer per connection (required by MCP SDK)
    let mcpToolsPromise: Promise<{
      MCPServer: any;
      mcpTools: Record<string, any>;
    }> | null = null;

    async function getMcpToolsAndClass() {
      if (!mcpToolsPromise) {
        mcpToolsPromise = (async () => {
          const { MCPServer } = await import("@mastra/mcp");
          const { semanticSearchEvidenceTool } =
            await import("../mastra/tools/semantic-search-evidence");
          const { fetchEvidenceTool } =
            await import("../mastra/tools/fetch-evidence");
          const { fetchThemesTool } =
            await import("../mastra/tools/fetch-themes");
          const { fetchPeopleDetailsTool } =
            await import("../mastra/tools/fetch-people-details");
          const { fetchSurveysTool } =
            await import("../mastra/tools/fetch-surveys");
          const { searchSurveyResponsesTool } =
            await import("../mastra/tools/search-survey-responses");
          const { fetchInterviewContextTool } =
            await import("../mastra/tools/fetch-interview-context");
          const { fetchPersonasTool } =
            await import("../mastra/tools/fetch-personas");
          const { fetchSegmentsTool } =
            await import("../mastra/tools/fetch-segments");
          const { semanticSearchPeopleTool } =
            await import("../mastra/tools/semantic-search-people");
          const { fetchProjectStatusContextTool } =
            await import("../mastra/tools/fetch-project-status-context");
          const { upsertPersonTool } =
            await import("../mastra/tools/upsert-person");
          const { managePeopleTool } =
            await import("../mastra/tools/manage-people");
          const { createTaskTool, deleteTaskTool, updateTaskTool } =
            await import("../mastra/tools/manage-tasks");
          const { markTaskCompleteTool } =
            await import("../mastra/tools/mark-task-complete");
          const { manageAnnotationsTool } =
            await import("../mastra/tools/manage-annotations");

          // Wrap tools for MCP compatibility:
          // 1. Strip outputSchema (Zod→JSON Schema $ref breaks on reused sub-schemas)
          // 2. Wrap execute to avoid Mastra's elicitation trap getter on context
          function wrapForMcp(tool: any) {
            const { outputSchema, execute, ...rest } = tool;
            return {
              ...rest,
              execute: async (input: any, ctx: any) => {
                const contextMap = new Map<string, string>();
                if (process.env.__MCP_PROJECT_ID)
                  contextMap.set("project_id", process.env.__MCP_PROJECT_ID);
                if (process.env.__MCP_ACCOUNT_ID)
                  contextMap.set("account_id", process.env.__MCP_ACCOUNT_ID);
                const safeCtx = {
                  requestContext: contextMap,
                  messages: ctx?.messages,
                  toolCallId: ctx?.toolCallId,
                  mcp: ctx?.mcp,
                };
                return execute(input, safeCtx);
              },
            };
          }

          const allTools = {
            semantic_search_evidence: semanticSearchEvidenceTool,
            fetch_evidence: fetchEvidenceTool,
            fetch_themes: fetchThemesTool,
            fetch_people_details: fetchPeopleDetailsTool,
            fetch_surveys: fetchSurveysTool,
            search_survey_responses: searchSurveyResponsesTool,
            fetch_interview_context: fetchInterviewContextTool,
            fetch_personas: fetchPersonasTool,
            fetch_segments: fetchSegmentsTool,
            semantic_search_people: semanticSearchPeopleTool,
            fetch_project_status: fetchProjectStatusContextTool,
            upsert_person: upsertPersonTool,
            manage_people: managePeopleTool,
            create_task: createTaskTool,
            update_task: updateTaskTool,
            delete_task: deleteTaskTool,
            mark_task_complete: markTaskCompleteTool,
            manage_annotations: manageAnnotationsTool,
          };

          const mcpTools = Object.fromEntries(
            Object.entries(allTools).map(([k, v]) => [k, wrapForMcp(v)]),
          );

          return { MCPServer, mcpTools };
        })();
      }
      return mcpToolsPromise;
    }

    // Create a fresh MCPServer per connection (MCP SDK requires one transport per server instance)
    async function createMcpServer() {
      const { MCPServer, mcpTools } = await getMcpToolsAndClass();
      return new MCPServer({
        id: "upsight-intelligence",
        name: "UpSight Intelligence",
        version: "1.1.0",
        tools: mcpTools,
      });
    }

    // -----------------------------------------------------------------------
    // OAuth 2.1 — Authorization Server Metadata (RFC 8414)
    // -----------------------------------------------------------------------

    /** Resolve origin, always using HTTPS in production (TLS terminated at proxy). */
    function getOrigin(c: {
      req: { header: (name: string) => string | undefined; url: string };
    }) {
      const host = c.req.header("host") ?? new URL(c.req.url).host;
      const isLocalhost =
        host.startsWith("localhost") || host.startsWith("127.0.0.1");
      return `${isLocalhost ? "http" : "https"}://${host}`;
    }

    server.get("/.well-known/oauth-authorization-server", (c) => {
      return c.json(getOAuthMetadata(getOrigin(c)), 200, {
        "Cache-Control": "no-store",
      });
    });

    // OAuth 2.1 — Protected Resource Metadata (RFC 9728)
    server.get("/.well-known/oauth-protected-resource", (c) => {
      const origin = getOrigin(c);
      return c.json(
        getProtectedResourceMetadata(`${origin}/mcp`, origin),
        200,
        { "Cache-Control": "no-store" },
      );
    });

    // OAuth 2.1 — Dynamic Client Registration (RFC 7591)
    server.post("/oauth/register", async (c) => {
      try {
        const body = await c.req.json();
        const supabase = createSupabaseAdminClient();
        const result = await registerClient(supabase, body);
        return c.json(result, 201);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Registration failed";
        consola.error("[oauth] Registration error:", message);
        return c.json(
          { error: "invalid_client_metadata", error_description: message },
          400,
        );
      }
    });

    // OAuth 2.1 — Token Endpoint
    server.post("/oauth/token", async (c) => {
      const contentType = c.req.header("Content-Type") ?? "";
      let body: Record<string, string>;

      // OAuth spec requires application/x-www-form-urlencoded
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const parsed = await c.req.parseBody();
        body = Object.fromEntries(
          Object.entries(parsed).map(([k, v]) => [k, String(v)]),
        );
      } else if (contentType.includes("application/json")) {
        // Some clients send JSON — accept it gracefully
        body = await c.req.json();
      } else {
        return c.json(
          {
            error: "invalid_request",
            error_description:
              "Content-Type must be application/x-www-form-urlencoded",
          },
          400,
        );
      }

      const supabase = createSupabaseAdminClient();
      const grantType = body.grant_type;

      try {
        if (grantType === "authorization_code") {
          const result = await exchangeCodeForTokens(supabase, {
            code: body.code,
            clientId: body.client_id,
            redirectUri: body.redirect_uri,
            codeVerifier: body.code_verifier,
          });
          return c.json(result);
        }

        if (grantType === "refresh_token") {
          const result = await refreshAccessToken(supabase, {
            refreshToken: body.refresh_token,
            clientId: body.client_id,
          });
          return c.json(result);
        }

        return c.json(
          {
            error: "unsupported_grant_type",
            error_description: `Grant type '${grantType}' is not supported`,
          },
          400,
        );
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Token exchange failed";
        consola.error("[oauth] Token error:", message);
        return c.json(
          { error: "invalid_grant", error_description: message },
          400,
        );
      }
    });

    server.all("/mcp/*", async (c) => {
      const authHeader = c.req.header("Authorization") ?? "";
      const rawKey = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : "";
      if (!rawKey) {
        return c.json(
          { error: "Missing Authorization: Bearer <api_key>" },
          401,
          { "WWW-Authenticate": "Bearer" },
        );
      }

      const supabase = createSupabaseAdminClient();
      const resolved = await resolveApiKey(supabase, rawKey);
      if (!resolved) {
        return c.json({ error: "Invalid, revoked, or expired API key" }, 401, {
          "WWW-Authenticate": "Bearer",
        });
      }

      // Inject project/account context for tools
      process.env.__MCP_PROJECT_ID = resolved.projectId;
      process.env.__MCP_ACCOUNT_ID = resolved.accountId;

      const mcpServer = await createMcpServer();
      const url = new URL(c.req.url);

      return mcpServer.startHonoSSE({
        url,
        ssePath: "/mcp",
        messagePath: "/mcp/message",
        context: c,
      });
    });

    // Handle stale asset requests after deployments.
    // When a new deploy changes chunk hashes, clients with cached HTML still
    // request old /assets/*.js files that no longer exist. Return a small JS
    // snippet that forces a full page reload so the browser fetches fresh HTML
    // with the correct asset references.
    server.get("/assets/:filename{.+\\.(js|css)$}", (c) => {
      const ext = c.req.path.endsWith(".css") ? "css" : "js";
      consola.warn(
        `[assets] Stale asset requested: ${c.req.path} — triggering client reload`,
      );
      if (ext === "js") {
        return c.body(
          "window.__STALE_DEPLOY=true;window.location.reload();",
          404,
          {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "no-store",
          },
        );
      }
      // For CSS, return empty stylesheet — the reload from a stale JS chunk
      // will refresh everything anyway
      return c.body("", 404, {
        "Content-Type": "text/css; charset=utf-8",
        "Cache-Control": "no-store",
      });
    });

    // Let React Router handle 404s by not adding a custom notFound handler
    // The server will fall through to React Router's $.tsx catch-all route
  },
  defaultLogger: false,
  getLoadContext,
});
