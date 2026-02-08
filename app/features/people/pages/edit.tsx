import slugify from "@sindresorhus/slugify";
import {
	Building2,
	Check,
	ChevronsUpDown,
	Globe,
	Instagram,
	Linkedin,
	Loader2,
	Mail,
	Phone,
	Trash2,
	Twitter,
	User,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, redirect, useActionData, useFetcher, useLoaderData, useNavigation } from "react-router-dom";
import { LinkOrganizationDialog } from "~/components/dialogs/LinkOrganizationDialog";
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
	AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { MediaInput } from "~/components/ui/MediaInput";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import {
	createOrganization,
	getOrganizations,
	linkPersonToOrganization,
	unlinkPersonFromOrganization,
} from "~/features/organizations/db";
import { deletePerson, getPersonById, updatePerson } from "~/features/people/db";
import { getPersonas } from "~/features/personas/db";
import { getFacetCatalog } from "~/lib/database/facets.server";
import { userContext } from "~/server/user-context";
import { createProjectRoutes } from "~/utils/routes.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `Edit ${data?.person?.name || "Person"} | Insights` },
		{ name: "description", content: "Edit person details" },
	];
};

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext);
	const supabase = ctx.supabase;

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId;
	const projectId = params.projectId;
	const personId = params.personId;

	if (!accountId || !projectId || !personId) {
		throw new Response("Account ID, Project ID, and Person ID are required", {
			status: 400,
		});
	}

	try {
		const [person, { data: personas }, catalog, { data: organizations }] = await Promise.all([
			getPersonById({
				supabase,
				accountId,
				projectId,
				id: personId,
			}),
			getPersonas({ supabase, accountId, projectId }),
			getFacetCatalog({ db: supabase, accountId, projectId }),
			getOrganizations({ supabase, accountId, projectId }),
		]);

		if (!person) {
			throw new Response("Person not found", { status: 404 });
		}

		return {
			person,
			personas: personas || [],
			catalog,
			organizations: organizations || [],
			accountId,
			projectId,
		};
	} catch {
		throw new Response("Failed to load person", { status: 500 });
	}
}

export async function action({ request, params, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext);
	const supabase = ctx.supabase;

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId;
	const projectId = params.projectId;
	const personId = params.personId;
	if (!accountId || !projectId || !personId) {
		throw new Response("Account ID, Project ID, and Person ID are required", {
			status: 400,
		});
	}
	const routes = createProjectRoutes(accountId, projectId);

	const formData = await request.formData();
	const intent = formData.get("intent") as string;

	if (intent === "delete") {
		try {
			await deletePerson({
				supabase,
				id: personId,
				accountId,
				projectId,
			});

			return redirect(routes.people.index());
		} catch (err) {
			console.error("Delete person action error:", err);
			return {
				error: err instanceof Error ? err.message : "Failed to delete person",
			};
		}
	}

	// Handle organization linking
	const _action = formData.get("_action") as string;

	if (_action === "link-organization") {
		const organizationId = formData.get("organization_id") as string;
		const role = formData.get("role") as string;

		if (!organizationId) {
			return { error: "Organization is required" };
		}

		try {
			await linkPersonToOrganization({
				supabase,
				accountId,
				projectId,
				personId,
				organizationId,
				role: role || null,
				isPrimary: true,
			});
			return { success: true };
		} catch (err) {
			return {
				error: err instanceof Error ? err.message : "Failed to link organization",
			};
		}
	}

	if (_action === "create-and-link-organization") {
		const name = formData.get("name") as string;
		const location = formData.get("headquarters_location") as string;
		const role = formData.get("role") as string;

		if (!name?.trim()) {
			return { error: "Organization name is required" };
		}

		try {
			// Create the organization
			const { data: newOrg, error: createError } = await createOrganization({
				supabase,
				data: {
					account_id: accountId,
					project_id: projectId,
					name: name.trim(),
					headquarters_location: location?.trim() || null,
				},
			});

			if (createError || !newOrg) {
				throw new Error(createError?.message || "Failed to create organization");
			}

			// Link the person to the new organization
			await linkPersonToOrganization({
				supabase,
				accountId,
				projectId,
				personId,
				organizationId: newOrg.id,
				role: role || null,
				isPrimary: true,
			});

			return { success: true };
		} catch (err) {
			return {
				error: err instanceof Error ? err.message : "Failed to create and link organization",
			};
		}
	}

	if (_action === "unlink-organization") {
		const organizationId = formData.get("organization_id") as string;

		if (!organizationId) {
			return { error: "Organization is required" };
		}

		try {
			await unlinkPersonFromOrganization({
				supabase,
				accountId,
				projectId,
				personId,
				organizationId,
			});
			return { success: true };
		} catch (err) {
			return {
				error: err instanceof Error ? err.message : "Failed to unlink organization",
			};
		}
	}

	// Handle update
	const firstname = formData.get("firstname") as string;
	const lastname = formData.get("lastname") as string;
	const description = formData.get("description") as string;
	const segment = formData.get("segment") as string;
	const image_url = formData.get("image_url") as string;
	const personaId = formData.get("persona_id") as string;

	// Contact info fields
	const primary_email = formData.get("primary_email") as string;
	const primary_phone = formData.get("primary_phone") as string;
	const title = formData.get("title") as string;
	// Note: company field removed from form - now handled via organization linking
	const linkedin_url = formData.get("linkedin_url") as string;
	const website_url = formData.get("website_url") as string;

	// Social profiles (stored in contact_info JSONB)
	const twitter = formData.get("twitter") as string;
	const instagram = formData.get("instagram") as string;
	const selectedFacetRefs = formData
		.getAll("facetRefs")
		.map((value) => value.toString())
		.filter((value) => value.trim().length);
	const newFacetKind = formData.get("newFacetKind")?.toString().trim() ?? "";
	const newFacetLabel = formData.get("newFacetLabel")?.toString().trim() ?? "";
	const newFacetSynonyms = formData.get("newFacetSynonyms")?.toString().trim() ?? "";
	const _newFacetNotes = formData.get("newFacetNotes")?.toString().trim() ?? "";

	if (!firstname?.trim()) {
		return { error: "First name is required" };
	}

	try {
		// Fetch existing person to merge contact_info
		const { data: existingPerson } = await supabase.from("people").select("contact_info").eq("id", personId).single();

		// Build contact_info JSONB by merging with existing data
		const existingContactInfo = (existingPerson?.contact_info as Record<string, string>) || {};
		const contactInfo: Record<string, string> = { ...existingContactInfo };

		// Update or remove social profiles based on form input
		if (twitter?.trim()) {
			contactInfo.twitter = twitter.trim();
		} else {
			delete contactInfo.twitter;
		}
		if (instagram?.trim()) {
			contactInfo.instagram = instagram.trim();
		} else {
			delete contactInfo.instagram;
		}

		// Update person basic info (no longer includes persona or company fields)
		// Note: company is NOT NULL so we don't update it - use organization linking instead
		const data = await updatePerson({
			supabase,
			id: personId,
			accountId,
			projectId,
			data: {
				firstname: firstname.trim(),
				lastname: lastname?.trim() || null,
				description: description?.trim() || null,
				segment: segment?.trim() || null,
				image_url: image_url?.trim() || null,
				primary_email: primary_email?.trim() || null,
				primary_phone: primary_phone?.trim() || null,
				title: title?.trim() || null,
				linkedin_url: linkedin_url?.trim() || null,
				website_url: website_url?.trim() || null,
				contact_info: Object.keys(contactInfo).length > 0 ? contactInfo : null,
			},
		});

		if (!data) {
			return { error: "Failed to update person" };
		}

		// Handle persona assignment via junction table
		if (personaId && personaId !== "none") {
			await supabase.from("people_personas").upsert(
				{
					person_id: personId,
					persona_id: personaId,
				},
				{ onConflict: "person_id,persona_id" }
			);
		} else {
			// Remove all persona assignments if "none" is selected
			await supabase.from("people_personas").delete().eq("person_id", personId);
		}

		// Synchronize facet assignments
		let selectedFacetAccountIds = selectedFacetRefs
			.map((ref) => {
				const match = /^a:(\d+)$/.exec(ref);
				return match ? Number.parseInt(match[1], 10) : null;
			})
			.filter((value): value is number => Number.isFinite(value));

		if (newFacetKind && newFacetLabel) {
			const synonyms = newFacetSynonyms
				.split(",")
				.map((value) => value.trim())
				.filter(Boolean);
			const { data: kindRow, error: kindError } = await supabase
				.from("facet_kind_global")
				.select("id")
				.eq("slug", newFacetKind)
				.maybeSingle();
			if (kindError) {
				return { error: `Failed to resolve facet kind: ${kindError.message}` };
			}
			if (!kindRow?.id) {
				return { error: "Unknown facet kind selected" };
			}

			const facetSlug = slugify(newFacetLabel, { separator: "_" }).toLowerCase() || `facet_${Date.now()}`;
			const insertPayload = {
				account_id: accountId,
				kind_id: kindRow.id,
				label: newFacetLabel,
				slug: facetSlug,
				synonyms,
				is_active: true,
			};

			const { data: upsertedFacet, error: facetInsertError } = await supabase
				.from("facet_account")
				.upsert(insertPayload, { onConflict: "account_id,kind_id,slug" })
				.select("id")
				.single();
			if (facetInsertError) {
				return { error: `Failed to create facet: ${facetInsertError.message}` };
			}
			if (upsertedFacet?.id) {
				selectedFacetAccountIds = Array.from(new Set([...selectedFacetAccountIds, upsertedFacet.id]));
			}
		}

		const { data: existingFacetRows, error: existingFacetError } = await supabase
			.from("person_facet")
			.select("facet_account_id")
			.eq("person_id", personId)
			.eq("project_id", projectId);
		if (existingFacetError) {
			return {
				error: `Failed to load existing facets: ${existingFacetError.message}`,
			};
		}

		const existingIds = new Set(
			(existingFacetRows ?? [])
				.map((row) => row.facet_account_id)
				.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
		);
		const desiredIds = new Set(selectedFacetAccountIds);

		const toInsert = selectedFacetAccountIds.filter((id) => !existingIds.has(id));
		const toRemove = Array.from(existingIds).filter((id) => !desiredIds.has(id));

		if (toInsert.length) {
			const insertPayload = toInsert.map((facetId) => ({
				account_id: accountId,
				project_id: projectId,
				person_id: personId,
				facet_account_id: facetId,
				source: "manual" as const,
				confidence: 0.8,
			}));
			const { error: insertError } = await supabase
				.from("person_facet")
				.upsert(insertPayload, { onConflict: "person_id,facet_account_id" });
			if (insertError) {
				return { error: `Failed to add facets: ${insertError.message}` };
			}
		}

		if (toRemove.length) {
			const { error: deleteError } = await supabase
				.from("person_facet")
				.delete()
				.eq("person_id", personId)
				.eq("project_id", projectId)
				.in("facet_account_id", toRemove);
			if (deleteError) {
				return { error: `Failed to remove facets: ${deleteError.message}` };
			}
		}

		return redirect(routes.people.detail(data.id));
	} catch (error) {
		// Log error for debugging without using console
		if (typeof window !== "undefined") {
			const globalWindow = window as typeof window & { debugError?: unknown };
			globalWindow.debugError = error;
		}
		return { error: "Failed to update person" };
	}
}

export default function EditPerson() {
	const { person, personas, catalog, organizations } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const fetcher = useFetcher();

	const isSubmitting = navigation.state === "submitting";
	const isDeleting = navigation.state === "submitting" && navigation.formData?.get("intent") === "delete";

	// Get current persona from junction table
	const people_personas = person.people_personas || [];
	const currentPersona = people_personas.length > 0 ? people_personas[0].personas : null;

	// Get linked organizations
	const linkedOrganizations = person.people_organizations || [];

	// Get available organizations (not already linked)
	const availableOrganizations = useMemo(() => {
		const linkedIds = new Set(linkedOrganizations.map((po) => po.organization?.id).filter(Boolean));
		return organizations.filter((org) => !linkedIds.has(org.id));
	}, [organizations, linkedOrganizations]);

	// Parse existing contact_info for social profiles
	const existingContactInfo = useMemo(() => {
		const info = person.contact_info as Record<string, string> | null;
		return {
			twitter: info?.twitter || "",
			instagram: info?.instagram || "",
		};
	}, [person.contact_info]);

	const initialFacetRefs = useMemo(() => {
		return (person.person_facet ?? [])
			.map((facet) => {
				if (typeof facet.facet_account_id === "number") {
					return `a:${facet.facet_account_id}`;
				}
				return null;
			})
			.filter((value): value is string => Boolean(value));
	}, [person.person_facet]);

	// Use state for facets selection to enable controlled multi-select UI
	const [selectedFacetRefs, setSelectedFacetRefs] = useState<string[]>(initialFacetRefs);
	const [facetPopoverOpen, setFacetPopoverOpen] = useState(false);

	const accountFacetOptions = catalog.facets;

	// Build a lookup map for selected facets to show their labels
	const selectedFacetLabels = useMemo(() => {
		const labelMap = new Map<string, { label: string; kind: string }>();
		for (const facet of accountFacetOptions) {
			const ref = `a:${facet.facet_account_id}`;
			if (selectedFacetRefs.includes(ref)) {
				const kind = catalog.kinds.find((k) => k.slug === facet.kind_slug);
				labelMap.set(ref, {
					label: facet.alias || facet.label,
					kind: kind?.label || facet.kind_slug,
				});
			}
		}
		return labelMap;
	}, [selectedFacetRefs, accountFacetOptions, catalog.kinds]);

	const toggleFacet = (ref: string) => {
		setSelectedFacetRefs((prev) => (prev.includes(ref) ? prev.filter((r) => r !== ref) : [...prev, ref]));
	};

	const removeFacet = (ref: string) => {
		setSelectedFacetRefs((prev) => prev.filter((r) => r !== ref));
	};

	return (
		<PageContainer size="sm" padded={false} className="max-w-2xl">
			<div className="mb-8">
				<h1 className="font-bold text-3xl text-foreground">Edit Person</h1>
			</div>

			<Form method="post" className="space-y-6">
				<div className="grid gap-4 sm:grid-cols-2">
					<div>
						<Label htmlFor="firstname">First Name *</Label>
						<Input
							id="firstname"
							name="firstname"
							type="text"
							required
							defaultValue={person.firstname || ""}
							placeholder="First name"
							className="mt-1"
						/>
					</div>
					<div>
						<Label htmlFor="lastname">Last Name</Label>
						<Input
							id="lastname"
							name="lastname"
							type="text"
							defaultValue={person.lastname || ""}
							placeholder="Last name"
							className="mt-1"
						/>
					</div>
				</div>

				<MediaInput
					name="image_url"
					defaultValue={person.image_url}
					category="avatars"
					entityId={person.id}
					mode="avatar"
					size="lg"
					circular
					allowUrl
					label="Profile Image"
					hint="Drag & drop, upload, or paste a URL"
				/>

				{/* Professional Info */}
				<div className="grid gap-4 sm:grid-cols-2">
					<div>
						<Label htmlFor="title">
							<User className="mr-1.5 inline h-4 w-4 text-muted-foreground" />
							Job Title
						</Label>
						<Input
							id="title"
							name="title"
							type="text"
							defaultValue={person.title || ""}
							placeholder="e.g., Product Manager"
							className="mt-1"
						/>
					</div>
					<div>
						<Label>
							<Building2 className="mr-1.5 inline h-4 w-4 text-muted-foreground" />
							Organization
						</Label>
						<div className="mt-1 space-y-2">
							{/* Show linked organizations */}
							{linkedOrganizations.map((link) => (
								<div
									key={link.id}
									className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2"
								>
									<div className="flex items-center gap-2">
										<Building2 className="h-4 w-4 text-muted-foreground" />
										<span className="font-medium text-sm">{link.organization?.name}</span>
										{link.role && <span className="text-muted-foreground text-xs">({link.role})</span>}
									</div>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="h-6 w-6"
										onClick={() => {
											fetcher.submit(
												{
													_action: "unlink-organization",
													organization_id: link.organization?.id || "",
												},
												{ method: "post" }
											);
										}}
									>
										<X className="h-4 w-4" />
									</Button>
								</div>
							))}

							{/* Link organization dialog */}
							<LinkOrganizationDialog
								personId={person.id}
								availableOrganizations={availableOrganizations.map((org) => ({
									id: org.id,
									name: org.name,
									headquarters_location: org.headquarters_location,
								}))}
								triggerButton={
									<Button type="button" variant="outline" size="sm" className="w-full">
										<Building2 className="mr-2 h-4 w-4" />
										{linkedOrganizations.length > 0 ? "Add Another" : "Link Organization"}
									</Button>
								}
							/>
						</div>
					</div>
				</div>

				{/* Contact Info */}
				<div className="space-y-4 rounded-lg border bg-muted/30 p-4">
					<h3 className="font-medium text-sm">Contact Information</h3>
					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<Label htmlFor="primary_email">
								<Mail className="mr-1.5 inline h-4 w-4 text-muted-foreground" />
								Email
							</Label>
							<Input
								id="primary_email"
								name="primary_email"
								type="email"
								defaultValue={person.primary_email || ""}
								placeholder="email@example.com"
								className="mt-1"
							/>
						</div>
						<div>
							<Label htmlFor="primary_phone">
								<Phone className="mr-1.5 inline h-4 w-4 text-muted-foreground" />
								Phone
							</Label>
							<Input
								id="primary_phone"
								name="primary_phone"
								type="tel"
								defaultValue={person.primary_phone || ""}
								placeholder="+1 (555) 123-4567"
								className="mt-1"
							/>
						</div>
					</div>
					<div>
						<Label htmlFor="website_url">
							<Globe className="mr-1.5 inline h-4 w-4 text-muted-foreground" />
							Website
						</Label>
						<Input
							id="website_url"
							name="website_url"
							type="url"
							defaultValue={person.website_url || ""}
							placeholder="https://example.com"
							className="mt-1"
						/>
					</div>
				</div>

				{/* Social Profiles */}
				<div className="space-y-4 rounded-lg border bg-muted/30 p-4">
					<h3 className="font-medium text-sm">Social Profiles</h3>
					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<Label htmlFor="linkedin_url">
								<Linkedin className="mr-1.5 inline h-4 w-4 text-muted-foreground" />
								LinkedIn
							</Label>
							<Input
								id="linkedin_url"
								name="linkedin_url"
								type="url"
								defaultValue={person.linkedin_url || ""}
								placeholder="https://linkedin.com/in/username"
								className="mt-1"
							/>
						</div>
						<div>
							<Label htmlFor="twitter">
								<Twitter className="mr-1.5 inline h-4 w-4 text-muted-foreground" />
								Twitter / X
							</Label>
							<Input
								id="twitter"
								name="twitter"
								type="text"
								defaultValue={existingContactInfo.twitter}
								placeholder="@username or URL"
								className="mt-1"
							/>
						</div>
					</div>
					<div>
						<Label htmlFor="instagram">
							<Instagram className="mr-1.5 inline h-4 w-4 text-muted-foreground" />
							Instagram
						</Label>
						<Input
							id="instagram"
							name="instagram"
							type="text"
							defaultValue={existingContactInfo.instagram}
							placeholder="@username or URL"
							className="mt-1"
						/>
					</div>
				</div>

				<div>
					<Label htmlFor="persona_id">Persona</Label>
					<Select name="persona_id" defaultValue={currentPersona?.id || "none"}>
						<SelectTrigger className="mt-1">
							<SelectValue placeholder="Select a persona" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="none">No persona</SelectItem>
							{personas.map((persona) => (
								<SelectItem key={persona.id} value={persona.id}>
									{persona.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div>
					<Label htmlFor="segment">Segment</Label>
					<Input
						id="segment"
						name="segment"
						type="text"
						defaultValue={person.segment || ""}
						placeholder="e.g., Customer, Prospect, Partner"
						className="mt-1"
					/>
				</div>

				<div>
					<Label htmlFor="description">Description</Label>
					<Textarea
						id="description"
						name="description"
						defaultValue={person.description || ""}
						placeholder="Additional notes about this person"
						className="mt-1"
						rows={4}
					/>
				</div>

				<div>
					<Label>Facets</Label>
					{/* Hidden inputs to submit selected facet refs */}
					{selectedFacetRefs.map((ref) => (
						<input key={ref} type="hidden" name="facetRefs" value={ref} />
					))}

					{/* Selected facets as badges */}
					{selectedFacetRefs.length > 0 && (
						<div className="mt-2 flex flex-wrap gap-1.5">
							{selectedFacetRefs.map((ref) => {
								const info = selectedFacetLabels.get(ref);
								return (
									<Badge key={ref} variant="secondary" className="gap-1 pr-1">
										<span className="text-muted-foreground text-xs">{info?.kind}:</span>
										{info?.label}
										<button
											type="button"
											onClick={() => removeFacet(ref)}
											className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
										>
											<X className="size-3" />
										</button>
									</Badge>
								);
							})}
						</div>
					)}

					{/* Popover + Command for selecting facets */}
					<Popover open={facetPopoverOpen} onOpenChange={setFacetPopoverOpen}>
						<PopoverTrigger asChild>
							<Button
								type="button"
								variant="outline"
								role="combobox"
								aria-expanded={facetPopoverOpen}
								className="mt-2 w-full justify-between"
							>
								{selectedFacetRefs.length === 0
									? "Select facets..."
									: `${selectedFacetRefs.length} facet${selectedFacetRefs.length === 1 ? "" : "s"} selected`}
								<ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-[400px] p-0" align="start">
							<Command>
								<CommandInput placeholder="Search facets..." />
								<CommandList>
									<CommandEmpty>No facets found.</CommandEmpty>
									{catalog.kinds.map((kind) => {
										const options = catalog.facets.filter((facet) => facet.kind_slug === kind.slug);
										if (!options.length) return null;
										return (
											<CommandGroup key={kind.slug} heading={kind.label}>
												{options.map((facet) => {
													const ref = `a:${facet.facet_account_id}`;
													const isSelected = selectedFacetRefs.includes(ref);
													return (
														<CommandItem
															key={facet.facet_account_id}
															value={`${kind.label} ${facet.alias || facet.label}`}
															onSelect={() => toggleFacet(ref)}
														>
															<Check className={`mr-2 size-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
															{facet.alias || facet.label}
														</CommandItem>
													);
												})}
											</CommandGroup>
										);
									})}
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
					<p className="mt-1 text-muted-foreground text-xs">
						Click to search and select facets. Click a badge to remove.
					</p>
				</div>

				<div className="rounded-lg border border-muted-foreground/40 border-dashed p-4">
					<h3 className="font-medium text-sm">Suggest New Facet</h3>
					<p className="mt-1 text-muted-foreground text-xs">
						Can't find the right facet? Add a candidate and it will appear in the review queue.
					</p>
					<div className="mt-4 grid gap-4 sm:grid-cols-2">
						<div>
							<Label htmlFor="newFacetKind">Facet Kind</Label>
							<select
								id="newFacetKind"
								name="newFacetKind"
								defaultValue=""
								className="mt-1 block w-full rounded-md border border-input bg-background p-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
							>
								<option value="">Select kind</option>
								{catalog.kinds.map((kind) => (
									<option key={kind.slug} value={kind.slug}>
										{kind.label}
									</option>
								))}
							</select>
						</div>
						<div>
							<Label htmlFor="newFacetLabel">Facet Label</Label>
							<Input
								id="newFacetLabel"
								name="newFacetLabel"
								placeholder="e.g., Prefers async updates"
								className="mt-1"
							/>
						</div>
					</div>
					<div className="mt-3 grid gap-4 sm:grid-cols-2">
						<div>
							<Label htmlFor="newFacetSynonyms">Synonyms</Label>
							<Input id="newFacetSynonyms" name="newFacetSynonyms" placeholder="Comma separated" className="mt-1" />
						</div>
						<div>
							<Label htmlFor="newFacetNotes">Notes</Label>
							<Input id="newFacetNotes" name="newFacetNotes" placeholder="Optional context" className="mt-1" />
						</div>
					</div>
				</div>

				{actionData?.error && (
					<div className="rounded-md bg-red-50 p-4">
						<p className="text-red-700 text-sm">{actionData.error}</p>
					</div>
				)}

				<div className="flex gap-4">
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting && !isDeleting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Updating...
							</>
						) : (
							"Update Person"
						)}
					</Button>
					<Button type="button" variant="outline" onClick={() => window.history.back()} disabled={isSubmitting}>
						Cancel
					</Button>
				</div>
			</Form>

			<div className="mt-12 border-t pt-8">
				<div className="rounded-lg border border-red-200 bg-red-50 p-4">
					<h3 className="mb-2 font-medium text-red-900">Danger Zone</h3>
					<p className="mb-4 text-red-700 text-sm">
						Deleting this person will permanently remove them and all associated data. This action cannot be undone.
					</p>
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button variant="destructive" size="sm" className="gap-2" disabled={isSubmitting}>
								<Trash2 className="h-4 w-4" />
								Delete Person
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
								<AlertDialogDescription>
									This action cannot be undone. This will permanently delete "{person.name}" and remove all associated
									data from our servers.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
								<Form method="post">
									<input type="hidden" name="intent" value="delete" />
									<AlertDialogAction
										type="submit"
										className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
										disabled={isDeleting}
									>
										{isDeleting ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Deleting...
											</>
										) : (
											"Delete Person"
										)}
									</AlertDialogAction>
								</Form>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</div>
		</PageContainer>
	);
}
