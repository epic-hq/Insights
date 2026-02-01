/**
 * Generative UI Demo v2 - Conversational Flow
 *
 * Shows how agents decide what to render based on user intent:
 * "What do you want to learn?" → Agent detects intent → Renders appropriate component
 *
 * This demo visualizes the decision-making process clearly.
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";
import { BANTScorecard } from "../components/BANTScorecard";

// Sample user intents and what they trigger
const USER_INTENTS = [
  {
    id: "qualify-deals",
    userSays: "I need to qualify enterprise deals",
    agentThinks: "Sales qualification → BANT framework",
    componentShown: "BANT Scorecard",
    lensUsed: "BANT",
    color: "emerald",
  },
  {
    id: "understand-users",
    userSays: "I want to understand what users really need",
    agentThinks: "Product discovery → Jobs-to-be-Done",
    componentShown: "JTBD Canvas",
    lensUsed: "Jobs-to-be-Done",
    color: "blue",
  },
  {
    id: "research-pain",
    userSays: "What problems are customers facing?",
    agentThinks: "User research → Empathy mapping",
    componentShown: "Empathy Map",
    lensUsed: "Empathy Map",
    color: "purple",
  },
  {
    id: "collect-feedback",
    userSays: "I just want to collect some feedback",
    agentThinks: "Simple collection → Survey builder",
    componentShown: "Survey Builder",
    lensUsed: "None (direct action)",
    color: "orange",
  },
];

const DECISION_FLOW = [
  {
    step: 1,
    label: "User Input",
    description: 'User types or speaks: "What do you want to learn?"',
    icon: MessageSquare,
  },
  {
    step: 2,
    label: "Agent Analyzes",
    description: "Detects intent from natural language",
    icon: Brain,
  },
  {
    step: 3,
    label: "Component Chosen",
    description: "Agent returns appropriate UI component",
    icon: Sparkles,
  },
  {
    step: 4,
    label: "User Sees Result",
    description: "Rendered component matches their goal",
    icon: CheckCircle2,
  },
];

export default function GenerativeUIDemoV2() {
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null);
  const [showBANTDemo, setShowBANTDemo] = useState(false);
  const [scorecardState, setScorecardState] = useState<
    "empty" | "partial" | "streaming" | "complete"
  >("empty");

  const currentIntent = USER_INTENTS.find((i) => i.id === selectedIntent);

  // Simulate streaming for BANT demo
  const handleStartStreaming = () => {
    setScorecardState("streaming");
    setTimeout(() => setScorecardState("partial"), 2000);
    setTimeout(() => setScorecardState("complete"), 4000);
  };

  // Get BANT data based on state
  const getBANTData = () => {
    if (scorecardState === "empty") {
      return {
        budget: { score: 0, evidence: [], status: "empty" as const },
        authority: { score: 0, evidence: [], status: "empty" as const },
        need: { score: 0, evidence: [], status: "empty" as const },
        timeline: { score: 0, evidence: [], status: "empty" as const },
        overallScore: 0,
        isStreaming: false,
      };
    }

    if (scorecardState === "streaming" || scorecardState === "partial") {
      return {
        budget: {
          score: 40,
          evidence: [
            {
              verbatim: "costs $50K annually",
              timestamp: 8.5,
              confidence: 0.95,
            },
          ],
          status: "partial" as const,
          updating: scorecardState === "streaming",
        },
        authority: {
          score: 60,
          evidence: [
            {
              verbatim: "final say on vendor selection",
              timestamp: 23.2,
              confidence: 0.92,
            },
          ],
          status: "partial" as const,
          updating: scorecardState === "streaming",
        },
        need: {
          score: scorecardState === "streaming" ? 30 : 55,
          evidence:
            scorecardState === "streaming"
              ? [
                  {
                    verbatim: "frustrated with the reporting",
                    timestamp: 15.8,
                    confidence: 0.88,
                  },
                ]
              : [
                  {
                    verbatim: "frustrated with the reporting",
                    timestamp: 15.8,
                    confidence: 0.88,
                  },
                  {
                    verbatim: "need better analytics capabilities",
                    timestamp: 42.3,
                    confidence: 0.91,
                  },
                ],
          status: "partial" as const,
          updating: scorecardState === "streaming",
        },
        timeline: {
          score: 0,
          evidence: [],
          status: "empty" as const,
        },
        overallScore: scorecardState === "streaming" ? 33 : 39,
        isStreaming: scorecardState === "streaming",
      };
    }

    // Complete state
    return {
      budget: {
        score: 85,
        evidence: [
          { verbatim: "costs $50K annually", timestamp: 8.5, confidence: 0.95 },
          {
            verbatim: "budgeted $75K for this quarter",
            timestamp: 67.2,
            confidence: 0.93,
          },
        ],
        status: "complete" as const,
      },
      authority: {
        score: 90,
        evidence: [
          {
            verbatim: "final say on vendor selection",
            timestamp: 23.2,
            confidence: 0.92,
          },
          {
            verbatim: "I'm the decision maker for this purchase",
            timestamp: 89.5,
            confidence: 0.97,
          },
        ],
        status: "complete" as const,
      },
      need: {
        score: 75,
        evidence: [
          {
            verbatim: "frustrated with the reporting",
            timestamp: 15.8,
            confidence: 0.88,
          },
          {
            verbatim: "need better analytics capabilities",
            timestamp: 42.3,
            confidence: 0.91,
          },
          {
            verbatim: "current solution is too slow",
            timestamp: 103.7,
            confidence: 0.89,
          },
        ],
        status: "complete" as const,
      },
      timeline: {
        score: 70,
        evidence: [
          {
            verbatim: "need to make a decision by end of Q1",
            timestamp: 125.4,
            confidence: 0.94,
          },
        ],
        status: "complete" as const,
      },
      overallScore: 80,
      isStreaming: false,
    };
  };

  return (
    <div className="mx-auto min-h-screen max-w-7xl space-y-8 p-6">
      {/* Header */}
      <div className="space-y-3">
        <h1 className="font-bold text-4xl">
          Generative UI - Agent-Driven Flow
        </h1>
        <p className="text-muted-foreground text-lg">
          Instead of wizards or forms,{" "}
          <span className="font-semibold text-foreground">
            ask users what they want to learn
          </span>
          , then let the agent decide what to show them.
        </p>
      </div>

      <Tabs defaultValue="flow" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="flow">Decision Flow</TabsTrigger>
          <TabsTrigger value="intents">User Intents</TabsTrigger>
          <TabsTrigger value="live">Live Demo</TabsTrigger>
        </TabsList>

        {/* Tab 1: Decision Flow Visualization */}
        <TabsContent value="flow" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>How Agents Decide What to Show</CardTitle>
              <CardDescription>
                The agent analyzes user intent and dynamically renders the
                appropriate component
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Flow Steps */}
              <div className="flex items-center justify-between">
                {DECISION_FLOW.map((step, index) => (
                  <div key={step.step} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary bg-primary/10">
                        <step.icon className="h-8 w-8 text-primary" />
                      </div>
                      <div className="mt-3 text-center">
                        <p className="font-semibold text-sm">{step.label}</p>
                        <p className="mt-1 max-w-[150px] text-muted-foreground text-xs">
                          {step.description}
                        </p>
                      </div>
                    </div>
                    {index < DECISION_FLOW.length - 1 && (
                      <ArrowRight className="mx-4 h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>

              {/* Example Flow */}
              <div className="mt-8 rounded-lg border bg-muted/30 p-6">
                <h3 className="mb-4 font-semibold text-lg">
                  Example: Sales Qualification
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="rounded-lg border bg-background p-4">
                    <p className="mb-2 font-medium text-sm">User Says:</p>
                    <p className="text-muted-foreground text-sm italic">
                      "I need to qualify enterprise deals"
                    </p>
                  </div>
                  <div className="rounded-lg border bg-background p-4">
                    <p className="mb-2 font-medium text-sm">Agent Detects:</p>
                    <p className="text-sm">
                      Intent:{" "}
                      <span className="font-medium text-emerald-600">
                        Sales qualification
                      </span>
                    </p>
                  </div>
                  <div className="rounded-lg border bg-background p-4">
                    <p className="mb-2 font-medium text-sm">Agent Chooses:</p>
                    <p className="text-sm">
                      Lens:{" "}
                      <span className="font-medium text-blue-600">BANT</span>
                    </p>
                  </div>
                  <div className="rounded-lg border bg-background p-4">
                    <p className="mb-2 font-medium text-sm">User Sees:</p>
                    <p className="text-sm">
                      Component:{" "}
                      <span className="font-medium">BANT Scorecard</span>
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Insight */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Key Insight
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">
                <span className="font-semibold">
                  Same question, different users, different components:
                </span>
              </p>
              <ul className="ml-6 space-y-1 text-sm">
                <li className="list-disc">
                  Sales manager asking "show pipeline" →{" "}
                  <span className="font-medium">BANT Scorecard</span>
                </li>
                <li className="list-disc">
                  Product manager asking "show feedback" →{" "}
                  <span className="font-medium">JTBD Canvas</span>
                </li>
                <li className="list-disc">
                  Researcher asking "show interviews" →{" "}
                  <span className="font-medium">Empathy Map</span>
                </li>
              </ul>
              <p className="mt-3 text-muted-foreground text-xs italic">
                The agent uses context (user role, project type, data available)
                to choose the right component.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: User Intent Examples */}
        <TabsContent value="intents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Try Different User Intents</CardTitle>
              <CardDescription>
                Click a user intent to see how the agent would respond
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Intent Cards */}
              <div className="grid grid-cols-2 gap-4">
                {USER_INTENTS.map((intent) => (
                  <button
                    key={intent.id}
                    type="button"
                    onClick={() => setSelectedIntent(intent.id)}
                    className={cn(
                      "rounded-lg border p-4 text-left transition-all hover:border-primary/50",
                      selectedIntent === intent.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border bg-background",
                    )}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <MessageSquare
                        className={cn("h-5 w-5", `text-${intent.color}-500`)}
                      />
                      {selectedIntent === intent.id && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="mb-2 font-medium text-sm">User says:</p>
                    <p className="mb-3 text-muted-foreground text-sm italic">
                      "{intent.userSays}"
                    </p>
                    <div className="mt-3 border-t pt-3">
                      <p className="mb-1 text-[10px] text-muted-foreground uppercase">
                        Agent Response:
                      </p>
                      <p className="text-xs">
                        → Shows{" "}
                        <span className="font-medium">
                          {intent.componentShown}
                        </span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Using {intent.lensUsed}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Agent Thinking Process */}
              <AnimatePresence mode="wait">
                {currentIntent && (
                  <motion.div
                    key={currentIntent.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="rounded-lg border bg-gradient-to-br from-muted/50 to-background p-6"
                  >
                    <div className="mb-4 flex items-center gap-2">
                      <Brain className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Agent Decision Process</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-xs">
                          1
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            Parse user input
                          </p>
                          <p className="text-muted-foreground text-xs">
                            Detected keywords: "
                            {currentIntent.userSays
                              .split(" ")
                              .slice(0, 3)
                              .join(" ")}
                            ..."
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-xs">
                          2
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            Determine intent
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {currentIntent.agentThinks}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-xs">
                          3
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            Return component
                          </p>
                          <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                            {`<${currentIntent.componentShown.replace(/\s+/g, "")} />`}
                          </code>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Live BANT Demo */}
        <TabsContent value="live" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Live Demo: BANT Scorecard with Streaming</CardTitle>
              <CardDescription>
                Watch the scorecard update in real-time as evidence is extracted
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  onClick={() => setScorecardState("empty")}
                  variant="outline"
                  size="sm"
                >
                  Reset
                </Button>
                <Button
                  onClick={handleStartStreaming}
                  variant="default"
                  size="sm"
                  disabled={scorecardState === "streaming"}
                >
                  {scorecardState === "streaming"
                    ? "Extracting..."
                    : "Simulate Recording"}
                </Button>
                <Button
                  onClick={() => setScorecardState("complete")}
                  variant="outline"
                  size="sm"
                >
                  Skip to Complete
                </Button>
              </div>

              <BANTScorecard
                {...getBANTData()}
                onPlayClip={(timestamp) => {
                  alert(
                    `Would play clip at ${Math.floor(timestamp / 60)}:${Math.floor(
                      timestamp % 60,
                    )
                      .toString()
                      .padStart(2, "0")}`,
                  );
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bottom Section: Why This Matters */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Why Generative UI?</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-6">
          <div>
            <h4 className="mb-2 font-semibold text-sm">❌ Traditional UI</h4>
            <p className="text-muted-foreground text-sm">
              User navigates menus → clicks through forms → sees generic
              template
            </p>
          </div>
          <div>
            <h4 className="mb-2 font-semibold text-sm">✅ Generative UI</h4>
            <p className="text-muted-foreground text-sm">
              User states goal → agent understands → dynamically renders perfect
              component
            </p>
          </div>
          <div>
            <h4 className="mb-2 font-semibold text-sm">💡 Result</h4>
            <p className="text-muted-foreground text-sm">
              Faster time-to-value, less cognitive load, better match to user
              intent
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
