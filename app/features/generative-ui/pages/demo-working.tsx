/**
 * Minimal working demo - just shows the conversation pattern
 */

export default function WorkingDemo() {
  return (
    <div className="mx-auto min-h-screen max-w-4xl p-6">
      <h1 className="mb-6 font-bold text-4xl">Conversational Flow Pattern</h1>

      <div className="space-y-4 rounded-lg border p-6">
        <div className="flex gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            U
          </div>
          <div className="rounded bg-primary px-4 py-2 text-primary-foreground">
            I need to qualify some deals
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            A
          </div>
          <div className="rounded bg-muted px-4 py-2">
            Got it. Are you qualifying based on budget, decision-makers, and
            timeline? Or are you looking for something else?
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <div className="rounded bg-primary px-4 py-2 text-primary-foreground">
            Yes exactly - need to know if they have budget and who makes
            decisions
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            U
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            A
          </div>
          <div className="space-y-2 rounded bg-muted px-4 py-2">
            <p>Perfect! I'll set up a BANT qualification framework for you.</p>
            <div className="mt-2 rounded border border-primary/20 bg-primary/5 p-2 text-xs">
              🔧 Rendering BANT Scorecard...
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background p-6">
          <h3 className="mb-4 font-semibold">BANT Scorecard</h3>
          <div className="space-y-2 text-sm">
            <div>
              • <strong>Budget:</strong> Track budget range and approval
            </div>
            <div>
              • <strong>Authority:</strong> Identify decision makers
            </div>
            <div>
              • <strong>Need:</strong> Understand pain points
            </div>
            <div>
              • <strong>Timeline:</strong> When they need to decide
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-lg border p-4">
        <p className="font-medium">This shows the conversational pattern:</p>
        <ol className="mt-2 ml-6 list-decimal space-y-1 text-sm">
          <li>User states goal → Agent asks clarifying questions</li>
          <li>User answers → Agent understands intent</li>
          <li>Agent recommends framework → Renders appropriate component</li>
        </ol>
        <p className="mt-4 text-sm text-muted-foreground">
          To see this working for real, go to any project's setup page
          (a/:accountId/:projectId/setup) which uses the actual conversational
          agent.
        </p>
      </div>
    </div>
  );
}
