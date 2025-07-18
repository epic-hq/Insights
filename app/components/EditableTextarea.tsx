import { useState } from "react"
import { useFetcher } from "react-router-dom"

interface EditableTextareaProps {
	table: string
	id: string
	field: string
	initialValue: string | string[] | null
	label: string
	isArray?: boolean // when true, join/split by newlines
	className?: string
}

/**
 * Reusable editable textarea that updates db on blur via /api/update-field route.
 * Designed for Remix + Supabase backends.
 */
export default function EditableTextarea({
	table,
	id,
	field,
	initialValue,
	label,
	isArray = false,
	className = "",
}: EditableTextareaProps) {
	const fetcher = useFetcher()
	const [value, setValue] = useState<string>(
		Array.isArray(initialValue) ? (initialValue as string[]).join("\n") : ((initialValue ?? "") as string)
	)

	return (
		<div className={className}>
			<label className="mb-1 block font-medium text-gray-700">{label}</label>
			<textarea
				className="w-full rounded border p-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
				value={value}
				rows={4}
				onChange={(e) => setValue(e.target.value)}
				onBlur={() => {
					const payload = {
						table,
						id,
						field,
						value: isArray ? value.split(/\n+/).filter(Boolean) : value,
					}
					fetcher.submit(JSON.stringify(payload), {
						method: "post",
						encType: "application/json",
						action: "/api/update-field",
					})
				}}
			/>
			{fetcher.state === "submitting" && <p className="text-gray-500 text-xs">Saving…</p>}
			{fetcher.state === "idle" && fetcher.data?.error && <p className="text-red-600 text-xs">{fetcher.data.error}</p>}
		</div>
	)
}
