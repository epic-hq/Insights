import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate, useRouteLoaderData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "~/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { SidebarMenu, SidebarMenuItem } from "~/components/ui/sidebar"
import { useCurrentProject } from "~/contexts/current-project-context"
import { CreateTeamForm } from "~/features/teams/components/CreateTeamForm"
import { cn } from "~/lib/utils"
import { createRouteDefinitions } from "~/utils/route-definitions"

interface ProjectRecord {
	id: string
	account_id: string
	name?: string | null
	slug?: string | null
}

interface AccountRecord {
	account_id: string
	name?: string | null
	personal_account?: boolean | null
	projects?: ProjectRecord[] | null
}

interface ProtectedLayoutData {
	accounts?: AccountRecord[] | string | null
	user_settings?: { last_used_project_id?: string | null } | null
}

interface TeamSwitcherProps {
	accounts?: AccountRecord[]
	collapsed?: boolean
}

export function TeamSwitcher({ accounts: propAccounts, collapsed = false }: TeamSwitcherProps) {
	const [open, setOpen] = useState(false)
	const [showCreateDialog, setShowCreateDialog] = useState(false)
	const navigate = useNavigate()
	const { accountId, projectId, setLastProjectPath } = useCurrentProject()
	const protectedData = useRouteLoaderData("routes/_ProtectedLayout") as ProtectedLayoutData | null

	const accounts = useMemo<AccountRecord[]>(() => {
		// Use passed-in accounts if available, otherwise fall back to loader data
		if (propAccounts && propAccounts.length > 0) {
			return propAccounts
		}

		if (!protectedData?.accounts) {
			console.log("[TeamSwitcher] No accounts data")
			return []
		}
		let accountsList: AccountRecord[] = []

		if (typeof protectedData.accounts === "string") {
			try {
				const parsed = JSON.parse(protectedData.accounts)
				accountsList = Array.isArray(parsed) ? parsed : []
			} catch (error) {
				console.error("Failed to parse accounts from protected loader data", error)
				return []
			}
		} else if (Array.isArray(protectedData.accounts)) {
			accountsList = protectedData.accounts
		}

		console.log(
			"[TeamSwitcher] Accounts data:",
			accountsList.map((acc) => ({
				id: acc.account_id,
				name: acc.name,
				projectsCount: acc.projects?.length || 0,
				projectNames: acc.projects?.map((p) => p.name) || [],
			}))
		)

		// Filter out personal accounts from the team switcher dropdown
		const filtered = accountsList.filter((acct) => !acct.personal_account)
		console.log("[TeamSwitcher] Filtered accounts:", filtered.length)
		return filtered
	}, [propAccounts, protectedData?.accounts])

	const currentAccount = accounts.find((acct) => acct.account_id === accountId) || accounts[0]

	// Determine current project with same fallback logic as AppSidebar
	const currentProject = useMemo(() => {
		// First priority: URL projectId
		if (projectId && currentAccount?.projects) {
			const urlProject = currentAccount.projects.find((proj) => proj.id === projectId)
			if (urlProject) return urlProject
		}

		// Second priority: last_used_project_id from user_settings
		const userSettings = protectedData?.user_settings as { last_used_project_id?: string | null } | undefined
		const lastUsedProjectId = userSettings?.last_used_project_id
		if (lastUsedProjectId && currentAccount?.projects) {
			const lastUsedProject = currentAccount.projects.find((proj) => proj.id === lastUsedProjectId)
			if (lastUsedProject) return lastUsedProject
		}

		// Final fallback: first project
		return currentAccount?.projects?.[0]
	}, [projectId, currentAccount, protectedData])

	const currentProjectLabel = currentProject?.name || "Select a project"
	const currentAccountLabel = currentAccount?.name || "Select an account"
	const initials = currentProject?.name?.charAt(0)?.toUpperCase() || "P"

	const handleSelectProject = async (acctId: string, projId: string) => {
		if (!acctId || !projId) {
			console.error("Cannot navigate: missing accountId or projectId", {
				acctId,
				projId,
			})
			return
		}

		// Update local context state
		setLastProjectPath({ accountId: acctId, projectId: projId })

		// Persist preference to database to prevent sidebar showing wrong project
		try {
			const formData = new FormData()
			formData.append("accountId", acctId)
			formData.append("projectId", projId)

			await fetch("/api/update-user-project-preference", {
				method: "POST",
				body: formData,
			})
		} catch (error) {
			console.error("Failed to persist project preference:", error)
			// Don't block navigation on persistence failure
		}

		const basePath = `/a/${acctId}/${projId}`
		const routes = createRouteDefinitions(basePath)
		navigate(routes.dashboard())
		setOpen(false)
	}

	const handleTeamCreated = (newAccountId: string) => {
		setShowCreateDialog(false)
		setOpen(false)
		// Navigate to create new project in the new team
		const basePath = `/a/${newAccountId}`
		const routes = createRouteDefinitions(basePath)
		navigate(routes.projects.new())
	}

	if (accounts.length === 0) {
		return null
	}

	return (
		<SidebarMenu className="">
			<SidebarMenuItem>
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger asChild>
						<Button
							variant="ghost"
							role="combobox"
							aria-expanded={open}
							className={cn(
								"w-full justify-start gap-2 overflow-hidden hover:bg-sidebar-accent",
								collapsed ? "-ml-1 h-10 w-10 justify-center p-0" : "-ml-2 px-1"
							)}
						>
							<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
								<span className="font-semibold text-sm">{initials}</span>
							</div>
							{!collapsed && (
								<div className="flex min-w-0 flex-1 flex-col items-start text-left">
									<span className="truncate font-medium text-sm">{currentProjectLabel}</span>
									<span className="truncate text-muted-foreground text-xs">{currentAccountLabel}</span>
								</div>
							)}
							{!collapsed && <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />}
						</Button>
					</PopoverTrigger>
					<PopoverContent align="start" className="w-72 p-0">
						<Command>
							<CommandInput placeholder="Search projects..." />
							<CommandList>
								<CommandEmpty>No projects found.</CommandEmpty>
								{accounts.map((account) => (
									<CommandGroup key={account.account_id} heading={account.name || "Untitled account"}>
										{(account.projects ?? []).map((project) => {
											// Use currentProject/currentAccount for active state instead of URL params
											// This ensures checkmark shows correctly even on routes without projectId in URL
											const isActive =
												account.account_id === currentAccount?.account_id && project.id === currentProject?.id
											return (
												<CommandItem
													key={`${account.account_id}:${project.id}`}
													value={`${project.name || "Untitled project"} ${account.name || ""}`}
													onSelect={() => handleSelectProject(account.account_id, project.id)}
												>
													<Check className={cn("mr-2 h-4 w-4", isActive ? "opacity-100" : "opacity-0")} />
													<span className="truncate">{project.name || "Untitled project"}</span>
												</CommandItem>
											)
										})}
									</CommandGroup>
								))}
								<CommandSeparator />
								<CommandGroup>
									<CommandItem
										onSelect={() => {
											setOpen(false)
											setShowCreateDialog(true)
										}}
										className="text-primary"
									>
										<Plus className="mr-2 h-4 w-4" />
										<span>Create Team</span>
									</CommandItem>
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>

				{/* Create Team Dialog */}
				<Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
					<DialogContent className="sm:max-w-md">
						<DialogHeader>
							<DialogTitle>Create a New Team</DialogTitle>
							<DialogDescription>
								Create a team workspace to collaborate with others on research projects.
							</DialogDescription>
						</DialogHeader>
						<CreateTeamForm onSuccess={handleTeamCreated} onCancel={() => setShowCreateDialog(false)} />
					</DialogContent>
				</Dialog>
			</SidebarMenuItem>
		</SidebarMenu>
	)
}
