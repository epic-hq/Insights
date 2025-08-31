import * as SliderPrimitive from "@radix-ui/react-slider"
import * as React from "react"

import { cn } from "~/lib/utils"

function Slider({
	className,
	defaultValue,
	value,
	min = 0,
	max = 100,
	...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
	// Determine controlled vs uncontrolled to avoid passing both value and defaultValue
	const isControlled = value !== undefined

	// Stable list length for rendering thumbs (do not generate new arrays unnecessarily)
	const _values = React.useMemo(() => {
		if (isControlled && Array.isArray(value)) return value
		if (!isControlled && Array.isArray(defaultValue)) return defaultValue
		return [min]
	}, [isControlled, value, defaultValue, min])

	return (
		<SliderPrimitive.Root
			data-slot="slider"
			{...(isControlled ? { value } : { defaultValue })}
			min={min}
			max={max}
			className={cn(
				"relative flex w-full touch-none select-none items-center data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col data-[disabled]:opacity-50",
				className
			)}
			{...props}
		>
			<SliderPrimitive.Track
				data-slot="slider-track"
				className={cn(
					"relative grow overflow-hidden rounded-full bg-muted data-[orientation=horizontal]:h-1.5 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-1.5"
				)}
			>
				<SliderPrimitive.Range
					data-slot="slider-range"
					className={cn("absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full")}
				/>
			</SliderPrimitive.Track>
			{Array.from({ length: _values.length }, (_, index) => (
				<SliderPrimitive.Thumb
					data-slot="slider-thumb"
					key={String(_values[index] ?? index)}
					className="block size-4 shrink-0 rounded-full border border-primary bg-background shadow-sm ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:outline-hidden focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50"
				/>
			))}
		</SliderPrimitive.Root>
	)
}

export { Slider }
