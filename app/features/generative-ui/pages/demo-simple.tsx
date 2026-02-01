/**
 * Simple demo using EXISTING working chat component
 */

import { ProjectSetupChat } from "~/features/projects/components/ProjectSetupChat";

export default function SimpleDemo() {
  // Use existing working component with a demo project
  return (
    <div className="mx-auto min-h-screen max-w-7xl p-6">
      <div className="mb-6 space-y-3">
        <h1 className="font-bold text-4xl">Live Conversational Demo</h1>
        <p className="text-lg">
          This uses the actual working project setup agent. Try asking it about
          qualifying deals, understanding users, or any research goal.
        </p>
      </div>

      <div className="mx-auto max-w-4xl">
        <ProjectSetupChat
          projectPath="demo-project"
          onCapturedFieldsChange={() => {}}
        />
      </div>
    </div>
  );
}
