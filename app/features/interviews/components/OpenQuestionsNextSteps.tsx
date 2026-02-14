interface OpenQuestionsNextStepsProps {
	items: string[];
	className?: string;
}

export default function OpenQuestionsNextSteps({ items, className }: OpenQuestionsNextStepsProps) {
	return (
		<div className={`max-w-xl space-y-4 rounded-lg border bg-white p-6 shadow dark:bg-gray-900 ${className ?? ""}`}>
			<h3 className="font-semibold text-lg">Open Questions & Next Steps</h3>
			<ul className="list-inside list-disc space-y-1 text-sm">
				{items.map((item) => (
					<li key={item}>{item}</li>
				))}
			</ul>
		</div>
	);
}
