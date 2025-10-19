import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useLoaderData } from "react-router"
import type { PayloadPost } from "~/lib/cms/payload.server"
import { getPostBySlug, getRecentPosts } from "~/lib/cms/payload.server"
import { formatDate, getImageUrl, getReadingTime, lexicalToHtml } from "~/lib/cms/utils"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data?.post) {
		return [{ title: "Post Not Found | Upsight" }]
	}

	const { post } = data
	const seoTitle = post.seo?.title || post.title
	const seoDescription = post.seo?.description || post.excerpt || `Read ${post.title} on the Upsight blog`
	const seoImage = post.seo?.image
		? getImageUrl(post.seo.image)
		: post.featured_image
			? getImageUrl(post.featured_image)
			: undefined

	return [
		{ title: `${seoTitle} | Upsight Blog` },
		{ name: "description", content: seoDescription },
		{ name: "keywords", content: post.seo?.keywords || "" },
		{ property: "og:title", content: seoTitle },
		{ property: "og:description", content: seoDescription },
		{ property: "og:type", content: "article" },
		{ property: "og:url", content: `https://getupsight.com/blog/${post.slug}` },
		...(seoImage ? [{ property: "og:image", content: seoImage }] : []),
		{ property: "article:published_time", content: post.publishedAt },
		{ property: "article:modified_time", content: post.updatedAt },
		...(post.author ? [{ property: "article:author", content: post.author.name }] : []),
	]
}

export async function loader({ params }: LoaderFunctionArgs) {
	const { blogId } = params

	if (!blogId) {
		throw new Response("Not Found", { status: 404 })
	}

	try {
		const [post, recentPosts] = await Promise.all([getPostBySlug(blogId), getRecentPosts(5)])

		if (!post) {
			throw new Response("Post Not Found", { status: 404 })
		}

		// Convert Lexical content to HTML in the loader
		const htmlContent = await lexicalToHtml(post.content)

		// Filter out current post from recent posts
		const filteredRecentPosts = recentPosts.filter((p) => p.id !== post.id).slice(0, 4)

		return {
			post,
			htmlContent,
			recentPosts: filteredRecentPosts,
		}
	} catch (error) {
		console.error("Failed to fetch blog post:", error)
		throw new Response("Failed to load blog post", { status: 500 })
	}
}

export default function BlogPost() {
	const { post, htmlContent, recentPosts } = useLoaderData<typeof loader>()

	const heroImageUrl: string | undefined = post.heroImage?.url
		? post.heroImage.url.startsWith("/")
			? `https://upsight-cms.vercel.app${post.heroImage.url}`
			: post.heroImage.url
		: undefined
	const imageUrl: string | undefined =
		heroImageUrl ?? (post.featured_image ? getImageUrl(post.featured_image) || undefined : undefined)
	const readingTime = getReadingTime(post.content)

	// Structured data for SEO
	const structuredData = {
		"@context": "https://schema.org",
		"@type": "BlogPosting",
		headline: post.title,
		image: imageUrl || undefined,
		datePublished: post.publishedAt,
		dateModified: post.updatedAt,
		author: post.author
			? {
				"@type": "Person",
				name: post.author.name,
			}
			: undefined,
		publisher: {
			"@type": "Organization",
			name: "Upsight",
			logo: {
				"@type": "ImageObject",
				url: "https://getupsight.com/logo.png",
			},
		},
		description: post.excerpt || post.seo?.description,
	}

	return (
		<>
			{/* Structured Data */}
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

			<div className="bg-background">
				{/* Hero */}
				{imageUrl && (
					<section className="relative h-[56vh] min-h-[360px] w-full">
						<img
							src={imageUrl!}
							alt={(post.heroImage?.alt || post.featured_image?.alt || post.title) as string}
							className="absolute inset-0 h-full w-full object-cover"
						/>
						<div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-black/80" />
						<div className="absolute inset-0 z-10 flex items-end pb-20">
							<div className="mx-auto w-full max-w-4xl px-6 pb-10">
								{post.tags?.length ? (
									<div className="mb-3 font-semibold text-white/80 text-xs uppercase tracking-wider">{post.tags[0]}</div>
								) : null}
								<h1 className="mb-4 font-bold text-3xl text-white md:text-5xl">{post.title}</h1>
								<div className="flex items-center gap-3 text-sm text-white/80">
									<span>{formatDate(post.publishedAt)}</span>
									<span>•</span>
									<span>{readingTime} min read</span>
								</div>
							</div>
						</div>
					</section>
				)}
				{/* Header */}
				<article className="mx-auto max-w-4xl px-6 py-16">
					{/* Breadcrumb */}
					<nav className="mb-8 flex items-center gap-2 text-muted-foreground text-sm">
						<Link to="/" className="hover:text-foreground">
							Home
						</Link>
						<span>→</span>
						<Link to="/blog" className="hover:text-foreground">
							Blog
						</Link>
					</nav>

					{/* Title */}
					{!imageUrl && (
						<h1 className="mb-6 font-bold text-4xl text-foreground tracking-tight md:text-5xl">{post.title}</h1>
					)}

					{/* Meta */}
					{!imageUrl && (
						<div className="mb-8 flex flex-wrap items-center gap-4 text-muted-foreground">
							{post.author && (
								<div className="flex items-center gap-2">
									{post.author.avatar && (
										<img
											src={getImageUrl(post.author.avatar)}
											alt={post.author.name}
											className="h-10 w-10 rounded-full"
										/>
									)}
									<span className="font-medium text-foreground">{post.author.name}</span>
								</div>
							)}
							<span>•</span>
							<span>{readingTime} min read</span>
						</div>
					)}

					{/* Featured Image */}
					{!imageUrl && <div className="mb-12 overflow-hidden rounded-lg">{/* no image available */}</div>}

					{/* Content */}
					{/* biome-ignore lint/security/noDangerouslySetInnerHtml: CMS content is trusted */}
					<div
						className="prose prose-slate prose-lg mx-auto prose-p:mb-0 max-w-none space-y-6 prose-code:rounded prose-img:rounded-xl prose-blockquote:border-l-amber-500 prose-blockquote:bg-amber-50 prose-code:bg-slate-100 prose-pre:bg-slate-900 prose-code:px-1.5 prose-blockquote:py-1 prose-code:py-0.5 prose-blockquote:pl-4 prose-a:font-medium prose-code:font-mono prose-headings:font-bold prose-strong:font-semibold prose-a:text-amber-600 prose-blockquote:text-slate-700 prose-code:text-slate-800 prose-code:text-sm prose-em:text-slate-700 prose-headings:text-slate-900 prose-li:text-slate-700 prose-ol:text-slate-700 prose-p:text-slate-700 prose-pre:text-slate-100 prose-strong:text-slate-900 prose-ul:text-slate-700 prose-p:leading-relaxed prose-headings:tracking-tight prose-a:no-underline prose-img:shadow-lg prose-li:marker:text-amber-500 prose-code:before:content-none prose-code:after:content-none hover:prose-a:underline [&>blockquote]:my-8 [&>h1]:mt-10 [&>h2]:mt-8 [&>h3]:mt-6 [&>img]:my-6 [&>ol]:my-6 [&>p]:my-6 [&>ul]:my-6"
						dangerouslySetInnerHTML={{ __html: htmlContent }}
					/>

					{/* Tags */}
					{post.tags && post.tags.length > 0 && (
						<div className="mt-12 flex flex-wrap gap-2">
							{post.tags.map((tag) => (
								<span
									key={tag}
									className="rounded-full border border-border bg-accent px-3 py-1 text-muted-foreground text-sm"
								>
									{tag}
								</span>
							))}
						</div>
					)}

					{/* Author Bio */}
					{post.author?.bio && (
						<div className="mt-12 rounded-lg border bg-card p-6">
							<div className="flex items-start gap-4">
								{post.author.avatar && (
									<img
										src={getImageUrl(post.author.avatar)}
										alt={post.author.name}
										className="h-16 w-16 rounded-full"
									/>
								)}
								<div>
									<h3 className="mb-2 font-semibold text-card-foreground text-lg">About {post.author.name}</h3>
									<p className="text-muted-foreground">{post.author.bio}</p>
								</div>
							</div>
						</div>
					)}

					{/* CTA */}
					<div className="mt-12 rounded-lg border bg-primary/5 p-8 text-center">
						<h3 className="mb-4 font-bold text-2xl text-foreground">Ready to Transform Your Customer Interviews?</h3>
						<p className="mb-6 text-muted-foreground">
							Join product teams using AI to turn customer interviews into actionable insights.
						</p>
						<Link
							to="/sign-up"
							className="inline-block rounded-lg bg-primary px-8 py-3 font-semibold text-lg text-primary-foreground transition-colors hover:bg-primary/90"
						>
							Start Free Trial
						</Link>
					</div>
				</article>

				{/* Recent Posts */}
				{recentPosts.length > 0 && (
					<section className="border-t bg-accent/30 px-6 py-16">
						<div className="mx-auto max-w-6xl">
							<h2 className="mb-8 font-bold text-3xl text-foreground">Recent Posts</h2>
							<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
								{recentPosts.map((recentPost) => (
									<RecentPostCard key={recentPost.id} post={recentPost} />
								))}
							</div>
						</div>
					</section>
				)}
			</div>
		</>
	)
}

function RecentPostCard({ post }: { post: PayloadPost }) {
	const imageUrl = getImageUrl(post.featured_image)
	const publishedDate = formatDate(post.publishedAt)

	return (
		<Link to={`/blog/${post.slug}`} className="group">
			<article className="h-full overflow-hidden rounded-lg border bg-card transition-all hover:shadow-lg">
				{post.featured_image && (
					<div className="aspect-video overflow-hidden bg-muted">
						<img
							src={imageUrl}
							alt={post.featured_image.alt || post.title}
							className="h-full w-full object-cover transition-transform group-hover:scale-105"
						/>
					</div>
				)}
				<div className="p-4">
					{/* <time className="mb-2 block text-muted-foreground text-sm" dateTime={post.publishedAt}>
						{publishedDate}
					</time> */}
					<h3 className="font-semibold text-card-foreground group-hover:text-primary">{post.title}</h3>
				</div>
			</article>
		</Link>
	)
}
