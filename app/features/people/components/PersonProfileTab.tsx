/**
 * PersonProfileTab - Detailed attributes and contact information
 *
 * Shows the supporting data for a person:
 * 1. PersonFacetLenses - AI-extracted attributes (Pain, Goals, Workflow)
 * 2. Demographics & Segment - Job function, seniority, industry badges
 * 3. Contact Information - email, phone, LinkedIn, social links
 */

import type { LucideIcon } from "lucide-react";
import {
	Briefcase,
	Building2,
	ChevronDown,
	ChevronUp,
	ExternalLink,
	Globe,
	Instagram,
	Linkedin,
	Mail,
	MapPin,
	Phone,
	Twitter,
	User2,
} from "lucide-react";
import { useState } from "react";
import { InlineEditableField } from "~/components/InlineEditableField";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { BandBadge } from "~/features/lenses/components/ICPMatchSection";
import { INDUSTRIES, JOB_FUNCTIONS, SENIORITY_LEVELS } from "~/lib/constants/options";
import { PersonFacetLenses } from "./PersonFacetLenses";

/** Contact information item with icon and optional link */
interface ContactItem {
	type: string;
	value: string;
	href?: string;
	icon: LucideIcon;
}

/** Facet entry within a lens group */
interface FacetEntry {
	facet_account_id: number;
	label: string;
	source: string | null;
	confidence: number | null;
	kind_slug: string;
}

/** Facet lens group */
interface FacetGroupLens {
	kind_slug: string;
	label: string;
	summary?: string | null;
	facets: FacetEntry[];
}

/** Available facet for adding to a person */
interface AvailableFacet {
	id: number;
	label: string;
	slug: string;
}

/** Person data needed for the Profile tab (accepts full person object) */
interface Person {
	id: string;
	primary_email: string | null;
	primary_phone: string | null;
	linkedin_url: string | null;
	contact_info: Record<string, string> | null;
	job_function: string | null;
	seniority_level: string | null;
	industry: string | null;
	// Allow additional properties from loader
	[key: string]: unknown;
}

/** Primary organization data */
interface PrimaryOrganization {
	industry: string | null;
	size_range: string | null;
}

interface PersonScaleEntry {
	kind_slug: string;
	score: number;
	band: string | null;
	confidence: number | null;
	noted_at: string | null;
}

interface PersonProfileTabProps {
	/** Person data */
	person: Person;
	/** Facet lens groups for PersonFacetLenses */
	facetLensGroups: FacetGroupLens[];
	/** Available facets by kind for adding new signals */
	availableFacetsByKind: Record<string, AvailableFacet[]>;
	/** Whether AI summaries are being regenerated */
	isGenerating?: boolean;
	/** Primary organization for fallback industry */
	primaryOrg?: PrimaryOrganization | null;
	/** Person scale data (e.g. ICP match scores) */
	personScale?: PersonScaleEntry[] | null;
}

/**
 * Parse contact info from person record
 * Extracts primary fields and additional JSONB fields into a consistent format
 */
function parseContactInfo(person: Person): ContactItem[] {
	const items: ContactItem[] = [];

	// Primary contact fields
	if (person.primary_email) {
		items.push({
			type: "Email",
			value: person.primary_email,
			href: `mailto:${person.primary_email}`,
			icon: Mail,
		});
	}
	if (person.primary_phone) {
		items.push({
			type: "Phone",
			value: person.primary_phone,
			href: `tel:${person.primary_phone.replace(/\s/g, "")}`,
			icon: Phone,
		});
	}
	if (person.linkedin_url) {
		const displayValue = person.linkedin_url.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "").replace(/\/$/, "");
		items.push({
			type: "LinkedIn",
			value: displayValue,
			href: person.linkedin_url.startsWith("http")
				? person.linkedin_url
				: `https://linkedin.com/in/${person.linkedin_url}`,
			icon: Linkedin,
		});
	}

	// Parse contact_info JSONB for additional fields
	const info = person.contact_info;
	if (info) {
		if (info.twitter) {
			const handle = info.twitter.replace(/^@/, "").replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//, "");
			items.push({
				type: "X / Twitter",
				value: `@${handle}`,
				href: `https://x.com/${handle}`,
				icon: Twitter,
			});
		}
		if (info.instagram) {
			const handle = info.instagram
				.replace(/^@/, "")
				.replace(/^https?:\/\/(www\.)?instagram\.com\//, "")
				.replace(/\/$/, "");
			items.push({
				type: "Instagram",
				value: `@${handle}`,
				href: `https://instagram.com/${handle}`,
				icon: Instagram,
			});
		}
		if (info.website) {
			items.push({
				type: "Website",
				value: info.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""),
				href: info.website.startsWith("http") ? info.website : `https://${info.website}`,
				icon: Globe,
			});
		}
		if (info.address) {
			items.push({
				type: "Address",
				value: info.address,
				icon: MapPin,
			});
		}
	}

	return items;
}

/** Get option label from a list of options */
function getOptionLabel(options: { value: string; label: string }[], value: string | null): string | null {
	if (!value) return null;
	const option = options.find((o) => o.value === value);
	return option?.label ?? value;
}

export function PersonProfileTab({
	person,
	facetLensGroups,
	availableFacetsByKind,
	isGenerating = false,
	primaryOrg,
	personScale,
}: PersonProfileTabProps) {
	const [contactExpanded, setContactExpanded] = useState(true);

	const contactItems = parseContactInfo(person);
	const hasContactInfo = contactItems.length > 0;

	// Determine if we have any editable primary contact fields set
	const hasPrimaryEmail = Boolean(person.primary_email);
	const hasPrimaryPhone = Boolean(person.primary_phone);
	const hasLinkedIn = Boolean(person.linkedin_url);

	// Segment/demographic data
	const jobFunctionLabel = getOptionLabel(JOB_FUNCTIONS, person.job_function);
	const seniorityLabel = getOptionLabel(SENIORITY_LEVELS, person.seniority_level);
	const industryValue = person.industry || primaryOrg?.industry || null;
	const industryLabel = getOptionLabel(INDUSTRIES, industryValue);

	// ICP match data
	const icpMatch = personScale?.find((s) => s.kind_slug === "icp_match");

	const hasSegmentData = person.job_function || person.seniority_level || industryValue;

	// Empty state
	const hasFacetLenses = facetLensGroups.length > 0;
	const hasAnyContent = hasFacetLenses || hasSegmentData || hasContactInfo || icpMatch;

	if (!hasAnyContent) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-center">
				<User2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
				<h3 className="mb-2 font-medium text-lg">No profile data yet</h3>
				<p className="max-w-md text-muted-foreground text-sm">
					Profile data will appear here as you add conversations and evidence linked to this person.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Demographics & Segment Data */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-base">
						<Briefcase className="h-4 w-4" />
						Demographics
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Segment badges - read-only display */}
					{hasSegmentData && (
						<div className="flex flex-wrap gap-2">
							{jobFunctionLabel && (
								<Badge variant="outline" className="gap-1.5 border-border/60 bg-muted/30">
									<span className="text-muted-foreground/70">Function:</span>
									<span className="text-foreground">{jobFunctionLabel}</span>
								</Badge>
							)}
							{seniorityLabel && (
								<Badge variant="outline" className="gap-1.5 border-border/60 bg-muted/30">
									<span className="text-muted-foreground/70">Seniority:</span>
									<span className="text-foreground">{seniorityLabel}</span>
								</Badge>
							)}
							{industryLabel && (
								<Badge variant="outline" className="gap-1.5 border-border/60 bg-muted/30">
									<span className="text-muted-foreground/70">Industry:</span>
									<span className="text-foreground">{industryLabel}</span>
								</Badge>
							)}
						</div>
					)}

					{/* Inline editable fields */}
					<div className="grid gap-4 sm:grid-cols-3">
						<div className="space-y-1">
							<label className="text-muted-foreground text-xs uppercase tracking-wide">Job Function</label>
							<InlineEditableField
								value={person.job_function}
								entityId={person.id}
								entityIdKey="personId"
								field="job_function"
								placeholder="Select function"
								type="select"
								options={JOB_FUNCTIONS}
								className="text-sm"
							/>
						</div>
						<div className="space-y-1">
							<label className="text-muted-foreground text-xs uppercase tracking-wide">Seniority</label>
							<InlineEditableField
								value={person.seniority_level}
								entityId={person.id}
								entityIdKey="personId"
								field="seniority_level"
								placeholder="Select level"
								type="select"
								options={SENIORITY_LEVELS}
								className="text-sm"
							/>
						</div>
						<div className="space-y-1">
							<label className="text-muted-foreground text-xs uppercase tracking-wide">Industry</label>
							<InlineEditableField
								value={person.industry}
								entityId={person.id}
								entityIdKey="personId"
								field="industry"
								placeholder="Select industry"
								type="select"
								options={INDUSTRIES}
								className="text-sm"
							/>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* ICP Match Score */}
			{icpMatch && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-base">
							<Briefcase className="h-4 w-4" />
							ICP Match
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-3">
							<BandBadge band={icpMatch.band} confidence={icpMatch.confidence} />
							{icpMatch.score != null && (
								<span className="text-muted-foreground text-xs">Score: {Math.round(icpMatch.score * 100)}%</span>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Contact Information - Collapsible */}
			<Collapsible open={contactExpanded} onOpenChange={setContactExpanded}>
				<Card>
					<CardHeader className="pb-3">
						<div className="flex items-center justify-between">
							<CardTitle className="flex items-center gap-2 text-base">
								<Mail className="h-4 w-4" />
								Contact Information
							</CardTitle>
							<CollapsibleTrigger asChild>
								<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
									{contactExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
									<span className="sr-only">{contactExpanded ? "Collapse" : "Expand"}</span>
								</Button>
							</CollapsibleTrigger>
						</div>
					</CardHeader>
					<CollapsibleContent>
						<CardContent className="space-y-4">
							{/* Editable primary fields */}
							<div className="grid gap-4 sm:grid-cols-3">
								<div className="space-y-1">
									<label className="text-muted-foreground text-xs uppercase tracking-wide">Email</label>
									<InlineEditableField
										value={person.primary_email}
										entityId={person.id}
										entityIdKey="personId"
										field="primary_email"
										placeholder="Add email"
										className="text-sm"
									/>
								</div>
								<div className="space-y-1">
									<label className="text-muted-foreground text-xs uppercase tracking-wide">Phone</label>
									<InlineEditableField
										value={person.primary_phone}
										entityId={person.id}
										entityIdKey="personId"
										field="primary_phone"
										placeholder="Add phone"
										className="text-sm"
									/>
								</div>
								<div className="space-y-1">
									<label className="text-muted-foreground text-xs uppercase tracking-wide">LinkedIn</label>
									<InlineEditableField
										value={person.linkedin_url}
										entityId={person.id}
										entityIdKey="personId"
										field="linkedin_url"
										placeholder="Add LinkedIn URL"
										className="text-sm"
									/>
								</div>
							</div>

							{/* Display-only contact items (from JSONB) */}
							{contactItems.length > 0 && (
								<div className="space-y-3 border-t pt-4">
									<p className="text-muted-foreground text-xs uppercase tracking-wide">All Contact Methods</p>
									<div className="grid gap-3 sm:grid-cols-2">
										{contactItems.map((item) => {
											const IconComponent = item.icon;
											return (
												<div key={`${item.type}-${item.value}`} className="flex items-start gap-3">
													<IconComponent className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
													<div className="min-w-0 flex-1">
														<div className="text-muted-foreground text-xs uppercase tracking-wide">{item.type}</div>
														{item.href ? (
															<a
																href={item.href}
																target={
																	item.href.startsWith("mailto:") || item.href.startsWith("tel:") ? undefined : "_blank"
																}
																rel="noopener noreferrer"
																className="group flex items-center gap-1 font-medium text-foreground text-sm hover:text-primary"
															>
																<span className="truncate">{item.value}</span>
																{!item.href.startsWith("mailto:") && !item.href.startsWith("tel:") && (
																	<ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
																)}
															</a>
														) : (
															<div className="font-medium text-foreground text-sm">{item.value}</div>
														)}
													</div>
												</div>
											);
										})}
									</div>
								</div>
							)}

							{/* Empty state for contact section */}
							{!hasPrimaryEmail && !hasPrimaryPhone && !hasLinkedIn && contactItems.length === 0 && (
								<p className="py-4 text-center text-muted-foreground text-sm">
									No contact information available. Use the fields above to add email, phone, or LinkedIn.
								</p>
							)}
						</CardContent>
					</CollapsibleContent>
				</Card>
			</Collapsible>

			{/* Facet Lenses - AI-extracted attributes */}
			{hasFacetLenses && (
				<PersonFacetLenses
					groups={facetLensGroups}
					personId={person.id}
					availableFacetsByKind={availableFacetsByKind}
					isGenerating={isGenerating}
				/>
			)}
		</div>
	);
}
