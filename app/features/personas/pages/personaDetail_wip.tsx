import consola from "consola";
import { ArrowLeft } from "lucide-react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router-dom";
import { Button } from "~/components/ui/button";
import PersonaStrategicPanel, {
	PersonaStrategicPanelMockData,
	type PersonaStrategicProps,
} from "~/features/personas/components/PersonaStrategicPanel";

const MOCKDATA = true;

export const meta: MetaFunction = () => [{ title: "Persona Detail | Insights" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
	const { projectId, personaId } = params as { projectId: string; personaId: string };
	void request;

	if (MOCKDATA) {
		return {
			projectId,
			personaId,
			persona: PersonaStrategicPanelMockData satisfies PersonaStrategicProps,
		};
	}
	return { projectId, personaId, persona: PersonaStrategicPanelMockData satisfies PersonaStrategicProps };
}

export default function PersonaDetailPage() {
	const { projectId, personaId, persona } = useLoaderData<typeof loader>();

	const handleAskAI = (topic: string) => {
		// Hook your LLM endpoint/action here
		// e.g., submit fetcher to /api.ask with { personaId, topic }
		consola.log("Ask AI:", topic, { projectId, personaId });
	};

	return (
		<div className="mx-auto max-w-5xl px-4 py-6">
			<div className="mb-4 flex items-center justify-between">
				<Button asChild variant="ghost" size="sm">
					<Link to={`/projects/${projectId}/personas`}>
						<ArrowLeft className="mr-2 h-4 w-4" /> Back
					</Link>
				</Button>
			</div>

			<PersonaStrategicPanel {...persona} onAskAI={handleAskAI} />
		</div>
	);
}
