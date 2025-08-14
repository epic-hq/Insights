import type * as React from "react"

type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue }

export type UserSettings = {
	// core
	id: string
	user_id?: string | null
	first_name?: string | null
	last_name?: string | null
	company_name?: string | null
	title?: string | null
	role?: string | null
	industry?: string | null
	email?: string | null
	mobile_phone?: string | null
	image_url?: string | null

	// jsonb & prefs
	signup_data?: JSONValue
	setup_data?: JSONValue // tolerate alternate name
	trial_goals?: JSONValue
	referral_source?: string | null
	metadata?: JSONValue
	onboarding_completed?: boolean
	onboarding_steps?: JSONValue
	theme?: string | null
	language?: string | null
	notification_preferences?: JSONValue
	ui_preferences?: JSONValue
	last_used_account_id?: string | null
	last_used_project_id?: string | null

	// timestamps
	created_at?: string
	updated_at?: string

	// alt fields (second schema variant)
	account_id?: string | null
	app_activity?: JSONValue
	created_by?: string | null
	updated_by?: string | null
}

function cn(...s: Array<string | false | undefined | null>) {
	return s.filter(Boolean).join(" ")
}

function isEmptyJson(v: JSONValue | undefined): boolean {
	if (v == null) return true
	if (Array.isArray(v)) return v.length === 0
	if (typeof v === "object") return Object.keys(v as Record<string, unknown>).length === 0
	return false
}

function formatScalar(v: Exclude<JSONValue, object | JSONValue[]>): string {
	if (v === null) return "null"
	if (typeof v === "boolean") return v ? "true" : "false"
	return String(v)
}

function JsonKV({ data, level = 0 }: { data: JSONValue; level?: number }) {
	if (data == null) return null

	if (Array.isArray(data)) {
		return (
			<ul className="space-y-1">
				{data.map((item, i) => (
					<li key={i} className="rounded-md border border-gray-200 p-2">
						<JsonKV data={item} level={level + 1} />
					</li>
				))}
			</ul>
		)
	}

	if (typeof data === "object") {
		return (
			<dl className={cn("grid gap-2", level === 0 ? "sm:grid-cols-2" : "")}>
				{Object.entries(data as Record<string, JSONValue>).map(([k, v]) => (
					<div key={k} className="flex flex-col">
						<dt className="font-medium text-gray-500 text-xs uppercase tracking-wide">{k}</dt>
						<dd className="text-sm">
							{typeof v === "object" && v !== null ? (
								<div className="mt-1 rounded-md border border-gray-200 p-2">
									<JsonKV data={v} level={level + 1} />
								</div>
							) : (
								<span className="font-mono">{formatScalar(v as any)}</span>
							)}
						</dd>
					</div>
				))}
			</dl>
		)
	}

	// primitive
	return <span className="font-mono">{formatScalar(data as any)}</span>
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
	if (value === undefined || value === null || value === "") return null
	return (
		<div className="grid grid-cols-3 gap-3 py-2">
			<div className="col-span-1 font-medium text-gray-600 text-sm">{label}</div>
			<div className="col-span-2 text-sm">{value}</div>
		</div>
	)
}

function BoolPill({ value }: { value?: boolean }) {
	if (value === undefined || value === null) return null
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs",
				value ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-700"
			)}
		>
			{value ? "Yes" : "No"}
		</span>
	)
}

function Time({ iso }: { iso?: string }) {
	if (!iso) return null
	const d = new Date(iso)
	const ok = !Number.isNaN(d.getTime())
	return <span className="font-mono">{ok ? d.toLocaleString() : iso}</span>
}

export function UserSettings({
	settings,
	className,
	title = "User Settings",
}: {
	settings: UserSettings
	className?: string
	title?: string
}) {
	const signup = settings.setup_data ?? settings.signup_data

	return (
		<section className={cn("w-full", className)}>
			<header className="mb-4">
				<h2 className="font-semibold text-xl">{title}</h2>
				<p className="text-gray-500 text-sm">{/* ID: <span className="font-mono">{settings.id}</span> */}</p>
			</header>

			{/* Identity */}
			<div className="rounded-xl border bg-white p-4 shadow-sm">
				<h3 className="mb-2 font-semibold text-gray-500 text-sm uppercase tracking-wide">Profile</h3>
				<div className="divide-y">
					<Row label="User ID" value={<span className="font-mono">{settings.user_id}</span>} />
					<Row label="First Name" value={settings.first_name} />
					<Row label="Last Name" value={settings.last_name} />
					<Row label="Email" value={settings.email} />
					<Row label="Mobile" value={settings.mobile_phone} />
					<Row label="Company" value={settings.company_name} />
					<Row label="Title" value={settings.title} />
					<Row label="Role" value={settings.role} />
					<Row label="Industry" value={settings.industry} />
					<Row label="Theme" value={settings.theme} />
					<Row label="Language" value={settings.language} />
					<Row label="Onboarding Completed" value={<BoolPill value={settings.onboarding_completed} />} />
					<Row label="Last Used Account" value={<span className="font-mono">{settings.last_used_account_id}</span>} />
					<Row label="Last Used Project" value={<span className="font-mono">{settings.last_used_project_id}</span>} />
					{/* alt schema extras */}
					<Row label="Account ID" value={<span className="font-mono">{settings.account_id}</span>} />
					<Row label="Created By" value={settings.created_by} />
					<Row label="Updated By" value={settings.updated_by} />
					<Row label="Created At" value={<Time iso={settings.created_at} />} />
					<Row label="Updated At" value={<Time iso={settings.updated_at} />} />
					{settings.image_url ? (
						<Row
							label="Avatar"
							value={
								<img
									src={settings.image_url}
									alt="avatar"
									className="h-12 w-12 rounded-full object-cover ring-1 ring-gray-200"
								/>
							}
						/>
					) : null}
				</div>
			</div>

			{/* JSON Sections */}
			<div className="mt-6 grid gap-6 md:grid-cols-1">
				{!isEmptyJson(signup) && (
					<div className="rounded-xl border bg-white p-4 shadow-sm">
						<h3 className="mb-2 font-semibold text-gray-500 text-sm uppercase tracking-wide">
							{settings.setup_data !== undefined ? "Setup Data" : "Signup Data"}
						</h3>
						<JsonKV data={signup as JSONValue} />
					</div>
				)}

				{!isEmptyJson(settings.trial_goals) && (
					<div className="rounded-xl border bg-white p-4 shadow-sm">
						<h3 className="mb-2 font-semibold text-gray-500 text-sm uppercase tracking-wide">Trial Goals</h3>
						<JsonKV data={settings.trial_goals as JSONValue} />
					</div>
				)}

				{!isEmptyJson(settings.onboarding_steps) && (
					<div className="rounded-xl border bg-white p-4 shadow-sm">
						<h3 className="mb-2 font-semibold text-gray-500 text-sm uppercase tracking-wide">Onboarding Steps</h3>
						<JsonKV data={settings.onboarding_steps as JSONValue} />
					</div>
				)}

				{!isEmptyJson(settings.notification_preferences) && (
					<div className="rounded-xl border bg-white p-4 shadow-sm">
						<h3 className="mb-2 font-semibold text-gray-500 text-sm uppercase tracking-wide">
							Notification Preferences
						</h3>
						<JsonKV data={settings.notification_preferences as JSONValue} />
					</div>
				)}

				{!isEmptyJson(settings.ui_preferences) && (
					<div className="rounded-xl border bg-white p-4 shadow-sm">
						<h3 className="mb-2 font-semibold text-gray-500 text-sm uppercase tracking-wide">UI Preferences</h3>
						<JsonKV data={settings.ui_preferences as JSONValue} />
					</div>
				)}

				{!isEmptyJson(settings.metadata) && (
					<div className="rounded-xl border bg-white p-4 shadow-sm">
						<h3 className="mb-2 font-semibold text-gray-500 text-sm uppercase tracking-wide">Metadata</h3>
						<JsonKV data={settings.metadata as JSONValue} />
					</div>
				)}

				{!isEmptyJson(settings.app_activity) && (
					<div className="rounded-xl border bg-white p-4 shadow-sm">
						<h3 className="mb-2 font-semibold text-gray-500 text-sm uppercase tracking-wide">App Activity</h3>
						<JsonKV data={settings.app_activity as JSONValue} />
					</div>
				)}
			</div>
		</section>
	)
}

export default UserSettings
