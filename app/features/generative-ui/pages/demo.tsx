/**
 * Generative UI Demo Page
 *
 * Demonstrates the PoC components:
 * - SetupWizard: Agent-driven lens selection
 * - BANTScorecard: Real-time streaming updates with evidence
 *
 * This shows how agents can dynamically choose which components to render
 * based on user context, data volume, and query intent.
 */

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { BANTScorecard } from "../components/BANTScorecard";
import { SetupWizard } from "../components/SetupWizard";

export default function GenerativeUIDemo() {
  const [wizardStep, setWizardStep] = useState(0);
  const [scorecardState, setScorecardState] = useState<
    "empty" | "partial" | "streaming" | "complete"
  >("empty");

  // Simulate streaming updates for BANT scorecard
  const handleStartStreaming = () => {
    setScorecardState("streaming");
    setTimeout(() => setScorecardState("partial"), 2000);
    setTimeout(() => setScorecardState("complete"), 4000);
  };

  // Sample data for different scorecard states
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
          updating: false,
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
          {
            verbatim: "costs $50K annually",
            timestamp: 8.5,
            confidence: 0.95,
          },
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

  const bantData = getBANTData();

  return (
    <div className="mx-auto min-h-screen max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="font-bold text-3xl">Generative UI - Proof of Concept</h1>
        <p className="text-muted-foreground">
          Demonstrates how agents dynamically render components based on user
          context and data state
        </p>
      </div>

      {/* Tabs for different demos */}
      <Tabs defaultValue="wizard" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="wizard">Setup Wizard</TabsTrigger>
          <TabsTrigger value="scorecard">BANT Scorecard</TabsTrigger>
        </TabsList>

        {/* Setup Wizard Demo */}
        <TabsContent value="wizard" className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <h2 className="mb-2 font-semibold text-lg">
              Agent-Driven Lens Selection
            </h2>
            <p className="mb-4 text-muted-foreground text-sm">
              When user says:{" "}
              <span className="font-medium italic">
                "I need to qualify enterprise deals"
              </span>
              <br />
              Agent recommends BANT lens and shows this wizard.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => setWizardStep(0)}
                variant={wizardStep === 0 ? "default" : "outline"}
                size="sm"
              >
                Step 1: Lens Selection
              </Button>
              <Button
                onClick={() => setWizardStep(1)}
                variant={wizardStep === 1 ? "default" : "outline"}
                size="sm"
              >
                Step 2: Context
              </Button>
            </div>
          </div>

          <SetupWizard
            recommendedLens="bant"
            userGoal="qualify enterprise deals"
            currentStep={wizardStep}
            onAcceptLens={(lens) => {
              console.log("Accepted lens:", lens);
              setWizardStep(1);
            }}
            onContinue={() => setWizardStep(wizardStep + 1)}
          />
        </TabsContent>

        {/* BANT Scorecard Demo */}
        <TabsContent value="scorecard" className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <h2 className="mb-2 font-semibold text-lg">
              Real-Time Evidence Extraction
            </h2>
            <p className="mb-4 text-muted-foreground text-sm">
              During voice recording or conversation, the scorecard updates in
              real-time as evidence is extracted.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => setScorecardState("empty")}
                variant="outline"
                size="sm"
              >
                Reset (Empty)
              </Button>
              <Button
                onClick={handleStartStreaming}
                variant="default"
                size="sm"
                disabled={scorecardState === "streaming"}
              >
                {scorecardState === "streaming"
                  ? "Streaming..."
                  : "Simulate Recording"}
              </Button>
              <Button
                onClick={() => setScorecardState("complete")}
                variant="outline"
                size="sm"
              >
                Show Complete
              </Button>
            </div>
          </div>

          <BANTScorecard
            {...bantData}
            onPlayClip={(timestamp) => {
              console.log("Play clip at timestamp:", timestamp);
              alert(
                `Would jump to ${Math.floor(timestamp / 60)}:${Math.floor(
                  timestamp % 60,
                )
                  .toString()
                  .padStart(2, "0")}`,
              );
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Architecture Notes */}
      <div className="rounded-lg border bg-gradient-to-br from-muted/50 to-background p-6">
        <h2 className="mb-3 font-semibold text-xl">How This Works</h2>
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="mb-1 font-medium">1. Agent Decision Logic</h3>
            <p className="text-muted-foreground">
              When user says "I need to qualify enterprise deals", the agent:
              <br />• Detects intent (sales qualification)
              <br />• Recommends BANT lens
              <br />• Returns{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                SetupWizard
              </code>{" "}
              component with props
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-medium">2. Streaming Updates</h3>
            <p className="text-muted-foreground">
              During voice recording, every 3 seconds:
              <br />• Transcribe audio chunk
              <br />• Extract BANT evidence (Budget, Authority, Need, Timeline)
              <br />• Update scorecard component via{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                createStreamableUI()
              </code>
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-medium">3. Component Switching</h3>
            <p className="text-muted-foreground">
              Agent chooses different components based on state:
              <br />• 0 deals →{" "}
              <code className="rounded bg-muted px-1 py-0.5">SetupWizard</code>
              <br />• 1-3 deals →{" "}
              <code className="rounded bg-muted px-1 py-0.5">DealCards</code>
              <br />• 10+ deals →{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                BANTMatrix
              </code>{" "}
              (aggregated view)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
