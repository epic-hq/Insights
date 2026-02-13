/**
 * StepsToWow - Orchestrator component for the 3 Steps to Wow flow.
 * Renders either the route picker or step guide based on project settings.
 */

import type { RouteDefinitions } from "~/utils/route-definitions";
import type { WowSettings } from "../journey-config";
import { WowRoutePicker } from "./WowRoutePicker";
import { WowStepGuide } from "./WowStepGuide";

interface StepsToWowProps {
  routes: RouteDefinitions;
  counts: Record<string, number | undefined>;
  wowSettings: WowSettings;
  onShowJourneyMap: () => void;
}

export function StepsToWow({
  routes,
  counts,
  wowSettings,
  onShowJourneyMap,
}: StepsToWowProps) {
  // If a wow_path has been chosen, show the step guide
  if (wowSettings.wow_path) {
    return (
      <WowStepGuide
        wowPath={wowSettings.wow_path}
        wowSettings={wowSettings}
        counts={counts}
        routes={routes}
        onSkipToJourney={onShowJourneyMap}
      />
    );
  }

  // Otherwise, show the route picker
  return <WowRoutePicker onFullSetup={onShowJourneyMap} />;
}
