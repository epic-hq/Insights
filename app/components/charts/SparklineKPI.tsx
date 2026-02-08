import type { CSSProperties } from "react";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from "recharts";

export interface SparklineDatum {
	label: string; // e.g. date label
	value: number;
}

interface SparklineKPIProps {
	data: SparklineDatum[];
	/** Latest KPI value (defaults to last datum) */
	kpiValue?: number | string;
	/** Change string, e.g., "+12%" */
	change?: string;
	/** Optional threshold baseline to draw */
	baseline?: number;
	height?: number;
	style?: CSSProperties;
	stroke?: string;
}

// Thin line chart w/out axes, paired with a big KPI figure. Wraps in a flex column
export default function SparklineKPI({
	data,
	kpiValue,
	change,
	baseline,
	height = 60,
	style,
	stroke = "#0284c7",
}: SparklineKPIProps) {
	const latest = kpiValue ?? data[data.length - 1]?.value;
	const isUp = typeof change === "string" && change.startsWith("+");

	return (
		<div style={style} className="flex flex-col gap-1">
			<div className="font-semibold text-gray-900 text-xl leading-none dark:text-gray-100">{latest}</div>
			{change && <div className={`text-xs ${isUp ? "text-emerald-600" : "text-rose-600"}`}>{change}</div>}
			<div style={{ width: "100%", height }}>
				<ResponsiveContainer>
					<LineChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
						{baseline != null && <ReferenceLine y={baseline} stroke="#d1d5db" strokeDasharray="3 3" />}
						<YAxis hide domain={["dataMin", "dataMax"]} />
						<Tooltip cursor={{ stroke: "#e5e7eb" }} contentStyle={{ fontSize: 12 }} labelStyle={{ display: "none" }} />
						<Line type="monotone" dataKey="value" stroke={stroke} strokeWidth={2} dot={false} />
					</LineChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}
