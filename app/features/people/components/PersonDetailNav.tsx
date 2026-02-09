/**
 * PersonDetailNav - Sticky anchor navigation for person detail pages.
 *
 * Pins to the top of the viewport on scroll and highlights the currently
 * visible section using IntersectionObserver (scroll spy). Clicking a pill
 * smooth-scrolls to the corresponding section.
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

interface PersonDetailNavProps {
	sections?: Array<{ id: string; label: string }>;
}

const DEFAULT_SECTIONS = [
	{ id: "scorecard", label: "Overview" },
	{ id: "insights", label: "Insights" },
	{ id: "activity", label: "Activity" },
	{ id: "profile", label: "Profile" },
];

export function PersonDetailNav({ sections = DEFAULT_SECTIONS }: PersonDetailNavProps) {
	const [activeSection, setActiveSection] = useState(sections[0]?.id ?? "");
	const navRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						setActiveSection(entry.target.id);
					}
				}
			},
			{ rootMargin: "-80px 0px -66% 0px", threshold: 0 }
		);

		sections.forEach(({ id }) => {
			const el = document.getElementById(id);
			if (el) observer.observe(el);
		});

		return () => observer.disconnect();
	}, [sections]);

	function handleClick(id: string) {
		const el = document.getElementById(id);
		if (el) {
			el.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	}

	return (
		<nav
			ref={navRef}
			className="sticky top-0 z-40 border-border/40 border-b bg-background/80 backdrop-blur-sm"
			aria-label="Section navigation"
		>
			<div className="flex gap-1 overflow-x-auto py-2" style={{ scrollbarWidth: "none" }}>
				{sections.map(({ id, label }) => {
					const isActive = activeSection === id;

					return (
						<button
							key={id}
							type="button"
							onClick={() => handleClick(id)}
							className={cn(
								"relative cursor-pointer whitespace-nowrap rounded-md px-3.5 py-1.5 font-medium text-muted-foreground text-sm transition-colors",
								"hover:bg-muted hover:text-foreground",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
								isActive &&
									"after:-translate-x-1/2 bg-primary/10 text-primary after:absolute after:bottom-0 after:left-1/2 after:h-0.5 after:w-4/5 after:rounded-full after:bg-primary"
							)}
							aria-current={isActive ? "true" : undefined}
						>
							{label}
						</button>
					);
				})}
			</div>
		</nav>
	);
}
