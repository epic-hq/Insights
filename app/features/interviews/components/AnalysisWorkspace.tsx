/**
 * AnalysisWorkspace — left column of the interview detail page.
 * Provides tabbed access to Overview, completed lens results (as first-class tabs),
 * a "+ Lenses" tab for the LensSwitcher, and Notes.
 */
import consola from "consola";
import { Pencil, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useRevalidator } from "react-router";
import InlineEdit from "~/components/ui/inline-edit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { GenericLensView } from "~/features/lenses/components/GenericLensView";
import type {
  LensAnalysisWithTemplate,
  LensTemplate,
} from "~/features/lenses/lib/loadLensAnalyses.server";
import { InterviewInsights } from "./InterviewInsights";
import { InterviewRecommendations } from "./InterviewRecommendations";
import { LensSwitcher } from "./LensSwitcher";

interface KeyTakeaway {
  priority: "high" | "medium" | "low";
  summary: string;
  evidenceSnippets: string[];
  evidenceId?: string;
}

interface Recommendation {
  focusArea: string;
  action: string;
  rationale: string;
}

type EvidenceRecord = {
  id: string;
  anchors?: unknown;
  start_ms?: number | null;
  gist?: string | null;
};

/** Check if a lens analysis has meaningful data to display */
function analysisHasData(
  analysis: LensAnalysisWithTemplate | undefined,
): boolean {
  if (!analysis) return false;
  if (analysis.status !== "completed") return false;

  const data = analysis.analysis_data;
  if (!data) return false;

  const sections = data.sections || [];
  const hasFieldData = sections.some((section: any) => {
    const fields = section.fields || [];
    return fields.some(
      (field: any) =>
        field.value !== null && field.value !== undefined && field.value !== "",
    );
  });

  const hasEntities = (data.entities || []).length > 0;
  const hasRecommendations = (data.recommendations || []).length > 0;
  const hasKeyInsights = (data.key_insights || []).length > 0;
  const hasHygiene = (data.hygiene || []).length > 0;

  return (
    hasFieldData ||
    hasEntities ||
    hasRecommendations ||
    hasKeyInsights ||
    hasHygiene
  );
}

interface AnalysisWorkspaceProps {
  /** Active tab from URL state */
  activeTab: string;
  /** Callback to change active tab (updates URL) */
  onTabChange: (tab: string) => void;

  // Overview tab props
  aiKeyTakeaways: KeyTakeaway[];
  conversationUpdatedLabel: string | null;
  onSourceClick?: (evidenceId: string) => void;
  recommendations: Recommendation[];

  // Lenses tab props
  interviewId: string;
  lensTemplates: LensTemplate[];
  lensAnalyses: Record<string, LensAnalysisWithTemplate>;
  evidenceMap: Map<string, EvidenceRecord>;
  selectedLensKey?: string | null;
  onLensChange?: (templateKey: string) => void;

  // Notes tab props
  notesValue: string;
  onNotesUpdate: (value: string) => void;
}

export function AnalysisWorkspace({
  activeTab,
  onTabChange,
  aiKeyTakeaways,
  conversationUpdatedLabel,
  onSourceClick,
  recommendations,
  interviewId,
  lensTemplates,
  lensAnalyses,
  evidenceMap,
  selectedLensKey,
  onLensChange,
  notesValue,
  onNotesUpdate,
}: AnalysisWorkspaceProps) {
  const revalidator = useRevalidator();

  // Compute completed lenses to promote as first-class tabs
  const completedLenses = useMemo(() => {
    return lensTemplates
      .filter((t) => analysisHasData(lensAnalyses[t.template_key]))
      .sort((a, b) => a.display_order - b.display_order);
  }, [lensTemplates, lensAnalyses]);

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="flex-wrap">
        <TabsTrigger value="overview">Overview</TabsTrigger>

        {/* Completed lenses as first-class tabs */}
        {completedLenses.map((template) => (
          <TabsTrigger
            key={template.template_key}
            value={`lens:${template.template_key}`}
          >
            {template.template_name}
          </TabsTrigger>
        ))}

        <TabsTrigger value="lenses">
          <Sparkles className="h-3.5 w-3.5" />+ Lenses
        </TabsTrigger>
        <TabsTrigger value="notes">
          <Pencil className="h-3.5 w-3.5" />
          Notes
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <InterviewInsights
          aiKeyTakeaways={aiKeyTakeaways}
          conversationUpdatedLabel={conversationUpdatedLabel}
          onSourceClick={onSourceClick}
          interviewId={interviewId}
        />
        <InterviewRecommendations recommendations={recommendations} />
        {aiKeyTakeaways.length === 0 && recommendations.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-muted-foreground text-sm">
              Insights will appear here once analysis is complete.
            </p>
          </div>
        )}
      </TabsContent>

      {/* Completed lens tab content — renders GenericLensView directly */}
      {completedLenses.map((template) => {
        const analysis = lensAnalyses[template.template_key];
        return (
          <TabsContent
            key={template.template_key}
            value={`lens:${template.template_key}`}
          >
            <GenericLensView
              analysis={analysis}
              template={template}
              editable
              evidenceMap={evidenceMap}
            />
          </TabsContent>
        );
      })}

      <TabsContent value="lenses">
        <LensSwitcher
          interviewId={interviewId}
          templates={lensTemplates}
          analyses={lensAnalyses}
          editable
          evidenceMap={evidenceMap}
          selectedLensKey={selectedLensKey}
          onLensChange={onLensChange}
          onLensApplied={() => revalidator.revalidate()}
        />
      </TabsContent>

      <TabsContent value="notes">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <InlineEdit
            textClassName="text-foreground"
            value={notesValue}
            multiline
            markdown
            placeholder="Add your notes here..."
            onSubmit={(value) => {
              try {
                onNotesUpdate(value);
              } catch (error) {
                consola.error("Failed to update notes:", error);
              }
            }}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
