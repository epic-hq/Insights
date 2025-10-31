import { task } from "@trigger.dev/sdk"
import consola from "consola"

import { b } from "~/../baml_client"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import type { Tables } from "~/types"
import { workflowRetryConfig } from "~/utils/processInterview.server"

type Payload = {
        personaId: string
        projectId: string
        accountId: string
}

export const generatePersonaSummaryTask = task({
        id: "personas.generate-summary",
        retry: workflowRetryConfig,
        run: async ({ personaId, projectId, accountId }: Payload) => {
                const supabase = createSupabaseAdminClient()

                type PeoplePersonaRow = Pick<Tables<"people_personas">, "person_id" | "persona_id"> & {
                        people: Tables<"people"> | null
                }

                const { data: people, error: peopleError } = await supabase
                        .from("people_personas")
                        .select<PeoplePersonaRow>("person_id, people(*)")
                        .eq("persona_id", personaId)
                if (peopleError) {
                        throw new Error(`Failed to fetch people for persona: ${peopleError.message}`)
                }

                type PersonaInsightRow = Pick<Tables<"persona_insights">, "insight_id" | "persona_id"> & {
                        insights: Tables<"insights"> | null
                }

                const { data: personaInsights, error: insightsError } = await supabase
                        .from("persona_insights")
                        .select<PersonaInsightRow>("insight_id, insights(*)")
                        .eq("persona_id", personaId)
                if (insightsError) {
                        throw new Error(`Failed to fetch persona insights: ${insightsError.message}`)
                }

                const peopleIds = (people ?? [])
                        .map((entry) => entry.person_id)
                        .filter((value): value is string => Boolean(value))

                let interviewsRecords: Tables<"interviews">[] = []
                if (peopleIds.length > 0) {
                        type InterviewPeopleRow = Pick<Tables<"interview_people">, "interview_id" | "person_id">

                        const { data: interviewPeopleData, error: interviewPeopleError } = await supabase
                                .from("interview_people")
                                .select<InterviewPeopleRow>("interview_id, person_id")
                                .in("person_id", peopleIds)
                        if (interviewPeopleError) {
                                throw new Error(`Failed to fetch interview_people: ${interviewPeopleError.message}`)
                        }

                        const interviewIds = (interviewPeopleData ?? [])
                                .map((record) => record.interview_id)
                                .filter((value): value is string => Boolean(value))
                        if (interviewIds.length > 0) {
                                const { data: interviewsData, error: interviewsError } = await supabase
                                        .from("interviews")
                                        .select<Tables<"interviews">>("*")
                                        .in("id", interviewIds)
                                if (interviewsError) {
                                        throw new Error(`Failed to fetch interviews: ${interviewsError.message}`)
                                }
                                interviewsRecords = interviewsData ?? []
                        }
                }

                const { data: evidenceData, error: evidenceError } = await supabase
                        .from("evidence")
                        .select<Tables<"evidence">>("*")
                        .eq("project_id", projectId)
                if (evidenceError) {
                        throw new Error(`Failed to fetch evidence for persona refresh: ${evidenceError.message}`)
                }

                const peopleRecords = (people ?? [])
                        .map((entry) => entry.people)
                        .filter((value): value is Tables<"people"> => Boolean(value))
                const insightsRecords = (personaInsights ?? [])
                        .map((entry) => entry.insights)
                        .filter((value): value is Tables<"insights"> => Boolean(value))

                const bamlResult = await b.ExtractPersona(
                        JSON.stringify(peopleRecords),
                        JSON.stringify(insightsRecords),
                        JSON.stringify(interviewsRecords),
                        JSON.stringify(evidenceData ?? [])
                )

                const { error: updateError } = await supabase
                        .from("personas")
                        .update({
                                name: bamlResult.name,
                                description: bamlResult.description,
                                age: bamlResult.age,
                                gender: bamlResult.gender,
                                location: bamlResult.location,
                                education: bamlResult.education,
                                occupation: bamlResult.occupation,
                                income: bamlResult.income,
                                languages: bamlResult.languages,
                                segment: bamlResult.segment,
                                role: bamlResult.role,
                                color_hex: bamlResult.color_hex,
                                image_url: bamlResult.image_url,
                                motivations: bamlResult.motivations,
                                values: bamlResult.values,
                                frustrations: bamlResult.frustrations,
                                preferences: bamlResult.preferences,
                                learning_style: bamlResult.learning_style,
                                tech_comfort_level: bamlResult.tech_comfort_level,
                                frequency_of_purchase: bamlResult.frequency_of_purchase,
                                frequency_of_use: bamlResult.frequency_of_use,
                                key_tasks: bamlResult.key_tasks,
                                tools_used: bamlResult.tools_used,
                                primary_goal: bamlResult.primary_goal,
                                secondary_goals: bamlResult.secondary_goals,
                                sources: bamlResult.sources,
                                quotes: bamlResult.quotes,
                                percentage: bamlResult.percentage,
                                updated_at: new Date().toISOString(),
                        })
                        .eq("id", personaId)
                        .eq("account_id", accountId)

                if (updateError) {
                        throw new Error(`Failed to update persona: ${updateError.message}`)
                }

                consola.info(`[Persona] refreshed persona ${personaId}`)

                return {
                        personaId,
                        updatedFields: Object.keys(bamlResult ?? {}),
                }
        },
})
