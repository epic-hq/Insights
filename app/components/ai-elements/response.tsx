import { type ComponentProps, memo } from "react"
import { Streamdown } from "streamdown"
import { cn } from "~/lib/utils"

// Custom link renderer that adds icons
const LinkWithIcon = ({ href, children }: { href: string; children: React.ReactNode }) => {
	return (
		<a href={href} className="inline-flex items-center gap-1 text-blue-600 underline hover:text-blue-800">
			{children}
			<span className="text-xs">🔗</span>
		</a>
	)
}

// Custom renderer for Streamdown to add icons to links
const customRenderers = {
	link: LinkWithIcon,
}

type ResponseProps = ComponentProps<typeof Streamdown>

export const Response = memo(
	({ className, ...props }: ResponseProps) => (
		<Streamdown
			className={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}
			renderers={customRenderers}
			rehypePlugins={[]} // Disable all rehype plugins to allow links
			{...props}
		/>
	),
	(prevProps, nextProps) => prevProps.children === nextProps.children
)

Response.displayName = "Response"
