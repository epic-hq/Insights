/**
 * Hidden test page for Gen-UI / A2UI development.
 *
 * Access: /test/gen-ui
 *
 * Component gallery + live surface testing without hitting the agent.
 * Protected by _ProtectedLayout — requires login.
 */

import { useState } from "react";
import { A2UIRenderer } from "~/components/gen-ui/A2UIRenderer";
import { A2UISurfaceProvider, useA2UISurface } from "~/contexts/a2ui-surface-context";
import type { A2UIMessage } from "~/lib/gen-ui/a2ui";
import { buildDismiss, buildSingleComponentSurface } from "~/lib/gen-ui/tool-helpers";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

// ---------------------------------------------------------------------------
// Mock data for each registered component
// ---------------------------------------------------------------------------

const COMPONENT_GALLERY: Array<{ type: string; label: string; data: Record<string, unknown> }> = [
	{
		type: "InterviewPrompts",
		label: "Interview Prompts",
		data: {
			title: "Customer Discovery Questions",
			description: "Questions for understanding user pain points.",
			prompts: [
				{ id: "q1", text: "What's the biggest pain point in your current workflow?", status: "planned", isMustHave: true, category: "Pain" },
				{ id: "q2", text: "How do you currently solve this problem?", status: "planned", isMustHave: true, category: "Current Solution" },
				{ id: "q3", text: "What would an ideal solution look like?", status: "answered", isMustHave: false, category: "Desired Outcome" },
				{ id: "q4", text: "How much time do you spend on this each week?", status: "planned", isMustHave: false, category: "Impact" },
				{ id: "q5", text: "Who else on your team is affected?", status: "skipped", isMustHave: false, category: "Stakeholders" },
			],
		},
	},
	{
		type: "BANTScorecard",
		label: "BANT Scorecard",
		data: {
			budget: { score: 72, note: "Has dedicated budget for tooling" },
			authority: { score: 85, note: "VP-level decision maker" },
			need: { score: 90, note: "Critical pain point, losing 10h/week" },
			timeline: { score: 60, note: "Q2 target, needs vendor approval" },
			overall: 77,
		},
	},
	{
		type: "AiInsightCard",
		label: "AI Insight Card",
		data: {
			insight: "Users who conduct 5+ interviews have 3x higher retention on insights pages. Consider nudging new users toward their first interview.",
			source: "Usage Analytics",
		},
	},
	{
		type: "StatCard",
		label: "Stat Card",
		data: {
			label: "Interviews Conducted",
			value: 47,
			change: "+12 this week",
			description: "Across 3 active projects",
			icon: "📊",
		},
	},
	{
		type: "PersonaCard",
		label: "Persona Card",
		data: {
			persona: {
				id: "p1",
				name: "Tech-Savvy PM",
				description: "Product managers at Series B+ startups who use data to drive decisions",
				color_hex: "#8b5cf6",
				percentage: 34,
			},
		},
	},
	{
		type: "ThemeList",
		label: "Theme List",
		data: {
			themes: [
				{ tag: "PAIN", text: "Manual data entry wastes hours each week", impact: 5, novelty: 3 },
				{ tag: "NEED", text: "Real-time collaboration on research findings", impact: 4, novelty: 4 },
				{ tag: "DESIRE", text: "AI-assisted synthesis of interview transcripts", impact: 5, novelty: 5 },
				{ tag: "BLOCKER", text: "Security compliance prevents cloud storage", impact: 3, novelty: 2 },
			],
		},
	},
	{
		type: "ProjectContextStatus",
		label: "Project Context",
		data: {
			projectId: "test-proj-1",
			name: "Enterprise UX Research",
			description: "Understanding enterprise buyer pain points in research tooling",
			goals: ["Identify top 3 pain points", "Validate pricing model", "Map decision-making process"],
			researchQuestions: ["What tools do teams currently use?", "How do they share findings?", "What's the buying process?"],
			icp: {
				description: "VP/Director of Product at B2B SaaS companies with 100-500 employees",
				characteristics: ["B2B SaaS", "100-500 employees", "VP/Director level", "Research-driven"],
			},
			progress: { interviewCount: 12, insightCount: 34, themeCount: 8 },
			workflowType: "Discovery",
		},
	},
	{
		type: "InsightCard",
		label: "Insight Card",
		data: {
			id: "ins-1",
			name: "Teams waste 40% of research time on manual synthesis",
			statement: "Cross-functional research teams spend nearly half their time manually organizing and synthesizing interview data rather than generating insights.",
			pain: "Manual copy-paste from transcripts to spreadsheets",
			jtbd: "When I finish an interview, I want to quickly extract key findings so I can share them with stakeholders before the next meeting.",
			category: "Efficiency",
			evidenceCount: 7,
		},
	},
	{
		type: "EvidenceCard",
		label: "Evidence Card",
		data: {
			id: "ev-1",
			gist: "Spends 3 hours after each interview just organizing notes",
			verbatim: "After every customer call, I literally sit there for like three hours just copying quotes into our Notion database. It's soul-crushing.",
			topic: "Research workflow",
			journeyStage: "Consideration",
			support: "supports",
			speakerName: "Sarah K.",
			interviewTitle: "Enterprise PM Interview #7",
		},
	},
	{
		type: "SurveyCreated",
		label: "Survey Created",
		data: {
			surveyId: "srv-1",
			name: "Product-Market Fit Survey",
			questionCount: 6,
			editUrl: "#edit",
			publicUrl: "#preview",
		},
	},
	{
		type: "SurveyResponseCard",
		label: "Survey Response",
		data: {
			responseId: "resp-1",
			surveyName: "Product Feedback Survey",
			respondentName: "Alex Chen",
			completedAt: new Date().toISOString(),
			answers: [
				{ question: "What's working well?", answer: "The interview analysis is incredibly fast and accurate." },
				{ question: "What could be improved?", answer: "Would love better team collaboration features." },
				{ question: "Any other feedback?", answer: "This tool has become essential to our research workflow." },
			],
		},
	},
	{
		type: "SurveyResponseList",
		label: "Survey Responses List",
		data: {
			surveyName: "Beta Feedback Round 2",
			totalResponses: 24,
			responses: [
				{ id: "r1", respondentName: "Maria G.", completedAt: new Date().toISOString(), highlightAnswer: "The AI synthesis feature is a game-changer" },
				{ id: "r2", respondentName: "James L.", completedAt: new Date(Date.now() - 86400000).toISOString(), highlightAnswer: "Would pay 2x for real-time collaboration" },
				{ id: "r3", respondentName: "Anonymous", completedAt: new Date(Date.now() - 172800000).toISOString(), highlightAnswer: "Needs better enterprise SSO support" },
			],
		},
	},
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function GenUITestInner() {
	const surface = useA2UISurface();
	const [log, setLog] = useState<string[]>([]);
	const [activeType, setActiveType] = useState<string | null>(null);

	const addLog = (msg: string) => setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));

	const handleSpawn = (entry: (typeof COMPONENT_GALLERY)[0]) => {
		// Dismiss previous surface first
		if (surface.isActive) {
			surface.dismiss();
		}
		const payload = buildSingleComponentSurface({
			surfaceId: `test-${entry.type}`,
			componentType: entry.type,
			data: entry.data,
		});
		addLog(`Spawn ${entry.type} (${payload.messages.length} messages)`);
		surface.applyMessages(payload.messages as A2UIMessage[]);
		setActiveType(entry.type);
	};

	const handleDismiss = () => {
		if (activeType) {
			const payload = buildDismiss(`test-${activeType}`);
			surface.applyMessages(payload.messages as A2UIMessage[]);
		} else {
			surface.dismiss();
		}
		addLog("Dismissed");
		setActiveType(null);
	};

	return (
		<div className="mx-auto max-w-5xl space-y-6 p-6">
			<div>
				<h1 className="text-2xl font-bold">Gen-UI Component Gallery</h1>
				<p className="text-sm text-muted-foreground">
					{COMPONENT_GALLERY.length} registered components. Click any to render via A2UI pipeline.
				</p>
			</div>

			{/* Component buttons */}
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-base">Components</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					{COMPONENT_GALLERY.map((entry) => (
						<Button
							key={entry.type}
							onClick={() => handleSpawn(entry)}
							variant={activeType === entry.type ? "default" : "outline"}
							size="sm"
						>
							{entry.label}
						</Button>
					))}
					<Button onClick={handleDismiss} variant="destructive" size="sm" disabled={!surface.isActive}>
						Dismiss
					</Button>
				</CardContent>
			</Card>

			{/* Surface state */}
			<div className="flex items-center gap-4 text-sm">
				<span className="font-medium">Surface:</span>
				<span>{surface.isActive ? `Active (${activeType})` : "None"}</span>
				<span className="text-muted-foreground">|</span>
				<span>Components: {surface.surface?.components.size ?? 0}</span>
				<span className="text-muted-foreground">|</span>
				<span>Ready: {surface.surface?.ready ? "Yes" : "No"}</span>
			</div>

			{/* Rendered surface */}
			{surface.surface != null && surface.surface.ready && (
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">Rendered: {activeType}</CardTitle>
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
				<CardHeader className="pb-2">
					<CardTitle className="text-base">Event Log</CardTitle>
				</CardHeader>
				<CardContent>
					{log.length === 0 ? (
						<p className="text-sm text-muted-foreground">Click a component above to start.</p>
					) : (
						<pre className="max-h-36 overflow-y-auto rounded bg-muted p-2 font-mono text-xs">
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
