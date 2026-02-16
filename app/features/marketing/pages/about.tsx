import type { LinksFunction } from "react-router";

export const links: LinksFunction = () => [
	{
		rel: "canonical",
		href: "https://getupsight.com/about",
	},
];

export default function AboutPage() {
	// const { user, loading } = useAuth()
	// const navigate = useNavigate()

	// useEffect(() => {
	// 	if (!loading && user) {
	// 		// If already authenticated, send the user to the main dashboard
	// 		navigate("/", { replace: true })
	// 	}
	// }, [user, loading, navigate])

	// if (loading) return null

	return (
		<div className="min-h-screen bg-[#050508] text-[#eeeef2]">
			<div className="mx-auto w-full max-w-5xl px-6 py-16 md:py-24">
				<div className="max-w-2xl">
					<p className="font-medium text-[0.7rem] text-[rgba(238,238,242,0.65)] tracking-[0.22em]">ABOUT</p>
					<h1 className="mt-4 font-semibold text-[clamp(2rem,5vw,3.25rem)] leading-[1.05] tracking-[-0.02em]">
						Founded by software industry veterans.
					</h1>
					<p className="mt-6 text-[clamp(1rem,1.3vw,1.15rem)] text-[rgba(238,238,242,0.75)] leading-relaxed">
						Deep product instincts. Real marketing scar tissue. A bias for craft.
					</p>
					<p className="mt-4 text-[clamp(1rem,1.3vw,1.15rem)] text-[rgba(238,238,242,0.75)] leading-relaxed">
						We’ve been doing AI since before it was cool — back when it was fragile, expensive, and mostly academic.
					</p>
					<p className="mt-4 text-[clamp(1rem,1.3vw,1.15rem)] text-[rgba(238,238,242,0.75)] leading-relaxed">
						The goal hasn’t changed: turn signal into conviction. The toolset has. We think you're gonna like it.
					</p>
				</div>

				<div className="mt-12 grid gap-4 md:grid-cols-3">
					<div className="rounded-xl border border-white/10 bg-white/5 p-5">
						<p className="font-medium text-[0.7rem] text-[rgba(238,238,242,0.65)] tracking-[0.18em]">PRODUCT</p>
						<p className="mt-3 text-[rgba(238,238,242,0.78)] text-sm leading-relaxed">
							We obsess over workflows that feel obvious in week one.
						</p>
					</div>
					<div className="rounded-xl border border-white/10 bg-white/5 p-5">
						<p className="font-medium text-[0.7rem] text-[rgba(238,238,242,0.65)] tracking-[0.18em]">MARKETING</p>
						<p className="mt-3 text-[rgba(238,238,242,0.78)] text-sm leading-relaxed">
							We believe in truth, not tricks.
						</p>
					</div>
					<div className="rounded-xl border border-white/10 bg-white/5 p-5">
						<p className="font-medium text-[0.7rem] text-[rgba(238,238,242,0.65)] tracking-[0.18em]">AI</p>
						<p className="mt-3 text-[rgba(238,238,242,0.78)] text-sm leading-relaxed">
							Useful beats impressive. Every time.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
