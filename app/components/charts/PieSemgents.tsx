import { Cell, Label, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type SegmentDatum = { name: string; value: number };

type PrettySegmentPieProps = {
	data: SegmentDatum[];
	height?: number;
	colors?: string[];
	outerRadius?: number;
	innerRadius?: number;
	minPercentToLabel?: number; // e.g., 0.03 -> 3%
	percentDigits?: number;
};

const DEFAULT_COLORS = [
	"#2563eb",
	"#16a34a",
	"#f59e0b",
	"#ef4444",
	"#8b5cf6",
	"#06b6d4",
	"#10b981",
	"#3b82f6",
	"#f97316",
	"#dc2626",
];

export function PrettySegmentPie({
	data,
	height = 240,
	colors = DEFAULT_COLORS,
	outerRadius = 92,
	innerRadius = 54,
	minPercentToLabel = 0.03,
	percentDigits = 0,
}: PrettySegmentPieProps) {
	const total = data.reduce((s, d) => s + (d.value ?? 0), 0);

	return (
		<ResponsiveContainer width="100%" height={height}>
			<PieChart>
				<Tooltip formatter={(v: number, _name, { payload }) => [`${v}`, payload.name]} />
				<Pie
					data={data}
					dataKey="value"
					nameKey="name"
					cx="50%"
					cy="50%"
					innerRadius={innerRadius}
					outerRadius={outerRadius}
					labelLine={false}
					label={(props) => {
						const { name, percent } = props as { name?: string; percent?: number };
						if (!percent || percent < minPercentToLabel) return null;
						const pct = (percent * 100).toFixed(percentDigits);
						return `${name} · ${pct}%`;
					}}
				>
					{data.map((d, i) => (
						<Cell key={d.name ?? String(i)} fill={colors[i % colors.length]} />
					))}

					{/* center total */}
					<Label value={total.toLocaleString()} position="center" style={{ fontSize: 18, fontWeight: 600 }} />
				</Pie>
			</PieChart>
		</ResponsiveContainer>
	);
}
