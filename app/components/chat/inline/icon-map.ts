import {
	ArrowRight,
	BarChart3,
	Eye,
	FileText,
	Lightbulb,
	type LucideIcon,
	MessageSquare,
	Plus,
	RefreshCw,
	Search,
	Settings,
	Sparkles,
	Target,
	TrendingUp,
	Upload,
	Users,
	Zap,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
	search: Search,
	upload: Upload,
	users: Users,
	barchart3: BarChart3,
	filetext: FileText,
	messagesquare: MessageSquare,
	lightbulb: Lightbulb,
	target: Target,
	trendingup: TrendingUp,
	zap: Zap,
	eye: Eye,
	plus: Plus,
	arrowright: ArrowRight,
	refreshcw: RefreshCw,
	settings: Settings,
	sparkles: Sparkles,
};

/** Resolve a lucide icon name (case-insensitive) to a component. Falls back to ArrowRight. */
export function resolveIcon(name: string | undefined): LucideIcon {
	if (!name) return ArrowRight;
	const key = name.replace(/[-_\s]/g, "").toLowerCase();
	return ICON_MAP[key] ?? ArrowRight;
}
