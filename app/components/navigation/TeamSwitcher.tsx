import { Check, ChevronsUpDown } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate, useRouteLoaderData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { SidebarMenu, SidebarMenuItem } from "~/components/ui/sidebar"
import { useCurrentProject } from "~/contexts/current-project-context"
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
}

interface TeamSwitcherProps {
	collapsed?: boolean
}

export function TeamSwitcher({ collapsed = false }: TeamSwitcherProps) {
	const [open, setOpen] = useState(false)
	const navigate = useNavigate()
	const { accountId, projectId, setLastProjectPath } = useCurrentProject()
	const protectedData = useRouteLoaderData("routes/_ProtectedLayout") as ProtectedLayoutData | null

	const accounts = useMemo<AccountRecord[]>(() => {
		if (!protectedData?.accounts) return []
		if (typeof protectedData.accounts === "string") {
			try {
				const parsed = JSON.parse(protectedData.accounts)
				return Array.isArray(parsed) ? parsed : []
			} catch (error) {
				console.error("Failed to parse accounts from protected loader data", error)
				return []
			}
		}
		if (Array.isArray(protectedData.accounts)) {
			return protectedData.accounts
		}
		return []
	}, [protectedData?.accounts])

	const currentAccount = accounts.find((acct) => acct.account_id === accountId) || accounts[0]
	const currentProject =
		currentAccount?.projects?.find((proj) => proj.id === projectId) || currentAccount?.projects?.[0]

	const currentProjectLabel = currentProject?.name || "Select a project"
	const currentAccountLabel = currentAccount?.name || "Select an account"
	const initials = currentProject?.name?.charAt(0)?.toUpperCase() || "P"

	const handleSelectProject = (acctId: string, projId: string) => {
		setLastProjectPath({ accountId: acctId, projectId: projId })
		const basePath = `/a/${acctId}/${projId}`
		const routes = createRouteDefinitions(basePath)
		navigate(routes.dashboard())
		setOpen(false)
	}

	if (accounts.length === 0) {
		return null
	}

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger asChild>
						<Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-start gap-2">
							<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
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
											const isActive = account.account_id === accountId && project.id === projectId
											return (
												<CommandItem
													key={`${account.account_id}:${project.id}`}
													value={`${account.account_id}-${project.id}`}
													onSelect={() => handleSelectProject(account.account_id, project.id)}
												>
													<Check className={cn("mr-2 h-4 w-4", isActive ? "opacity-100" : "opacity-0")} />
													<span className="truncate">{project.name || "Untitled project"}</span>
												</CommandItem>
											)
										})}
									</CommandGroup>
								))}
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>
			</SidebarMenuItem>
		</SidebarMenu>
	)
}
