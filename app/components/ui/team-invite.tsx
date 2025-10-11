"use client"

import { Crown, Edit3, Eye, Users } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import * as React from "react"
import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Separator } from "~/components/ui/separator"
import { cn } from "~/lib/utils"

export type PermissionLevel = "can-view" | "can-edit" | "admin"

export interface TeamMember {
	id: string
	name: string
	email: string
	avatar?: string
	role: PermissionLevel
	isOwner?: boolean
}

export interface TeamInviteProps {
	className?: string
	teamName: string
	teamLogo?: string
	totalMembers: number
	members?: TeamMember[]
	onInvite?: (email: string, permission: PermissionLevel) => void
	onUpdateMemberPermission?: (memberId: string, permission: PermissionLevel) => void
	onCancel?: () => void
}

const permissionOptions = [
	{
		value: "can-view" as const,
		label: "Can view",
		description: "View only access",
		icon: Eye,
	},
	{
		value: "can-edit" as const,
		label: "Can edit",
		description: "Edit and view access",
		icon: Edit3,
	},
] as const

const getPermissionIcon = (permission: PermissionLevel) => {
	switch (permission) {
		case "can-view":
			return Eye
		case "can-edit":
			return Edit3
		case "admin":
			return Crown
		default:
			return Eye
	}
}

const getPermissionLabel = (permission: PermissionLevel) => {
	switch (permission) {
		case "can-view":
			return "Can view"
		case "can-edit":
			return "Can edit"
		case "admin":
			return "Admin"
		default:
			return "Can view"
	}
}

const _getPermissionColor = (permission: PermissionLevel) => {
	switch (permission) {
		case "can-view":
			return "default"
		case "can-edit":
			return "secondary"
		case "admin":
			return "destructive"
		default:
			return "default"
	}
}

const TeamInvite = React.forwardRef<HTMLDivElement, TeamInviteProps>(
	(
		{
			className,
			teamName,
			teamLogo,
			totalMembers,
			members = [],
			onInvite,
			onUpdateMemberPermission,
			onCancel,
			useActions = false,
			formAction,
			...props
		},
		ref
	) => {
		const [inviteEmail, setInviteEmail] = useState("")
		const [invitePermission, setInvitePermission] = useState<PermissionLevel>("can-view")
		const [isLoading, setIsLoading] = useState(false)

		const handleInvite = async () => {
			if (!inviteEmail.trim()) return

			setIsLoading(true)
			try {
				await onInvite?.(inviteEmail, invitePermission)
				setInviteEmail("")
				setInvitePermission("can-view")
			} finally {
				setIsLoading(false)
			}
		}

		const handleUpdatePermission = (memberId: string, permission: PermissionLevel) => {
			onUpdateMemberPermission?.(memberId, permission)
		}

		const getInitials = (name: string) => {
			return name
				.split(" ")
				.map((n) => n[0])
				.join("")
				.toUpperCase()
				.slice(0, 2)
		}

		return (
			<Card ref={ref} className={cn("w-full max-w-9xl", className)} {...props}>
				<CardHeader className="pb-4">
					<div className="flex items-center gap-3">
						<div className="flex-shrink-0">
							<Avatar className="size-10">
								<AvatarImage src={teamLogo} alt={teamName} />
								<AvatarFallback className="bg-primary text-primary-foreground">{getInitials(teamName)}</AvatarFallback>
							</Avatar>
						</div>
						<div className="min-w-0 flex-1">
							<CardTitle className="truncate font-semibold text-lg">{teamName}</CardTitle>
							<p className="flex items-center gap-1 text-muted-foreground text-sm">
								<Users size={14} />
								{totalMembers} {totalMembers === 1 ? "member" : "members"}
							</p>
						</div>
					</div>
				</CardHeader>

				<CardContent className="flex flex-col gap-6">
					{/* Share this folder section */}
					<div className="flex flex-col gap-4">
						<div className="flex items-center justify-between">
							<Label className="font-medium">Invite Members</Label>
						</div>
						<div className="flex gap-2">
							<div className="flex-1">
								<Input
									type="email"
									placeholder="Add an email or name"
									value={inviteEmail}
									onChange={(e) => setInviteEmail(e.target.value)}
									className="h-9"
								/>
							</div>
							<div>
								<Select
									value={invitePermission}
									onValueChange={(value) => setInvitePermission(value as PermissionLevel)}
								>
									<SelectTrigger className="h-9 text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{permissionOptions.map((option) => {
											const IconComponent = option.icon
											return (
												<SelectItem key={option.value} value={option.value}>
													<div className="flex items-center gap-2">
														<IconComponent size={14} />
														<span>{option.label}</span>
													</div>
												</SelectItem>
											)
										})}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="ml-auto flex w-fit justify-end gap-2">
							<Button variant="outline" size={"sm"} onClick={onCancel} className="h-9 flex-1">
								Cancel
							</Button>
							<Button
								onClick={handleInvite}
								size={"sm"}
								disabled={!inviteEmail.trim() || isLoading}
								className="h-9 flex-1"
							>
								Send Invite
							</Button>
						</div>
					</div>

					{/* Access section */}
					{members.length > 0 && (
						<>
							<Separator />
							<div className="flex flex-col gap-4">
								<Label className="font-medium text-base">Access</Label>

								<div className="flex flex-col gap-3">
									<AnimatePresence>
										{members.map((member) => {
											const PermissionIcon = getPermissionIcon(member.role)

											return (
												<motion.div
													key={member.id}
													initial={{ opacity: 0, y: 10 }}
													animate={{ opacity: 1, y: 0 }}
													exit={{ opacity: 0, y: -10 }}
													transition={{ duration: 0.2 }}
													className="flex items-center gap-3 rounded-ele p-2 transition-colors hover:bg-accent"
												>
													<Avatar className="size-6">
														<AvatarImage src={member.avatar} alt={member.name} />
														<AvatarFallback>{getInitials(member.name)}</AvatarFallback>
													</Avatar>

													<div className="min-w-0 flex-1">
														<div className="flex items-center gap-2">
															<p className="truncate font-medium text-sm">{member.name}</p>
															{member.isOwner && (
																<Badge variant="outline" className="px-1.5 py-0.5 text-xs">
																	Owner
																</Badge>
															)}
														</div>
														<p className="truncate text-muted-foreground text-xs">{member.email}</p>
													</div>

													<div className="flex items-center gap-2">
														{member.isOwner ? (
															<Badge variant="outline" className="text-xs">
																<Crown size={12} className="mr-1" />
																Owner
															</Badge>
														) : (
															<Select
																value={member.role}
																onValueChange={(value) => handleUpdatePermission(member.id, value as PermissionLevel)}
															>
																<SelectTrigger className="h-8 text-xs">
																	<div className="flex items-center gap-1">
																		<PermissionIcon size={12} />
																		<span className="truncate">{getPermissionLabel(member.role)}</span>
																	</div>
																</SelectTrigger>
																<SelectContent>
																	{permissionOptions.map((option) => {
																		const IconComponent = option.icon
																		return (
																			<SelectItem key={option.value} value={option.value}>
																				<div className="flex items-center gap-2">
																					<IconComponent size={14} />
																					<div>
																						<p className="font-medium">{option.label}</p>
																						<p className="text-muted-foreground text-xs">{option.description}</p>
																					</div>
																				</div>
																			</SelectItem>
																		)
																	})}
																</SelectContent>
															</Select>
														)}
													</div>
												</motion.div>
											)
										})}
									</AnimatePresence>
								</div>
							</div>
						</>
					)}

					{/* Actions */}
					{onCancel && (
						<>
							<Separator />
							<div className="flex justify-end gap-2">
								<Button variant="ghost" onClick={onCancel}>
									Cancel
								</Button>
								<Button onClick={onCancel}>Done</Button>
							</div>
						</>
					)}
				</CardContent>
			</Card>
		)
	}
)

TeamInvite.displayName = "TeamInvite"

export { TeamInvite }
