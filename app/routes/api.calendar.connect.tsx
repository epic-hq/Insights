/**
 * Calendar Connection API - DEPRECATED
 *
 * This route is no longer used. Calendar OAuth is now handled via
 * Pica AuthKit on the frontend (see PicaConnectButton component).
 *
 * Kept for backwards compatibility - returns error directing to new flow.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

/**
 * GET requests redirect to home
 */
export async function loader({ request }: LoaderFunctionArgs) {
  return redirect("/home");
}

/**
 * POST requests return error - use AuthKit flow instead
 */
export async function action({ context, request }: ActionFunctionArgs) {
  return Response.json(
    {
      error:
        "This endpoint is deprecated. Use the Pica AuthKit flow via the Connect Calendar button.",
    },
    { status: 410 },
  );
}
