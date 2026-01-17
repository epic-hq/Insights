import consola from "consola";
import {
  LayoutGrid,
  Sparkle,
  Table as TableIcon,
  UserCircle,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  type LoaderFunctionArgs,
  type MetaFunction,
  useLoaderData,
} from "react-router";
import { Link, useFetcher } from "react-router-dom";
import { toast } from "sonner";
import { UpgradeBadge } from "~/components/feature-gate";
import { PageContainer } from "~/components/layout/PageContainer";
import { Button } from "~/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import type { PlanId } from "~/config/plans";
import { useCurrentProject } from "~/contexts/current-project-context";
import EnhancedPersonaCard from "~/features/personas/components/EnhancedPersonaCard";
import { PersonaPeopleSubnav } from "~/features/personas/components/PersonaPeopleSubnav";
import {
  PersonasDataTable,
  type PersonaTableRow,
} from "~/features/personas/components/PersonasDataTable";
import { useFeatureGate } from "~/hooks/useFeatureGate";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { getServerClient } from "~/lib/supabase/client.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Personas | Insights" },
    {
      name: "description",
      content: "User personas based on research insights",
    },
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { client: supabase } = getServerClient(request);
  const projectId = params.projectId;

  if (!projectId) {
    throw new Response("Project ID is required", { status: 400 });
  }

  const { data: personas, error: personasError } = await supabase
    .from("personas")
    .select(
      `
				*,
				people_personas(count)
			`,
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (personasError) {
    throw new Response(`Error fetching personas: ${personasError.message}`, {
      status: 500,
    });
  }

  consola.log("Loaded personas for project", {
    projectId,
    count: personas?.length || 0,
  });

  // TODO: Get actual plan from account/billing provider
  // For now, everyone is on free tier for testing feature gates
  const currentPlan: PlanId = "free";

  return { personas: personas || [], currentPlan };
}

type PersonaRow =
  Awaited<ReturnType<typeof loader>> extends { personas: infer T }
    ? T extends Array<infer U>
      ? U
      : never
    : never;

export default function Personas() {
  const { personas, currentPlan } = useLoaderData<typeof loader>();
  const { projectPath } = useCurrentProject();
  const routes = useProjectRoutes(projectPath || "");

  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const sortedPersonas = useMemo(() => {
    return [...personas].sort((a, b) => {
      const aCount = a.people_personas?.[0]?.count ?? 0;
      const bCount = b.people_personas?.[0]?.count ?? 0;
      return bCount - aCount;
    });
  }, [personas]);

  const tableRows = useMemo<PersonaTableRow[]>(() => {
    return sortedPersonas.map((persona) => {
      const goals = Array.isArray(persona.goals)
        ? persona.goals
        : typeof persona.goals === "string"
          ? [persona.goals]
          : [];
      const pains = Array.isArray(persona.pains)
        ? persona.pains
        : typeof persona.pains === "string"
          ? [persona.pains]
          : [];
      const tags = Array.isArray(persona.tags)
        ? persona.tags
        : typeof persona.tags === "string"
          ? [persona.tags]
          : [];

      return {
        id: persona.id,
        name: persona.name ?? "Untitled persona",
        kind: persona.kind ?? null,
        tags,
        goals,
        pains,
        linkedPeople: persona.people_personas?.[0]?.count ?? 0,
        updatedAt: persona.updated_at ?? null,
        colorHex: persona.color_hex ?? undefined,
      };
    });
  }, [sortedPersonas]);

  return (
    <>
      <PersonaPeopleSubnav />
      <PageContainer className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserCircle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-semibold text-3xl text-foreground">
                Personas
              </h1>
              <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
                Identify your ideal customers and create personas from AI
                recommendations or build them manually.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {personas.length > 0 ? (
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(value) =>
                  value && setViewMode(value as "cards" | "table")
                }
                className="w-full sm:w-auto"
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="cards" aria-label="Card view">
                  <LayoutGrid className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label="Table view">
                  <TableIcon className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            ) : null}
            <div className="flex w-full gap-2 sm:w-auto">
              <GeneratePersonasButton planId={currentPlan} />
              <Button
                asChild
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
              >
                <Link to={routes.personas.new()}>Add Persona</Link>
              </Button>
            </div>
          </div>
        </div>

        {personas.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/40 py-16 text-center">
            <div className="mx-auto max-w-md space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-background p-6 shadow-sm">
                  <Users className="h-10 w-10 text-muted-foreground" />
                </div>
              </div>
              <h3 className="font-semibold text-foreground text-xl">
                No personas yet
              </h3>
              <p className="text-muted-foreground text-sm">
                Get started by generating AI-powered persona recommendations
                from your research data or create personas manually.
              </p>
              <div className="flex justify-center gap-3">
                <GeneratePersonasButton planId={currentPlan} />
                <Button asChild variant="outline">
                  <Link to={routes.personas.new()}>Create Manually</Link>
                </Button>
              </div>
            </div>
          </div>
        ) : viewMode === "cards" ? (
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {sortedPersonas.map((persona: PersonaRow) => (
              <EnhancedPersonaCard key={persona.id} persona={persona} />
            ))}
          </div>
        ) : (
          <PersonasDataTable rows={tableRows} />
        )}
      </PageContainer>
    </>
  );
}

function GeneratePersonasButton({ planId }: { planId: PlanId }) {
  const fetcher = useFetcher();
  const { projectId } = useCurrentProject();
  const isGenerating =
    fetcher.state === "submitting" || fetcher.state === "loading";

  // Check if smart_personas feature is enabled for this plan
  const { isEnabled, upgradeUrl } = useFeatureGate("smart_personas", planId);

  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.success) {
        const count = fetcher.data.personas?.length || 0;
        toast.success(
          `Successfully generated ${count} persona${count === 1 ? "" : "s"}!`,
        );
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast.error(
          fetcher.data.message ||
            "Failed to generate personas. Please try again.",
        );
      }
    }
  }, [fetcher.data]);

  const handleGenerate = () => {
    if (!projectId || !isEnabled) return;

    const formData = new FormData();
    formData.append("projectId", projectId);

    fetcher.submit(formData, {
      method: "post",
      action: "/api/generate-icp-recommendations",
    });
  };

  // Show upgrade badge if feature is not enabled
  if (!isEnabled) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled type="button">
          <Sparkle className="mr-2 h-4 w-4" />
          Generate Personas
        </Button>
        <UpgradeBadge feature="smart_personas" size="sm" />
      </div>
    );
  }

  return (
    <Button
      onClick={handleGenerate}
      variant="secondary"
      disabled={isGenerating}
      type="button"
    >
      <Sparkle className="mr-2 h-4 w-4" />
      {isGenerating ? "Generating..." : "Generate Personas"}
    </Button>
  );
}
