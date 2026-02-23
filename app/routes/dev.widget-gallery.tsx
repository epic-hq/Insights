/**
 * Widget Gallery — Dev-only page to preview all gen-ui widgets with dummy data.
 * Access at /dev/widget-gallery
 */

import { ConversationLensInsights } from "~/features/generative-ui/components/ConversationLensInsights";
import { DecisionBrief } from "~/features/generative-ui/components/DecisionBrief";
import { DecisionSupport } from "~/features/generative-ui/components/DecisionSupport";
import { EvidenceWall } from "~/features/generative-ui/components/EvidenceWall";
import { IntakeBatchStatus } from "~/features/generative-ui/components/IntakeBatchStatus";
import { IntakeHealth } from "~/features/generative-ui/components/IntakeHealth";
import { IntakePathPicker } from "~/features/generative-ui/components/IntakePathPicker";
import { PatternSynthesis } from "~/features/generative-ui/components/PatternSynthesis";
import { ProgressRail } from "~/features/generative-ui/components/ProgressRail";
import { ResearchPulse } from "~/features/generative-ui/components/ResearchPulse";
import { StakeholderMap } from "~/features/generative-ui/components/StakeholderMap";
import { SurveyOutreach } from "~/features/generative-ui/components/SurveyOutreach";

/* ---------- dummy data ---------- */

const progressRailData = {
  phases: [
    {
      id: "frame" as const,
      label: "Frame Decision",
      status: "complete" as const,
    },
    {
      id: "collect" as const,
      label: "Collect Signal",
      status: "complete" as const,
    },
    {
      id: "validate" as const,
      label: "Validate Pattern",
      status: "active" as const,
      hint: "2 strong themes, 1 needs more signal",
    },
    {
      id: "commit" as const,
      label: "Commit Actions",
      status: "upcoming" as const,
    },
    { id: "measure" as const, label: "Measure", status: "upcoming" as const },
  ],
  activeMoment: 6,
  statusLine: "Growing Confidence — 6 interviews in, 2 strong themes emerging",
  nextAction: "Review your top themes",
  nextActionUrl: "#",
};

const decisionBriefData = {
  projectId: "p1",
  decisionQuestion: "Should we invest in a self-serve onboarding flow?",
  targetCustomer: "Mid-market SaaS ops leads",
  deadline: "March 15, 2026",
  successMetric: "20% reduction in onboarding support tickets",
  researchQuestions: [
    "What blocks self-serve adoption today?",
    "Which persona segments would use it?",
    "What's the cost of doing nothing?",
  ],
  completeness: {
    hasDecision: true,
    hasTarget: true,
    hasDeadline: true,
    hasMetric: true,
    hasQuestions: true,
  },
  readinessLabel: "Decision Brief complete — ready to collect signal",
  editUrl: "#",
};

const intakePathPickerData = {
  projectId: "p1",
  accountId: "a1",
  prompt: "How do you want to get signal?",
  paths: [
    {
      id: "upload" as const,
      label: "Upload Interviews",
      description:
        "Get existing recordings and transcripts into the system now",
      hint: "Fastest if you have recordings",
      started: true,
      count: 3,
    },
    {
      id: "record" as const,
      label: "Live Recording",
      description: "Capture a fresh conversation right now",
      hint: "Best for scheduled calls",
    },
    {
      id: "survey" as const,
      label: "Send Surveys",
      description: "Collect responses from real people quickly",
      hint: "Great for broad reach",
      started: true,
      count: 1,
    },
  ],
  recommendedPath: "upload" as const,
};

const intakeBatchStatusData = {
  projectId: "p1",
  items: [
    {
      id: "i1",
      title: "VP Product interview.mp3",
      source: "upload" as const,
      status: "ready" as const,
      resultSummary: "12 insights extracted",
    },
    {
      id: "i2",
      title: "Sales lead call.m4a",
      source: "upload" as const,
      status: "ready" as const,
      resultSummary: "8 insights extracted",
    },
    {
      id: "i3",
      title: "Customer feedback.pdf",
      source: "upload" as const,
      status: "ready" as const,
      resultSummary: "5 insights extracted",
    },
    {
      id: "i4",
      title: "Onboarding session.mp4",
      source: "upload" as const,
      status: "processing" as const,
    },
    {
      id: "i5",
      title: "Corrupted file.wav",
      source: "upload" as const,
      status: "failed" as const,
      resultSummary: "File could not be read",
    },
  ],
  summary: { total: 5, ready: 3, processing: 1, failed: 1 },
  statusLine:
    "3 conversations analyzed, 25 evidence points so far. You could use more VP-level signal.",
  signalGate: {
    sufficient: false,
    message: "Need 2 more interviews for balanced coverage",
  },
  uploadMoreUrl: "#",
};

const intakeHealthData = {
  projectId: "p1",
  confidenceTier: "growing_confidence" as const,
  confidenceLabel: "Growing Confidence",
  summary:
    "You have solid signal from 6 interviews, but your survey response rate is low. Consider a follow-up nudge.",
  coverage: [
    { label: "VP Engineering", count: 4, target: 5 },
    { label: "Product Managers", count: 2, target: 5 },
    { label: "End Users", count: 1, target: 5 },
  ],
  sourceMix: { interviews: 6, surveys: 2, documents: 1 },
  totalEvidence: 47,
  daysSinceLastIntake: 2,
  gaps: [
    "You need 3 more end-user interviews for balanced coverage",
    "Your survey has 2 responses — nudge the other 8 recipients",
  ],
  gateStatus: "marginal" as const,
  nextAction: "Send survey reminders",
  nextActionUrl: "#",
};

const evidenceWallData = {
  projectId: "p1",
  headline: "Here's what your customers actually said",
  clusters: [
    {
      label: "Onboarding friction",
      type: "pain" as const,
      items: [
        {
          id: "e1",
          verbatim:
            "I spent 3 hours just trying to set up the integration and nobody warned me it would be this painful.",
          speakerName: "Sarah Chen",
          speakerTitle: "VP Eng",
          interviewTitle: "Acme product feedback",
          detailUrl: "#",
        },
        {
          id: "e2",
          verbatim:
            "Nobody told us there was a setup wizard. We did it manually and wasted an entire sprint.",
          speakerName: "Mike Rodriguez",
          speakerTitle: "Product Lead",
          interviewTitle: "Beta deep dive",
          detailUrl: "#",
        },
      ],
      totalCount: 12,
    },
    {
      label: "Faster decisions",
      type: "goal" as const,
      items: [
        {
          id: "e3",
          verbatim:
            "If I could get a weekly summary of what my team learned, that would change everything about how we plan sprints.",
          speakerName: "Jamie Walsh",
          speakerTitle: "Head of Research",
          interviewTitle: "Gamma strategy call",
          detailUrl: "#",
        },
      ],
      totalCount: 8,
    },
    {
      label: "API limitations",
      type: "observation" as const,
      items: [
        {
          id: "e4",
          verbatim:
            "We tried to automate the ingestion but the API rate limits made it impractical for our volume.",
          speakerName: "Alex Kumar",
          speakerTitle: "Staff Engineer",
          interviewTitle: "Delta tech review",
          detailUrl: "#",
        },
      ],
      totalCount: 3,
    },
  ],
  totalEvidence: 47,
  uniqueSources: 8,
  viewAllUrl: "#",
};

const patternSynthesisData = {
  projectId: "p1",
  headline: "What repeats and what matters",
  narrativeSummary:
    "3 strong patterns across 8 interviews. 2 need more signal before you commit resources.",
  patterns: [
    {
      id: "t1",
      name: "Onboarding friction",
      statement:
        "Users consistently struggle with initial setup, costing hours of productivity",
      mentionCount: 14,
      confidenceTier: "strong" as const,
      confidenceLabel: "Strong",
      topQuotes: [
        {
          verbatim: "I spent 3 hours just trying to set up...",
          speakerName: "Sarah C.",
        },
        {
          verbatim: "Nobody told us there was a setup wizard",
          speakerName: "Mike R.",
        },
      ],
      uniqueSources: 6,
      detailUrl: "#",
    },
    {
      id: "t2",
      name: "Need for weekly summaries",
      statement:
        "Decision-makers want regular, synthesized updates instead of raw data",
      mentionCount: 11,
      confidenceTier: "strong" as const,
      confidenceLabel: "Strong",
      topQuotes: [
        {
          verbatim: "A weekly summary would change everything",
          speakerName: "Jamie W.",
        },
      ],
      uniqueSources: 5,
      detailUrl: "#",
    },
    {
      id: "t3",
      name: "Pricing confusion",
      statement: "Some users report unclear pricing tiers and hidden costs",
      mentionCount: 5,
      confidenceTier: "emerging" as const,
      confidenceLabel: "Emerging",
      uniqueSources: 3,
      detailUrl: "#",
    },
    {
      id: "t4",
      name: "API limitations",
      statement: "Mentioned by 2 technical users as a growth blocker",
      mentionCount: 2,
      confidenceTier: "thin" as const,
      confidenceLabel: "Thin",
      uniqueSources: 2,
      detailUrl: "#",
    },
  ],
  distribution: { strong: 2, emerging: 1, thin: 1 },
  nextAction: "Consider 1 more interview to validate pricing confusion",
  nextActionUrl: "#",
};

const decisionSupportData = {
  projectId: "p1",
  headline: "What should you do this week?",
  decisionContext: "Based on onboarding friction and weekly summaries themes",
  actions: [
    {
      id: "a1",
      action: "Build a setup wizard for new accounts",
      reasoning:
        "14 mentions of setup friction across 6 people — this is your strongest signal",
      effort: "medium" as const,
      impact: "high" as const,
      tradeoffs: ["Requires eng sprint", "Delays API work by 1 week"],
      evidenceCount: 14,
      evidenceUrl: "#",
      owner: "Sarah Chen",
      dueDate: "2026-03-01",
      committed: true,
    },
    {
      id: "a2",
      action: "Ship weekly digest emails",
      reasoning: "11 mentions from decision-makers wanting regular synthesis",
      effort: "low" as const,
      impact: "high" as const,
      tradeoffs: ["Adds email infrastructure dependency"],
      evidenceCount: 11,
      evidenceUrl: "#",
      owner: null,
      dueDate: null,
      committed: false,
    },
    {
      id: "a3",
      action: "Clarify pricing page copy",
      reasoning:
        "5 mentions but only from 3 people — emerging signal, not yet validated",
      effort: "low" as const,
      impact: "medium" as const,
      evidenceCount: 5,
      evidenceUrl: "#",
      owner: null,
      dueDate: null,
      committed: false,
    },
  ],
  informingPatterns: [
    { name: "Onboarding friction", confidenceLabel: "Strong" },
    { name: "Weekly summaries", confidenceLabel: "Strong" },
    { name: "Pricing confusion", confidenceLabel: "Emerging" },
  ],
  narrative:
    "Strong signal on #1 and #2. Pricing needs more validation before committing design resources.",
  actionsUrl: "#",
};

const surveyOutreachData = {
  surveyId: "s1",
  surveyName: "Customer Onboarding Feedback",
  publicUrl: "https://app.upsight.ai/s/abc123",
  recipients: [
    {
      email: "sarah@acme.com",
      name: "Sarah Chen",
      status: "completed" as const,
    },
    {
      email: "mike@beta.co",
      name: "Mike Rodriguez",
      status: "opened" as const,
    },
    { email: "jamie@gamma.io", name: "Jamie Walsh", status: "sent" as const },
    { email: "alex@delta.dev", name: "Alex Kumar", status: "pending" as const },
    {
      email: "bad@bounce.fail",
      name: "Bad Address",
      status: "bounced" as const,
    },
  ],
  messagePreview:
    "Hi {name}, we'd love your input on our onboarding experience. It takes about 3 minutes.",
  funnel: { sent: 5, opened: 3, completed: 1, bounced: 1 },
  statusLine: "1 response in — you need at least 5 for useful signal",
  editUrl: "#",
  addRecipientsUrl: "#",
};

const stakeholderMapData = {
  projectId: "p1",
  headline: "Who does this apply to?",
  summary: "8 people shaped your strongest patterns",
  stakeholders: [
    {
      personId: "p1",
      name: "Sarah Chen",
      title: "VP Engineering",
      orgName: "Acme Corp",
      linkedThemes: [
        { name: "Onboarding friction", evidenceCount: 4 },
        { name: "Weekly summaries", evidenceCount: 2 },
      ],
      topQuote: "I spent 3 hours just trying to set up the integration",
      icpBand: "HIGH",
      detailUrl: "#",
    },
    {
      personId: "p2",
      name: "Mike Rodriguez",
      title: "Product Lead",
      orgName: "Beta Inc",
      linkedThemes: [
        { name: "Onboarding friction", evidenceCount: 3 },
        { name: "Pricing confusion", evidenceCount: 1 },
      ],
      topQuote: "Nobody told us there was a setup wizard",
      icpBand: "HIGH",
      detailUrl: "#",
    },
    {
      personId: "p3",
      name: "Jamie Walsh",
      title: "Head of Research",
      orgName: "Gamma Labs",
      linkedThemes: [{ name: "Weekly summaries", evidenceCount: 5 }],
      topQuote: "A weekly summary would change everything",
      icpBand: "MEDIUM",
      detailUrl: "#",
    },
  ],
  totalPeople: 8,
  viewAllUrl: "#",
};

const researchPulseData = {
  projectId: "p1",
  periodLabel: "Week of Feb 10",
  confidenceTier: "growing_confidence" as const,
  confidenceLabel: "Growing Confidence",
  confidenceChange: "improved" as const,
  deltas: [
    {
      label: "New interviews",
      current: 8,
      previous: 6,
      change: "+2",
      direction: "up" as const,
    },
    {
      label: "New evidence",
      current: 61,
      previous: 47,
      change: "+14",
      direction: "up" as const,
    },
    {
      label: "Survey responses",
      current: 8,
      previous: 5,
      change: "+3",
      direction: "up" as const,
    },
    {
      label: "Themes validated",
      current: 4,
      previous: 3,
      change: "+1",
      direction: "up" as const,
    },
  ],
  actions: [
    {
      id: "a1",
      action: "Build setup wizard",
      owner: "Sarah",
      status: "complete" as const,
      dueDate: "2026-03-01",
    },
    {
      id: "a2",
      action: "Ship weekly digests",
      owner: "Mike",
      status: "in_progress" as const,
      dueDate: "2026-03-08",
    },
    {
      id: "a3",
      action: "Clarify pricing copy",
      owner: "Jamie",
      status: "not_started" as const,
      dueDate: "2026-03-15",
    },
  ],
  newSignalSummary:
    "2 new interviews reinforced the onboarding friction theme. Pricing confusion is now emerging with 3 more mentions.",
  nextStep:
    "Run one more round of surveys to validate pricing confusion before committing design resources.",
  nextStepUrl: "#",
};

const conversationLensInsightsData = {
  templateKey: "jtbd-conversation-pipeline",
  templateName: "Jobs to be Done",
  interviewCount: 1,
  mode: "single" as const,
  analysisData: {
    sections: [
      {
        section_key: "core_job",
        section_label: "Core Job",
        fields: [
          {
            field_key: "job_statement",
            field_label: "Job Statement",
            value:
              "When I'm leading product decisions, I want to quickly synthesize scattered customer conversations into clear, defensible insights so I can reduce risk and move faster without losing rigor.",
          },
        ],
      },
      {
        section_key: "forces_of_progress",
        section_label: "Forces of Progress",
        fields: [
          {
            field_key: "push_forces",
            field_label: "Push Forces",
            text_array_value: [
              "Current tools scatter insights across docs, Slack, and notes",
              "Team makes decisions based on gut feeling, not evidence",
              "Stakeholders demand proof before approving roadmap changes",
            ],
          },
          {
            field_key: "pull_forces",
            field_label: "Pull Forces",
            text_array_value: [
              "AI-powered synthesis would save 10+ hours per week",
              "Searchable evidence base creates institutional memory",
            ],
          },
          {
            field_key: "anxieties",
            field_label: "Anxieties",
            text_array_value: [
              "AI might misinterpret nuanced customer feedback",
              "Team adoption of yet another tool",
            ],
          },
          {
            field_key: "habits_inertia",
            field_label: "Habits & Inertia",
            text_array_value: [
              "Existing Notion/Miro workflow is 'good enough'",
            ],
          },
        ],
      },
      {
        section_key: "job_map",
        section_label: "Job Map",
        fields: [
          {
            field_key: "job_steps_summary",
            field_label: "Job Steps",
            value: [
              {
                step_name: "Define",
                summary: "Frame the research question and target audience",
              },
              {
                step_name: "Locate",
                summary: "Find and schedule relevant customer conversations",
              },
              {
                step_name: "Confirm",
                summary: "Validate patterns across multiple interviews",
                pains: ["Manual synthesis is error-prone"],
              },
              {
                step_name: "Execute",
                summary: "Turn insights into roadmap decisions and actions",
              },
            ],
          },
        ],
      },
      {
        section_key: "outcomes",
        section_label: "Outcomes",
        fields: [
          {
            field_key: "desired_outcomes",
            field_label: "Desired Outcomes",
            text_array_value: [
              "Reduce time from interview to insight by 80%",
              "Every decision has traceable evidence behind it",
              "New team members can ramp up on customer context in hours",
            ],
          },
          {
            field_key: "unmet_outcomes",
            field_label: "Unmet Outcomes",
            text_array_value: ["Side-by-side comparison of competing signals"],
          },
        ],
      },
      {
        section_key: "opportunity_board",
        section_label: "Opportunity Board",
        fields: [
          {
            field_key: "opportunity_candidates",
            field_label: "Opportunities",
            text_array_value: [
              "AI-powered pattern detection across interviews",
              "Auto-generated stakeholder briefs",
            ],
          },
          {
            field_key: "highest_priority_opportunity",
            field_label: "Top Opportunity",
            text_array_value: [
              "Enhance AI reliability so teams trust the synthesis",
            ],
          },
        ],
      },
    ],
    recommendations: [
      {
        priority: "high",
        description:
          "Enhance AI reliability tooling to build trust in synthesis quality",
      },
      {
        priority: "medium",
        description:
          "Implement side-by-side evidence comparison for conflicting signals",
      },
      {
        priority: "low",
        description: "Add export-to-deck for stakeholder presentations",
      },
    ],
  },
  synthesisData: null,
  lensDetailUrl: "#",
  interviewTitle: "Interview #3",
  interviewUrl: "#",
  personName: "Sarah Chen",
};

const conversationLensGenericData = {
  templateKey: "customer-discovery",
  templateName: "Customer Discovery",
  interviewCount: 1,
  mode: "single" as const,
  analysisData: {
    sections: [
      {
        section_key: "problem_validation",
        section_label: "Problem Validation",
        fields: [
          {
            field_key: "problem_statement",
            field_label: "Problem Statement",
            value:
              "Teams lack a unified view of customer feedback, leading to gut-based decisions.",
          },
          {
            field_key: "severity",
            field_label: "Severity",
            value: "High — directly impacts roadmap quality",
          },
        ],
      },
      {
        section_key: "solution_fit",
        section_label: "Solution Fit",
        fields: [
          {
            field_key: "current_alternatives",
            field_label: "Current Alternatives",
            text_array_value: [
              "Notion databases",
              "Miro boards",
              "Manual spreadsheet tracking",
            ],
          },
          {
            field_key: "willingness_to_pay",
            field_label: "Willingness to Pay",
            value: "Strong — would replace existing tooling budget",
          },
        ],
      },
    ],
  },
  synthesisData: null,
  lensDetailUrl: "#",
  interviewTitle: "Discovery Call #7",
  interviewUrl: "#",
  personName: "Alex Rivera",
};

/* ---------- Gallery ---------- */

function Section({
  title,
  moment,
  children,
}: {
  title: string;
  moment: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-semibold text-lg">{title}</h2>
        <p className="text-muted-foreground text-sm">{moment}</p>
      </div>
      <div className="max-w-2xl">{children}</div>
    </div>
  );
}

export default function WidgetGallery() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-12">
        <div>
          <h1 className="font-bold text-3xl">Gen-UI Widget Gallery</h1>
          <p className="mt-1 text-muted-foreground">
            Time-to-Aha JTBD flow — all 11 widgets with dummy data
          </p>
        </div>

        <Section
          title="ProgressRail"
          moment="Meta — persistent across all steps"
        >
          <ProgressRail data={progressRailData} />
        </Section>

        <Section title="DecisionBrief" moment="Moment 1 — Frame the Decision">
          <DecisionBrief data={decisionBriefData} />
        </Section>

        <Section
          title="IntakePathPicker"
          moment="Moment 2 — Choose Intake Path"
        >
          <IntakePathPicker data={intakePathPickerData} />
        </Section>

        <Section
          title="IntakeBatchStatus"
          moment="Moment 3A — Upload Interviews"
        >
          <IntakeBatchStatus data={intakeBatchStatusData} />
        </Section>

        <Section title="SurveyOutreach" moment="Moment 3C — Email Survey Links">
          <SurveyOutreach data={surveyOutreachData} />
        </Section>

        <Section
          title="IntakeHealth"
          moment="Moment 4 — Intake Health (Confidence Gate)"
        >
          <IntakeHealth data={intakeHealthData} />
        </Section>

        <Section title="EvidenceWall" moment="Moment 5 — Evidence Grounding">
          <EvidenceWall data={evidenceWallData} />
        </Section>

        <Section title="PatternSynthesis" moment="Moment 6 — Pattern Synthesis">
          <PatternSynthesis data={patternSynthesisData} />
        </Section>

        <Section title="DecisionSupport" moment="Moment 7 — Decision Support">
          <DecisionSupport data={decisionSupportData} />
        </Section>

        <Section title="StakeholderMap" moment="Moment 8 — CRM Activation">
          <StakeholderMap data={stakeholderMapData} />
        </Section>

        <Section title="ResearchPulse" moment="Moment 9 — Close the Loop">
          <ResearchPulse data={researchPulseData} />
        </Section>

        <Section
          title="ConversationLensInsights (JTBD)"
          moment="Canvas — JTBD analysis with forces, journey, recs"
        >
          <ConversationLensInsights data={conversationLensInsightsData} />
        </Section>

        <Section
          title="ConversationLensInsights (Generic)"
          moment="Canvas — Non-JTBD lens with section cards"
        >
          <ConversationLensInsights data={conversationLensGenericData} />
        </Section>
      </div>
    </div>
  );
}
