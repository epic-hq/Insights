/**
 * User guide for importing people/contacts into UpSight CRM via CSV.
 * Covers standard fields, custom fields, membership data, and facets.
 */
import {
	AlertCircle,
	ArrowLeft,
	ArrowRight,
	CheckCircle2,
	Download,
	FileSpreadsheet,
	Settings2,
	Upload,
	Users,
} from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export default function ImportingPeopleGuide() {
	return (
		<div className="container mx-auto max-w-4xl px-4 py-12">
			<Link to="/docs">
				<Button variant="ghost" size="sm" className="mb-6">
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to Docs
				</Button>
			</Link>

			<div className="mb-2 flex items-center gap-2">
				<Badge variant="outline" className="text-xs">
					CRM
				</Badge>
				<Badge variant="outline" className="text-xs">
					Import
				</Badge>
			</div>

			<h1 className="mb-3 font-bold text-4xl tracking-tight">Import People & Organizations</h1>
			<p className="mb-10 text-lg text-muted-foreground">
				Bring your contacts, companies, and custom fields into UpSight so surveys, segmentation, and analysis all work
				from a single source of truth.
			</p>

			{/* Why Import */}
			<Card className="mb-8 border-primary/20 bg-primary/5">
				<CardContent className="pt-6">
					<p className="text-muted-foreground">
						Importing your contact list is the foundation for personalized surveys, smart branching, and meaningful
						segmentation. When UpSight knows who your respondents are before they open a survey, every interaction
						becomes more relevant.
					</p>
				</CardContent>
			</Card>

			<div className="space-y-10">
				{/* Step 1: Prepare Your CSV */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<FileSpreadsheet className="h-5 w-5 text-primary" />
							Step 1: Prepare Your Spreadsheet
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							Export your contacts from your CRM, mailing list, or spreadsheet as a CSV file. UpSight auto-detects
							columns, but using clear header names improves accuracy.
						</p>

						<div className="space-y-4">
							<h4 className="font-semibold text-foreground text-sm">Standard Fields (Auto-Detected)</h4>
							<div className="grid gap-3 md:grid-cols-2">
								<div className="rounded-lg border bg-muted/30 p-3">
									<h5 className="mb-2 font-medium text-foreground text-xs uppercase tracking-wide">Person</h5>
									<ul className="space-y-1 text-muted-foreground text-sm">
										<li>
											<code className="rounded bg-muted px-1 text-xs">Name</code> or{" "}
											<code className="rounded bg-muted px-1 text-xs">First Name</code> /{" "}
											<code className="rounded bg-muted px-1 text-xs">Last Name</code>
										</li>
										<li>
											<code className="rounded bg-muted px-1 text-xs">Email</code>
										</li>
										<li>
											<code className="rounded bg-muted px-1 text-xs">Phone</code>
										</li>
										<li>
											<code className="rounded bg-muted px-1 text-xs">Title</code> /{" "}
											<code className="rounded bg-muted px-1 text-xs">Job Title</code>
										</li>
										<li>
											<code className="rounded bg-muted px-1 text-xs">LinkedIn</code>
										</li>
										<li>
											<code className="rounded bg-muted px-1 text-xs">Location</code>
										</li>
									</ul>
								</div>
								<div className="rounded-lg border bg-muted/30 p-3">
									<h5 className="mb-2 font-medium text-foreground text-xs uppercase tracking-wide">Organization</h5>
									<ul className="space-y-1 text-muted-foreground text-sm">
										<li>
											<code className="rounded bg-muted px-1 text-xs">Company</code> /{" "}
											<code className="rounded bg-muted px-1 text-xs">Organization</code>
										</li>
										<li>
											<code className="rounded bg-muted px-1 text-xs">Industry</code>
										</li>
										<li>
											<code className="rounded bg-muted px-1 text-xs">Company Size</code>
										</li>
										<li>
											<code className="rounded bg-muted px-1 text-xs">Company Stage</code>
										</li>
										<li>
											<code className="rounded bg-muted px-1 text-xs">Annual Revenue</code>
										</li>
										<li>
											<code className="rounded bg-muted px-1 text-xs">Funding Stage</code> /{" "}
											<code className="rounded bg-muted px-1 text-xs">Total Funding</code>
										</li>
									</ul>
								</div>
							</div>

							<h4 className="font-semibold text-foreground text-sm">Segmentation Fields</h4>
							<p className="text-muted-foreground text-sm">
								These columns automatically become person facets, making them available for filtering and analysis:
							</p>
							<div className="rounded-lg border bg-muted/30 p-3">
								<ul className="grid grid-cols-2 gap-1 text-muted-foreground text-sm md:grid-cols-3">
									<li>
										<code className="rounded bg-muted px-1 text-xs">Segment</code>
									</li>
									<li>
										<code className="rounded bg-muted px-1 text-xs">Lifecycle Stage</code>
									</li>
									<li>
										<code className="rounded bg-muted px-1 text-xs">Role</code>
									</li>
									<li>
										<code className="rounded bg-muted px-1 text-xs">Industry</code>
									</li>
									<li>
										<code className="rounded bg-muted px-1 text-xs">Location</code>
									</li>
									<li>
										<code className="rounded bg-muted px-1 text-xs">Member Status</code>
									</li>
								</ul>
							</div>
						</div>

						<div className="rounded-lg border-amber-500 border-l-4 bg-amber-50 p-4 dark:bg-amber-950/20">
							<p className="font-medium text-sm">Example CSV</p>
							<pre className="mt-2 overflow-x-auto text-muted-foreground text-xs">
								{`Name,Email,Title,Company,Industry,Segment,Member Status,Membership Year
Jane Chen,jane@acme.co,VP Engineering,Acme Inc,SaaS,Enterprise,active,2025
Marcus Rivera,marcus@startup.io,CTO,Startup Labs,FinTech,Growth,true,2026`}
							</pre>
						</div>
					</CardContent>
				</Card>

				{/* Step 2: Custom Fields */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Settings2 className="h-5 w-5 text-primary" />
							Step 2: Include Custom Fields
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							Any column that isn't a standard CRM field can be imported as a <strong>facet</strong> -- a flexible tag
							that attaches to each person. Facets power filtering, segmentation, and survey personalization.
						</p>

						<h4 className="font-semibold text-foreground text-sm">Common Custom Fields</h4>
						<div className="space-y-2">
							<div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
								<Badge variant="secondary" className="mt-0.5 shrink-0 text-xs">
									Membership
								</Badge>
								<div>
									<p className="font-medium text-foreground text-sm">Member Status, Membership Year, Expiration Date</p>
									<p className="text-muted-foreground text-xs">
										Track association/community membership alongside contacts. These become durable facets you can
										filter and segment on.
									</p>
								</div>
							</div>
							<div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
								<Badge variant="secondary" className="mt-0.5 shrink-0 text-xs">
									Events
								</Badge>
								<div>
									<p className="font-medium text-foreground text-sm">Event Attended, RSVP Status, Session Preference</p>
									<p className="text-muted-foreground text-xs">
										Import event registration data to personalize follow-up surveys.
									</p>
								</div>
							</div>
							<div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
								<Badge variant="secondary" className="mt-0.5 shrink-0 text-xs">
									Product
								</Badge>
								<div>
									<p className="font-medium text-foreground text-sm">Plan, Feature Flags, NPS Score</p>
									<p className="text-muted-foreground text-xs">
										Product usage data enables targeted research surveys scoped to specific user tiers.
									</p>
								</div>
							</div>
						</div>

						<div className="rounded-lg border-blue-500 border-l-4 bg-blue-50 p-4 dark:bg-blue-950/20">
							<p className="font-medium text-sm">How custom fields become facets</p>
							<p className="mt-1 text-muted-foreground text-sm">
								When UpSight's AI analyzes your CSV headers, it suggests which extra columns to import as facets and
								assigns a facet kind (e.g., <code className="rounded bg-muted px-1 text-xs">membership_status</code>,{" "}
								<code className="rounded bg-muted px-1 text-xs">event</code>,{" "}
								<code className="rounded bg-muted px-1 text-xs">custom</code>). You can also specify custom mappings via
								the API.
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Step 3: Upload */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Upload className="h-5 w-5 text-primary" />
							Step 3: Upload & Review
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">There are two ways to import contacts:</p>

						<div className="grid gap-4 md:grid-cols-2">
							<div className="rounded-lg border p-4">
								<h4 className="mb-2 font-semibold text-foreground text-sm">Chat Import</h4>
								<p className="mb-3 text-muted-foreground text-sm">
									Paste CSV data into the project chat. The AI assistant will parse it, show you a preview, and ask if
									you'd like to import.
								</p>
								<ol className="space-y-1 text-muted-foreground text-sm">
									<li className="flex items-start gap-2">
										<span className="font-medium text-primary">1.</span> Open project chat
									</li>
									<li className="flex items-start gap-2">
										<span className="font-medium text-primary">2.</span> Paste your CSV data
									</li>
									<li className="flex items-start gap-2">
										<span className="font-medium text-primary">3.</span> Review the column mapping
									</li>
									<li className="flex items-start gap-2">
										<span className="font-medium text-primary">4.</span> Confirm import
									</li>
								</ol>
							</div>
							<div className="rounded-lg border p-4">
								<h4 className="mb-2 font-semibold text-foreground text-sm">API Import</h4>
								<p className="mb-3 text-muted-foreground text-sm">
									Use the <code className="rounded bg-muted px-1 text-xs">POST /api/people/import-csv</code> endpoint
									for programmatic imports from scripts or integrations.
								</p>
								<ol className="space-y-1 text-muted-foreground text-sm">
									<li className="flex items-start gap-2">
										<span className="font-medium text-primary">1.</span> POST CSV as multipart or JSON
									</li>
									<li className="flex items-start gap-2">
										<span className="font-medium text-primary">2.</span> Auto-detects columns via AI
									</li>
									<li className="flex items-start gap-2">
										<span className="font-medium text-primary">3.</span> Returns import summary + verification
									</li>
									<li className="flex items-start gap-2">
										<span className="font-medium text-primary">4.</span> Supports create or upsert modes
									</li>
								</ol>
							</div>
						</div>

						<h4 className="font-semibold text-foreground text-sm">Import Modes</h4>
						<div className="space-y-2">
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-muted-foreground text-sm">
									<strong className="text-foreground">Create</strong> (default) -- adds new contacts, skips rows where
									email or name+company already exists
								</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-muted-foreground text-sm">
									<strong className="text-foreground">Upsert</strong> -- matches by email or name+company, updates only
									fields with values in the spreadsheet (preserves existing data for unmapped fields)
								</span>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Step 4: What Happens Next */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="h-5 w-5 text-primary" />
							What Happens After Import
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">Once your contacts are imported, they're immediately operational:</p>
						<div className="space-y-3">
							<div className="flex items-start gap-3">
								<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
								<div>
									<p className="font-medium text-foreground text-sm">Visible in People</p>
									<p className="text-muted-foreground text-xs">
										Browse, search, and filter contacts with all imported fields and facets
									</p>
								</div>
							</div>
							<div className="flex items-start gap-3">
								<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
								<div>
									<p className="font-medium text-foreground text-sm">Facets for segmentation</p>
									<p className="text-muted-foreground text-xs">
										Custom fields appear as facets -- filter by membership status, segment, role, or any imported
										attribute
									</p>
								</div>
							</div>
							<div className="flex items-start gap-3">
								<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
								<div>
									<p className="font-medium text-foreground text-sm">Survey personalization</p>
									<p className="text-muted-foreground text-xs">
										When a respondent starts a survey, UpSight matches them by email and uses their profile to
										personalize the experience
									</p>
								</div>
							</div>
							<div className="flex items-start gap-3">
								<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
								<div>
									<p className="font-medium text-foreground text-sm">Linked to organizations</p>
									<p className="text-muted-foreground text-xs">
										Company columns automatically create or match organization records, with full org metadata
									</p>
								</div>
							</div>
						</div>

						<div className="rounded-lg border-primary border-l-4 bg-primary/5 p-4">
							<div className="flex items-center gap-2">
								<p className="font-medium text-sm">Coming Soon: Attribute-Based Branching</p>
								<Badge variant="secondary" className="text-xs">
									In Development
								</Badge>
							</div>
							<p className="mt-1 text-muted-foreground text-sm">
								Imported person attributes (title, segment, membership status) will be usable as branching conditions in
								surveys. For example: skip a section for non-members, or show different questions based on job function
								-- without asking the respondent again.{" "}
								<span className="text-foreground">
									This feature is being built on the{" "}
									<code className="rounded bg-muted px-1 text-xs">feat/person-attribute-branching</code> branch.
								</span>
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Duplicate Handling */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<AlertCircle className="h-5 w-5 text-amber-500" />
							Duplicate Handling & Data Safety
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-3">
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-muted-foreground text-sm">
									<strong className="text-foreground">Email matching:</strong> existing contacts are matched by email
									(case-insensitive)
								</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-muted-foreground text-sm">
									<strong className="text-foreground">Name + company fallback:</strong> if no email, matches by name and
									organization
								</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-muted-foreground text-sm">
									<strong className="text-foreground">Upsert preserves data:</strong> only fields with values in your
									CSV overwrite existing data -- blank cells are ignored
								</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-muted-foreground text-sm">
									<strong className="text-foreground">Integrity verification:</strong> after import, UpSight checks that
									all records, org links, and facets were created correctly
								</span>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Next Steps */}
				<Card className="border-primary/20 bg-primary/5">
					<CardHeader>
						<CardTitle>Next Steps</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<ul className="space-y-2 text-muted-foreground text-sm">
							<li className="flex items-start gap-2">
								<ArrowRight className="mt-0.5 h-4 w-4 text-primary" />
								<span>
									<Link to="/docs/sending-surveys" className="text-primary underline">
										Send personalized surveys
									</Link>{" "}
									to your imported contacts via email or direct link
								</span>
							</li>
							<li className="flex items-start gap-2">
								<ArrowRight className="mt-0.5 h-4 w-4 text-primary" />
								<span>
									Use <strong className="text-foreground">People &rarr; Filters</strong> to create segments from
									imported facets
								</span>
							</li>
							<li className="flex items-start gap-2">
								<ArrowRight className="mt-0.5 h-4 w-4 text-primary" />
								<span>
									<Link to="/docs/analyzing-insights" className="text-primary underline">
										Analyze survey results
									</Link>{" "}
									with segmentation by imported attributes
								</span>
							</li>
						</ul>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
