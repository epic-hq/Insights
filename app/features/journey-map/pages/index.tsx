/**
 * Journey Map page - Visualizes user's research journey progress.
 * Uses sidebar counts and journey progress hooks for real data.
 */

import { useCurrentProject } from "~/contexts/current-project-context"
import { useJourneyProgress } from "~/hooks/useJourneyProgress"
import { useProjectRoutesFromIds } from "~/hooks/useProjectRoutes"
import { useSidebarCounts } from "~/hooks/useSidebarCounts"
import { JourneyMapView } from "../components/JourneyMapView"

export default function JourneyMapPage() {
	const { accountId, projectId } = useCurrentProject()
	const routes = useProjectRoutesFromIds(accountId, projectId)
	const { counts } = useSidebarCounts(accountId, projectId)
	const { progress } = useJourneyProgress(projectId)

	return <JourneyMapView routes={routes} counts={counts} journeyProgress={progress} />
}
