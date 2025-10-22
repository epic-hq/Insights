import consola from "consola"
import {
	AlertTriangle,
	CheckCircle2,
	ChevronDown,
	ListChecks,
	MessageSquareText,
	Target,
	User,
	XCircle,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { createClient } from "~/lib/supabase/client"
import { cn } from "~/lib/utils"

type SignupData = Record<string, any> | undefined

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
 * - Renders a modern UI card with the current data
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
						consola.error(err)
					}
				}
			)
			.subscribe()

		return () => {
			supabase.removeChannel(channel)
		}
	}, [supabase, userId, onDataUpdate, onCompleted, subscribe])

	const normalized = useMemo(() => {
		const d = data ?? {}
		const toArray = (v: unknown): string[] =>
			Array.isArray(v)
				? (v as any[]).map((x) => `${x}`.trim()).filter(Boolean)
				: typeof v === "string" && v.trim()
					? [v.trim()]
					: []
		return {
			name: typeof d.name === "string" ? d.name.trim() || undefined : (d.name?.toString?.() ?? undefined),
			goal: typeof d.goal === "string" ? d.goal.trim() || undefined : (d.goal?.toString?.() ?? undefined),
			problem: typeof d.problem === "string" ? d.problem.trim() || undefined : (d.problem?.toString?.() ?? undefined),
			challenges: toArray(d.challenges),
			contentTypes: toArray(d.content_types ?? d.contentTypes ?? d.contentTypesPreferred),
			otherFeedback:
				typeof d.other_feedback === "string"
					? d.other_feedback.trim() || undefined
					: (d.other_feedback?.toString?.() ?? undefined),
			completed: d.completed === true,
		}
	}, [data])

	const [isOpen, setIsOpen] = useState(false)

	if (!showCard) return <div />

	return (
		<div className={cn("@container", className)}>
			{/* Mobile: Floating accordion header + collapsible body */}
			<div>
				{/* Backdrop when open */}
				{isOpen && <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setIsOpen(false)} />}
				<div className="fixed top-2 right-2 left-2 z-50 md:hidden">
					<button
						onClick={() => setIsOpen((prev) => !prev)}
						className="flex w-full items-center justify-between rounded-lg border border-neutral-200/60 bg-white px-3 py-2 text-left shadow-sm transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800"
					>
						<div className="flex min-w-0 items-center gap-3">
							<h3 className="truncate font-medium text-neutral-700 text-sm dark:text-neutral-200">{title}</h3>
							<span
								className={
									"inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-xs " +
									(normalized.completed
										? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 ring-inset dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800"
										: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 ring-inset dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800")
								}
							>
								{normalized.completed ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
								{normalized.completed ? "Completed" : "In progress"}
							</span>
						</div>
						<ChevronDown className={`size-5 transition-transform ${isOpen ? "rotate-180" : "rotate-0"}`} />
					</button>
					<div
						className={`transition-all duration-200 ${isOpen ? "mt-2 max-h-[80dvh] opacity-100" : "max-h-0 opacity-0"}`}
					>
						<div className="overflow-hidden rounded-xl border border-neutral-200/60 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
							<div className="grid @xl:grid-cols-2 grid-cols-1 gap-5 p-4">
								{/* Name */}
								<div className="space-y-1.5">
									<div className="flex items-center gap-2 font-semibold text-neutral-500 text-xs uppercase tracking-wide dark:text-neutral-400">
										<User className="size-4" /> Name
									</div>
									<div className="whitespace-pre-wrap text-neutral-800 text-sm dark:text-neutral-100">
										{normalized.name ?? "—"}
									</div>
								</div>

								{/* Goal */}
								<div className="space-y-1.5">
									<div className="flex items-center gap-2 font-semibold text-neutral-500 text-xs uppercase tracking-wide dark:text-neutral-400">
										<Target className="size-4" /> Goal
									</div>
									<div className="whitespace-pre-wrap text-neutral-800 text-sm dark:text-neutral-100">
										{normalized.goal ?? "—"}
									</div>
								</div>

								{/* Problem */}
								<div className="@sm:col-span-2 space-y-1.5">
									<div className="flex items-center gap-2 font-semibold text-neutral-500 text-xs uppercase tracking-wide dark:text-neutral-400">
										<AlertTriangle className="size-4" /> Problem
									</div>
									<div className="whitespace-pre-wrap text-neutral-800 text-sm dark:text-neutral-100">
										{normalized.problem ?? "—"}
									</div>
								</div>

								{/* Challenges */}
								<div className="space-y-1.5">
									<div className="flex items-center gap-2 font-semibold text-neutral-500 text-xs uppercase tracking-wide dark:text-neutral-400">
										<ListChecks className="size-4" /> Challenges
									</div>
									<div className="flex flex-wrap gap-2">
										{normalized.challenges.length ? (
											normalized.challenges.map((c, i) => (
												<span
													key={`${c}-${i}`}
													className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-700 text-xs ring-1 ring-neutral-200 ring-inset dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-700"
												>
													{c}
												</span>
											))
										) : (
											<span className="text-neutral-500 text-sm dark:text-neutral-400">—</span>
										)}
									</div>
								</div>

								{/* Content Types */}
								<div className="space-y-1.5">
									<div className="flex items-center gap-2 font-semibold text-neutral-500 text-xs uppercase tracking-wide dark:text-neutral-400">
										<MessageSquareText className="size-4" /> Content Types
									</div>
									<div className="flex flex-wrap gap-2">
										{normalized.contentTypes.length ? (
											normalized.contentTypes.map((c, i) => (
												<span
													key={`${c}-${i}`}
													className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-700 text-xs ring-1 ring-neutral-200 ring-inset dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-700"
												>
													{c}
												</span>
											))
										) : (
											<span className="text-neutral-500 text-sm dark:text-neutral-400">—</span>
										)}
									</div>
								</div>

								{/* Other Feedback */}
								<div className="space-y-1.5 sm:col-span-2">
									<div className="flex items-center gap-2 font-semibold text-neutral-500 text-xs uppercase tracking-wide dark:text-neutral-400">
										<MessageSquareText className="size-4" /> Other Feedback
									</div>
									<div className="whitespace-pre-wrap text-neutral-800 text-sm dark:text-neutral-100">
										{normalized.otherFeedback ?? "—"}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Desktop: regular card */}
				<div className="hidden md:block">
					<div className="rounded-xl border border-neutral-200/60 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
						{/* Header */}
						<div className="flex items-center justify-between gap-3 border-neutral-200/60 border-b px-4 py-3 dark:border-neutral-800">
							<h3 className="font-medium text-neutral-700 text-sm dark:text-neutral-200">{title}</h3>
							<span
								className={
									"inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-xs " +
									(normalized.completed
										? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 ring-inset dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800"
										: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 ring-inset dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800")
								}
							>
								{normalized.completed ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
								{normalized.completed ? "Completed" : "In progress"}
							</span>
						</div>

						{/* Body */}
						<div className="grid @xl:grid-cols-2 grid-cols-1 gap-5 p-4">
							{/* Name */}
							<div className="space-y-1.5">
								<div className="flex items-center gap-2 font-semibold text-neutral-500 text-xs uppercase tracking-wide dark:text-neutral-400">
									<User className="size-4" /> Name
								</div>
								<div className="whitespace-pre-wrap text-neutral-800 text-sm dark:text-neutral-100">
									{normalized.name ?? "—"}
								</div>
							</div>

							{/* Goal */}
							<div className="space-y-1.5">
								<div className="flex items-center gap-2 font-semibold text-neutral-500 text-xs uppercase tracking-wide dark:text-neutral-400">
									<Target className="size-4" /> Goal
								</div>
								<div className="whitespace-pre-wrap text-neutral-800 text-sm dark:text-neutral-100">
									{normalized.goal ?? "—"}
								</div>
							</div>

							{/* Problem */}
							<div className="space-y-1.5">
								<div className="flex items-center gap-2 font-semibold text-neutral-500 text-xs uppercase tracking-wide dark:text-neutral-400">
									<AlertTriangle className="size-4" /> Problem
								</div>
								<div className="whitespace-pre-wrap text-neutral-800 text-sm dark:text-neutral-100">
									{normalized.problem ?? "—"}
								</div>
							</div>

							{/* Challenges */}
							<div className="space-y-1.5">
								<div className="flex items-center gap-2 font-semibold text-neutral-500 text-xs uppercase tracking-wide dark:text-neutral-400">
									<ListChecks className="size-4" /> Challenges
								</div>
								<div className="flex flex-wrap gap-2">
									{normalized.challenges.length ? (
										normalized.challenges.map((c, i) => (
											<span
												key={`${c}-${i}`}
												className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-700 text-xs ring-1 ring-neutral-200 ring-inset dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-700"
											>
												{c}
											</span>
										))
									) : (
										<span className="text-neutral-500 text-sm dark:text-neutral-400">—</span>
									)}
								</div>
							</div>

							{/* Content Types */}
							<div className="space-y-1.5">
								<div className="flex items-center gap-2 font-semibold text-neutral-500 text-xs uppercase tracking-wide dark:text-neutral-400">
									<MessageSquareText className="size-4" /> Content Types
								</div>
								<div className="flex flex-wrap gap-2">
									{normalized.contentTypes.length ? (
										normalized.contentTypes.map((c, i) => (
											<span
												key={`${c}-${i}`}
												className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-700 text-xs ring-1 ring-neutral-200 ring-inset dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-700"
											>
												{c}
											</span>
										))
									) : (
										<span className="text-neutral-500 text-sm dark:text-neutral-400">—</span>
									)}
								</div>
							</div>

							{/* Other Feedback */}
							<div className="@lg:col-span-2 space-y-1.5">
								<div className="flex items-center gap-2 font-semibold text-neutral-500 text-xs uppercase tracking-wide dark:text-neutral-400">
									<MessageSquareText className="size-4" /> Other Feedback
								</div>
								<div className="whitespace-pre-wrap text-neutral-800 text-sm dark:text-neutral-100">
									{normalized.otherFeedback ?? "—"}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
