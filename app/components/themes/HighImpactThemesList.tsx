export interface ThemeItem {
	tag: string; // #theme_tag
	text: string; // one-sentence insight
	impact: number; // 1-5
	novelty: number; // 1-5
}

interface HighImpactThemesListProps {
	themes: ThemeItem[];
	className?: string;
}

export default function HighImpactThemesList({ themes, className }: HighImpactThemesListProps) {
	return (
		<div className={`max-w-xl space-y-4 rounded-lg border bg-white p-6 shadow dark:bg-gray-900 ${className ?? ""}`}>
			<h3 className="font-semibold text-lg">High-Impact Themes</h3>
			<ul className="space-y-2">
				{themes.map((t) => (
					<li
						key={t.tag}
						className="grid items-center gap-2 text-sm"
						style={{ gridTemplateColumns: "auto 1fr auto auto" }}
					>
						<span className="whitespace-nowrap font-medium text-primary-700">{t.tag}</span>
						<span className="flex-1">{t.text}</span>
						<span className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-blue-800 text-xs">
							⚡ {t.impact}
						</span>
						<span className="inline-flex items-center gap-1 rounded bg-fuchsia-100 px-1.5 py-0.5 text-fuchsia-800 text-xs">
							✨ {t.novelty}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}
