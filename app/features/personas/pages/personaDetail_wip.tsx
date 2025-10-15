import consola from "consola"
import { ArrowLeft } from "lucide-react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useLoaderData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import PersonaStrategicPanel, { type PersonaStrategicProps } from "~/features/personas/components/PersonaStrategicPanel"
import { getServerClient } from "~/lib/supabase/client.server"

const MOCKDATA = true

export const meta: MetaFunction = () => [{ title: "Persona Detail | Insights" }]

export async function loader({ request, params }: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const { projectId, personaId } = params as { projectId: string; personaId: string }

	if (MOCKDATA) {
		return {
			projectId,
			personaId,
			persona: {
				name: "John Doe",
				role: "Core Persona",
				kind: "core",
				tags: ["tag1", "tag2"],
				strengths: ["strength1", "strength2"],
				mbti: "MBTI",
				enneagram: "Enneagram",
				temperament: "Temperament",
				behavior_patterns: ["pattern1", "pattern2"],
				emotional_profile: ["profile1", "profile2"],
				effective_strategies: ["strategy1", "strategy2"],
				recommended_questions: ["question1", "question2"],
				common_pitfalls: ["pitfall1", "pitfall2"],
				coaching_prompts: ["prompt1", "prompt2"],
				evidence: ["evidence1", "evidence2"],
				learning_loop: {
					last_tactics: ["tactic1", "tactic2"],
					notes: "Notes",
				},
			},
		}
	}
	const { data, error } = await supabase
		.from("personas")
		.select(`
      id, name_and_tagline, role, kind, tags,
      strengths, mbti, enneagram, temperament,
      behavior_patterns, emotional_profile,
      effective_strategies, recommended_questions, common_pitfalls, coaching_prompts,
      evidence, learning_loop
    `)
		.eq("project_id", projectId)
		.eq("id", personaId)
		.single()

	if (error) {
		throw new Response(`Error fetching persona: ${error.message}`, { status: 500 })
	}

	// Map DB -> component props; keep names consistent with component
	const props: PersonaStrategicProps = {
		name: data.name_and_tagline,
		role: data.role ?? undefined,
		kind: (data.kind ?? "core") as any,
		tags: data.tags ?? [],
		strengths: data.strengths ?? [],
		mbti: data.mbti ?? undefined,
		enneagram: data.enneagram ?? undefined,
		temperament: data.temperament ?? undefined,
		behaviors: data.behavior_patterns ?? [],
		emotional_profile: data.emotional_profile ?? [],
		effective_strategies: data.effective_strategies ?? [],
		recommended_questions: data.recommended_questions ?? [],
		common_pitfalls: data.common_pitfalls ?? [],
		coaching_prompts: data.coaching_prompts ?? [],
		evidence: data.evidence ?? [],
		learning_loop: data.learning_loop ?? undefined,
	}

	return { projectId, personaId, persona: props }
}

export default function PersonaDetailPage() {
	const { projectId, personaId, persona } = useLoaderData<typeof loader>()

	const handleAskAI = (topic: string) => {
		// Hook your LLM endpoint/action here
		// e.g., submit fetcher to /api.ask with { personaId, topic }
		consola.log("Ask AI:", topic, { projectId, personaId })
	}

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
	)
}
