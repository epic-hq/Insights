/**
 * Shared admin navigation bar for all admin pages.
 */

import { Activity, AlertTriangle, BarChart3 } from "lucide-react";
import { Link, useLocation } from "react-router";
import { cn } from "~/lib/utils";

const adminLinks = [
	{ href: "/admin/usage", label: "Usage", icon: BarChart3 },
	{ href: "/admin/activity", label: "Activity", icon: Activity },
	{
		href: "/admin/stuck-interviews",
		label: "Stuck Interviews",
		icon: AlertTriangle,
	},
];

export function AdminNav() {
	const location = useLocation();

	return (
		<nav className="flex items-center gap-1 border-b pb-4">
			<span className="mr-4 font-semibold text-muted-foreground text-sm">Admin</span>
			{adminLinks.map((link) => {
				const isActive = location.pathname === link.href;
				return (
					<Link
						key={link.href}
						to={link.href}
						className={cn(
							"flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
							isActive
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:bg-muted hover:text-foreground"
						)}
					>
						<link.icon className="h-4 w-4" />
						{link.label}
					</Link>
				);
			})}
		</nav>
	);
}
