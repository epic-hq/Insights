/**
 * Proxies deck asset requests to R2 via presigned URLs.
 * Route: /deck/:token/assets/*
 */
import consola from "consola";
import type { LoaderFunctionArgs } from "react-router";
import { createR2PresignedReadUrl } from "~/utils/r2.server";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  css: "text/css",
  js: "application/javascript",
};

export async function loader({ params }: LoaderFunctionArgs) {
  const { token } = params;
  const assetPath = params["*"];

  if (!token || !/^[a-zA-Z0-9_-]{8,24}$/.test(token) || !assetPath) {
    throw new Response("Not found", { status: 404 });
  }

  // Sanitize: no path traversal
  if (assetPath.includes("..")) {
    throw new Response("Not found", { status: 404 });
  }

  const r2Key = `decks/${token}/assets/${assetPath}`;

  try {
    const presignedUrl = createR2PresignedReadUrl(r2Key, 60 * 60);
    if (!presignedUrl) {
      throw new Response("Not found", { status: 404 });
    }

    const response = await fetch(presignedUrl);
    if (!response.ok) {
      throw new Response("Not found", { status: 404 });
    }

    const ext = assetPath.split(".").pop()?.toLowerCase() ?? "";
    const contentType =
      CONTENT_TYPES[ext] ||
      response.headers.get("content-type") ||
      "application/octet-stream";

    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    if (error instanceof Response) throw error;
    consola.error("[deck-asset] Unexpected error", { token, assetPath, error });
    throw new Response("Not found", { status: 404 });
  }
}
