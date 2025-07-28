import { useState } from "react"
import { Link } from "react-router-dom"
import type { ColumnData, OpportunityItem } from "~/types"

interface OpportunityKanbanProps {
	columns: ColumnData[]
	className?: string
}

export default function OpportunityKanban({ columns, className }: OpportunityKanbanProps) {
	const [draggedItem, setDraggedItem] = useState<OpportunityItem | null>(null)
	const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
	const [dragOverItem, setDragOverItem] = useState<string | null>(null)

	// Handle drag start
	const handleDragStart = (item: OpportunityItem) => {
		setDraggedItem(item)
	}

	// Handle drag over column
	const handleDragOverColumn = (columnTitle: string, e: React.DragEvent) => {
		e.preventDefault()
		if (draggedItem && dragOverColumn !== columnTitle) {
			setDragOverColumn(columnTitle)
		}
	}

	// Handle drag over item
	const handleDragOverItem = (itemId: string, e: React.DragEvent) => {
		e.preventDefault()
		if (draggedItem && dragOverItem !== itemId && draggedItem.id !== itemId) {
			setDragOverItem(itemId)
		}
	}

	// Handle drag end
	const handleDragEnd = () => {
		// In a real app, this would update the state/backend
		// For now, we just reset the visual indicators
		setDraggedItem(null)
		setDragOverColumn(null)
		setDragOverItem(null)
	}

	// Get priority color
	const getPriorityColor = (priority?: "high" | "medium" | "low") => {
		switch (priority) {
			case "high":
				return "border-l-4 border-l-red-500"
			case "medium":
				return "border-l-4 border-l-yellow-500"
			case "low":
				return "border-l-4 border-l-green-500"
			default:
				return ""
		}
	}

	return (
		<div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className ?? ""}`}>
			{columns.map((col) => (
				<div
					key={col.title}
					className={`flex flex-col rounded-lg border bg-white dark:bg-gray-900 ${dragOverColumn === col.title ? "ring-2 ring-blue-400" : ""}`}
					onDragOver={(e) => handleDragOverColumn(col.title, e)}
					onDrop={handleDragEnd}
				>
					<div className="flex items-center justify-between rounded-t-lg bg-gray-50 px-4 py-2 font-semibold text-sm dark:bg-gray-800">
						<span>{col.title}</span>
						<span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs dark:bg-gray-700">{col.items.length}</span>
					</div>
					<div
						className="min-h-[200px] flex-1 space-y-2 overflow-auto p-4"
						onDragOver={(e) => handleDragOverColumn(col.title, e)}
					>
						{col.items.map((item) => (
							<div
								key={item.id}
								draggable
								onDragStart={() => handleDragStart(item)}
								onDragOver={(e) => handleDragOverItem(item.id, e)}
								onDragEnd={handleDragEnd}
								className={`hover:-translate-y-0.5 cursor-move rounded border bg-gray-50 p-3 text-sm transition-all hover:shadow-md active:translate-y-0 active:shadow-sm dark:bg-gray-800 ${getPriorityColor(item.priority)} ${draggedItem?.id === item.id ? "scale-95 opacity-50" : ""} ${dragOverItem === item.id ? "-translate-y-1 border-blue-400" : ""}`}
							>
								<Link to={`/opportunities/${item.id}`} className="mb-1 block font-medium hover:text-blue-600">
									{item.title}
								</Link>
								<div className="flex items-center justify-between">
									<div className="text-gray-500 text-xs">Owner: {item.owner}</div>
									{item.priority && (
										<span
											className={`rounded-full px-2 py-0.5 text-xs ${item.priority === "high" ? "bg-red-100 text-red-800" : item.priority === "medium" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}
										>
											{item.priority}
										</span>
									)}
								</div>
							</div>
						))}
						{col.items.length === 0 && (
							<div className="flex h-full min-h-[100px] items-center justify-center rounded-lg border-2 border-dashed p-4 text-gray-400 text-sm italic">
								Drop items here
							</div>
						)}
					</div>
				</div>
			))}
		</div>
	)
}
