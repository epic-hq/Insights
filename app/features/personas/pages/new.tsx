import { motion } from "framer-motion";
import { type ActionFunctionArgs, type MetaFunction, redirect, useActionData } from "react-router-dom";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { getServerClient } from "~/lib/supabase/client.server";
import type { Database } from "~/types";
import { createProjectRoutes } from "~/utils/routes.server";

type PersonaInsert = Database["public"]["Tables"]["personas"]["Insert"];

export const meta: MetaFunction = () => {
	return [{ title: "New Persona | Insights" }, { name: "description", content: "Create a new user persona" }];
};

export async function loader({
	request,
	params,
}: {
	request: Request;
	params: { accountId: string; projectId: string };
}) {
	const { client: supabase } = getServerClient(request);
	const { data: jwt } = await supabase.auth.getClaims();
	const accountId = params?.accountId;
	const projectId = params?.projectId;

	const _routes = createProjectRoutes(accountId, projectId);
	if (!accountId) {
		throw new Response("Unauthorized", { status: 401 });
	}

	return {};
}

export async function action({ request, params }: ActionFunctionArgs) {
	const formData = await request.formData();
	const name = (formData.get("name") as string)?.trim();
	if (!name) return { error: "Name is required" };

	const description = (formData.get("description") as string) || null;
	const color_hex = (formData.get("color_hex") as string) || "#6b7280";
	const image_url = (formData.get("image_url") as string) || null;

	const { client: supabase } = getServerClient(request);
	const { data: jwt } = await supabase.auth.getClaims();

	const accountId = params?.accountId;
	const projectId = params?.projectId;
	if (!accountId || !projectId) throw new Response("Unauthorized", { status: 401 });

	const routes = createProjectRoutes(accountId, projectId);
	const personaData: PersonaInsert = {
		name,
		description,
		color_hex,
		image_url,
		account_id: accountId,
		project_id: projectId,
	};

	const { data: persona, error } = await supabase.from("personas").insert(personaData).select().single();

	if (error) {
		return { error: `Failed to create persona: ${error.message}` };
	}

	return redirect(routes.personas.detail(persona.id));
}

export default function NewPersona() {
	const actionData = useActionData<typeof action>();
	const currentProjectContext = useCurrentProject();
	const routes = useProjectRoutes(currentProjectContext?.projectPath || "");

	return (
		<div className="mx-auto max-w-2xl px-3 py-6 sm:px-6">
			<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
				<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm">
					<CardHeader className="pb-2 sm:pb-4">
						<CardTitle className="text-2xl">Create New Persona</CardTitle>
					</CardHeader>
					<CardContent className="p-0 sm:p-4">
						<form method="post" className="space-y-6">
							{actionData?.error && (
								<div className="rounded-md bg-red-50 p-4">
									<div className="text-red-700 text-sm">{actionData.error}</div>
								</div>
							)}

							<div className="space-y-2">
								<Label htmlFor="name">Name *</Label>
								<Input
									id="name"
									name="name"
									type="text"
									required
									placeholder="e.g., Tech-Savvy Professional"
									className="w-full"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="description">Description</Label>
								<Textarea
									id="description"
									name="description"
									placeholder="Describe this persona's characteristics, needs, and behaviors..."
									rows={4}
									className="w-full"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="image_url">Profile Image URL</Label>
								<Input
									id="image_url"
									name="image_url"
									type="url"
									placeholder="https://example.com/image.jpg"
									className="w-full"
								/>
								<span className="text-muted-foreground text-xs">
									Optional: URL to an image that represents this persona
								</span>
							</div>

							<div className="space-y-2">
								<Label htmlFor="color_hex">Theme Color</Label>
								<div className="flex items-center gap-3">
									<Input id="color_hex" name="color_hex" type="color" defaultValue="#6b7280" className="h-10 w-20" />
									<span className="text-muted-foreground text-sm">Choose a color to represent this persona</span>
								</div>
							</div>

							<div className="flex gap-3 pt-2 sm:pt-4">
								<Button type="submit" className="flex-1">
									Create Persona
								</Button>
								<Button type="button" variant="outline" asChild>
									<a href={routes.personas.index()}>Cancel</a>
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			</motion.div>
		</div>
	);
}
