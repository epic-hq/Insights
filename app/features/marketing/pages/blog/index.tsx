import { ArrowRight, Clock, MessageSquare, Sparkles, User } from "lucide-react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router";
import { getPosts } from "~/lib/cms/payload.server";
import { formatDate, getReadingTime } from "~/lib/cms/utils";

export const meta: MetaFunction = () => {
	return [
		{ title: "Blog | Upsight - Customer Insights & Best Practices" },
		{
			name: "description",
			content:
				"Learn how to get more out of everyday conversations with customers, stakeholders and team-members. Build better relationships and products without friction and anxiety.",
		},
		{
			name: "keywords",
			content:
				"customer interviews, user research, product discovery, UX research, interview tips, customer insights, product management",
		},
		{ property: "og:title", content: "Blog | Upsight" },
		{
			property: "og:description",
			content: "Expert insights on customer interviews and user research.",
		},
		{ property: "og:type", content: "website" },
		{ property: "og:url", content: "https://getupsight.com/blog" },
	];
};

// Format post data on the server
function formatPostForClient(post: any) {
	// Use heroImage field from CMS
	const image = post.heroImage;
	const preferredImagePath = image?.sizes?.small?.url || image?.sizes?.thumbnail?.url || image?.url || null;
	const imageUrl = preferredImagePath ? `https://upsight-cms.vercel.app${preferredImagePath}` : null;
	const imageWidth = image?.sizes?.small?.width || image?.sizes?.thumbnail?.width || image?.width || undefined;
	const imageHeight = image?.sizes?.small?.height || image?.sizes?.thumbnail?.height || image?.height || undefined;

	const srcSetCandidates = [
		image?.sizes?.thumbnail?.url
			? `https://upsight-cms.vercel.app${image.sizes.thumbnail.url} ${image.sizes.thumbnail.width || 300}w`
			: null,
		image?.sizes?.small?.url
			? `https://upsight-cms.vercel.app${image.sizes.small.url} ${image.sizes.small.width || 600}w`
			: null,
		image?.url ? `https://upsight-cms.vercel.app${image.url} ${image.width || 1024}w` : null,
	].filter(Boolean) as string[];

	return {
		id: post.id,
		title: post.title,
		slug: post.slug,
		excerpt: post.meta?.description || post.excerpt,
		imageUrl,
		imageSrcSet: srcSetCandidates.length > 0 ? srcSetCandidates.join(", ") : null,
		imageWidth,
		imageHeight,
		imageAlt: image?.alt || post.title,
		publishedDate: formatDate(post.publishedAt),
		publishedDateISO: post.publishedAt,
		readingTime: getReadingTime(post.content),
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
	const limit = 12; // Posts per page

	try {
		const postsData = await getPosts({ limit, page });

		// Format all posts on the server
		const formattedPosts = postsData.docs.map(formatPostForClient);

		return {
			posts: formattedPosts,
			pagination: {
				currentPage: postsData.page,
				totalPages: postsData.totalPages,
				totalPosts: postsData.totalDocs,
				hasNextPage: postsData.hasNextPage,
				hasPrevPage: postsData.hasPrevPage,
			},
		};
	} catch (error) {
		console.error("Failed to fetch blog posts:", error);
		// Return empty state on error
		return {
			posts: [],
			pagination: {
				currentPage: 1,
				totalPages: 0,
				totalPosts: 0,
				hasNextPage: false,
				hasPrevPage: false,
			},
			error: "Failed to load blog posts. Please try again later.",
		};
	}
}

export default function BlogIndex() {
	const { posts, pagination, error } = useLoaderData<typeof loader>();

	return (
		<>
			{/* Compact Hero Header */}
			<section className="relative overflow-hidden border-slate-200 border-b bg-gradient-to-br from-zinc-900 via-stone-900 to-neutral-800 px-6 py-12 text-white md:py-16">
				<div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-black/10" />

				<div className="container relative mx-auto max-w-6xl">
					<div className="text-center">
						<div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
							<Sparkles className="h-3.5 w-3.5 text-amber-400" />
							<span className="font-medium text-xs">Insights & Best Practices</span>
						</div>

						<h1 className="mb-3 bg-gradient-to-r from-white via-white to-white/80 bg-clip-text font-bold text-4xl text-transparent tracking-tight md:text-5xl">
							Customer
							<span className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">
								{" "}
								Insights
							</span>
						</h1>

						<p className="mx-auto max-w-2xl text-base text-white/80 leading-relaxed md:text-lg">
							Learn how to get more out of everyday conversations with customers, stakeholders and team-members
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

					{posts.length === 0 && !error && (
						<div className="py-24 text-center">
							<div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
								<MessageSquare className="h-10 w-10 text-slate-400" />
							</div>
							<h3 className="mb-2 font-semibold text-2xl text-slate-900">No posts yet</h3>
							<p className="text-lg text-slate-600">Check back soon for expert insights and best practices</p>
						</div>
					)}

					{posts.length > 0 && (
						<>
							{/* Blog Grid - Show all posts in grid */}
							<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
								{posts.map((post, index) => (
									<BlogCard key={post.id} post={post} prioritizeImage={index === 0} />
								))}
							</div>

							{/* Pagination */}
							{pagination.totalPages > 1 && (
								<div className="mt-16 flex items-center justify-center gap-4">
									{pagination.hasPrevPage && (
										<Link
											to={`/blog?page=${pagination.currentPage - 1}`}
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
											to={`/blog?page=${pagination.currentPage + 1}`}
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

type FormattedPost = ReturnType<typeof formatPostForClient>;

// Blog Card
function BlogCard({ post, prioritizeImage }: { post: FormattedPost; prioritizeImage: boolean }) {
	return (
		<Link to={`/blog/${post.slug}`} className="group">
			<article className="hover:-translate-y-1 flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-xl">
				{/* Image */}
				<div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
					{post.imageUrl ? (
						<img
							src={post.imageUrl}
							srcSet={post.imageSrcSet || undefined}
							sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
							alt={post.imageAlt}
							width={post.imageWidth}
							height={post.imageHeight}
							loading={prioritizeImage ? "eager" : "lazy"}
							fetchPriority={prioritizeImage ? "high" : "auto"}
							decoding="async"
							className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
						/>
					) : (
						<div className="flex h-full items-center justify-center">
							<MessageSquare className="h-16 w-16 text-slate-300" />
						</div>
					)}
					<div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
				</div>

				{/* Content */}
				<div className="flex flex-1 flex-col p-6">
					<div className="mb-3 flex items-center gap-3 text-slate-500 text-sm">
						<div className="flex items-center gap-1">
							<Clock className="h-3.5 w-3.5" />
							<span>{post.readingTime} min</span>
						</div>
					</div>

					<h3 className="mb-3 line-clamp-2 font-bold text-slate-900 text-xl leading-tight transition-colors group-hover:text-amber-600">
						{post.title}
					</h3>

					{post.excerpt && <p className="mb-4 line-clamp-3 flex-1 text-slate-600 leading-relaxed">{post.excerpt}</p>}

					{post.author && (
						<div className="flex items-center gap-2 border-slate-100 border-t pt-4">
							{post.author.avatarUrl ? (
								<img src={post.author.avatarUrl} alt={post.author.name} className="h-8 w-8 rounded-full" />
							) : (
								<div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
									<User className="h-4 w-4 text-slate-400" />
								</div>
							)}
							<span className="font-medium text-slate-700 text-sm">{post.author.name}</span>
						</div>
					)}
				</div>
			</article>
		</Link>
	);
}
