import type React from "react"
import { useCurrentAccount } from "~/contexts/current-account-context"

export const AccountSelectorModal: React.FC = () => {
	const { account, setAccount, allAccounts, loading } = useCurrentAccount()

	if (loading || account || allAccounts.length <= 1) return null

	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				width: "100vw",
				height: "100vh",
				background: "rgba(0,0,0,0.5)",
				zIndex: 1000,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<div
				style={{
					background: "white",
					borderRadius: 8,
					padding: 32,
					minWidth: 320,
					boxShadow: "0 2px 16px rgba(0,0,0,0.2)",
				}}
			>
				<h2 style={{ marginBottom: 16, fontWeight: 600 }}>Select an Account or Team</h2>
				<ul style={{ listStyle: "none", padding: 0 }}>
					{allAccounts.map((acct) => (
						<li key={acct.account_id} style={{ marginBottom: 12 }}>
							<button
								style={{
									width: "100%",
									padding: "12px 16px",
									borderRadius: 4,
									border: "1px solid #ddd",
									background: "#f9f9f9",
									fontWeight: 500,
									cursor: "pointer",
								}}
								onClick={() => setAccount(acct)}
							>
								{acct.name || acct.account_id}
								{acct.personal_account ? " (Personal)" : " (Team)"}
							</button>
						</li>
					))}
				</ul>
			</div>
		</div>
	)
}
