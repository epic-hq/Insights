/**
 * Generic inline editable field component
 *
 * Works with any entity type by using a fetcher to POST updates.
 * The parent page's action handler must handle the "_action": "update-field" intent.
 */
import { ChevronDown, Loader2, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router-dom";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import type { SelectOption } from "~/lib/constants/options";
import { cn } from "~/lib/utils";

interface InlineEditableFieldProps {
	/** Current value of the field */
	value: string | null | undefined;
	/** Entity ID (e.g., organizationId, personId) */
	entityId: string;
	/** Field name to update in the database */
	field: string;
	/** Key name for the entity ID in the form data (e.g., "organizationId", "personId") */
	entityIdKey?: string;
	/** Placeholder text when empty */
	placeholder?: string;
	/** Additional CSS classes */
	className?: string;
	/** Whether to use multiline textarea */
	multiline?: boolean;
	/** Number of rows for textarea */
	rows?: number;
	/** Field type: text input or select dropdown */
	type?: "text" | "select";
	/** Options for select dropdown */
	options?: SelectOption[];
	/** Optional action name override (defaults to "update-field") */
	actionName?: string;
}

export function InlineEditableField({
	value,
	entityId,
	field,
	entityIdKey = "entityId",
	placeholder = "Add...",
	className,
	multiline = false,
	rows = 3,
	type = "text",
	options = [],
	actionName = "update-field",
}: InlineEditableFieldProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(value ?? "");
	const inputRef = useRef<HTMLInputElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fetcher = useFetcher();

	const isSaving = fetcher.state !== "idle";

	// Update edit value when prop changes
	useEffect(() => {
		if (!isEditing) {
			setEditValue(value ?? "");
		}
	}, [value, isEditing]);

	useEffect(() => {
		if (isEditing && type === "text") {
			if (multiline) {
				textareaRef.current?.focus();
				textareaRef.current?.select();
			} else {
				inputRef.current?.focus();
				inputRef.current?.select();
			}
		}
	}, [isEditing, multiline, type]);

	const handleSave = (newValue?: string) => {
		const saveValue = newValue ?? editValue;
		if (saveValue === (value ?? "")) {
			setIsEditing(false);
			return;
		}

		fetcher.submit(
			{
				_action: actionName,
				[entityIdKey]: entityId,
				field,
				value: saveValue || "",
			},
			{ method: "post" }
		);
		setIsEditing(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (!multiline && e.key === "Enter") {
			e.preventDefault();
			handleSave();
		}
		if (e.key === "Escape") {
			setEditValue(value ?? "");
			setIsEditing(false);
		}
	};

	// Get display label for select value
	const getDisplayValue = () => {
		if (type === "select" && value) {
			const option = options.find((o) => o.value === value);
			return option?.label || value;
		}
		return value;
	};

	if (isEditing) {
		if (type === "select") {
			return (
				<Select
					value={editValue}
					onValueChange={(newValue) => {
						setEditValue(newValue);
						handleSave(newValue);
					}}
					open={true}
					onOpenChange={(open) => {
						if (!open) setIsEditing(false);
					}}
				>
					<SelectTrigger className={cn("h-8", className)}>
						<SelectValue placeholder={placeholder} />
					</SelectTrigger>
					<SelectContent>
						{options.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			);
		}

		return (
			<div className="relative">
				{multiline ? (
					<Textarea
						ref={textareaRef}
						value={editValue}
						onChange={(e) => setEditValue(e.target.value)}
						onBlur={() => handleSave()}
						onKeyDown={handleKeyDown}
						rows={rows}
						disabled={isSaving}
						className={cn("resize-none", className)}
					/>
				) : (
					<Input
						ref={inputRef}
						value={editValue}
						onChange={(e) => setEditValue(e.target.value)}
						onBlur={() => handleSave()}
						onKeyDown={handleKeyDown}
						disabled={isSaving}
						className={cn("h-8", className)}
					/>
				)}
				{isSaving && (
					<Loader2 className="-translate-y-1/2 absolute top-1/2 right-2 h-4 w-4 animate-spin text-muted-foreground" />
				)}
			</div>
		);
	}

	const displayValue = getDisplayValue();

	return (
		<button
			type="button"
			onClick={() => setIsEditing(true)}
			className={cn(
				"group flex w-full items-center gap-1 rounded px-2 py-1 text-left transition-colors hover:bg-muted/50",
				!displayValue && "text-muted-foreground italic",
				className
			)}
		>
			<span className={cn("flex-1", multiline ? "whitespace-normal" : "truncate")}>{displayValue || placeholder}</span>
			{type === "select" ? (
				<ChevronDown className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
			) : (
				<Pencil className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
			)}
		</button>
	);
}
