/**
 * Calendar OAuth Callback - DEPRECATED
 *
 * GET /api/calendar/callback
 *
 * This route is no longer used. Calendar OAuth is now handled via
 * Pica AuthKit on the frontend (see PicaConnectButton component).
 *
 * The connection is saved via /api/calendar/save-connection after
 * AuthKit completes the OAuth flow.
 */

import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  // This endpoint is deprecated - redirect to home with error
  return redirect("/home?calendar_error=deprecated_endpoint");
}
