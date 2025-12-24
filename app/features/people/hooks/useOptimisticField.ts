/**
 * Custom hook for optimistic field updates using Remix patterns
 *
 * Uses useFetcher for form submissions and derives optimistic state
 * from the fetcher's pending submission data.
 */

import { useCallback, useEffect, useRef } from "react"
import { useFetcher } from "react-router-dom"

interface UseOptimisticFieldOptions<T> {
	/** Current value from the server */
	value: T
	/** API endpoint for updates */
	endpoint: string
	/** Field name for the update */
	field: string
	/** Person ID for the update */
	personId: string
	/** Optional organization ID for org-linked fields */
	organizationId?: string
	/** Optional org field name (for organization-level updates) */
	orgField?: string
	/** Called when an error occurs */
	onError?: (error: string) => void
}

interface UseOptimisticFieldReturn<T> {
	/** The optimistic value (pending or current) */
	optimisticValue: T
	/** Whether a save is in progress */
	isPending: boolean
	/** Whether the last save failed */
	hasError: boolean
	/** Submit a new value */
	submit: (newValue: T) => void
}

export function useOptimisticField<T extends string | null>({
	value,
	endpoint,
	field,
	personId,
	organizationId,
	orgField,
	onError,
}: UseOptimisticFieldOptions<T>): UseOptimisticFieldReturn<T> {
	const fetcher = useFetcher()
	const lastSubmittedValue = useRef<T | undefined>(undefined)

	// Track if we're in a pending state
	const isPending = fetcher.state !== "idle"

	// Get the optimistic value from pending form data
	const pendingValue = fetcher.formData?.get("value") as T | undefined
	const optimisticValue = isPending && pendingValue !== undefined ? pendingValue : value

	// Track errors
	const hasError = fetcher.data?.error != null

	// Handle errors
	useEffect(() => {
		if (hasError && onError && fetcher.data?.error) {
			onError(fetcher.data.error)
		}
	}, [hasError, fetcher.data?.error, onError])

	// Submit a new value
	const submit = useCallback(
		(newValue: T) => {
			lastSubmittedValue.current = newValue

			const formData = new FormData()
			formData.append("personId", personId)
			formData.append("field", field)
			formData.append("value", newValue ?? "")

			if (organizationId) {
				formData.append("organizationId", organizationId)
			}
			if (orgField) {
				formData.append("orgField", orgField)
			}

			fetcher.submit(formData, {
				method: "POST",
				action: endpoint,
			})
		},
		[fetcher, personId, field, endpoint, organizationId, orgField]
	)

	return {
		optimisticValue,
		isPending,
		hasError,
		submit,
	}
}

/**
 * Hook for tracking multiple optimistic updates in a table context
 */
interface PendingUpdate {
	personId: string
	field: string
	value: string | null
	timestamp: number
}

interface UseOptimisticTableOptions {
	/** The server data */
	serverData: Array<{ id: string; [key: string]: unknown }>
	/** API endpoint for updates */
	endpoint: string
}

export function useOptimisticTable<T extends { id: string }>({ serverData, endpoint }: UseOptimisticTableOptions) {
	const fetcher = useFetcher()

	// Get pending updates from fetcher
	const getPendingValue = useCallback(
		(personId: string, field: string): string | null | undefined => {
			if (fetcher.state === "idle") return undefined

			const formPersonId = fetcher.formData?.get("personId")
			const formField = fetcher.formData?.get("field")
			const formValue = fetcher.formData?.get("value")

			if (formPersonId === personId && formField === field) {
				return formValue as string | null
			}
			return undefined
		},
		[fetcher.state, fetcher.formData]
	)

	// Submit an update
	const submitUpdate = useCallback(
		(
			personId: string,
			field: string,
			value: string | null,
			options?: {
				organizationId?: string
				orgField?: string
				newOrganizationName?: string
			}
		) => {
			const formData = new FormData()
			formData.append("personId", personId)
			formData.append("field", field)
			formData.append("value", value ?? "")

			if (options?.organizationId) {
				formData.append("organizationId", options.organizationId)
			}
			if (options?.orgField) {
				formData.append("orgField", options.orgField)
			}
			if (options?.newOrganizationName) {
				formData.append("newOrganizationName", options.newOrganizationName)
			}

			fetcher.submit(formData, {
				method: "POST",
				action: endpoint,
			})
		},
		[fetcher, endpoint]
	)

	return {
		isPending: fetcher.state !== "idle",
		hasError: fetcher.data?.error != null,
		errorMessage: fetcher.data?.error as string | undefined,
		getPendingValue,
		submitUpdate,
	}
}
