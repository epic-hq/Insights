import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

const noteId = 'a60396d4-886c-48ab-9110-dfaded52c0f3'

// Check interviews table
const { data: interview, error: intError } = await supabase
  .from('interviews')
  .select('id, title, observations_and_notes, source_type, media_type')
  .eq('id', noteId)
  .maybeSingle()

console.log('=== INTERVIEWS TABLE ===')
if (intError) console.error('Error:', intError)
else console.log(JSON.stringify(interview, null, 2))

// Check project_sections table
const { data: sections, error: sectError } = await supabase
  .from('project_sections')
  .select('id, kind, content_md, meta')
  .or(`id.eq.${noteId},kind.like.note_%`)

console.log('\n=== PROJECT_SECTIONS TABLE ===')
if (sectError) console.error('Error:', sectError)
else console.log(JSON.stringify(sections, null, 2))
