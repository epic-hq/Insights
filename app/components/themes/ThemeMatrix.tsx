import type React from "react";

const tailwindColors = [
	"blue",
	"sky",
	"indigo",
	"violet",
	"purple",
	"fuchsia",
	"pink",
	"rose",
	"red",
	"orange",
	"amber",
	"yellow",
	"lime",
	"green",
	"emerald",
	"teal",
	"cyan",
	"gray",
	"zinc",
	"neutral",
	"stone",
];

const shadeSteps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

export const ThemeMatrix: React.FC = () => {
	return (
		<div className="overflow-auto">
			<table className="border-collapse text-xs">
				<thead>
					<tr>
						<th className="p-2 text-left">Color / Shade</th>
						{shadeSteps.map((shade) => (
							<th key={shade} className="p-2 font-normal">
								{shade}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{tailwindColors.map((color) => (
						<tr key={color}>
							<td className="sticky left-0 bg-white p-2 pr-4 text-right font-medium capitalize dark:bg-gray-900">
								{color}
							</td>
							{shadeSteps.map((shade) => (
								<td key={shade} className={`h-10 w-10 bg-${color}-${shade}`} title={`${color}-${shade}`} />
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};
