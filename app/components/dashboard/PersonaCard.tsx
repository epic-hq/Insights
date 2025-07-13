// Component for displaying persona information with optional donut chart

import type { CSSProperties } from "react"
import type { PersonaSlice } from "~/components/charts/PersonaDonut"
import PersonaDonut from "~/components/charts/PersonaDonut"

interface PersonaCardProps {
	/** Optional donut slices — if present we render chart instead of simple bar */
	slices?: PersonaSlice[]
	centerLabel?: string | number
	style?: CSSProperties

	name: string
	percentage: number // share
	count?: number // actual count of participants
	color: string // hex or tailwind color
	href?: string // link to persona detail
}

export default function PersonaCard({
	name,
	percentage,
	count,
	color,
	slices,
	centerLabel,
	style,
	href,
}: PersonaCardProps) {
	const Wrapper = href ? "a" : "div"

	const wrapperProps = {
		className: `flex items-center gap-4 rounded-lg p-4 shadow ${href ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" : ""}`,
		style: style,
		...(href && { href: href }),
	}

	return (
		<Wrapper {...wrapperProps}>
			{slices ? (
				<PersonaDonut data={slices} centerLabel={centerLabel ?? `${percentage}%`} size={100} />
			) : (
				<div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
			)}
			<div className="flex-1">
				<div className="font-medium text-sm">
					<div>{name}</div>
				</div>
				<div className="text-gray-500 text-xs">
					{count ? `${count} participants (${percentage}%)` : `${percentage}% of participants`}
				</div>
			</div>
		</Wrapper>
	)
}
