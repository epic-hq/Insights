import { Check, ChevronsUpDown, FolderOpen, PlusCircle } from "lucide-react"
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
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
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

interface AccountProjectSwitcherProps {
	collapsed?: boolean
}

export function AccountProjectSwitcher({ collapsed = false }: AccountProjectSwitcherProps) {
	const [open, setOpen] = useState(false)
	const navigate = useNavigate()
	const { accountId, projectId, lastProjectPath, setLastProjectPath } = useCurrentProject()
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
	const currentProject = currentAccount?.projects?.find((proj) => proj.id === projectId) || currentAccount?.projects?.[0]

	const currentProjectLabel = currentProject?.name || "Select a project"
	const currentAccountLabel = currentAccount?.name || "Select an account"

	const handleSelectProject = (acctId: string, projId: string) => {
		setLastProjectPath({ accountId: acctId, projectId: projId })
		const basePath = `/a/${acctId}/${projId}`
		const routes = createRouteDefinitions(basePath)
		navigate(routes.dashboard())
		setOpen(false)
	}

	const handleViewProjects = (acctId: string) => {
		navigate(`/a/${acctId}/projects`)
		setOpen(false)
	}

	const handleCreateProject = (acctId: string) => {
		navigate(`/a/${acctId}/projects/new`)
		setOpen(false)
	}

	if (accounts.length === 0) {
		return null
	}

	if (collapsed) {
		return (
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Open project switcher">
						<FolderOpen className="h-4 w-4" />
					</Button>
				</PopoverTrigger>
				<PopoverContent align="start" className="w-72 p-0">
					<AccountProjectCommandList
						accounts={accounts}
						activeAccountId={lastProjectPath.accountId}
						activeProjectId={lastProjectPath.projectId}
						onSelectProject={handleSelectProject}
						onViewProjects={handleViewProjects}
						onCreateProject={handleCreateProject}
					/>
				</PopoverContent>
			</Popover>
		)
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="w-full justify-between gap-3 overflow-hidden"
				>
					<div className="flex min-w-0 flex-col items-start text-left">
						<span className="truncate font-medium text-sm">{currentProjectLabel}</span>
						<span className="truncate text-muted-foreground text-xs">{currentAccountLabel}</span>
					</div>
					<ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-72 p-0">
				<AccountProjectCommandList
					accounts={accounts}
					activeAccountId={accountId}
					activeProjectId={projectId}
					onSelectProject={handleSelectProject}
					onViewProjects={handleViewProjects}
					onCreateProject={handleCreateProject}
				/>
			</PopoverContent>
		</Popover>
	)
}

interface AccountProjectCommandListProps {
	accounts: AccountRecord[]
	activeAccountId?: string
	activeProjectId?: string
	onSelectProject: (accountId: string, projectId: string) => void
	onViewProjects: (accountId: string) => void
	onCreateProject: (accountId: string) => void
}

function AccountProjectCommandList({
	accounts,
	activeAccountId,
	activeProjectId,
	onSelectProject,
	onViewProjects,
	onCreateProject,
}: AccountProjectCommandListProps) {
	return (
		<Command>
			<CommandInput placeholder="Search projects..." />
			<CommandList>
				<CommandEmpty>No projects found.</CommandEmpty>
				{accounts.map((account) => (
					<CommandGroup key={account.account_id} heading={account.name || "Untitled account"}>
						{(account.projects ?? []).map((project) => {
							const isActive = account.account_id === activeAccountId && project.id === activeProjectId
							return (
								<CommandItem
									key={`${account.account_id}:${project.id}`}
									value={`${account.account_id}-${project.id}`}
									onSelect={() => onSelectProject(account.account_id, project.id)}
								>
									<Check className={cn("h-4 w-4", isActive ? "opacity-100" : "opacity-0")} />
									<span className="truncate">{project.name || "Untitled project"}</span>
								</CommandItem>
							)
						})}
						{/* <CommandSeparator />
						<CommandItem onSelect={() => onViewProjects(account.account_id)}>
							<FolderOpen className="h-4 w-4" />
							<span className="truncate">View projects</span>
						</CommandItem>
						<CommandItem onSelect={() => onCreateProject(account.account_id)}>
							<PlusCircle className="h-4 w-4" />
							<span className="truncate">Create project</span>
						</CommandItem> */}
					</CommandGroup>
				))}
			</CommandList>
		</Command>
	)
}
