import { supabaseAdmin } from "~/lib/supabase/server";

export async function loader({ request }: { request: Request })  {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return Response.json({ error: { message: "Missing userId" } }, { status: 400 });
  }

  //  'accounts.account_user' allows users to view their team mates
  const { data, error } = await (supabaseAdmin as any)
    .schema("accounts").from("account_user")
    .select("id, name, public_metadata")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return Response.json({ error: { message: "User not found" } }, { status: 404 });
  }

  // user_metadata may contain fields like full_name, avatar_url, etc.
  const { id, name, public_metadata } = data.account;
  return Response.json({
    id,
    name,
    avatar_url: public_metadata?.avatar_url || null,
  });
};
