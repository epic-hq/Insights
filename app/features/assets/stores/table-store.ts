/**
 * Zustand store for table asset state management.
 *
 * Enables:
 * - Optimistic updates for inline editing
 * - Add/remove rows and columns
 * - Future: drag-and-drop reordering
 * - Sync with server via useFetcher
 */

import { create } from "zustand"

export interface TableData {
	headers: string[]
	rows: Record<string, string>[]
}

interface TableState {
	// Data
	assetId: string | null
	headers: string[]
	rows: Record<string, string>[]

	// UI state
	isLoading: boolean
	pendingChanges: boolean

	// Actions
	initialize: (assetId: string, data: TableData) => void
	reset: () => void

	// Row operations
	addRow: (row?: Record<string, string>) => void
	updateCell: (rowIndex: number, column: string, value: string) => void
	removeRow: (rowIndex: number) => void
	moveRow: (fromIndex: number, toIndex: number) => void

	// Column operations
	addColumn: (columnName: string, defaultValue?: string) => void
	removeColumn: (columnName: string) => void
	renameColumn: (oldName: string, newName: string) => void
	moveColumn: (fromIndex: number, toIndex: number) => void

	// Sync
	setLoading: (loading: boolean) => void
	markSynced: () => void
}

export const useTableStore = create<TableState>((set, get) => ({
	// Initial state
	assetId: null,
	headers: [],
	rows: [],
	isLoading: false,
	pendingChanges: false,

	initialize: (assetId, data) => {
		set({
			assetId,
			headers: data.headers,
			rows: data.rows.map(row => {
				// Ensure all values are strings
				const stringRow: Record<string, string> = {}
				for (const [key, value] of Object.entries(row)) {
					stringRow[key] = String(value ?? "")
				}
				return stringRow
			}),
			pendingChanges: false,
		})
	},

	reset: () => {
		set({
			assetId: null,
			headers: [],
			rows: [],
			isLoading: false,
			pendingChanges: false,
		})
	},

	// Row operations
	addRow: (row) => {
		const { headers, rows } = get()
		const newRow: Record<string, string> = row || {}

		// Ensure all headers have a value
		for (const header of headers) {
			if (!(header in newRow)) {
				newRow[header] = ""
			}
		}

		set({
			rows: [...rows, newRow],
			pendingChanges: true,
		})
	},

	updateCell: (rowIndex, column, value) => {
		const { rows } = get()
		if (rowIndex < 0 || rowIndex >= rows.length) return

		const updatedRows = [...rows]
		updatedRows[rowIndex] = {
			...updatedRows[rowIndex],
			[column]: value,
		}

		set({
			rows: updatedRows,
			pendingChanges: true,
		})
	},

	removeRow: (rowIndex) => {
		const { rows } = get()
		if (rowIndex < 0 || rowIndex >= rows.length) return

		set({
			rows: rows.filter((_, i) => i !== rowIndex),
			pendingChanges: true,
		})
	},

	moveRow: (fromIndex, toIndex) => {
		const { rows } = get()
		if (fromIndex < 0 || fromIndex >= rows.length) return
		if (toIndex < 0 || toIndex >= rows.length) return
		if (fromIndex === toIndex) return

		const updatedRows = [...rows]
		const [movedRow] = updatedRows.splice(fromIndex, 1)
		updatedRows.splice(toIndex, 0, movedRow)

		set({
			rows: updatedRows,
			pendingChanges: true,
		})
	},

	// Column operations
	addColumn: (columnName, defaultValue = "") => {
		const { headers, rows } = get()

		if (headers.includes(columnName)) return // Column already exists

		set({
			headers: [...headers, columnName],
			rows: rows.map(row => ({
				...row,
				[columnName]: defaultValue,
			})),
			pendingChanges: true,
		})
	},

	removeColumn: (columnName) => {
		const { headers, rows } = get()

		set({
			headers: headers.filter(h => h !== columnName),
			rows: rows.map(row => {
				const { [columnName]: _, ...rest } = row
				return rest
			}),
			pendingChanges: true,
		})
	},

	renameColumn: (oldName, newName) => {
		const { headers, rows } = get()

		if (!headers.includes(oldName)) return
		if (headers.includes(newName)) return // New name already exists

		set({
			headers: headers.map(h => h === oldName ? newName : h),
			rows: rows.map(row => {
				const { [oldName]: value, ...rest } = row
				return { ...rest, [newName]: value }
			}),
			pendingChanges: true,
		})
	},

	moveColumn: (fromIndex, toIndex) => {
		const { headers, rows } = get()
		if (fromIndex < 0 || fromIndex >= headers.length) return
		if (toIndex < 0 || toIndex >= headers.length) return
		if (fromIndex === toIndex) return

		const updatedHeaders = [...headers]
		const [movedHeader] = updatedHeaders.splice(fromIndex, 1)
		updatedHeaders.splice(toIndex, 0, movedHeader)

		set({
			headers: updatedHeaders,
			pendingChanges: true,
		})
	},

	// Sync
	setLoading: (loading) => {
		set({ isLoading: loading })
	},

	markSynced: () => {
		set({ pendingChanges: false })
	},
}))
