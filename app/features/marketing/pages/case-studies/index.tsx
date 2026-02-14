import { ArrowRight, Award, Building2, Clock, Sparkles, TrendingUp } from "lucide-react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router";
import { getServerEnv } from "~/env.server";
import { formatDate, getReadingTime } from "~/lib/cms/utils";

export const meta: MetaFunction = () => {
	return [
		{ title: "Case Studies | Upsight - Real Customer Success Stories" },
		{
			name: "description",
			content:
				"Discover how teams use Upsight to transform customer conversations into actionable insights. Real stories, real results.",
		},
		{
			name: "keywords",
			content:
				"customer success stories, case studies, user research examples, customer interview results, product discovery case studies",
		},
		{ property: "og:title", content: "Case Studies | Upsight" },
		{
			property: "og:description",
			content: "Real customer success stories and results.",
		},
		{ property: "og:type", content: "website" },
		{ property: "og:url", content: "https://getupsight.com/case-studies" },
	];
};

// Format case study data on the server
function formatCaseStudyForClient(post: any) {
	// Use heroImage field from CMS
	const image = post.heroImage;
	const imageUrl = image?.url ? `https://upsight-cms.vercel.app${image.url}` : null;

	return {
		id: post.id,
		title: post.title,
		slug: post.slug,
		excerpt: post.meta?.description || post.excerpt,
		imageUrl,
		imageAlt: image?.alt || post.title,
		publishedDate: formatDate(post.publishedAt),
		publishedDateISO: post.publishedAt,
		readingTime: getReadingTime(post.content),
		// Extract custom fields for case studies
		company: post.company || null,
		industry: post.industry || null,
		results: post.results || null,
		author: post.populatedAuthors?.[0]
			? {
					name: post.populatedAuthors[0].name,
					avatarUrl: null,
				}
			: null,
	};
}

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const page = Number.parseInt(url.searchParams.get("page") || "1", 10);
	const limit = 12; // Case studies per page

	try {
		// Fetch from case-studies endpoint (separate from blog posts)
		const env = getServerEnv();
		const params = new URLSearchParams({
			limit: limit.toString(),
			page: page.toString(),
			where: JSON.stringify({ status: { equals: "published" } }),
			sort: "-publishedAt",
		});

		const response = await fetch(`${env.PAYLOAD_CMS_URL}/api/case-studies?${params}`, {
			headers: { "Content-Type": "application/json" },
		});

		// If endpoint doesn't exist yet, return empty state
		if (!response.ok) {
			console.log("Case studies endpoint not ready yet, returning empty state");
			return {
				caseStudies: [],
				pagination: {
					currentPage: 1,
					totalPages: 0,
					totalCaseStudies: 0,
					hasNextPage: false,
					hasPrevPage: false,
				},
			};
		}

		const postsData = await response.json();

		// Format all case studies on the server
		const formattedCaseStudies = postsData.docs.map(formatCaseStudyForClient);

		return {
			caseStudies: formattedCaseStudies,
			pagination: {
				currentPage: postsData.page,
				totalPages: postsData.totalPages,
				totalCaseStudies: postsData.totalDocs,
				hasNextPage: postsData.hasNextPage,
				hasPrevPage: postsData.hasPrevPage,
			},
		};
	} catch (error) {
		console.error("Failed to fetch case studies:", error);
		// Return empty state on error
		return {
			caseStudies: [],
			pagination: {
				currentPage: 1,
				totalPages: 0,
				totalCaseStudies: 0,
				hasNextPage: false,
				hasPrevPage: false,
			},
			error: "Failed to load case studies. Please try again later.",
		};
	}
}

export default function CaseStudiesIndex() {
	const { caseStudies, pagination, error } = useLoaderData<typeof loader>();

	return (
		<>
			{/* Compact Hero Header */}
			<section className="relative overflow-hidden border-slate-200 border-b bg-gradient-to-br from-zinc-900 via-stone-900 to-neutral-800 px-6 py-12 text-white md:py-16">
				<div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-black/10" />

				<div className="container relative mx-auto max-w-6xl">
					<div className="text-center">
						<div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
							<Award className="h-3.5 w-3.5 text-amber-400" />
							<span className="font-medium text-xs">Success Stories</span>
						</div>

						<h1 className="mb-3 bg-gradient-to-r from-white via-white to-white/80 bg-clip-text font-bold text-4xl text-transparent tracking-tight md:text-5xl">
							Real Teams,
							<span className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">
								{" "}
								Real Results
							</span>
						</h1>

						<p className="mx-auto max-w-2xl text-base text-white/80 leading-relaxed md:text-lg">
							Discover how teams transform customer conversations into breakthrough insights and build products people
							love
						</p>
					</div>
				</div>
			</section>

			{/* Content Section */}
			<section className="px-6 py-16 md:py-24">
				<div className="container mx-auto max-w-7xl">
					{error && (
						<div className="mb-12 rounded-2xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
							<p className="font-medium text-red-900">{error}</p>
						</div>
					)}

					{caseStudies.length === 0 && !error && (
						<div className="py-24 text-center">
							<div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
								<Building2 className="h-10 w-10 text-slate-400" />
							</div>
							<h3 className="mb-2 font-semibold text-2xl text-slate-900">Case Studies Coming Soon</h3>
							<p className="text-lg text-slate-600">
								We're working on publishing customer success stories. Check back soon to see how teams are using
								Upsight!
							</p>
						</div>
					)}

					{caseStudies.length > 0 && (
						<>
							{/* Featured Case Study (First one) */}
							{caseStudies[0] && (
								<div className="mb-16">
									<FeaturedCaseStudyCard caseStudy={caseStudies[0]} />
								</div>
							)}

							{/* Case Studies Grid */}
							<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
								{caseStudies.slice(1).map((caseStudy) => (
									<CaseStudyCard key={caseStudy.id} caseStudy={caseStudy} />
								))}
							</div>

							{/* Pagination */}
							{pagination.totalPages > 1 && (
								<div className="mt-16 flex items-center justify-center gap-4">
									{pagination.hasPrevPage && (
										<Link
											to={`/case-studies?page=${pagination.currentPage - 1}`}
											className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 font-medium text-slate-900 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
										>
											<ArrowRight className="group-hover:-translate-x-1 h-4 w-4 rotate-180 transition-transform" />
											Previous
										</Link>
									)}

									<div className="flex items-center gap-2">
										<span className="font-medium text-slate-900">Page {pagination.currentPage}</span>
										<span className="text-slate-400">of</span>
										<span className="font-medium text-slate-900">{pagination.totalPages}</span>
									</div>

									{pagination.hasNextPage && (
										<Link
											to={`/case-studies?page=${pagination.currentPage + 1}`}
											className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 font-medium text-slate-900 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
										>
											Next
											<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
										</Link>
									)}
								</div>
							)}
						</>
					)}
				</div>
			</section>
		</>
	);
}

type FormattedCaseStudy = ReturnType<typeof formatCaseStudyForClient>;

// Featured Case Study Card (Large, prominent)
function FeaturedCaseStudyCard({ caseStudy }: { caseStudy: FormattedCaseStudy }) {
	return (
		<Link to={`/case-studies/${caseStudy.slug}`} className="group">
			<article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl transition-all duration-300 hover:shadow-2xl">
				<div className="grid gap-0 md:grid-cols-5">
					{/* Image */}
					<div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-amber-100 to-orange-200 md:col-span-2 md:aspect-auto">
						{caseStudy.imageUrl ? (
							<img
								src={caseStudy.imageUrl}
								alt={caseStudy.imageAlt}
								className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
							/>
						) : (
							<div className="flex h-full items-center justify-center">
								<Building2 className="h-24 w-24 text-amber-300" />
							</div>
						)}
						<div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
					</div>

					{/* Content */}
					<div className="flex flex-col justify-center p-8 md:col-span-3 md:p-12">
						<div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-900 text-xs uppercase tracking-wide">
							<Sparkles className="h-3 w-3" />
							Featured Case Study
						</div>

						{caseStudy.company && (
							<div className="mb-2 flex items-center gap-2 text-slate-600 text-sm">
								<Building2 className="h-4 w-4" />
								<span className="font-semibold">{caseStudy.company}</span>
								{caseStudy.industry && (
									<>
										<span>•</span>
										<span>{caseStudy.industry}</span>
									</>
								)}
							</div>
						)}

						<h2 className="mb-4 font-bold text-3xl text-slate-900 leading-tight transition-colors group-hover:text-amber-600 md:text-4xl">
							{caseStudy.title}
						</h2>

						{caseStudy.excerpt && (
							<p className="mb-6 line-clamp-3 text-lg text-slate-600 leading-relaxed">{caseStudy.excerpt}</p>
						)}

						{caseStudy.results && (
							<div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
								<div className="flex items-start gap-2">
									<TrendingUp className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
									<div>
										<div className="mb-1 font-semibold text-green-900 text-sm">Key Results</div>
										<div className="text-green-800 text-sm">{caseStudy.results}</div>
									</div>
								</div>
							</div>
						)}

						<div className="flex flex-wrap items-center gap-4 text-slate-500 text-sm">
							<div className="flex items-center gap-2">
								<Clock className="h-4 w-4" />
								<span>{caseStudy.readingTime} min read</span>
							</div>
							<span>•</span>
							<time dateTime={caseStudy.publishedDateISO}>{caseStudy.publishedDate}</time>
						</div>

						<div className="mt-6 inline-flex items-center gap-2 font-semibold text-amber-600 transition-gap group-hover:gap-3">
							Read case study
							<ArrowRight className="h-5 w-5" />
						</div>
					</div>
				</div>
			</article>
		</Link>
	);
}

// Regular Case Study Card
function CaseStudyCard({ caseStudy }: { caseStudy: FormattedCaseStudy }) {
	return (
		<Link to={`/case-studies/${caseStudy.slug}`} className="group">
			<article className="hover:-translate-y-1 flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-xl">
				{/* Image */}
				<div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-amber-100 to-orange-200">
					{caseStudy.imageUrl ? (
						<img
							src={caseStudy.imageUrl}
							alt={caseStudy.imageAlt}
							className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
						/>
					) : (
						<div className="flex h-full items-center justify-center">
							<Building2 className="h-16 w-16 text-amber-300" />
						</div>
					)}
					<div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
				</div>

				{/* Content */}
				<div className="flex flex-1 flex-col p-6">
					{caseStudy.company && (
						<div className="mb-3 flex items-center gap-2 text-slate-600 text-xs">
							<Building2 className="h-3.5 w-3.5" />
							<span className="font-semibold">{caseStudy.company}</span>
							{caseStudy.industry && (
								<>
									<span>•</span>
									<span>{caseStudy.industry}</span>
								</>
							)}
						</div>
					)}

					<h3 className="mb-3 line-clamp-2 font-bold text-slate-900 text-xl leading-tight transition-colors group-hover:text-amber-600">
						{caseStudy.title}
					</h3>

					{caseStudy.excerpt && (
						<p className="mb-4 line-clamp-3 flex-1 text-slate-600 leading-relaxed">{caseStudy.excerpt}</p>
					)}

					{caseStudy.results && (
						<div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
							<div className="flex items-start gap-2">
								<TrendingUp className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
								<div className="line-clamp-2 text-green-800 text-xs">{caseStudy.results}</div>
							</div>
						</div>
					)}

					<div className="flex items-center gap-3 border-slate-100 border-t pt-4 text-slate-500 text-sm">
						<div className="flex items-center gap-1">
							<Clock className="h-3.5 w-3.5" />
							<span>{caseStudy.readingTime} min</span>
						</div>
						<span>•</span>
						<time dateTime={caseStudy.publishedDateISO}>{caseStudy.publishedDate}</time>
					</div>
				</div>
			</article>
		</Link>
	);
}
