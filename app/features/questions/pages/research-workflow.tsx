import { consola } from "consola"
import { useState } from "react"
import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData } from "react-router"
import { PageContainer } from "~/components/layout/PageContainer"
import { ResearchStructureManager } from "~/components/research/ResearchStructureManager"
import { getServerClient } from "~/lib/supabase/client.server"

interface ResearchStructure {
	decision_questions: Array<{
		id: string
		text: string
		rationale?: string
	}>
	research_questions: Array<{
		id: string
		text: string
		rationale?: string
		decision_question_id: string
	}>
}

interface LoaderData {
	project: {
		id: string
		title: string
	}
	projectPath: string
	research_goal?: string
	target_roles?: string
	target_orgs?: string
	assumptions?: string
	unknowns?: string
	hasExistingStructure: boolean
}

export async function loader({ params, request }: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const projectId = params.projectId
	consola.log("research-workflow: projectId", projectId)

	if (!projectId) {
		throw new Response("Project not found", { status: 404 })
	}

	// Load project
	const { data: project, error: projectError } = await supabase
		.from("projects")
		.select("id, name")
		.eq("id", projectId)
		.single()

	if (projectError || !project) {
		throw new Response("Project not found", { status: 404 })
	}

	// Load project sections for context
	const { data: projectSections } = await supabase
		.from("project_sections")
		.select("kind, content_md")
		.eq("project_id", projectId)
		.in("kind", ["research_goal", "target_roles", "target_orgs", "assumptions", "unknowns"])

	type ProjectSectionRow = {
		kind: string
		content_md: string | null
	}

	const projectContext = ((projectSections ?? []) as ProjectSectionRow[]).reduce<Record<string, string>>(
		(acc, section) => {
			if (section.content_md) {
				acc[section.kind] = section.content_md
			}
			return acc
		},
		{}
	)

	// Check if research structure already exists
	const { data: existingDQs } = await supabase
		.from("decision_questions")
		.select("id")
		.eq("project_id", projectId)
		.limit(1)

	return {
		project,
		projectPath: `/projects/${projectId}`,
		research_goal: projectContext.research_goal,
		target_roles: projectContext.target_roles,
		target_orgs: projectContext.target_orgs,
		assumptions: projectContext.assumptions,
		unknowns: projectContext.unknowns,
		hasExistingStructure: (existingDQs?.length || 0) > 0,
	}
}

export default function ResearchWorkflowPage() {
	const data = useLoaderData<LoaderData>()
	const [_validatedStructure, setValidatedStructure] = useState<ResearchStructure | null>(null)

	const handleStructureValidated = (structure: ResearchStructure) => {
		setValidatedStructure(structure)
	}

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Simple Header */}
			<div className="border-b bg-white">
				<PageContainer size="lg" padded={false} className="max-w-6xl px-4 py-4">
					<h1 className="font-semibold text-xl">{data.project.name}</h1>
				</PageContainer>
			</div>

			{/* Content */}
			<PageContainer size="lg" padded={false} className="max-w-6xl space-y-8 p-4">
				{/* Research Structure Section */}
				<ResearchStructureManager
					projectId={data.project.id}
					projectPath={data.projectPath}
					research_goal={data.research_goal}
					target_roles={data.target_roles}
					target_orgs={data.target_orgs}
					assumptions={data.assumptions}
					unknowns={data.unknowns}
					onStructureValidated={handleStructureValidated}
				/>

				{/* Interview Questions Section
				<InterviewQuestionsManager
					projectId={data.project.id}
					research_goal={data.research_goal}
					target_roles={data.target_roles}
					target_orgs={data.target_orgs}
					assumptions={data.assumptions}
					unknowns={data.unknowns}
					researchStructure={validatedStructure}
				/> */}
			</PageContainer>
		</div>
	)
}
