/**
 * Analysis By Person Tab - ICP-first view
 *
 * Thin wrapper: empty state if no people, otherwise renders ICPMatchSection.
 */

import { User } from "lucide-react";
import { ICPMatchSection } from "./ICPMatchSection";

export type ICPScoredPerson = {
  person_id: string;
  name: string;
  title: string | null;
  company: string | null;
  job_function: string | null;
  seniority_level: string | null;
  default_organization_id: string | null;
  org_name: string | null;
  org_industry: string | null;
  org_size_range: string | null;
  band: string | null;
  score: number | null;
  confidence: number | null;
  evidence_count: number;
};

type ByPersonTabProps = {
  people: { id: string }[];
  projectPath: string;
  accountId: string;
  projectId: string;
  icpCriteria: {
    target_orgs: string[];
    target_roles: string[];
    target_size_ranges: string[];
    target_facets: Array<{ facet_account_id: number; label: string }>;
  };
  icpDistribution: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
    NONE: number;
  };
  icpScoredPeople: ICPScoredPerson[];
  organizations: { id: string; name: string }[];
  dataQuality: {
    totalPeople: number;
    withTitle: number;
    withCompany: number;
  };
  availableFacets: Array<{
    id: number;
    label: string;
    slug: string;
    kindSlug: string;
    kindLabel: string;
    personCount: number;
  }>;
};

export function AnalysisByPersonTab({
  people,
  projectPath,
  accountId,
  projectId,
  icpCriteria,
  icpDistribution,
  icpScoredPeople,
  organizations,
  dataQuality,
  availableFacets,
}: ByPersonTabProps) {
  if (people.length === 0) {
    return (
      <div className="py-20 text-center">
        <User className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
        <h2 className="mb-2 font-semibold text-xl">No people yet</h2>
        <p className="mx-auto max-w-md text-muted-foreground">
          People are automatically identified from your interviews and surveys.
          Start conversations to see analysis per person.
        </p>
      </div>
    );
  }

  return (
    <ICPMatchSection
      accountId={accountId}
      projectId={projectId}
      projectPath={projectPath}
      initialCriteria={{
        target_orgs: icpCriteria.target_orgs,
        target_roles: icpCriteria.target_roles,
        target_company_sizes: icpCriteria.target_size_ranges,
        target_facets: icpCriteria.target_facets,
      }}
      distribution={icpDistribution}
      scoredPeople={icpScoredPeople}
      organizations={organizations}
      dataQuality={dataQuality}
      availableFacets={availableFacets}
    />
  );
}
