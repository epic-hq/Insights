/**
 * Public route for viewing shared slide decks.
 * Reads HTML content from the decks table and renders it in an iframe.
 * No authentication required — access controlled by token.
 */
import consola from "consola";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const { token } = params;

  if (!token || !/^[a-zA-Z0-9_-]{8,24}$/.test(token)) {
    throw new Response("Invalid deck token", { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: deck, error } = await supabase
    .from("decks")
    .select("html_content, title, share_enabled")
    .eq("token", token)
    .single();

  if (error || !deck) {
    throw new Response("Deck not found", { status: 404 });
  }

  if (!deck.share_enabled) {
    throw new Response("This deck link has been disabled", { status: 403 });
  }

  return { html: deck.html_content, title: deck.title };
}

export default function DeckPage() {
  const { html } = useLoaderData<typeof loader>();
  return (
    <iframe
      srcDoc={html}
      style={{ width: "100%", height: "100vh", border: "none" }}
      title="Deck"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
