/**
 * Hidden test page for Gen-UI / A2UI development.
 *
 * Access: /test/gen-ui
 *
 * Renders mock A2UI surfaces without hitting the agent or Mastra.
 * Use this to verify components, the renderer, and the surface context
 * work correctly before enabling via the ffGenUI feature flag.
 */

import { useState } from "react";
import { A2UIRenderer } from "~/components/gen-ui/A2UIRenderer";
import { A2UISurfaceProvider, useA2UISurface } from "~/contexts/a2ui-surface-context";
import type { A2UIMessage } from "~/lib/gen-ui/a2ui";
import { buildDataUpdate, buildDismiss, buildSingleComponentSurface } from "~/lib/gen-ui/tool-helpers";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

const MOCK_PROMPTS = [
	{ id: "q1", text: "What's the biggest pain point in your current workflow?", status: "planned" as const, isMustHave: true, category: "Pain" },
	{ id: "q2", text: "How do you currently solve this problem?", status: "planned" as const, isMustHave: true, category: "Current Solution" },
	{ id: "q3", text: "What would an ideal solution look like?", status: "planned" as const, isMustHave: false, category: "Desired Outcome" },
	{ id: "q4", text: "How much time do you spend on this each week?", status: "planned" as const, isMustHave: false, category: "Impact" },
	{ id: "q5", text: "Who else on your team is affected?", status: "planned" as const, isMustHave: false, category: "Stakeholders" },
];

function GenUITestInner() {
	const surface = useA2UISurface();
	const [log, setLog] = useState<string[]>([]);

	const addLog = (msg: string) => setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));

	const handleSpawnSurface = () => {
		const payload = buildSingleComponentSurface({
			surfaceId: "test-surface-1",
			componentType: "InterviewPrompts",
			data: {
				title: "Customer Discovery Questions",
				description: "Questions for understanding user pain points and current workflows.",
				prompts: MOCK_PROMPTS,
			},
		});
		addLog(`Spawning surface: ${payload.surfaceId} (${payload.messages.length} messages)`);
		surface.applyMessages(payload.messages as A2UIMessage[]);
	};

	const handleUpdateData = () => {
		const payload = buildDataUpdate({
			surfaceId: "test-surface-1",
			data: {
				title: "Updated: Discovery Questions v2",
				description: "Revised questions after stakeholder feedback.",
				prompts: [
					...MOCK_PROMPTS,
					{ id: "q6", text: "What budget do you have allocated for this?", status: "planned", isMustHave: true, category: "Budget" },
				],
			},
		});
		addLog(`Data update: ${payload.messages.length} messages`);
		surface.applyMessages(payload.messages as A2UIMessage[]);
	};

	const handleDismiss = () => {
		const payload = buildDismiss("test-surface-1");
		addLog("Dismissing surface");
		surface.applyMessages(payload.messages as A2UIMessage[]);
	};

	return (
		<div className="mx-auto max-w-5xl space-y-6 p-6">
			<div>
				<h1 className="text-2xl font-bold">Gen-UI Test Page</h1>
				<p className="text-sm text-muted-foreground">
					Hidden page for testing A2UI surfaces. Not linked from navigation.
				</p>
			</div>

			{/* Controls */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Surface Controls</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					<Button onClick={handleSpawnSurface} variant="default" size="sm">
						Spawn InterviewPrompts
					</Button>
					<Button onClick={handleUpdateData} variant="secondary" size="sm">
						Update Data
					</Button>
					<Button onClick={handleDismiss} variant="destructive" size="sm">
						Dismiss
					</Button>
				</CardContent>
			</Card>

			{/* Surface state */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Surface State</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm">
					<div className="flex gap-4">
						<span className="font-medium">Active:</span>
						<span>{surface.isActive ? "✅ Yes" : "❌ No"}</span>
					</div>
					<div className="flex gap-4">
						<span className="font-medium">Surface ID:</span>
						<span className="font-mono text-xs">{surface.surface?.surfaceId ?? "—"}</span>
					</div>
					<div className="flex gap-4">
						<span className="font-medium">Components:</span>
						<span>{surface.surface?.components.size ?? 0}</span>
					</div>
					<div className="flex gap-4">
						<span className="font-medium">Ready:</span>
						<span>{surface.surface?.ready ? "Yes" : "No"}</span>
					</div>
				</CardContent>
			</Card>

			{/* Rendered surface */}
			{surface.surface != null && surface.surface.ready && (
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Rendered Surface</CardTitle>
					</CardHeader>
					<CardContent>
						<A2UIRenderer
							surface={surface.surface}
							onAction={(action) => {
								addLog(`Action: ${JSON.stringify(action)}`);
							}}
						/>
					</CardContent>
				</Card>
			)}

			{/* Log */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Event Log</CardTitle>
				</CardHeader>
				<CardContent>
					{log.length === 0 ? (
						<p className="text-sm text-muted-foreground">No events yet. Click &quot;Spawn InterviewPrompts&quot; to start.</p>
					) : (
						<pre className="max-h-48 overflow-y-auto rounded bg-muted p-2 font-mono text-xs">
							{log.join("\n")}
						</pre>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

export default function GenUITestPage() {
	return (
		<A2UISurfaceProvider>
			<GenUITestInner />
		</A2UISurfaceProvider>
	);
}
