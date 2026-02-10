import consola from "consola";
import { GitMerge, LayoutGrid, MoreHorizontal, Sparkles, Table as TableIcon, UserCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type LoaderFunctionArgs, type MetaFunction, useLoaderData, useNavigate, useSearchParams } from "react-router";
import { Link, useParams, useRevalidator } from "react-router-dom";
import { PageContainer } from "~/components/layout/PageContainer";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { useCurrentProject } from "~/contexts/current-project-context";
import { getOrganizations } from "~/features/organizations/db";
import EnhancedPersonCard from "~/features/people/components/EnhancedPersonCard";
import { PeopleDataTable, type PersonTableRow } from "~/features/people/components/PeopleDataTable";
import { getPeople } from "~/features/people/db";
import { PersonaPeopleSubnav } from "~/features/personas/components/PersonaPeopleSubnav";
import { useDeviceDetection } from "~/hooks/useDeviceDetection";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { getFacetCatalog } from "~/lib/database/facets.server";
import { getServerClient } from "~/lib/supabase/client.server";
import { getImageUrl } from "~/utils/storeImage.server";

export const meta: MetaFunction = () => {
	return [
		{ title: "People" },
		{
			name: "description",
			content: "Manage research participants and contacts",
		},
	];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(request);
	const accountId = params.accountId;
	const projectId = params.projectId;

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", {
			status: 400,
		});
	}

	// Get scope from URL search params (defaults to "project")
	const url = new URL(request.url);
	const scope = (url.searchParams.get("scope") as "project" | "account") || "project";

	const [{ data: people, error }, catalog, { data: allOrganizations }] = await Promise.all([
		getPeople({ supabase, accountId, projectId, scope }),
		getFacetCatalog({ db: supabase, accountId }),
		getOrganizations({ supabase, accountId, projectId }),
	]);

	if (error) {
		throw new Response("Error loading people", { status: 500 });
	}

	// Convert R2 keys to presigned URLs for avatars
	const peopleWithImageUrls = (people || []).map((person) => {
		if (person.image_url?.startsWith("images/")) {
			return { ...person, image_url: getImageUrl(person.image_url) ?? null };
		}
		return person;
	});

	const evidence_counts: Record<string, number> = {};
	const person_ids = peopleWithImageUrls.map((person) => person.id);
	if (person_ids.length) {
		const { data: evidencePeople, error: evidenceError } = await supabase
			.from("evidence_people")
			.select("person_id")
			.in("person_id", person_ids);
		if (evidenceError) {
			consola.warn("Failed to load evidence counts for people index", evidenceError.message);
		} else {
			for (const row of evidencePeople ?? []) {
				const person_id = row.person_id;
				if (!person_id) continue;
				evidence_counts[person_id] = (evidence_counts[person_id] ?? 0) + 1;
			}
		}
	}

	// Format organizations for the table
	const organizationsList = (allOrganizations || []).map((org) => ({
		id: org.id,
		name: org.name,
	}));

	return {
		people: peopleWithImageUrls,
		catalog,
		evidence_counts,
		scope,
		organizationsList,
	};
}

export default function PeopleIndexPage() {
	const { people, catalog, evidence_counts, scope, organizationsList } = useLoaderData<typeof loader>();
	const currentProjectContext = useCurrentProject();
	const { isMobile } = useDeviceDetection();
	const { accountId, projectId } = useParams();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", {
			status: 400,
		});
	}
	const routes = useProjectRoutes(currentProjectContext?.projectPath);
	const revalidator = useRevalidator();
	const [isEnriching, setIsEnriching] = useState(false);
	const [isFindingDuplicates, setIsFindingDuplicates] = useState(false);
	const [duplicateGroups, setDuplicateGroups] = useState<
		Array<{
			key: string;
			reason: "email" | "linkedin" | "name_company";
			people: Array<{
				id: string;
				name: string | null;
				primary_email: string | null;
				linkedin_url: string | null;
				company: string | null;
				title: string | null;
				created_at: string;
			}>;
		}>
	>([]);
	const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false);
	const [isMerging, setIsMerging] = useState(false);

	const handleFindDuplicates = async () => {
		const url = `${routes.people.index()}/api/deduplicate`;
		consola.info("[Find Duplicates] Triggering:", url);
		setIsFindingDuplicates(true);
		try {
			const response = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ action: "find" }),
			});
			if (!response.ok) {
				const text = await response.text();
				consola.error("[Find Duplicates] Response error:", text);
				alert(`Error: ${response.status} - ${text}`);
				return;
			}
			const data = await response.json();
			consola.info("[Find Duplicates] Response data:", data);
			if (data.error) {
				alert(`Error: ${data.error}`);
			} else if (data.duplicateGroups?.length === 0) {
				alert("No duplicates found.");
			} else {
				setDuplicateGroups(data.duplicateGroups);
				setShowDuplicatesDialog(true);
			}
		} catch (err) {
			consola.error("[Find Duplicates] Error:", err);
			alert(`Error finding duplicates: ${err}`);
		} finally {
			setIsFindingDuplicates(false);
		}
	};

	const handleMergeDuplicates = async (primaryId: string, duplicateIds: string[]) => {
		const url = `${routes.people.index()}/api/deduplicate`;
		setIsMerging(true);
		try {
			const response = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					action: "merge",
					primaryId,
					duplicateIds,
					dryRun: false,
				}),
			});
			const data = await response.json();
			if (data.error) {
				alert(`Error: ${data.error}`);
			} else if (data.success) {
				alert(`Merged ${data.mergedIds.length} duplicate(s) into primary record.`);
				setShowDuplicatesDialog(false);
				setDuplicateGroups([]);
				revalidator.revalidate();
			}
		} catch (err) {
			consola.error("[Merge Duplicates] Error:", err);
			alert(`Error merging duplicates: ${err}`);
		} finally {
			setIsMerging(false);
		}
	};

	const handleAutoMergeDuplicates = async () => {
		const url = `${routes.people.index()}/api/deduplicate`;
		setIsMerging(true);
		try {
			const response = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ action: "auto-merge", dryRun: false }),
			});
			const data = await response.json();
			if (data.error) {
				alert(`Error: ${data.error}`);
			} else if (data.success) {
				alert(`Auto-merged ${data.peopleMerged} duplicate(s) across ${data.groupsProcessed} groups.`);
				setShowDuplicatesDialog(false);
				setDuplicateGroups([]);
				revalidator.revalidate();
			}
		} catch (err) {
			consola.error("[Auto-Merge] Error:", err);
			alert(`Error auto-merging: ${err}`);
		} finally {
			setIsMerging(false);
		}
	};

	const handleEnrichSegments = async () => {
		const url = `${routes.people.index()}/api/infer-segments`;
		consola.info("[Enrich Segments] Triggering:", url);
		setIsEnriching(true);
		try {
			const response = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ force: false }),
			});
			consola.info("[Enrich Segments] Response status:", response.status);
			if (!response.ok) {
				const text = await response.text();
				consola.error("[Enrich Segments] Response error:", text);
				alert(`Error: ${response.status} - ${text}`);
				return;
			}
			const data = await response.json();
			consola.info("[Enrich Segments] Response data:", data);
			if (data.error) {
				alert(`Error: ${data.error}`);
			} else {
				alert(`Segment enrichment started. Run ID: ${data.runId}`);
			}
		} catch (err) {
			consola.error("[Enrich Segments] Error:", err);
			alert(`Error triggering enrichment: ${err}`);
		} finally {
			setIsEnriching(false);
		}
	};

	const facetsById = useMemo(() => {
		const map = new Map<number, { label: string; alias?: string; kind_slug: string }>();
		for (const facet of catalog.facets) {
			map.set(facet.facet_account_id, {
				label: facet.label,
				alias: facet.alias,
				kind_slug: facet.kind_slug,
			});
		}
		return map;
	}, [catalog]);

	const peopleWithFacets = useMemo(() => {
		return people.map((person) => {
			const personFacets = (person.person_facet ?? []).map((row) => {
				const facetMeta = facetsById.get(row.facet_account_id);
				const joinedFacet = row.facet as {
					label?: string | null;
					facet_kind_global?: { slug?: string | null } | null;
				} | null;
				const fallbackLabel = joinedFacet?.label ?? null;
				return {
					facet_account_id: row.facet_account_id,
					label: facetMeta?.alias || facetMeta?.label || fallbackLabel || `ID:${row.facet_account_id}`,
					kind_slug: facetMeta?.kind_slug || joinedFacet?.facet_kind_global?.slug || "",
					source: row.source ?? null,
					confidence: row.confidence ?? null,
				};
			});
			return { person, facets: personFacets };
		});
	}, [people, facetsById]);

	const [searchQuery, setSearchQuery] = useState("");
	const [organizationFilter] = useState<string>("all");
	const [stakeholderFilter] = useState<string>("all");
	const [icpFilter, setIcpFilter] = useState<string>("all");

	const _organizations = useMemo(() => {
		const seen = new Set<string>();
		for (const { person } of peopleWithFacets) {
			const primaryOrgLink =
				person.people_organizations?.find((link) => link.is_primary) ?? person.people_organizations?.[0];
			const label = primaryOrgLink?.organization?.name || primaryOrgLink?.organization?.website_url || null;
			if (!label) continue;
			seen.add(label);
		}
		return Array.from(seen).sort((a, b) => a.localeCompare(b));
	}, [peopleWithFacets]);

	const _stakeholder_statuses = useMemo(() => {
		const seen = new Set<string>();
		for (const { person } of peopleWithFacets) {
			const primaryOrgLink =
				person.people_organizations?.find((link) => link.is_primary) ?? person.people_organizations?.[0];
			const status = primaryOrgLink?.relationship_status || person.lifecycle_stage || null;
			if (!status) continue;
			seen.add(status);
		}
		return Array.from(seen).sort((a, b) => a.localeCompare(b));
	}, [peopleWithFacets]);

	const filteredPeopleWithFacets = useMemo(() => {
		const normalized_query = searchQuery.trim().toLowerCase();
		return peopleWithFacets.filter(({ person }) => {
			const primaryOrgLink =
				person.people_organizations?.find((link) => link.is_primary) ?? person.people_organizations?.[0];
			const organization_label =
				primaryOrgLink?.organization?.name || primaryOrgLink?.organization?.website_url || null;
			const stakeholder_status = primaryOrgLink?.relationship_status || person.lifecycle_stage || null;
			const job_title = person.title || null;

			if (organizationFilter !== "all" && organization_label !== organizationFilter) return false;
			if (stakeholderFilter !== "all" && stakeholder_status !== stakeholderFilter) return false;

			// ICP filter
			if (icpFilter !== "all") {
				const personScale = (person as Record<string, unknown>).person_scale as
					| Array<{ kind_slug: string; band: string | null }>
					| null
					| undefined;
				const band = personScale?.find((s) => s.kind_slug === "icp_match")?.band ?? null;
				if (icpFilter === "unscored" && band !== null) return false;
				if (icpFilter !== "unscored" && band !== icpFilter) return false;
			}

			if (!normalized_query) return true;

			const haystack = [person.name, job_title, organization_label, person.description]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();
			return haystack.includes(normalized_query);
		});
	}, [organizationFilter, icpFilter, peopleWithFacets, searchQuery, stakeholderFilter]);

	const tableRows = useMemo<PersonTableRow[]>(() => {
		return filteredPeopleWithFacets.map(({ person }) => {
			const primaryOrgLink =
				person.people_organizations?.find((link) => link.is_primary) ?? person.people_organizations?.[0];
			const primaryOrganization = primaryOrgLink?.organization ?? null;
			const jobTitle = (person as { title?: string | null }).title ?? null;
			const stakeholderStatus = primaryOrgLink?.relationship_status || person.lifecycle_stage || null;

			// Extract ICP match from person_scale
			const personScale = (person as Record<string, unknown>).person_scale as
				| Array<{
						kind_slug: string;
						score: number;
						band: string | null;
						confidence: number | null;
				  }>
				| null
				| undefined;
			const icpMatch = personScale?.find((s) => s.kind_slug === "icp_match");

			return {
				id: person.id,
				name: person.name || "Unnamed person",
				firstname: (person as { firstname?: string | null }).firstname ?? null,
				lastname: (person as { lastname?: string | null }).lastname ?? null,
				title: jobTitle,
				organization: primaryOrganization
					? {
							id: primaryOrganization.id,
							name: primaryOrganization.name || primaryOrganization.website_url || null,
							job_title: primaryOrgLink?.job_title ?? null,
						}
					: null,
				conversationCount: person.interview_people?.length ?? 0,
				evidenceCount: evidence_counts[person.id] ?? 0,
				stakeholderStatus,
				updatedAt: person.updated_at ?? null,
				// Segment data
				jobFunction: (person as { job_function?: string | null }).job_function ?? null,
				seniority: (person as { seniority_level?: string | null }).seniority_level ?? null,
				segment: (person as { segment?: string | null }).segment ?? null,
				companySize: primaryOrganization?.size_range ?? null,
				// ICP score data
				icpBand: icpMatch?.band ?? null,
				icpScore: icpMatch?.score ?? null,
				icpConfidence: icpMatch?.confidence ?? null,
			};
		});
	}, [evidence_counts, filteredPeopleWithFacets]);

	// Default to table view when there are more than 10 people.
	// On mobile we flip to cards after mount for better readability.
	const [viewMode, setViewMode] = useState<"cards" | "table">(() => (people.length > 10 ? "table" : "cards"));
	const [hasManualViewSelection, setHasManualViewSelection] = useState(false);

	useEffect(() => {
		if (!hasManualViewSelection && isMobile && viewMode === "table") {
			setViewMode("cards");
		}
	}, [hasManualViewSelection, isMobile, viewMode]);

	return (
		<>
			<PersonaPeopleSubnav />
			<PageContainer className="space-y-6">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex items-start gap-3">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
							<UserCircle className="h-6 w-6" />
						</div>
						<div>
							<div className="flex items-baseline gap-2">
								<h1 className="font-semibold text-3xl text-foreground">People</h1>
								<span className="text-foreground/75 text-sm">({people.length})</span>
							</div>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2 sm:gap-3">
						{/* Scope toggle - Project vs Account */}
						<ToggleGroup
							type="single"
							value={scope}
							onValueChange={(value) => {
								if (value) {
									const newParams = new URLSearchParams(searchParams);
									newParams.set("scope", value);
									navigate(`?${newParams.toString()}`, { replace: true });
								}
							}}
							className="w-auto"
							variant="outline"
							size="sm"
						>
							<ToggleGroupItem value="project" aria-label="Current project">
								Project
							</ToggleGroupItem>
							<ToggleGroupItem value="account" aria-label="All account">
								All
							</ToggleGroupItem>
						</ToggleGroup>

						{/* View mode toggle */}
						<ToggleGroup
							type="single"
							value={viewMode}
							onValueChange={(value) => {
								if (!value) return;
								setHasManualViewSelection(true);
								setViewMode(value as "cards" | "table");
							}}
							className="w-auto"
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
						<Button asChild size="sm" className="h-8 px-3 text-xs sm:text-sm">
							<Link to={routes.people.new()}>
								<span className="sm:hidden">Add</span>
								<span className="hidden sm:inline">Add Person</span>
							</Link>
						</Button>

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs sm:text-sm">
									Actions
									<MoreHorizontal className="h-3.5 w-3.5" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-52">
								<DropdownMenuItem
									onClick={handleEnrichSegments}
									disabled={isEnriching}
									className="flex items-center gap-2"
								>
									<Sparkles className="h-4 w-4" />
									{isEnriching ? "Enriching..." : "Enrich Segments"}
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={handleFindDuplicates}
									disabled={isFindingDuplicates}
									className="flex items-center gap-2"
								>
									<GitMerge className="h-4 w-4" />
									{isFindingDuplicates ? "Finding..." : "Find Duplicates"}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex flex-1 flex-col gap-3 sm:flex-row">
						<div className="flex-1">
							<Input
								value={searchQuery}
								onChange={(event) => setSearchQuery(event.target.value)}
								placeholder="Search people…"
								aria-label="Search people"
							/>
						</div>
						{/* <div className="w-full sm:w-56">
							<Select value={organizationFilter} onValueChange={setOrganizationFilter}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Organization" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All organizations</SelectItem>
									{organizations.map((org) => (
										<SelectItem key={org} value={org}>
											{org}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div> */}
						{/* <div className="w-full sm:w-56">
							<Select value={stakeholderFilter} onValueChange={setStakeholderFilter}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Stakeholder status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All statuses</SelectItem>
									{stakeholder_statuses.map((status) => (
										<SelectItem key={status} value={status}>
											{status}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div> */}
						<Select value={icpFilter} onValueChange={setIcpFilter}>
							<SelectTrigger className="w-full sm:w-44">
								<SelectValue placeholder="ICP Match" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All ICP</SelectItem>
								<SelectItem value="HIGH">High match</SelectItem>
								<SelectItem value="MEDIUM">Medium match</SelectItem>
								<SelectItem value="LOW">Low match</SelectItem>
								<SelectItem value="unscored">Unscored</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="text-muted-foreground text-sm">{filteredPeopleWithFacets.length} results</div>
				</div>

				{people.length === 0 ? (
					<div className="rounded-lg border border-dashed bg-muted/40 py-16 text-center">
						<div className="mx-auto max-w-md space-y-4">
							<h3 className="font-semibold text-lg text-muted-foreground">No people yet</h3>

							<Button asChild>
								<Link to={routes.people.new()}>Add Person</Link>
							</Button>
						</div>
					</div>
				) : viewMode === "table" ? (
					<PeopleDataTable rows={tableRows} organizations={organizationsList} />
				) : (
					<div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
						{filteredPeopleWithFacets.map(({ person, facets }) => {
							const personScale = (person as Record<string, unknown>).person_scale as
								| Array<{
										kind_slug: string;
										band: string | null;
										confidence: number | null;
								  }>
								| null
								| undefined;
							const icpMatch = personScale?.find((s) => s.kind_slug === "icp_match");
							return (
								<EnhancedPersonCard
									key={person.id}
									person={{
										...person,
										people_personas: (person.people_personas || []).map((pp) => ({
											personas: pp.personas
												? {
														name: pp.personas.name,
														color_hex: pp.personas.color_hex || undefined,
													}
												: undefined,
										})),
									}}
									conversationCount={person.interview_people?.length ?? 0}
									evidenceCount={evidence_counts[person.id] ?? 0}
									facets={facets}
									icpBand={icpMatch?.band ?? null}
									icpConfidence={icpMatch?.confidence ?? null}
								/>
							);
						})}
					</div>
				)}
			</PageContainer>

			{/* Duplicates Dialog */}
			<AlertDialog open={showDuplicatesDialog} onOpenChange={setShowDuplicatesDialog}>
				<AlertDialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
					<AlertDialogHeader>
						<AlertDialogTitle>Potential Duplicates Found</AlertDialogTitle>
						<AlertDialogDescription>
							Found {duplicateGroups.length} groups of potential duplicate people. Review each group and choose how to
							handle them.
						</AlertDialogDescription>
					</AlertDialogHeader>

					<div className="space-y-4 py-4">
						{duplicateGroups.map((group, _groupIndex) => (
							<div key={group.key} className="rounded-lg border bg-muted/20 p-4">
								<div className="mb-2 flex items-center gap-2">
									<Badge variant="outline">
										{group.reason === "email"
											? "Same Email"
											: group.reason === "linkedin"
												? "Same LinkedIn"
												: "Same Name & Company"}
									</Badge>
									<span className="text-muted-foreground text-sm">{group.people.length} records</span>
								</div>

								<div className="space-y-2">
									{group.people.map((person, personIndex) => (
										<div
											key={person.id}
											className={`flex items-center justify-between rounded border p-2 ${personIndex === 0 ? "border-primary bg-primary/5" : "bg-background"}`}
										>
											<div className="min-w-0 flex-1">
												<div className="font-medium">
													{person.name || "Unnamed"}
													{personIndex === 0 && (
														<Badge className="ml-2" variant="secondary">
															Primary
														</Badge>
													)}
												</div>
												<div className="truncate text-muted-foreground text-sm">
													{[
														person.title,
														(person as any).people_organizations?.[0]?.organization?.name,
														person.primary_email,
													]
														.filter(Boolean)
														.join(" · ")}
												</div>
											</div>
										</div>
									))}
								</div>

								<div className="mt-3 flex justify-end">
									<Button
										size="sm"
										variant="secondary"
										disabled={isMerging}
										onClick={() => {
											const [primary, ...duplicates] = group.people;
											handleMergeDuplicates(
												primary.id,
												duplicates.map((d) => d.id)
											);
										}}
									>
										<GitMerge className="mr-1 h-3 w-3" />
										Merge into Primary
									</Button>
								</div>
							</div>
						))}
					</div>

					<AlertDialogFooter>
						<AlertDialogCancel disabled={isMerging}>Cancel</AlertDialogCancel>
						{duplicateGroups.length > 1 && (
							<AlertDialogAction
								disabled={isMerging}
								onClick={(e) => {
									e.preventDefault();
									handleAutoMergeDuplicates();
								}}
							>
								{isMerging ? "Merging..." : "Auto-Merge All"}
							</AlertDialogAction>
						)}
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
