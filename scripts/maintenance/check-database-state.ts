import { createClient } from "@supabase/supabase-js";
import consola from "consola";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
	throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseState() {
	consola.info("Checking database state...");

	// Check if new columns exist in people table
	consola.box("People Table Columns");
	const { data: columns, error: colError } = await supabase.rpc("exec_sql", {
		sql: `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'people'
        AND column_name IN ('job_function', 'seniority_level', 'title', 'industry', 'life_stage', 'age_range', 'segment', 'role', 'occupation')
      ORDER BY column_name
    `,
	});

	if (colError) {
		// Try direct query instead
		const { data: peopleSchema } = await supabase.from("people").select("*").limit(1);

		if (peopleSchema && peopleSchema.length > 0) {
			const person = peopleSchema[0] as Record<string, unknown>;
			const cols = Object.keys(person).filter((k) =>
				[
					"job_function",
					"seniority_level",
					"title",
					"industry",
					"life_stage",
					"age_range",
					"segment",
					"role",
					"occupation",
				].includes(k)
			);
			consola.info("Available columns:", cols.length > 0 ? cols : "None of the expected columns found");
		}
	} else {
		consola.info("Columns:", columns);
	}

	// Check facet_kind_global
	consola.box("Facet Kinds");
	const { data: kinds, error: kindsError } = await supabase
		.from("facet_kind_global")
		.select("id, slug, label")
		.order("slug");

	if (kindsError) {
		consola.error("Error fetching facet kinds:", kindsError);
	} else {
		consola.info(`Found ${kinds?.length || 0} facet kinds:`);
		for (const kind of kinds || []) {
			consola.info(`  - ${kind.slug}: ${kind.label} (id: ${kind.id})`);
		}
	}

	// Check facet_account counts
	consola.box("Facet Accounts by Kind");
	const { data: facetCounts, error: facetError } = await supabase
		.from("facet_account")
		.select("kind_id, facet_kind_global!inner(slug, label)");

	if (facetError) {
		consola.error("Error fetching facet counts:", facetError);
	} else {
		const countsByKind = new Map<string, number>();
		for (const fc of facetCounts || []) {
			const kind = (fc.facet_kind_global as any).slug;
			countsByKind.set(kind, (countsByKind.get(kind) || 0) + 1);
		}
		consola.info(`Found ${facetCounts?.length || 0} total facet_account entries:`);
		for (const [kind, count] of countsByKind.entries()) {
			consola.info(`  - ${kind}: ${count}`);
		}
	}

	// Check person_facet links
	consola.box("Person-Facet Links");
	const { data: personFacets, error: pfError } = await supabase
		.from("person_facet")
		.select("person_id, facet_account_id, facet_account!inner(kind_id, facet_kind_global!inner(slug))");

	if (pfError) {
		consola.error("Error fetching person_facet links:", pfError);
	} else {
		const linksByKind = new Map<string, Set<string>>();
		for (const pf of personFacets || []) {
			const kind = ((pf.facet_account as any).facet_kind_global as any).slug;
			if (!linksByKind.has(kind)) {
				linksByKind.set(kind, new Set());
			}
			linksByKind.get(kind)?.add(pf.person_id);
		}
		consola.info(`Found ${personFacets?.length || 0} total person_facet links:`);
		for (const [kind, people] of linksByKind.entries()) {
			consola.info(
				`  - ${kind}: ${people.size} people, ${personFacets?.filter((pf) => ((pf.facet_account as any).facet_kind_global as any).slug === kind).length} total links`
			);
		}
	}

	// Check people with data
	consola.box("People with Segment Data");
	const { count: totalPeople } = await supabase.from("people").select("*", { count: "exact", head: true });

	const { count: withSegment } = await supabase
		.from("people")
		.select("*", { count: "exact", head: true })
		.not("segment", "is", null)
		.neq("segment", "");

	const { count: withRole } = await supabase
		.from("people")
		.select("*", { count: "exact", head: true })
		.not("role", "is", null)
		.neq("role", "");

	const { count: withTitle } = await supabase
		.from("people")
		.select("*", { count: "exact", head: true })
		.not("title", "is", null)
		.neq("title", "");

	consola.info(`Total people: ${totalPeople}`);
	consola.info(`  - With segment: ${withSegment}`);
	consola.info(`  - With role: ${withRole}`);
	consola.info(`  - With title: ${withTitle}`);

	// Sample people
	consola.box("Sample People");
	const { data: samplePeople } = await supabase.from("people").select("id, name, segment, role, title").limit(3);

	if (samplePeople && samplePeople.length > 0) {
		for (const person of samplePeople) {
			consola.info(`${person.name || "Unnamed"}:`, {
				segment: person.segment,
				role: person.role,
				title: person.title,
				industry: (person as any).default_organization?.industry ?? null,
			});
		}
	}

	consola.success("Database state check complete!");
}

checkDatabaseState();
