/**
 * JourneyMapView - Main container for the journey map.
 * Responsive layout that fits all phases in the available viewport.
 * The parent <main overflow-auto> handles scrolling only if needed.
 */

import { ChevronsUpDown, User } from "lucide-react"
import { useMemo } from "react"
import type { RouteDefinitions } from "~/utils/route-definitions"
import { getPhaseState, JOURNEY_PHASES } from "../journey-config"
import { JourneyBackground } from "./JourneyBackground"
import { JourneySegment } from "./JourneySegment"

interface JourneyMapViewProps {
	routes: RouteDefinitions
	counts: Record<string, number | undefined>
	journeyProgress: {
		contextComplete: boolean
		promptsComplete: boolean
		hasConversations: boolean
		hasInsights: boolean
	}
}

export function JourneyMapView({ routes, counts, journeyProgress }: JourneyMapViewProps) {
	const phaseStates = useMemo(
		() => JOURNEY_PHASES.map((_, i) => getPhaseState(i, counts, journeyProgress)),
		[counts, journeyProgress]
	)

	// Find active phase index for player avatar position
	const activePhaseIndex = phaseStates.findIndex((state) => state === "active")

	return (
		<div className="relative min-h-full w-full overflow-hidden bg-[#0f1729] text-slate-200">
			{/* Background elements — absolutely positioned to fill container */}
			<div className="pointer-events-none absolute inset-0">
				<JourneyBackground />
			</div>

			{/* Phase content — responsive flex layout that fits the viewport */}
			<div className="relative flex h-full w-full items-end justify-center gap-2 overflow-y-auto px-4 pt-16 pb-8 lg:gap-6 lg:px-10">
				{/* Phase segments — each steps up left-to-right for ascending feel */}
				{JOURNEY_PHASES.map((phase, index) => (
					<div
						key={phase.id}
						className="relative w-0 min-w-0 flex-1 overflow-visible"
						style={{
							marginBottom: `${index * 24}px`,
						}}
					>
						{/* Player avatar above active phase */}
						{activePhaseIndex === index && (
							<div className="-translate-x-1/2 -top-14 absolute left-1/2 z-50">
								<div className="flex h-10 w-10 animate-[player-bounce_2s_ease-in-out_infinite] items-center justify-center rounded-full border-[3px] border-amber-400 bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_0_20px_rgba(245,158,11,0.4)]">
									<User className="h-5 w-5 text-white" />
								</div>
								<div className="mt-0.5 text-center font-bold text-[9px] text-amber-400 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
									YOU
								</div>
							</div>
						)}

						<JourneySegment
							phase={phase}
							state={phaseStates[index]}
							routes={routes}
							counts={counts}
							journeyProgress={journeyProgress}
							defaultExpanded={phaseStates[index] === "active" || phaseStates[index] === "completed"}
							index={index}
						/>
					</div>
				))}

				{/* Summit marker */}
				<div className="pointer-events-none flex w-16 flex-shrink-0 flex-col items-center text-center lg:w-24">
					<div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_0_30px_rgba(245,158,11,0.3)] lg:h-16 lg:w-16">
						<ChevronsUpDown className="h-6 w-6 text-white" />
					</div>
					<h3 className="bg-gradient-to-br from-amber-400 to-orange-500 bg-clip-text font-extrabold text-transparent text-xs lg:text-sm">
						Summit!
					</h3>
					<p className="mt-0.5 text-[10px] text-slate-500">Pro unlocked</p>
				</div>
			</div>
		</div>
	)
}
