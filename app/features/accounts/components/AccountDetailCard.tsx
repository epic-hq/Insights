import { formatDistanceToNow } from "date-fns"
import { motion } from "framer-motion"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { cn } from "~/lib/utils"
import type { GetAccount } from "~/types"

interface AccountDetailProps {
	account: GetAccount
	className?: string
}

export default function AccountDetailCard({ account, className }: AccountDetailProps) {
	// Generate color from slug or fallback
	const themeColor = stringToColor(account.slug || account.name || "A")
	const initials = (account.name || "A")
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2)

	return (
		<motion.div
			className={`relative overflow-hidden rounded-xl border border-border bg-background shadow-md transition-all duration-300 hover:shadow-lg ${className ?? ""}`}
			whileHover={{ y: -4, scale: 1.02 }}
			transition={{ duration: 0.3, ease: "easeOut" }}
		>
			<div className="h-1 w-full" style={{ backgroundColor: themeColor }} />
			<div className="flex items-center gap-4 p-6">
				<Avatar className="h-14 w-14 border-2" style={{ borderColor: themeColor }}>
					<AvatarFallback className="font-medium text-lg text-white" style={{ backgroundColor: themeColor }}>
						{initials}
					</AvatarFallback>
				</Avatar>
				<div className="flex-1">
					<h3 className="mb-1 font-bold text-xl" style={{ color: themeColor }}>
						{account.name}
					</h3>
					<div className="mb-1 text-muted-foreground text-xs">slug: {account.slug || "Not Set"}</div>
					<div className="flex flex-wrap gap-2 text-xs">
						<div className={cn("rounded px-2 py-0.5", account.personal_account ? "bg-muted" : "bg-purple-300")}>
							{account.personal_account ? "Personal" : "Team"}
						</div>
						{account.is_primary_owner ? (
							<div className="rounded bg-accent-foreground/40 bg-success px-2 py-0.5">Owner</div>
						) : (
							<div className="rounded bg-muted px-2 py-0.5">Member</div>
						)}
						<div className="text-muted-foreground">id: {account.account_id}</div>
						<div>
							<div className="flex items-end justify-end gap-1 text-muted-foreground">
								Created {formatDistanceToNow(account.created_at, { addSuffix: true })}
							</div>
						</div>
					</div>
				</div>
				{account.billing_customer && (
					<div className="flex flex-wrap gap-2 text-xs">
						<div className="text-muted-foreground">Billing Contact:</div>
						<div className="rounded bg-muted px-2 py-0.5">{account.billing_customer.email}</div>
					</div>
				)}
			</div>
		</motion.div>
	)
}

// Utility: hash string to color
function stringToColor(str: string) {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash)
	}
	const c = (hash & 0x00ffffff).toString(16).toUpperCase()
	return `#${"00000".substring(0, 6 - c.length)}${c}`
}
