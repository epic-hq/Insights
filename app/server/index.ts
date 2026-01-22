import "~/lib/instrumentation"; // Must be the first import
import { AuthKitToken } from "@picahq/authkit-token";
import { AssemblyAI } from "assemblyai";
import consola from "consola";
import { bodyLimit } from "hono/body-limit";
import { createHonoServer } from "react-router-hono-server/node";
import { i18next } from "remix-hono/i18next";
import i18nextOpts from "../localization/i18n.server";
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

    // Let React Router handle 404s by not adding a custom notFound handler
    // The server will fall through to React Router's $.tsx catch-all route
  },
  defaultLogger: false,
  getLoadContext,
});
