import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useFetcher } from "react-router-dom";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

const createTeamSchema = z.object({
	name: z.string().min(1, "Team name is required").max(50, "Team name must be 50 characters or less"),
	slug: z
		.string()
		.min(1, "Slug is required")
		.max(50, "Slug must be 50 characters or less")
		.regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
});

interface CreateTeamFormProps {
	onSuccess?: (accountId: string) => void;
	onCancel?: () => void;
}

export function CreateTeamForm({ onSuccess, onCancel }: CreateTeamFormProps) {
	const navigate = useNavigate();
	const fetcher = useFetcher<{
		ok: boolean;
		accountId?: string;
		error?: string;
		fieldErrors?: Record<string, string[]>;
	}>();
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [clientErrors, setClientErrors] = useState<{ name?: string; slug?: string }>({});

	const isSubmitting = fetcher.state === "submitting" || fetcher.state === "loading";

	// Auto-generate slug from name
	const handleNameChange = (value: string) => {
		setName(value);
		// Only auto-generate if user hasn't manually edited slug
		if (!slug || slug === slugify(name)) {
			setSlug(slugify(value));
		}
		// Clear client-side errors when user types
		if (clientErrors.name) {
			setClientErrors((prev) => ({ ...prev, name: undefined }));
		}
	};

	const handleSlugChange = (value: string) => {
		setSlug(slugify(value));
		// Clear client-side errors when user types
		if (clientErrors.slug) {
			setClientErrors((prev) => ({ ...prev, slug: undefined }));
		}
	};

	// Handle successful team creation
	useEffect(() => {
		if (fetcher.data?.ok && fetcher.data.accountId) {
			if (onSuccess) {
				onSuccess(fetcher.data.accountId);
			} else {
				navigate(`/a/${fetcher.data.accountId}/projects`);
			}
		}
	}, [fetcher.data, navigate, onSuccess]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setClientErrors({});

		// Client-side validation
		try {
			createTeamSchema.parse({ name, slug });
		} catch (err) {
			if (err instanceof z.ZodError) {
				const fieldErrors: { name?: string; slug?: string } = {};
				for (const issue of err.issues) {
					const field = issue.path[0] as "name" | "slug";
					fieldErrors[field] = issue.message;
				}
				setClientErrors(fieldErrors);
				return;
			}
		}

		// Submit to server action
		const formData = new FormData();
		formData.append("name", name);
		formData.append("slug", slug);
		fetcher.submit(formData, { method: "post", action: "/api/teams/create" });
	};

	// Get error message to display
	const serverError = fetcher.data?.error;

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="team-name">Team Name</Label>
				<Input
					id="team-name"
					type="text"
					placeholder="Acme Research"
					value={name}
					onChange={(e) => handleNameChange(e.target.value)}
					disabled={isSubmitting}
					className={clientErrors.name ? "border-red-500" : ""}
				/>
				{clientErrors.name && <p className="text-red-500 text-sm">{clientErrors.name}</p>}
			</div>

			<div className="space-y-2">
				<Label htmlFor="team-slug">Team Slug</Label>
				<Input
					id="team-slug"
					type="text"
					placeholder="acme-research"
					value={slug}
					onChange={(e) => handleSlugChange(e.target.value)}
					disabled={isSubmitting}
					className={clientErrors.slug ? "border-red-500" : ""}
				/>
				<p className="text-muted-foreground text-xs">
					Used in URLs: /a/<span className="font-mono">{slug || "your-slug"}</span>
				</p>
				{clientErrors.slug && <p className="text-red-500 text-sm">{clientErrors.slug}</p>}
			</div>

			{serverError && (
				<div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-600 text-sm dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
					{serverError}
				</div>
			)}

			<div className="flex justify-end gap-2 pt-2">
				{onCancel && (
					<Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
						Cancel
					</Button>
				)}
				<Button type="submit" disabled={isSubmitting || !name || !slug}>
					{isSubmitting ? "Creating..." : "Create Team"}
				</Button>
			</div>
		</form>
	);
}

// Helper function to slugify text
function slugify(text: string): string {
	return text
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, "") // Remove special characters
		.replace(/[\s_-]+/g, "-") // Replace spaces, underscores with hyphens
		.replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}
