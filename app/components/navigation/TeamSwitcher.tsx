import { Check, ChevronsUpDown, Crown, Plus, Settings } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useRouteLoaderData } from "react-router-dom";
import { Button } from "~/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "~/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { SidebarMenu, SidebarMenuItem } from "~/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { useCurrentProject } from "~/contexts/current-project-context";
import { CreateTeamForm } from "~/features/teams/components/CreateTeamForm";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { cn } from "~/lib/utils";
import { createRouteDefinitions } from "~/utils/route-definitions";

interface ProjectRecord {
	id: string;
	account_id: string;
	name?: string | null;
	slug?: string | null;
}

interface AccountRecord {
	account_id: string;
	account_role?: string | null;
	name?: string | null;
	personal_account?: boolean | null;
	projects?: ProjectRecord[] | null;
}

interface ProtectedLayoutData {
	accounts?: AccountRecord[] | string | null;
	user_settings?: { last_used_project_id?: string | null } | null;
}

interface TeamSwitcherProps {
	accounts?: AccountRecord[];
	collapsed?: boolean;
}

export function TeamSwitcher({ accounts: propAccounts, collapsed = false }: TeamSwitcherProps) {
	const [open, setOpen] = useState(false);
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const navigate = useNavigate();
	const { accountId, projectId, setLastProjectPath } = useCurrentProject();
	const protectedData = useRouteLoaderData("routes/_ProtectedLayout") as ProtectedLayoutData | null;

	// Get ALL accounts (including personal) for lookup purposes
	const allAccounts = useMemo<AccountRecord[]>(() => {
		if (propAccounts && propAccounts.length > 0) {
			return propAccounts;
		}

		if (!protectedData?.accounts) {
			return [];
		}

		if (typeof protectedData.accounts === "string") {
			try {
				const parsed = JSON.parse(protectedData.accounts);
				return Array.isArray(parsed) ? parsed : [];
			} catch (error) {
				console.error("Failed to parse accounts from protected loader data", error);
				return [];
			}
		}

		return Array.isArray(protectedData.accounts) ? protectedData.accounts : [];
	}, [propAccounts, protectedData?.accounts]);

	// Find current account from ALL accounts (before filtering)
	const currentAccount = useMemo(() => {
		if (accountId) {
			const found = allAccounts.find((acct) => acct.account_id === accountId);
			if (found) return found;
		}
		// Fallback to first non-personal account, or first account
		return allAccounts.find((acct) => !acct.personal_account) || allAccounts[0];
	}, [allAccounts, accountId]);

	// Filter and sort accounts for dropdown display (exclude personal, sort alphabetically)
	const accounts = useMemo<AccountRecord[]>(() => {
		return allAccounts
			.filter((acct) => !acct.personal_account)
			.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
	}, [allAccounts]);

	// Determine current project - search across ALL accounts to persist context
	const { currentProject, projectAccount } = useMemo(() => {
		// First priority: URL projectId within current account
		if (projectId && currentAccount?.projects) {
			const urlProject = currentAccount.projects.find((proj) => proj.id === projectId);
			if (urlProject) return { currentProject: urlProject, projectAccount: currentAccount };
		}

		// Second priority: last_used_project_id - search across ALL accounts
		const userSettings = protectedData?.user_settings as { last_used_project_id?: string | null } | undefined;
		const lastUsedProjectId = userSettings?.last_used_project_id;
		if (lastUsedProjectId) {
			for (const account of allAccounts) {
				const project = account.projects?.find((proj) => proj.id === lastUsedProjectId);
				if (project) {
					return { currentProject: project, projectAccount: account };
				}
			}
		}

		// Final fallback: first project from first non-personal account
		const fallbackAccount = allAccounts.find((acct) => !acct.personal_account && acct.projects?.length);
		if (fallbackAccount?.projects?.[0]) {
			return {
				currentProject: fallbackAccount.projects[0],
				projectAccount: fallbackAccount,
			};
		}

		// Last resort: first project from any account
		const anyAccountWithProjects = allAccounts.find((acct) => acct.projects?.length);
		return {
			currentProject: anyAccountWithProjects?.projects?.[0],
			projectAccount: anyAccountWithProjects,
		};
	}, [projectId, currentAccount, protectedData, allAccounts]);

	const currentProjectLabel = currentProject?.name || "Select a project";
	// Show the account that owns the displayed project, not the URL's account
	const currentAccountLabel = projectAccount?.name || currentAccount?.name || "Select an account";
	const initials = currentProject?.name?.charAt(0)?.toUpperCase() || "P";

	// Settings route for the gear icon
	const effectiveAccountId = projectAccount?.account_id || accountId || "";
	const effectiveProjectId = currentProject?.id || projectId || "";
	const projectPath = effectiveAccountId && effectiveProjectId ? `/a/${effectiveAccountId}/${effectiveProjectId}` : "";
	const routes = useProjectRoutes(projectPath);

	const handleSelectProject = async (acctId: string, projId: string) => {
		if (!acctId || !projId) {
			console.error("Cannot navigate: missing accountId or projectId", {
				acctId,
				projId,
			});
			return;
		}

		// Update local context state
		setLastProjectPath({ accountId: acctId, projectId: projId });

		// Persist preference to database to prevent sidebar showing wrong project
		try {
			const formData = new FormData();
			formData.append("accountId", acctId);
			formData.append("projectId", projId);

			await fetch("/api/update-user-project-preference", {
				method: "POST",
				body: formData,
			});
		} catch (error) {
			console.error("Failed to persist project preference:", error);
			// Don't block navigation on persistence failure
		}

		const basePath = `/a/${acctId}/${projId}`;
		const routes = createRouteDefinitions(basePath);
		navigate(routes.dashboard());
		setOpen(false);
	};

	const handleTeamCreated = (newAccountId: string) => {
		setShowCreateDialog(false);
		setOpen(false);
		// Navigate to create new project in the new team
		const basePath = `/a/${newAccountId}`;
		const routes = createRouteDefinitions(basePath);
		navigate(routes.projects.new());
	};

	if (accounts.length === 0) {
		return null;
	}

	return (
		<SidebarMenu className="">
			<SidebarMenuItem>
				<div className="flex items-center gap-0.5">
					<Popover open={open} onOpenChange={setOpen}>
						<PopoverTrigger asChild>
							<Button
								variant="ghost"
								role="combobox"
								aria-expanded={open}
								className={cn(
									"min-w-0 flex-1 justify-start gap-2 overflow-hidden hover:bg-sidebar-accent",
									collapsed ? "-ml-1 h-10 w-10 justify-center p-0" : "-ml-2 px-1"
								)}
							>
								<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
									<span className="font-semibold text-sm">{initials}</span>
								</div>
								{!collapsed && (
									<div className="flex min-w-0 flex-1 flex-col items-start text-left">
										<span className="truncate font-medium text-sm">{currentProjectLabel}</span>
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
										<CommandGroup
											key={account.account_id}
											heading={
												<span className="flex items-center gap-1.5">
													{account.name || "Untitled account"}
													{account.account_role === "owner" && <Crown className="h-3 w-3 text-amber-500" />}
												</span>
											}
										>
											{(account.projects ?? []).map((project) => {
												// Use currentProject/projectAccount for active state instead of URL params
												// This ensures checkmark shows correctly even on routes without projectId in URL
												const isActive =
													account.account_id === projectAccount?.account_id && project.id === currentProject?.id;
												return (
													<CommandItem
														key={`${account.account_id}:${project.id}`}
														value={`${project.name || "Untitled project"} ${account.name || ""}`}
														onSelect={() => handleSelectProject(account.account_id, project.id)}
													>
														<Check className={cn("mr-2 h-4 w-4", isActive ? "opacity-100" : "opacity-0")} />
														<span className="truncate">{project.name || "Untitled project"}</span>
													</CommandItem>
												);
											})}
										</CommandGroup>
									))}
									<CommandSeparator />
									<CommandGroup>
										<CommandItem
											onSelect={() => {
												setOpen(false);
												setShowCreateDialog(true);
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
					{/* Settings gear icon - visible when sidebar is expanded */}
					{!collapsed && projectPath && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
									asChild
								>
									<Link to={routes.settings()}>
										<Settings className="h-3.5 w-3.5" />
										<span className="sr-only">Project settings</span>
									</Link>
								</Button>
							</TooltipTrigger>
							<TooltipContent side="right">Project settings</TooltipContent>
						</Tooltip>
					)}
				</div>

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
	);
}
