import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { LogoBrand } from "~/components/branding";

const MARKETING_LINKS = [
	{ key: "product-teams", label: "For Product Teams", to: "/customer-discovery" },
	{ key: "consultants", label: "Consultants", to: "/customer-discovery-for-consultants" },
	{ key: "pricing", label: "Pricing", to: "/pricing" },
	{ key: "blog", label: "Blog", to: "/blog" },
];

const DARK_HERO_ROUTES = new Set(["/", "/pricing", "/customer-discovery", "/customer-discovery-for-consultants"]);

function navLinkClass(isDarkHero: boolean) {
	return [
		"font-medium text-sm underline-offset-4 transition-colors hover:underline",
		isDarkHero ? "text-zinc-300 hover:text-white" : "text-zinc-700 hover:text-zinc-950",
	].join(" ");
}

export default function MarketingNav() {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const { pathname } = useLocation();
	const isDarkHeroPage = DARK_HERO_ROUTES.has(pathname);

	return (
		<nav
			className={[
				"sticky top-0 z-40 w-full border-b backdrop-blur",
				isDarkHeroPage ? "border-white/10 bg-zinc-950/95 text-white" : "border-zinc-200/70 bg-white/95 text-zinc-900",
			].join(" ")}
		>
			<div className="mx-auto max-w-[1440px] px-4">
				<div className="flex h-16 items-center justify-between gap-4">
					<Link aria-label="UpSight home" className="flex items-center" to="/">
						<LogoBrand />
					</Link>

					<div className="hidden items-center gap-8 md:flex">
						{MARKETING_LINKS.map((link) => (
							<NavLink className={navLinkClass(isDarkHeroPage)} key={link.key} to={link.to}>
								{link.label}
							</NavLink>
						))}
					</div>

					<div className="hidden items-center gap-2 md:flex">
						<Link
							className={[
								"rounded-md px-3 py-2 font-medium text-sm transition-colors",
								isDarkHeroPage ? "text-zinc-200 hover:bg-white/10 hover:text-white" : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950",
							].join(" ")}
							to="/login"
						>
							Sign In
						</Link>
						<Link
							className="rounded-md bg-amber-400 px-3 py-2 font-semibold text-sm text-zinc-950 transition-colors hover:bg-amber-300"
							to="/sign-up"
						>
							Sign Up
						</Link>
					</div>

					<button
						aria-expanded={mobileMenuOpen}
						aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
						className={[
							"rounded-md px-3 py-2 font-medium text-sm md:hidden",
							isDarkHeroPage ? "text-zinc-200 hover:bg-white/10" : "text-zinc-700 hover:bg-zinc-100",
						].join(" ")}
						onClick={() => setMobileMenuOpen((open) => !open)}
						type="button"
					>
						{mobileMenuOpen ? "Close" : "Menu"}
					</button>
				</div>
			</div>

			{mobileMenuOpen && (
				<div className={["border-t px-4 pb-4 md:hidden", isDarkHeroPage ? "border-white/10" : "border-zinc-200"].join(" ")}>
					<div className="flex flex-col gap-1 pt-3">
						{MARKETING_LINKS.map((link) => (
							<NavLink
								className={["rounded-md px-3 py-2 font-medium text-sm", navLinkClass(isDarkHeroPage)].join(" ")}
								key={link.key}
								onClick={() => setMobileMenuOpen(false)}
								to={link.to}
							>
								{link.label}
							</NavLink>
						))}
					</div>

					<div className="mt-3 grid grid-cols-2 gap-2">
						<Link
							className={[
								"rounded-md px-3 py-2 text-center font-medium text-sm transition-colors",
								isDarkHeroPage ? "border border-white/15 text-zinc-200 hover:bg-white/10" : "border border-zinc-300 text-zinc-800 hover:bg-zinc-100",
							].join(" ")}
							onClick={() => setMobileMenuOpen(false)}
							to="/login"
						>
							Sign In
						</Link>
						<Link
							className="rounded-md bg-amber-400 px-3 py-2 text-center font-semibold text-sm text-zinc-950 transition-colors hover:bg-amber-300"
							onClick={() => setMobileMenuOpen(false)}
							to="/sign-up"
						>
							Sign Up
						</Link>
					</div>
				</div>
			)}
		</nav>
	);
}
