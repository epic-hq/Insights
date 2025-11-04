import { type ChangeEvent, useId } from "react"

interface TagCountSelectorProps {
	value: number
	onChange: (value: number) => void
	min?: number
	max?: number
	step?: number
}

export default function TagCountSelector({ value, onChange, min = 5, max = 25, step = 1 }: TagCountSelectorProps) {
	const sliderId = useId()

	const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
		onChange(Number(event.target.value))
	}

	return (
		<div className="flex items-center gap-3">
			<label htmlFor={sliderId} className="font-medium text-gray-700 text-sm dark:text-gray-300">
				Show tags:
			</label>
			<div className="flex items-center gap-3">
				<span className="w-6 text-right font-mono text-gray-500 text-sm dark:text-gray-400">{min}</span>
				<input
					id={sliderId}
					type="range"
					min={min}
					max={max}
					step={step}
					value={value}
					onChange={handleSliderChange}
					className="h-2 w-24 cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:shadow-lg [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:shadow-lg"
				/>
				<span className="w-6 font-mono text-gray-500 text-sm dark:text-gray-400">{max}</span>
				<span className="w-6 text-center font-semibold text-blue-600 text-sm dark:text-blue-400">{value}</span>
			</div>
		</div>
	)
}
