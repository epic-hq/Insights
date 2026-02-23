/**
 * Layer 3: Intersections, Divergences & Blind Spots.
 * Common Ground: horizontal bar chart with roles inline on bar + breadth fraction.
 * Divergences: placeholder for Phase C (AI-detected conflicting positions).
 * Blind Spots: expected concerns with low signal, "Add to Survey" / "Not Relevant" CTAs.
 */
import { AlertTriangle, Link2, X, Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { CommonGround, WeakSignal } from "~/features/insights/types";

interface IntersectionsPanelProps {
	commonGround: CommonGround[];
	weakSignals: WeakSignal[];
}

export function IntersectionsPanel({ commonGround, weakSignals }: IntersectionsPanelProps) {
	const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

	const visibleSignals = weakSignals.filter((ws) => !dismissedIds.has(ws.theme.id));

	return (
		<div className="grid gap-4 lg:grid-cols-3">
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="flex items-center gap-2 font-semibold text-base">
						<Link2 className="h-4 w-4 text-blue-500" />
						Intersections
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="mb-3 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
						Common Ground — themes shared across functions
					</p>
					{commonGround.length > 0 ? (
						<div className="space-y-3">
							{commonGround.slice(0, 5).map((cg) => (
								<div key={cg.theme.id} className="rounded-md border bg-muted/10 px-3 py-2">
									<div className="flex items-start justify-between gap-3">
										<p className="min-w-0 flex-1 truncate font-semibold text-foreground text-sm">{cg.theme.name}</p>
										<span className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-medium text-[11px] text-muted-foreground tabular-nums">
											{cg.role_count}/{cg.total_roles}
										</span>
									</div>
									<p className="mt-1 line-clamp-1 text-muted-foreground text-xs">{cg.roles.join(" · ")}</p>
								</div>
							))}
						</div>
					) : (
						<p className="text-muted-foreground text-xs italic">No themes shared across multiple roles yet.</p>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="flex items-center gap-2 font-semibold text-base">
						<Zap className="h-4 w-4 text-blue-500" />
						Divergences
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="mb-2 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
						Conflicting positions on the same topic
					</p>
					<p className="text-muted-foreground text-xs italic">
						Coming in Phase C — AI-detected conflicting positions across stakeholders will surface here.
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="flex items-center gap-2 font-semibold text-base">
						<AlertTriangle className="h-4 w-4 text-yellow-500" />
						Blind Spots
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="mb-3 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
						Expected concerns with no signal
					</p>
					{visibleSignals.length > 0 ? (
						<div className="divide-y divide-border">
							{visibleSignals.map((ws) => (
								<div
									key={ws.theme.id}
									className="grid grid-cols-[auto,1fr,auto] items-start gap-3 py-3 first:pt-0 last:pb-0"
								>
									<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
									<div className="min-w-0">
										<p className="font-medium text-foreground text-sm">{ws.theme.name || "Untitled"}</p>
										<p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">{ws.reason}</p>
									</div>
									<div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
										<Button variant="outline" size="sm" className="h-7 text-xs" disabled>
											Add to Survey
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="h-7 text-muted-foreground text-xs"
											onClick={() => setDismissedIds((prev) => new Set(prev).add(ws.theme.id))}
										>
											<X className="mr-1 h-3 w-3" />
											Not Relevant
										</Button>
									</div>
								</div>
							))}
						</div>
					) : (
						<p className="text-muted-foreground text-xs italic">
							No blind spots detected — all themes have adequate coverage.
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
