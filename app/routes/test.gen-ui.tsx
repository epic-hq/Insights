/**
 * Hidden test page for Gen-UI / A2UI development.
 *
 * Access: /a/:accountId/:projectId/test/gen-ui
 *
 * Component gallery + live surface testing without hitting the agent.
 * Protected by _ProtectedLayout — requires login.
 */

import { useCallback, useState } from "react";
import { InlineUserInput } from "~/components/chat/InlineUserInput";
import { A2UIRenderer } from "~/components/gen-ui/A2UIRenderer";
import {
  A2UISurfaceProvider,
  useA2UISurface,
} from "~/contexts/a2ui-surface-context";
import type { A2UIMessage } from "~/lib/gen-ui/a2ui";
import {
  buildDismiss,
  buildSingleComponentSurface,
} from "~/lib/gen-ui/tool-helpers";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

// ---------------------------------------------------------------------------
// Mock data for each registered component
// ---------------------------------------------------------------------------

const COMPONENT_GALLERY: Array<{
  type: string;
  label: string;
  data: Record<string, unknown>;
}> = [
  {
    type: "InterviewPrompts",
    label: "Interview Prompts",
    data: {
      title: "Customer Discovery Questions",
      description: "Questions for understanding user pain points.",
      prompts: [
        {
          id: "q1",
          text: "What's the biggest pain point in your current workflow?",
          status: "planned",
          isMustHave: true,
          category: "Pain",
        },
        {
          id: "q2",
          text: "How do you currently solve this problem?",
          status: "planned",
          isMustHave: true,
          category: "Current Solution",
        },
        {
          id: "q3",
          text: "What would an ideal solution look like?",
          status: "answered",
          isMustHave: false,
          category: "Desired Outcome",
        },
        {
          id: "q4",
          text: "How much time do you spend on this each week?",
          status: "planned",
          isMustHave: false,
          category: "Impact",
        },
        {
          id: "q5",
          text: "Who else on your team is affected?",
          status: "skipped",
          isMustHave: false,
          category: "Stakeholders",
        },
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
      insight:
        "Users who conduct 5+ interviews have 3x higher retention on insights pages. Consider nudging new users toward their first interview.",
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
        description:
          "Product managers at Series B+ startups who use data to drive decisions",
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
        {
          tag: "PAIN",
          text: "Manual data entry wastes hours each week",
          impact: 5,
          novelty: 3,
        },
        {
          tag: "NEED",
          text: "Real-time collaboration on research findings",
          impact: 4,
          novelty: 4,
        },
        {
          tag: "DESIRE",
          text: "AI-assisted synthesis of interview transcripts",
          impact: 5,
          novelty: 5,
        },
        {
          tag: "BLOCKER",
          text: "Security compliance prevents cloud storage",
          impact: 3,
          novelty: 2,
        },
      ],
    },
  },
  {
    type: "ProjectContextStatus",
    label: "Project Context",
    data: {
      projectId: "test-proj-1",
      name: "Enterprise UX Research",
      description:
        "Understanding enterprise buyer pain points in research tooling",
      goals: [
        "Identify top 3 pain points",
        "Validate pricing model",
        "Map decision-making process",
      ],
      researchQuestions: [
        "What tools do teams currently use?",
        "How do they share findings?",
        "What's the buying process?",
      ],
      icp: {
        description:
          "VP/Director of Product at B2B SaaS companies with 100-500 employees",
        characteristics: [
          "B2B SaaS",
          "100-500 employees",
          "VP/Director level",
          "Research-driven",
        ],
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
      statement:
        "Cross-functional research teams spend nearly half their time manually organizing and synthesizing interview data rather than generating insights.",
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
      verbatim:
        "After every customer call, I literally sit there for like three hours just copying quotes into our Notion database. It's soul-crushing.",
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
        {
          question: "What's working well?",
          answer: "The interview analysis is incredibly fast and accurate.",
        },
        {
          question: "What could be improved?",
          answer: "Would love better team collaboration features.",
        },
        {
          question: "Any other feedback?",
          answer: "This tool has become essential to our research workflow.",
        },
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
        {
          id: "r1",
          respondentName: "Maria G.",
          completedAt: new Date().toISOString(),
          highlightAnswer: "The AI synthesis feature is a game-changer",
        },
        {
          id: "r2",
          respondentName: "James L.",
          completedAt: new Date(Date.now() - 86400000).toISOString(),
          highlightAnswer: "Would pay 2x for real-time collaboration",
        },
        {
          id: "r3",
          respondentName: "Anonymous",
          completedAt: new Date(Date.now() - 172800000).toISOString(),
          highlightAnswer: "Needs better enterprise SSO support",
        },
      ],
    },
  },
  {
    type: "PeopleList",
    label: "People List",
    data: {
      totalCount: 42,
      viewAllUrl: "#people",
      people: [
        {
          id: "p1",
          name: "Sarah Kim",
          title: "VP Product",
          orgName: "Acme Corp",
          lastInteractionDate: new Date().toISOString(),
          evidenceCount: 12,
        },
        {
          id: "p2",
          name: "James Liu",
          title: "Head of Research",
          orgName: "TechStart Inc",
          lastInteractionDate: new Date(Date.now() - 86400000).toISOString(),
          evidenceCount: 8,
        },
        {
          id: "p3",
          name: "Maria Garcia",
          title: "Product Manager",
          orgName: "DataFlow",
          lastInteractionDate: new Date(Date.now() - 172800000).toISOString(),
          evidenceCount: 5,
        },
        {
          id: "p4",
          name: "Alex Chen",
          title: "CTO",
          orgName: "Innovate Labs",
          lastInteractionDate: new Date(Date.now() - 259200000).toISOString(),
          evidenceCount: 3,
        },
        {
          id: "p5",
          name: "Priya Patel",
          title: null,
          orgName: "Solo Consulting",
          evidenceCount: 1,
        },
      ],
    },
  },
  {
    type: "PersonCard",
    label: "Person Card",
    data: {
      id: "pc-1",
      name: "Sarah Kim",
      title: "VP of Product",
      orgName: "Acme Corp",
      email: "sarah@acmecorp.com",
      evidenceCount: 12,
      conversationCount: 4,
      surveyCount: 2,
      icpBand: "Strong Fit",
      themes: [
        "Workflow automation",
        "Team collaboration",
        "Data-driven decisions",
        "Enterprise security",
        "AI synthesis",
      ],
    },
  },
  {
    type: "TaskList",
    label: "Task List",
    data: {
      title: "Follow-up Actions",
      tasks: [
        {
          id: "t1",
          text: "Send Sarah the enterprise pricing deck",
          status: "pending",
          priority: 1,
          source: "Interview #7",
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        },
        {
          id: "t2",
          text: "Schedule deep-dive with engineering team",
          status: "pending",
          priority: 1,
          source: "Interview #7",
        },
        {
          id: "t3",
          text: "Review competitor analysis shared by James",
          status: "pending",
          priority: 2,
          source: "Interview #5",
        },
        {
          id: "t4",
          text: "Update ICP based on latest interviews",
          status: "done",
          priority: 2,
        },
        {
          id: "t5",
          text: "Send thank-you note to Maria",
          status: "done",
          priority: 3,
          source: "Interview #3",
        },
      ],
    },
  },
  {
    type: "ActionCards",
    label: "Action Cards",
    data: {
      title: "Recommended Next Steps",
      actions: [
        {
          id: "a1",
          action: "Follow up with Sarah Kim about enterprise pricing",
          reasoning:
            "She mentioned budget approval timeline of Q2 — reaching out now keeps momentum before their fiscal planning locks.",
          priority: 1,
          personName: "Sarah Kim",
        },
        {
          id: "a2",
          action:
            "Create a comparison doc: your tool vs. current spreadsheet workflow",
          reasoning:
            "3 out of 4 recent interviewees cited manual spreadsheet work as #1 pain point. A visual comparison would accelerate decision-making.",
          priority: 1,
        },
        {
          id: "a3",
          action: "Schedule a follow-up with James on security requirements",
          reasoning:
            "He raised SOC2 compliance as a hard blocker. Addressing this early prevents it from derailing the deal later.",
          priority: 2,
          personName: "James Liu",
        },
      ],
    },
  },
  {
    type: "OrganizationContextStatus",
    label: "Organization Context",
    data: {
      id: "org-1",
      name: "Acme Corp",
      industry: "B2B SaaS",
      size: "200-500 employees",
      stage: "Series C",
      website: "https://acmecorp.com",
      contactCount: 6,
      conversationCount: 8,
      evidenceCount: 34,
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

  const addLog = (msg: string) =>
    setLog((prev) =>
      [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50),
    );

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
          {COMPONENT_GALLERY.length} registered components. Click any to render
          via A2UI pipeline.
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
          <Button
            onClick={handleDismiss}
            variant="destructive"
            size="sm"
            disabled={!surface.isActive}
          >
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
            <p className="text-sm text-muted-foreground">
              Click a component above to start.
            </p>
          ) : (
            <pre className="max-h-36 overflow-y-auto rounded bg-muted p-2 font-mono text-xs">
              {log.join("\n")}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* InlineUserInput test section */}
      <InlineUserInputTestSection addLog={addLog} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// InlineUserInput standalone test
// ---------------------------------------------------------------------------

function InlineUserInputTestSection({
  addLog,
}: {
  addLog: (msg: string) => void;
}) {
  const handleSingleSubmit = useCallback(
    (selectedIds: string[], freeText?: string) => {
      addLog(
        `[Single] selected=${JSON.stringify(selectedIds)}, freeText=${freeText ?? "none"}`,
      );
    },
    [addLog],
  );

  const handleMultiSubmit = useCallback(
    (selectedIds: string[], freeText?: string) => {
      addLog(
        `[Multi] selected=${JSON.stringify(selectedIds)}, freeText=${freeText ?? "none"}`,
      );
    },
    [addLog],
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          InlineUserInput (requestUserInput)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Single selection (radio) */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
            Single select (radio)
          </p>
          <div className="rounded-lg bg-background p-3 ring-1 ring-border/60">
            <InlineUserInput
              prompt="Which persona should we prioritize for the next interview?"
              options={[
                {
                  id: "persona-1",
                  label: "Tech-Savvy PM",
                  description: "Product managers at Series B+ startups",
                },
                {
                  id: "persona-2",
                  label: "Enterprise Buyer",
                  description: "VP/Director at Fortune 500 companies",
                },
                {
                  id: "persona-3",
                  label: "Solo Founder",
                  description: "Early-stage founders wearing multiple hats",
                },
              ]}
              selectionMode="single"
              allowFreeText
              onSubmit={handleSingleSubmit}
            />
          </div>
        </div>

        {/* Multiple selection (checkbox) */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
            Multiple select (checkbox)
          </p>
          <div className="rounded-lg bg-background p-3 ring-1 ring-border/60">
            <InlineUserInput
              prompt="Which themes should we validate in the next round of interviews?"
              options={[
                {
                  id: "theme-1",
                  label: "Workflow automation",
                  description: "Manual processes eating into research time",
                },
                {
                  id: "theme-2",
                  label: "Team collaboration",
                  description: "Sharing findings across functions",
                },
                {
                  id: "theme-3",
                  label: "AI synthesis",
                  description: "Automated insight extraction from transcripts",
                },
                {
                  id: "theme-4",
                  label: "Security compliance",
                  description: "SOC2 and data residency requirements",
                },
              ]}
              selectionMode="multiple"
              allowFreeText
              onSubmit={handleMultiSubmit}
            />
          </div>
        </div>

        {/* Already answered state */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
            Already answered
          </p>
          <div className="rounded-lg bg-background p-3 ring-1 ring-border/60">
            <InlineUserInput
              prompt="Which persona should we focus on?"
              options={[
                { id: "a", label: "Tech-Savvy PM" },
                { id: "b", label: "Enterprise Buyer" },
                { id: "c", label: "Solo Founder" },
              ]}
              selectionMode="single"
              answered
              answeredIds={["b"]}
              onSubmit={() => {}}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GenUITestPage() {
  return (
    <A2UISurfaceProvider>
      <GenUITestInner />
    </A2UISurfaceProvider>
  );
}
