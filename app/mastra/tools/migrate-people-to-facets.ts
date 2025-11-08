import { openai } from "@ai-sdk/openai"
import { createClient } from "@supabase/supabase-js"
import { generateObject } from "ai"
import consola from "consola"
import { z } from "zod"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
	throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Schema for LLM classification output
const PersonSegmentClassification = z.object({
	job_function: z
		.string()
		.nullable()
		.describe("Job function like 'Product Manager', 'Developer', 'Designer', 'Founder'"),
	seniority_level: z
		.string()
		.nullable()
		.describe("Seniority level like 'Junior', 'Mid-level', 'Senior', 'Executive', 'C-Level'"),
	title: z.string().nullable().describe("Specific job title if clear from data"),
	industry: z.string().nullable().describe("Industry like 'Healthcare', 'SaaS', 'Finance', 'Education', 'E-commerce'"),
	life_stage: z
		.string()
		.nullable()
		.describe("Life stage like 'Student', 'Early Career', 'Mid-Career', 'Established Professional', 'Parent'"),
	age_range: z.string().nullable().describe("Age range like '18-24', '25-34', '35-44', '45-54', '55+'"),
	confidence: z.number().min(0).max(1).describe("Overall confidence in classification from 0 to 1"),
	reasoning: z.string().describe("Brief explanation of classification decisions"),
})

type PersonData = {
	id: string
	name: string | null
	role: string | null
	title: string | null
	occupation: string | null
	segment: string | null
	industry: string | null
	company: string | null
	age: number | null
	project_id: string
	account_id: string
}

type Classification = z.infer<typeof PersonSegmentClassification>

async function classifyPerson(person: PersonData): Promise<Classification> {
	const prompt = `Analyze this person's data and classify them into appropriate segments.

Person Data:
- Name: ${person.name || "N/A"}
- Role: ${person.role || "N/A"}
- Title: ${person.title || "N/A"}
- Occupation: ${person.occupation || "N/A"}
- Current Segment: ${person.segment || "N/A"}
- Industry: ${person.industry || "N/A"}
- Company: ${person.company || "N/A"}
- Age: ${person.age || "N/A"}

Guidelines:
1. job_function: Broad category (Product Manager, Developer, Designer, Marketer, Sales, Founder, etc.)
2. seniority_level: Career level (Junior, Mid-level, Senior, Executive, C-Level)
3. title: Use their actual title if available, otherwise infer from role/occupation
4. industry: The industry they work in (Healthcare, SaaS, Finance, Education, etc.)
5. life_stage: Personal/career stage (Student, Early Career, Mid-Career, Established Professional, Parent, etc.)
6. age_range: Age bracket (18-24, 25-34, 35-44, 45-54, 55+)

If you can't determine a value confidently, return null for that field.
Provide a confidence score (0-1) based on how much data is available.`

	const result = await generateObject({
		model: openai("gpt-4o-mini"),
		schema: PersonSegmentClassification,
		prompt,
	})

	return result.object
}

async function getFacetKindId(slug: string): Promise<number | null> {
	const { data } = await supabase.from("facet_kind_global").select("id").eq("slug", slug).single()

	return data?.id ?? null
}

async function getOrCreateFacet(kindId: number, label: string, accountId: string): Promise<string | null> {
	if (!label) return null

	// Check if facet exists
	const { data: existing } = await supabase
		.from("facet_account")
		.select("id")
		.eq("kind_id", kindId)
		.eq("label", label)
		.eq("account_id", accountId)
		.single()

	if (existing) return existing.id

	// Create new facet
	const { data: newFacet, error } = await supabase
		.from("facet_account")
		.insert({
			kind_id: kindId,
			label,
			account_id: accountId,
			slug: label.toLowerCase().replace(/\s+/g, "-"),
		})
		.select("id")
		.single()

	if (error) {
		consola.error(`Error creating facet ${label}:`, error)
		return null
	}

	return newFacet.id
}

async function linkPersonToFacet(
	personId: string,
	facetAccountId: string,
	accountId: string,
	projectId: string,
	confidence: number
) {
	// Check if link already exists
	const { data: existing } = await supabase
		.from("person_facet")
		.select("person_id")
		.eq("person_id", personId)
		.eq("facet_account_id", facetAccountId)
		.single()

	if (existing) return

	// Create link
	const { error } = await supabase.from("person_facet").insert({
		person_id: personId,
		facet_account_id: facetAccountId,
		account_id: accountId,
		project_id: projectId,
		source: "inferred",
		confidence,
	})

	if (error) {
		consola.error(`Error linking person ${personId} to facet ${facetAccountId}:`, error)
	}
}

async function migratePeopleToFacets(options: { projectId?: string; dryRun?: boolean; limit?: number } = {}) {
	const { projectId, dryRun = false, limit } = options

	consola.info("Starting people to facets migration...")
	if (dryRun) {
		consola.warn("DRY RUN MODE - No database changes will be made")
	}

	// Get facet kind IDs
	const kindIds = {
		job_function: await getFacetKindId("job_function"),
		seniority_level: await getFacetKindId("seniority_level"),
		title: await getFacetKindId("title"),
		industry: await getFacetKindId("industry"),
		life_stage: await getFacetKindId("life_stage"),
		age_range: await getFacetKindId("age_range"),
	}

	consola.info("Facet kind IDs:", kindIds)

	// Load people
	const baseQuery = supabase
		.from("people")
		.select("id, name, role, title, occupation, segment, industry, company, age, project_id, account_id")
		.order("created_at", { ascending: true })

	let query = baseQuery

	if (projectId) {
		query = query.eq("project_id", projectId)
	}

	if (limit) {
		query = query.limit(limit)
	}

	const { data: people, error } = await query

	if (error) {
		consola.error("Error loading people:", error)
		return
	}

	consola.info(`Loaded ${people.length} people to process`)

	let processed = 0
	const skipped = 0
	let errors = 0

	for (const person of people) {
		try {
			consola.start(`Processing ${person.name || person.id}...`)

			// Classify person
			const classification = await classifyPerson(person as PersonData)

			consola.info(`Classification (confidence: ${classification.confidence}):`, {
				job_function: classification.job_function,
				seniority_level: classification.seniority_level,
				title: classification.title,
				industry: classification.industry,
				life_stage: classification.life_stage,
				age_range: classification.age_range,
				reasoning: classification.reasoning,
			})

			if (dryRun) {
				processed++
				continue
			}

			// Create facets and links
			const facetMappings: Array<{ kindId: number | null; label: string | null }> = [
				{ kindId: kindIds.job_function, label: classification.job_function },
				{ kindId: kindIds.seniority_level, label: classification.seniority_level },
				{ kindId: kindIds.title, label: classification.title },
				{ kindId: kindIds.industry, label: classification.industry },
				{ kindId: kindIds.life_stage, label: classification.life_stage },
				{ kindId: kindIds.age_range, label: classification.age_range },
			]

			for (const { kindId, label } of facetMappings) {
				if (kindId && label) {
					const facetAccountId = await getOrCreateFacet(kindId, label, person.account_id)
					if (facetAccountId) {
						await linkPersonToFacet(
							person.id,
							facetAccountId,
							person.account_id,
							person.project_id,
							classification.confidence
						)
					}
				}
			}

			processed++
			consola.success(`Processed ${person.name || person.id}`)
		} catch (err) {
			consola.error(`Error processing ${person.name || person.id}:`, err)
			errors++
		}
	}

	consola.success(`
Migration complete:
- Processed: ${processed}
- Skipped: ${skipped}
- Errors: ${errors}
	`)
}

// CLI
const args = process.argv.slice(2)
const projectId = args.find((arg) => arg.startsWith("--project="))?.split("=")[1]
const dryRun = args.includes("--dry-run")
const limitArg = args.find((arg) => arg.startsWith("--limit="))
const limit = limitArg ? Number.parseInt(limitArg.split("=")[1], 10) : undefined

migratePeopleToFacets({ projectId, dryRun, limit })
