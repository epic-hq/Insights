import type * as React from "react";
import { useFetcher } from "react-router";
import InlineEdit from "~/components/ui/inline-edit";

type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };

type UserSettings = {
	// core
	id: string;
	user_id?: string | null;
	first_name?: string | null;
	last_name?: string | null;
	company_name?: string | null;
	company_website?: string | null;
	company_description?: string | null;
	title?: string | null;
	role?: string | null;
	industry?: string | null;
	email?: string | null;
	mobile_phone?: string | null;
	image_url?: string | null;

	// jsonb & prefs
	signup_data?: JSONValue;
	setup_data?: JSONValue; // tolerate alternate name
	trial_goals?: JSONValue;
	referral_source?: string | null;
	metadata?: JSONValue;
	onboarding_completed?: boolean;
	onboarding_steps?: JSONValue;
	theme?: string | null;
	language?: string | null;
	notification_preferences?: JSONValue;
	ui_preferences?: JSONValue;
	last_used_account_id?: string | null;
	last_used_project_id?: string | null;

	// timestamps
	created_at?: string;
	updated_at?: string;

	// alt fields (second schema variant)
	account_id?: string | null;
	app_activity?: JSONValue;
	created_by?: string | null;
	updated_by?: string | null;
};

function cn(...s: Array<string | false | undefined | null>) {
	return s.filter(Boolean).join(" ");
}

function isEmptyJson(v: JSONValue | undefined): boolean {
	if (v == null) return true;
	if (Array.isArray(v)) return v.length === 0;
	if (typeof v === "object") return Object.keys(v as Record<string, unknown>).length === 0;
	return false;
}

function formatScalar(v: Exclude<JSONValue, object | JSONValue[]>): string {
	if (v === null) return "null";
	if (typeof v === "boolean") return v ? "true" : "false";
	return String(v);
}

function JsonKV({ data, level = 0 }: { data: JSONValue; level?: number }) {
	if (data == null) return null;

	if (Array.isArray(data)) {
		return (
			<ul className="space-y-1">
				{data.map((item, i) => (
					<li key={i} className="rounded-md border border-gray-200 p-2">
						<JsonKV data={item} level={level + 1} />
					</li>
				))}
			</ul>
		);
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
		);
	}

	// primitive
	return <span className="font-mono">{formatScalar(data as any)}</span>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="grid grid-cols-3 gap-3 py-2">
			<div className="col-span-1 font-medium text-gray-600 text-sm">{label}</div>
			<div className="col-span-2 text-sm">{value}</div>
		</div>
	);
}

function EditableRow({
	label,
	field,
	value,
	placeholder,
	multiline = false,
}: {
	label: string;
	field: string;
	value?: string | null;
	placeholder?: string;
	multiline?: boolean;
}) {
	const fetcher = useFetcher();

	const handleSubmit = (newValue: string) => {
		const formData = new FormData();
		formData.append("field", field);
		formData.append("value", newValue);
		fetcher.submit(formData, { method: "post" });
	};

	return (
		<div className="grid grid-cols-3 gap-3 py-2">
			<div className="col-span-1 font-medium text-gray-600 text-sm">{label}</div>
			<div className="col-span-2 text-sm">
				<InlineEdit
					value={value || ""}
					onSubmit={handleSubmit}
					placeholder={placeholder || "Click to add"}
					textClassName="text-sm"
					inputClassName="text-sm"
					autoFocus={true}
					multiline={multiline}
				/>
			</div>
		</div>
	);
}

function _BoolPill({ value }: { value?: boolean }) {
	if (value === undefined || value === null) return null;
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs",
				value ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-700"
			)}
		>
			{value ? "Yes" : "No"}
		</span>
	);
}

function _Time({ iso }: { iso?: string }) {
	if (!iso) return null;
	const d = new Date(iso);
	const ok = !Number.isNaN(d.getTime());
	return <span className="font-mono">{ok ? d.toLocaleString() : iso}</span>;
}

function UserSettings({
	settings,
	oauthAvatar,
	className,
	title = "User Settings",
}: {
	settings: UserSettings;
	oauthAvatar?: string | null;
	className?: string;
	title?: string;
}) {
	// Check if profile is incomplete
	const missingFields = [];
	if (!settings.first_name) missingFields.push("first name");
	if (!settings.last_name) missingFields.push("last name");
	if (!settings.company_name) missingFields.push("company");
	if (!settings.title) missingFields.push("title");
	if (!settings.role) missingFields.push("role");

	const isIncomplete = missingFields.length > 0;

	return (
		<section className={cn("w-full", className)}>
			<header className="mb-4">
				<h2 className="font-semibold text-xl">{title}</h2>
				{isIncomplete && (
					<p className="mt-1 text-amber-600 text-sm">
						Complete your profile to help us personalize your experience. Missing: {missingFields.join(", ")}
					</p>
				)}
			</header>

			{/* Identity */}
			<div className="rounded-xl border bg-white p-4 shadow-sm">
				<div className="mb-3">
					<h3 className="font-semibold text-gray-500 text-sm uppercase tracking-wide">Profile Information</h3>
					<p className="mt-1 text-gray-500 text-xs">Click any field to edit. Changes save automatically.</p>
				</div>
				<div className="divide-y">
					<div className="grid grid-cols-3 gap-3 py-2">
						<div className="col-span-1 font-medium text-gray-600 text-sm">Avatar</div>
						<div className="col-span-2">
							{/* Show custom URL if set, otherwise OAuth avatar */}
							{(settings.image_url || oauthAvatar) && (
								<div className="mb-2">
									<img
										src={settings.image_url || oauthAvatar || ""}
										alt="avatar"
										className="h-16 w-16 rounded-full object-cover ring-2 ring-gray-200"
									/>
									{settings.image_url ? (
										<p className="mt-1 text-gray-500 text-xs">Custom profile picture</p>
									) : oauthAvatar ? (
										<p className="mt-1 text-gray-500 text-xs">From your OAuth provider</p>
									) : null}
								</div>
							)}
							<InlineEdit
								value={settings.image_url || ""}
								onSubmit={(newValue) => {
									const formData = new FormData();
									formData.append("field", "image_url");
									formData.append("value", newValue);
									const fetcher = {
										submit: (data: FormData) => {
											fetch(window.location.pathname, {
												method: "POST",
												body: data,
											}).then(() => window.location.reload());
										},
									};
									fetcher.submit(formData);
								}}
								placeholder={oauthAvatar ? "Add a custom URL override" : "Paste a URL to your profile picture"}
								textClassName="text-xs text-gray-500"
								inputClassName="text-sm"
								autoFocus={true}
							/>
							{/* <p className="mt-1 text-gray-400 text-xs">
								{oauthAvatar
									? "Add a custom URL to override your OAuth avatar"
									: "Paste a URL to your profile picture"}
							</p> */}
						</div>
					</div>
					<EditableRow label="First Name" field="first_name" value={settings.first_name} />
					<EditableRow label="Last Name" field="last_name" value={settings.last_name} />
					<Row label="Email" value={settings.email || <span className="text-gray-400 text-sm italic">Not set</span>} />
					<EditableRow
						label="Mobile"
						field="mobile_phone"
						value={settings.mobile_phone}
						placeholder="Add phone number"
					/>
				</div>
			</div>

			{/* Professional Info */}
			<div className="mt-6 rounded-xl border bg-white p-4 shadow-sm">
				<h3 className="mb-2 font-semibold text-gray-500 text-sm uppercase tracking-wide">Professional Information</h3>
				<div className="divide-y">
					<EditableRow label="Title" field="title" value={settings.title} placeholder="Add job title" />
					<EditableRow
						label="Role"
						field="role"
						value={settings.role}
						placeholder="e.g., Product Manager, Designer, Founder"
					/>
					<EditableRow
						label="Industry"
						field="industry"
						value={settings.industry}
						placeholder="e.g., SaaS, Healthcare, Finance"
					/>
					<EditableRow
						label="Referral Source"
						field="referral_source"
						value={settings.referral_source}
						placeholder="How did you hear about us?"
					/>
				</div>
			</div>

			{/* Company Info */}
			<div className="mt-6 rounded-xl border bg-white p-4 shadow-sm">
				<h3 className="mb-2 font-semibold text-gray-500 text-sm uppercase tracking-wide">Company Information</h3>
				<div className="divide-y">
					<EditableRow
						label="Company Name"
						field="company_name"
						value={settings.company_name}
						placeholder="Add company name"
					/>
					<EditableRow
						label="Website"
						field="company_website"
						value={settings.company_website}
						placeholder="https://example.com"
					/>
					<EditableRow
						label="Description"
						field="company_description"
						value={settings.company_description}
						placeholder="Brief description of your company"
						multiline={true}
					/>
				</div>
			</div>

			{/* Preferences */}
			<div className="mt-6 rounded-xl border bg-white p-4 shadow-sm">
				<h3 className="mb-2 font-semibold text-gray-500 text-sm uppercase tracking-wide">Preferences</h3>
				<div className="divide-y">
					<EditableRow label="Theme" field="theme" value={settings.theme} placeholder="light, dark, or system" />
					<EditableRow label="Language" field="language" value={settings.language} placeholder="en" />
				</div>
			</div>

			{/* Advanced Preferences - Only show if they exist */}
			<div className="mt-6 grid gap-6 md:grid-cols-1">
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
			</div>
		</section>
	);
}

export default UserSettings;
