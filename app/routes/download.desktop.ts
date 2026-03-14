/**
 * Redirect /download/desktop to the latest UpSight desktop app DMG.
 * Update DESKTOP_APP_URL here when a new version is released.
 */

import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

const DESKTOP_APP_URL =
  "https://pub-9c5ff12be83d47af8742318dfa326c50.r2.dev/UpSight-0.1.0-arm64.dmg";

export function loader(_args: LoaderFunctionArgs) {
  return redirect(DESKTOP_APP_URL, { status: 302 });
}
