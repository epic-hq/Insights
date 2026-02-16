import { ArrowLeft, Award, Building2, Calendar, Clock, TrendingUp } from "lucide-react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router";
import { getPostBySlug } from "~/lib/cms/payload.server";
import { formatDate, getImageUrl, getReadingTime } from "~/lib/cms/utils";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data?.caseStudy) {
		return [{ title: "Case Study Not Found | Upsight" }];
	}

	const { caseStudy } = data;
	const seoTitle = caseStudy.seo?.title || `${caseStudy.title} - Case Study | Upsight`;
	const seoDescription =
		caseStudy.seo?.description ||
		caseStudy.excerpt ||
		`Read how ${caseStudy.company || "this team"} achieved success with Upsight`;
	const seoImage = caseStudy.seo?.image;

	return [
		{ title: seoTitle },
		{ name: "description", content: seoDescription },
		{ property: "og:title", content: seoTitle },
		{ property: "og:description", content: seoDescription },
		{ property: "og:type", content: "article" },
		{ property: "og:url", content: `https://getupsight.com/case-studies/${caseStudy.slug}` },
		{
			tagName: "link",
			rel: "canonical",
			href: `https://getupsight.com/case-studies/${caseStudy.slug}`,
		},
		...(seoImage ? [{ property: "og:image", content: getImageUrl(seoImage) }] : []),
	];
};

export async function loader({ params }: LoaderFunctionArgs) {
	const { caseStudyId } = params;

	if (!caseStudyId) {
		throw new Response("Case study ID is required", { status: 400 });
	}

	const caseStudy = await getPostBySlug(caseStudyId);

	if (!caseStudy) {
		throw new Response("Case study not found", { status: 404 });
	}

	return { caseStudy };
}

export default function CaseStudyDetail() {
	const { caseStudy } = useLoaderData<typeof loader>();

	const imageUrl = getImageUrl(caseStudy.featured_image);
	const publishedDate = formatDate(caseStudy.publishedAt);
	const readingTime = getReadingTime(caseStudy.content);

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
			{/* Hero Section */}
			<section className="relative overflow-hidden border-slate-200 border-b bg-gradient-to-br from-zinc-900 via-stone-900 to-neutral-800 px-6 py-16 text-white md:py-24">
				<div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />

				<div className="container relative mx-auto max-w-4xl">
					{/* Back Button */}
					<Link
						to="/case-studies"
						className="mb-8 inline-flex items-center gap-2 text-sm text-white/80 transition-colors hover:text-white"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to Case Studies
					</Link>

					{/* Badge */}
					<div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
						<Award className="h-3.5 w-3.5 text-amber-400" />
						<span className="font-medium text-xs">Success Story</span>
					</div>

					{/* Company Info */}
					{(caseStudy.company || caseStudy.industry) && (
						<div className="mb-4 flex items-center gap-3 text-sm text-white/80">
							<Building2 className="h-4 w-4" />
							{caseStudy.company && <span className="font-semibold">{caseStudy.company}</span>}
							{caseStudy.industry && (
								<>
									<span>•</span>
									<span>{caseStudy.industry}</span>
								</>
							)}
						</div>
					)}

					{/* Title */}
					<h1 className="mb-6 font-bold text-4xl text-white leading-tight md:text-5xl lg:text-6xl">
						{caseStudy.title}
					</h1>

					{/* Excerpt */}
					{caseStudy.excerpt && (
						<p className="mb-8 text-lg text-white/90 leading-relaxed md:text-xl">{caseStudy.excerpt}</p>
					)}

					{/* Meta Info */}
					<div className="flex flex-wrap items-center gap-4 text-sm text-white/70">
						<div className="flex items-center gap-2">
							<Calendar className="h-4 w-4" />
							<time dateTime={caseStudy.publishedAt}>{publishedDate}</time>
						</div>
						<span>•</span>
						<div className="flex items-center gap-2">
							<Clock className="h-4 w-4" />
							<span>{readingTime} min read</span>
						</div>
					</div>
				</div>
			</section>

			{/* Featured Image */}
			{caseStudy.featured_image && (
				<section className="border-slate-200 border-b bg-white">
					<div className="container mx-auto max-w-5xl px-6 py-12">
						<div className="overflow-hidden rounded-2xl shadow-2xl">
							<img
								src={imageUrl}
								alt={caseStudy.featured_image.alt || caseStudy.title}
								className="h-auto w-full object-cover"
							/>
						</div>
					</div>
				</section>
			)}

			{/* Results Highlight */}
			{caseStudy.results && (
				<section className="border-slate-200 border-b bg-gradient-to-br from-green-50 to-emerald-50 px-6 py-12">
					<div className="container mx-auto max-w-4xl">
						<div className="rounded-2xl border border-green-200 bg-white p-8 shadow-lg md:p-12">
							<div className="mb-4 flex items-center gap-3">
								<div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
									<TrendingUp className="h-6 w-6 text-green-600" />
								</div>
								<h2 className="font-bold text-2xl text-slate-900">Key Results</h2>
							</div>
							<div className="text-lg text-slate-700 leading-relaxed">{caseStudy.results}</div>
						</div>
					</div>
				</section>
			)}

			{/* Content */}
			<article className="px-6 py-16">
				<div className="prose prose-slate prose-lg mx-auto max-w-4xl">
					{/* biome-ignore lint/security/noDangerouslySetInnerHtml: CMS content is trusted */}
					<div dangerouslySetInnerHTML={{ __html: caseStudy.content }} />
				</div>
			</article>

			{/* Author */}
			{caseStudy.author && (
				<section className="border-slate-200 border-t bg-white px-6 py-12">
					<div className="container mx-auto max-w-4xl">
						<div className="flex items-center gap-4">
							{caseStudy.author.avatar && (
								<img
									src={getImageUrl(caseStudy.author.avatar)}
									alt={caseStudy.author.name}
									className="h-16 w-16 rounded-full"
								/>
							)}
							<div>
								<div className="font-semibold text-slate-900">{caseStudy.author.name}</div>
								{caseStudy.author.bio && <div className="text-slate-600 text-sm">{caseStudy.author.bio}</div>}
							</div>
						</div>
					</div>
				</section>
			)}

			{/* CTA Section */}
			<section className="border-slate-200 border-t bg-gradient-to-br from-amber-50 to-orange-50 px-6 py-16">
				<div className="container mx-auto max-w-4xl text-center">
					<h2 className="mb-4 font-bold text-3xl text-slate-900">Ready to achieve similar results?</h2>
					<p className="mb-8 text-lg text-slate-600">
						Join hundreds of teams using Upsight to transform customer conversations into breakthrough insights
					</p>
					<Link
						to="/auth/register"
						className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-4 font-semibold text-lg text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
					>
						Start Free Trial
						<Award className="h-5 w-5" />
					</Link>
				</div>
			</section>
		</div>
	);
}
