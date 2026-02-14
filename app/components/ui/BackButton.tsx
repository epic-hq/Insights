import { ChevronLeft } from "lucide-react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";
import { Button } from "./button";

interface BackButtonProps {
	to: string;
	label?: string;
	className?: string;
	variant?: "outline" | "ghost" | "default" | "destructive" | "secondary";
	size?: "default" | "sm" | "lg";
	position?: "absolute" | "relative";
}

export function BackButton({
	to,
	label = "Back",
	className,
	variant = "outline",
	size = "sm",
	position = "absolute",
}: BackButtonProps) {
	return (
		<div className={cn(position === "absolute" && "absolute top-4 left-4 z-10", className)}>
			<Link to={to}>
				<Button
					variant={variant}
					size={size}
					className={cn("flex items-center gap-2", position === "absolute" && "bg-background/80 backdrop-blur-sm")}
				>
					<ChevronLeft className="h-4 w-4" />
					{label}
				</Button>
			</Link>
		</div>
	);
}
