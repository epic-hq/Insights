import { Building2, User, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "~/lib/utils";

interface EntityTypeNavProps {
	activeType: "people" | "personas" | "organizations";
	routes: {
		people: { index: () => string };
		personas: { index: () => string };
		organizations: { index: () => string };
	};
	className?: string;
}

export function EntityTypeNav({ activeType, routes, className }: EntityTypeNavProps) {
	const navItems = [
		{
			type: "people" as const,
			label: "People",
			icon: User,
			href: routes.people.index(),
		},
		{
			type: "personas" as const,
			label: "Personas",
			icon: Users,
			href: routes.personas.index(),
		},
		{
			type: "organizations" as const,
			label: "Organizations",
			icon: Building2,
			href: routes.organizations.index(),
		},
	];

	return (
		<nav className={cn("mb-6 flex gap-1 rounded-lg border bg-muted/30 p-1", className)}>
			{navItems.map((item) => {
				const Icon = item.icon;
				const isActive = activeType === item.type;

				return (
					<Link
						key={item.type}
						to={item.href}
						className={cn(
							"flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 font-medium text-sm transition-all",
							isActive
								? "bg-background text-foreground shadow-sm"
								: "text-muted-foreground hover:bg-background/50 hover:text-foreground"
						)}
					>
						<Icon className="h-4 w-4" />
						<span>{item.label}</span>
					</Link>
				);
			})}
		</nav>
	);
}
