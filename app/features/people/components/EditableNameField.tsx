/**
 * Advanced inline editable name field
 * Shows combined name in view mode, splits into firstname/lastname in edit mode
 */
import { Check, Loader2, Pencil, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useRevalidator } from "react-router-dom"
import { Input } from "~/components/ui/input"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"

interface EditableNameFieldProps {
	firstname: string | null | undefined
	lastname: string | null | undefined
	personId: string
	placeholder?: string
	className?: string
	/** Larger text styling for headers */
	variant?: "default" | "header"
}

export function EditableNameField({
	firstname,
	lastname,
	personId,
	placeholder = "—",
	className,
	variant = "default",
}: EditableNameFieldProps) {
	const [isEditing, setIsEditing] = useState(false)
	const [editFirstname, setEditFirstname] = useState(firstname ?? "")
	const [editLastname, setEditLastname] = useState(lastname ?? "")
	const [isSaving, setIsSaving] = useState(false)
	const firstnameRef = useRef<HTMLInputElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")
	const revalidator = useRevalidator()

	// Combined display name
	const displayName = [firstname, lastname].filter(Boolean).join(" ") || ""

	// Reset edit values when props change
	useEffect(() => {
		if (!isEditing) {
			setEditFirstname(firstname ?? "")
			setEditLastname(lastname ?? "")
		}
	}, [firstname, lastname, isEditing])

	// Focus first input when entering edit mode
	useEffect(() => {
		if (isEditing) {
			// Small delay to ensure the input is rendered
			setTimeout(() => {
				firstnameRef.current?.focus()
				firstnameRef.current?.select()
			}, 0)
		}
	}, [isEditing])

	// Handle click outside to save
	useEffect(() => {
		if (!isEditing) return

		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				handleSave()
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		return () => document.removeEventListener("mousedown", handleClickOutside)
	}, [isEditing, editFirstname, editLastname])

	const handleSave = async () => {
		const firstnameChanged = editFirstname !== (firstname ?? "")
		const lastnameChanged = editLastname !== (lastname ?? "")

		if (!firstnameChanged && !lastnameChanged) {
			setIsEditing(false)
			return
		}

		setIsSaving(true)
		try {
			const updates: Promise<Response>[] = []

			if (firstnameChanged) {
				updates.push(
					fetch(`${routes.people.index()}/api/update-inline`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						credentials: "include",
						body: JSON.stringify({
							personId,
							field: "firstname",
							value: editFirstname || null,
						}),
					})
				)
			}

			if (lastnameChanged) {
				updates.push(
					fetch(`${routes.people.index()}/api/update-inline`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						credentials: "include",
						body: JSON.stringify({
							personId,
							field: "lastname",
							value: editLastname || null,
						}),
					})
				)
			}

			const responses = await Promise.all(updates)
			const allOk = responses.every((r) => r.ok)

			if (!allOk) {
				throw new Error("Failed to save")
			}

			setIsEditing(false)
			revalidator.revalidate()
		} catch (error) {
			console.error("Failed to save name:", error)
			// Reset to original values on error
			setEditFirstname(firstname ?? "")
			setEditLastname(lastname ?? "")
		} finally {
			setIsSaving(false)
		}
	}

	const handleCancel = () => {
		setEditFirstname(firstname ?? "")
		setEditLastname(lastname ?? "")
		setIsEditing(false)
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault()
			handleSave()
		}
		if (e.key === "Escape") {
			handleCancel()
		}
	}

	if (isEditing) {
		return (
			<div ref={containerRef} className="flex items-center gap-2">
				<div className="flex items-center gap-1">
					<Input
						ref={firstnameRef}
						value={editFirstname}
						onChange={(e) => setEditFirstname(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="First"
						disabled={isSaving}
						className={cn("h-8 w-24", variant === "header" && "h-10 font-bold text-2xl")}
					/>
					<Input
						value={editLastname}
						onChange={(e) => setEditLastname(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Last"
						disabled={isSaving}
						className={cn("h-8 w-24", variant === "header" && "h-10 font-bold text-2xl")}
					/>
				</div>
				<div className="flex items-center gap-1">
					{isSaving ? (
						<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
					) : (
						<>
							<button
								type="button"
								onClick={handleSave}
								className="rounded p-1 text-green-600 transition-colors hover:bg-green-50"
								title="Save"
							>
								<Check className="h-4 w-4" />
							</button>
							<button
								type="button"
								onClick={handleCancel}
								className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted"
								title="Cancel"
							>
								<X className="h-4 w-4" />
							</button>
						</>
					)}
				</div>
			</div>
		)
	}

	return (
		<button
			type="button"
			onClick={() => setIsEditing(true)}
			className={cn(
				"group flex items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-muted/50",
				!displayName && "text-muted-foreground",
				variant === "header" && "font-bold text-3xl",
				className
			)}
		>
			<span>{displayName || placeholder}</span>
			<Pencil
				className={cn(
					"shrink-0 opacity-0 transition-opacity group-hover:opacity-50",
					variant === "header" ? "h-4 w-4" : "h-3 w-3"
				)}
			/>
		</button>
	)
}
