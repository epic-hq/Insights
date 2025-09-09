import { useEffect, useMemo } from "react"
import { JsonDataCard } from "~/features/signup-chat/components/JsonDataCard"
import { createClient } from "~/lib/supabase/client"

export type SignupData = Record<string, any> | undefined

interface SignupDataWatcherProps {
	userId?: string
	data?: SignupData
	title?: string
	className?: string
	onDataUpdate?: (data: SignupData) => void
	onCompleted?: () => void
	/** Whether to render the JsonDataCard. Defaults to true. */
	showCard?: boolean
	/** Whether to subscribe to Supabase changes. Defaults to true. */
	subscribe?: boolean
}

/**
 * SignupDataWatcher
 * - Subscribes to Supabase changes for the current user's signup_data
 * - Emits updates via onDataUpdate and onCompleted callbacks
 * - Renders a JsonDataCard with the current data
 */
export function SignupDataWatcher({
	userId,
	data,
	title = "Signup Data",
	className,
	onDataUpdate,
	onCompleted,
	showCard = true,
	subscribe = true,
}: SignupDataWatcherProps) {
	const supabase = createClient()

	useEffect(() => {
		if (!subscribe || !userId) return

		const channel = supabase
			.channel("signup_data_watch")
			.on(
				"postgres_changes",
				{ event: "UPDATE", schema: "public", table: "user_settings", filter: `user_id=eq.${userId}` },
				(payload) => {
					try {
						const newData = (payload.new as any)?.signup_data
						onDataUpdate?.(newData)
						const completed = newData?.completed === true
						if (completed) {
							onCompleted?.()
						}
					} catch (err) {
						// no-op
					}
				}
			)
			.subscribe()

		return () => {
			supabase.removeChannel(channel)
		}
	}, [supabase, userId, onDataUpdate, onCompleted, subscribe])

	if (!showCard) return <div></div>
	return <JsonDataCard title={title} jsonData={data} />
}
