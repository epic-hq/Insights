import { Command, CommandInput } from "~/components/ui/command"
import { DropdownMenu } from "~/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { CategoryFilterChipBasic } from "~/features/aichat/components/FilterChips"
import { IdeasBoard } from "~/features/aichat/components/IdeasBoard"
// import { CategoryFilterChip } from "~/components/CategoryFilterChip";
import { InsightsList } from "~/features/aichat/components/InsightsList"
// import { ChatSheet } from "~/features/insights/pages/ChatSheet";

import consola from "consola"
import { useState } from "react"
import type { LoaderFunctionArgs } from "react-router"
import { NavLink, useLoaderData } from "react-router"
import { getInsights } from "~/features/insights/db"
import AddInterviewButton from "~/features/upload/components/AddInterviewButton"
import { currentProjectContext } from "~/server/current-project-context"
import { userContext } from "~/server/user-context"
import type { Insight } from "~/types"
import ChatSheet from "../components/ChatSheet"

export async function loader({ context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	const ctx_project = context.get(currentProjectContext)
	const projectId = ctx_project.projectId || ""
	const accountId = ctx_project.accountId || ""

	const { data: insights, error } = await getInsights({
		supabase,
		accountId,
		projectId,
	})

	if (error) {
		consola.error("Insights query error:", error)
		throw new Response(`Error fetching insights: ${error.message}`, { status: 500 })
	}

	consola.log(`Found ${insights?.length || 0} insights`)

	return {
		insights: insights || [],
	}
}

function Tab({ to, label }: { to: string; label: string }) {
	// RR7 <NavLink> styling
	return (
		<NavLink
			to={to}
			className={({ isActive }) =>
				`inline-flex h-8 items-center rounded-lg px-3 text-sm ${
					isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
				}`
			}
		>
			{label}
		</NavLink>
	)
}

export function AppHeader({ onNew }: { onNew: () => void }) {
	return (
		<header className="sticky top-0 z-20 border-slate-200 border-b bg-white/80 backdrop-blur">
			<div className="mx-auto flex h-12 max-w-[1200px] items-center justify-between px-3">
				<div className="font-semibold tracking-tight">Upsight</div>

				<nav className="flex rounded-xl border border-slate-200 p-0.5">
					<Tab to="/" label="Insights" />
					<Tab to="/suggestions" label="Suggestions" />
					<Tab to="/chat" label="Chat" />
				</nav>

				<button
					onClick={onNew}
					className="hidden h-8 rounded-lg border border-slate-200 px-3 text-sm hover:bg-slate-50 md:inline-flex"
				>
					+ Add Interview
				</button>
			</div>
		</header>
	)
}

export default function QuickInsights() {
	const { insights } = useLoaderData<typeof loader>()
	const [searchQuery, _setSearchQuery] = useState("")
	const [selected, _setSelected] = useState<Insight | null>(null)
	const _filtered = insights.filter(
		(insight: Insight) =>
			insight.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			insight.details?.toLowerCase().includes(searchQuery.toLowerCase())
	)

	consola.log("Selected insight:", selected)
	return (
		<div className="min-h-screen bg-gray-50 p-4">
			{/* Header with tabs */}
			<Tabs defaultValue="insights" className="w-full">
				<div className="flex h-12 items-center justify-between px-3">
					{/* <Logo /> */}
					<AddInterviewButton />
					<TabsList className="h-8">
						<TabsTrigger value="insights">Insights</TabsTrigger>
						<TabsTrigger value="suggestions">Suggestions</TabsTrigger>
						<TabsTrigger value="chat">Chat</TabsTrigger>
					</TabsList>
					<DropdownMenu>…</DropdownMenu>
				</div>

				<div className="px-3">
					<Command className="rounded-xl border">
						<CommandInput placeholder="Search insights…" />
						<div className="flex gap-2 p-2">
							<CategoryFilterChipBasic categories={[]} value={""} onChange={() => {}} />
							{/* <CategoryFilterChip /> */}
						</div>
					</Command>
				</div>

				<TabsContent value="insights">
					<InsightsList />
				</TabsContent>
				<TabsContent value="suggestions">
					<IdeasBoard />
				</TabsContent>
				<TabsContent value="chat">
					<ChatSheet />
				</TabsContent>
			</Tabs>
		</div>
	)
}
