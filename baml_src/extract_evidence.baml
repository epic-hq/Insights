// Extract Evidence BAML Schema and Function
// Produces normalized evidence units from transcripts + chapters

class Anchor {
  type string @description("av | doc | web | message | log")
  target string @description("media_id | doc_id | URL | stream id")
  start string @description("av: ms (number-as-string OK); doc: p14#para3; web: selector; log: ISO time")
  end string? @description("optional end position")
  speaker string? @description("Optional: speaker label or name if available")
  chapter_title string? @description("Optional: chapter/section title for quick context")
}

class KindTags {
  problem string[]? @description(#" Pain points, frustrations, blockers, etc. "#)
  goal string[]? @description(#" Goals, success criteria, desired outcomes, etc. "#)
  behavior string[]? @description(#" Behaviors, actions, habits, etc. "#)
  emotion Emotions? @description("Optional emotion if obvious from context")
  context string[]? @description(#" Context, background, environment, etc. "#)
  artifact string[]? @description(#" items, data, places, things, documents, etc."#)
}

class FacetCatalogKind {
  slug string @description("Kind identifier, e.g., goal | pain | task | tool | value")
  label string @description("Display label for the kind")
}

class FacetCatalogEntry {
  facet_ref string @description("Stable reference like g:12 or a:45")
  kind_slug string @description("Kind slug this facet belongs to")
  label string @description("Preferred display label")
  alias string? @description("Project-level alias to show instead of label when present")
  synonyms string[]? @description("Known synonyms and aliases")
}

class FacetCatalog {
  kinds FacetCatalogKind[] @description("Merged catalog of facet kinds (project ▶ account ▶ global)")
  facets FacetCatalogEntry[] @description("Merged facet entries available to this project")
  version string @description("Opaque version string for caching and diffing")
}

class FacetCandidatePayload {
  kind_slug string @description("Kind slug such as goal | pain | task | tool | differentiator")
  label string @description("Human-readable label to review (≤5 words, Title Case)")
  synonyms string[]? @description("Optional synonyms observed in transcript")
  notes string[]? @description("Short bullets justifying why this term matters")
}

class PersonFacetObservation {
  facet_ref string? @description("Existing facet reference when confidently matched")
  candidate FacetCandidatePayload? @description("Populate when no facet_ref confidently matches")
  kind_slug string @description("Kind slug describing the dimension (goal, pain, etc.)")
  value string @description("Short phrase capturing the participant's wording")
  source string @description("interview | survey | telemetry | inferred | manual")
  evidence_unit_index int? @description("Index of the evidence unit supporting this observation")
  confidence float? @description("0.0-1.0 confidence that this facet applies")
  notes string[]? @description("Optional bullets with rationale or clarifications")
}

class PersonScaleObservation {
  kind_slug string @description("Scale identifier, e.g., price_sensitivity")
  score float @description("0.0-1.0 normalized score along the spectrum")
  band string? @description("low | medium | high banding for UI")
  source string @description("interview | survey | telemetry | inferred | manual")
  evidence_unit_index int? @description("Index of the evidence unit used for this assessment")
  confidence float? @description("0.0-1.0 confidence in the score")
  rationale string? @description("Short justification for the assigned score")
}

class EvidenceParticipant {
  person_key string @description("Stable identifier referenced by evidence units")
  display_name string? @description("Literal transcript speaker label, e.g., 'SPEAKER 2'")
  inferred_name string? @description("Preferred name if confidently inferred from context")
  role string? @description("participant | interviewer | observer | moderator")
  personas string[]? @description("Persona labels that apply to this human")
  segments string[]? @description("Segment labels that apply to this human")
  organization string? @description("Employer, school, or affiliation if mentioned")
  summary string? @description("Short descriptor of this participant's identity in the session")
  notes string? @description("Free-form clarifying notes for analysts")
  facets PersonFacetObservation[]? @description("Facet observations derived from catalog matching")
  scales PersonScaleObservation[]? @description("Scale observations with normalized scores")
}

class EvidenceUnit {
  person_key string @description("Reference to EvidenceParticipant.person_key for the primary speaker")
  person_role string? @description("Legacy helper; prefer participant.role")
  topic string? @description("Optional short label for the thematic focus of this chunk")
  gist string @description("≤12-word essence of the chunk; write like a slide headline")
  chunk string @description("Multi-sentence excerpt capturing the participant's full thought")
  verbatim string @description("Exact quote or concise snippet. Keep short and citable.")
  support string @description("supports | refutes | neutral")
  kind_tags KindTags @description("Canonical tag buckets for clustering")
  personas string[]? @description("Optional persona labels if obvious from context")
  segments string[]? @description("Optional segment labels if obvious from context")
  journey_stage string? @description("Optional journey stage if clear")
  anchors Anchor[] @description("At least one deep-link anchor to source")
  confidence string @description("low | medium | high")
  context_summary string? @description("1–2 sentences: who/where/what; why it matters")
  independence_key string? @description("Stable signature for dedupe (e.g., normalized gist + main tag)")

  // Empathy map facets: short, succinct phrases categorized for UX synthesis
  says string[]? @description("Short quotes the user says out loud; keep each entry under ~120 characters.")
  does string[]? @description("Observable actions/behaviors; short imperative phrases, under ~120 characters.")
  thinks string[]? @description("Internal thoughts/beliefs; concise first-person statements, under ~120 characters.")
  feels string[]? @description("Emotions with brief context; e.g., 'Frustrated with long load times'.")
  pains string[]? @description("Biggest frustrations/fears/obstacles; short phrases in specific context.")
  gains string[]? @description("Goals, desires, positive outcomes/benefits/success factors; short phrases in specific context.")
}

class EvidenceExtraction {
  people EvidenceParticipant[] @description("Unique participants detected in the transcript")
  evidence EvidenceUnit[] @description("Chronological evidence units for downstream storage")
  facet_catalog_version string? @description("Echo the catalog version to ensure downstream joins match")
}

class Chapter {
  start_ms int
  end_ms int?
  summary string?
  title string?
}

function ExtractEvidenceFromTranscript(
  transcript: string,
  chapters: Chapter[],
  language: string,
  facet_catalog: FacetCatalog
) -> EvidenceExtraction {
  client "CustomGPT4o"
  prompt #"
   You are an expert UX researcher.
Your task is to extract sequential evidence from an interview transcript so the reader can easily follow what happened, moment by moment.

IMPORTANT: Produce only valid JSON that matches the EvidenceExtraction schema. Do not include markdown fences, comments, natural language explanations, or leading/trailing text. When data is unavailable, use empty arrays or nulls instead of inventing values.

## Steps
1. Identify every human speaker. Populate the `people` array once with the transcript label, inferred name (if safe), role (participant vs interviewer), personas/segments, organization, and a short descriptor that captures their responsibilities.
2. Slice the transcript into coherent, chronological chunks that express a single point of view (usually 2–5 sentences from one speaker).
3. For each chunk, produce an `EvidenceUnit` anchored to the correct `person_key`, with chunk, gist, verbatim quote, tags, anchors, and empathy facets.
4. Only create a unit when it adds analytical value (pain, goal, motivation, workaround, evaluation criteria, decision factor, emotion, etc.).
5. For each participant, synthesize high-signal facet + scale observations using the provided `facet_catalog`; link each observation back to the supporting evidence.

## Evidence Slicing Heuristics
- Break multi-topic passages into separate evidence units so each unit expresses one clear insight or sentiment.
- Keep `chunk` spans tight (≈80–180 words) and produce multiple units when a speaker shifts from a pain to a workaround or to a desired outcome.
- Preserve chronology—do not merge non-consecutive statements even if they cover the same theme.
- When interviewer prompts uncover an explicit metric, success criterion, or blocker, capture it in its own unit.
- If a speaker layers multiple signals (pain + workaround + goal), split into sequential units so each signal is easy to tag and link to facets.

## Participant Profiles & Demographics
- Capture explicit demographic attributes for each participant: job title, role, seniority, team/discipline, tenure, geography, and organization.
- Populate `people[].summary` with a 1–2 sentence snapshot describing who they are, the work they do, and the context of their responsibilities.
- Use `people[].personas` and `people[].segments` to reflect any persona or segment labels mentioned or implied by the transcript.
- When the transcript reveals responsibilities or repeated activities, add `task` facets capturing those workflows.
- Prefer matching existing catalog entries for demographic/task facets (`kind_slug` such as `demographic`, `task`, `workflow`, `preference`, `value`). Emit new `candidate` entries only when no confident match exists.

## Selection Priorities
High-severity pains, frequent behaviors, explicit goals, success criteria.
Workarounds, hacks, switching triggers, evaluation criteria, blockers, willingness-to-pay signals.
Moments that reveal motivations, anxieties, decision criteria, or definitions of success.
Skip generic opinions or filler unless tied to a concrete outcome.

## Evidence Unit Schema
- person_key: matches one participant from `people` (exact string match required).
- gist: punchy ≤12-word headline (no leading labels like "Quote:").
- chunk: 2–5 sentences capturing the participant’s full thought in their own words.
- verbatim: crisp ≤15-word quote pulled from the chunk.
- anchors: start_time (ms for av), speaker label, chapter_title when provided.
- kind_tags: problem | goal | behavior | emotion | context | artifact (multiple allowed).
- support: supports | refutes | neutral relative to the belief or hypothesis.
- confidence: low | medium | high (be honest—only use high when unequivocal).
- context_summary: 1–2 sentences summarising who said it, where in the journey, why it matters.
- independence_key: Stable signature (recommend normalized gist + main tag).

## EMPATHY MAP FACETS (always fill, ≤12 words each)

says: Direct short quotes (e.g., “wants better leads quicker”).
does: Observable actions (imperative phrasing, e.g., “manually scrapes LinkedIn lists daily”).
thinks: Internal beliefs or self-talk (e.g., “I spend hours chasing low-quality prospects”).
feels: Emotions with context (e.g., “frustrated wasting evenings on prospecting”).
pains: Biggest frustrations/obstacles (e.g., “tools deliver unqualified contacts”).
gains: Desired positive outcomes (e.g., “save time with pre-qualified leads”).

## Facet & Scale Mapping
- The `facet_catalog` already merges project ▶ account ▶ global terms. Respect aliases when generating analyst-facing text, but match by label or synonyms case-insensitively.
- Populate `people[].facets` with distinct, high-signal observations. Capture demographic descriptors (role, title, team, tenure, location, pronouns) under the `demographic` kind. Capture responsibilities, repeated jobs, and tools under `task`, `workflow`, or `tool` kinds as appropriate.
- Always set `source` to "interview" and point `evidence_unit_index` to the supporting evidence (0-based).
- When you find a confident match, set `facet_ref` (e.g., `g:12` or `a:45`) and reuse the catalog’s `kind_slug`. When unsure, keep `facet_ref` empty and supply a `candidate` with Title Case `label`, ≤5 words, plus any synonyms.
- Use `value` to capture the participant’s own wording (≤12 words). Avoid duplicating the same facet multiple times for similar statements.
- Emit `people[].scales` only when the transcript clearly indicates direction or intensity. Map scores on 0.0–1.0, add a `band` (low <0.34, medium 0.34–0.66, high >0.66), and include a tight `rationale`.
- Set `facets[].confidence` / `scales[].confidence` to a float between 0.0 and 1.0 (e.g., 0.9 for explicit signals, 0.6 when inferred but plausible).
- Echo the provided `facet_catalog.version` into `facet_catalog_version` for downstream caching.
- Favor breadth: aim for at least three high-signal facets per participant when the transcript supports it (mix demographics, tasks, pains, goals, workflows, or preferences).
- When the catalog lacks a confident match but the signal is strong, add a `candidate` facet instead of discarding it—briefly justify why it matters.
- Prefer emitting a scale when the speaker states a degree of satisfaction, frequency, or urgency (e.g., “daily”, “huge blocker”, “ready to switch”) and anchor it to the clearest evidence unit.

## Facet Generation Tactics
- For every participant, scan the entire transcript end-to-end to ensure demographics, recurring workflows, frustrations, motivations, and decision criteria are all captured as facets.
- When matching to the catalog, consider partial or synonym matches—if confidence ≥80%, link via `facet_ref`; otherwise emit a `candidate` with concise analyst notes.
- Add at least one `task` or `workflow` facet when the participant describes routine responsibilities or tools.
- Capture emotional states as `value` or `preference` facets when they describe what they care about or how they judge success.
- Create `scales` whenever intensity, frequency, satisfaction, or urgency is explicitly stated; normalize to 0.0–1.0 and explain the rationale in plain language.

## Output Quality Checklist
- Every `EvidenceUnit` has empathy facets filled; keep each entry specific and ≤12 words.
- `verbatim` quotes are succinct and differ from `gist` headlines.
- `anchors` include the speaking label and chapter title when available.
- `person_key` values always match an entry in `people` and remain stable across units.
- Participants include demographic summaries and any explicit personas/segments from the transcript.
- If an array would be empty, ensure it is emitted as `[]` (never omit required fields).
- Always set `facet_catalog_version` to the input `facet_catalog.version`.

## Facet Catalog (read-only context)
- Available kinds with labels:
  {{ facet_catalog.kinds }}
- Enabled facets (already scoped to this project):
  {{ facet_catalog.facets }}
- Treat the catalog as authoritative: do not invent new kinds; prefer existing terms whenever confident.

## Guardrails
Only infer persona/segment/journey_stage when obvious. If unsure, omit.
Keep `chunk` faithful to the participant’s voice (light edits for clarity are OK, no inventions).
Prefer fewer, higher-quality units over many weak ones.

    Transcript (language={{ language }})
    {{ transcript }}

    Chapters (optional; may help anchoring)
    {{ chapters }}

    Facet catalog (merged project ▶ account ▶ global view)
    {{ facet_catalog }}

    Output strictly as EvidenceExtraction respecting {{ ctx.output_format }} and set `facet_catalog_version` = `facet_catalog.version`
  "#
}

// Simple empathy test
test ExtractEvidenceFromTranscript_EmpathyTest {
  functions [ExtractEvidenceFromTranscript]
  args {
    transcript #"
INTERVIEWER: How do you feel about your current project management tool?

PARTICIPANT: Honestly, it's really frustrating. I spend way too much time just trying to find where I put things. Like, I'll create a task and then I can't remember which project I assigned it to. It makes me feel disorganized and stressed out.

INTERVIEWER: What do you do when that happens?

PARTICIPANT: I usually end up searching through every project folder, which takes forever. Sometimes I just give up and create a duplicate task. I know it's not efficient, but I need to get my work done. I really wish there was a better way to organize everything automatically.

INTERVIEWER: What would success look like for you?

PARTICIPANT: I want to feel confident that I can find anything I need within seconds. When I'm in a meeting and someone asks about a project status, I want to pull it up instantly instead of saying 'let me get back to you on that.' That would make me feel so much more professional and in control.
    "#
    chapters []
    language "en"
    facet_catalog {
      kinds []
      facets []
      version "test"
    }
  }
}

// Full dev test
test ExtractEvidenceFromTranscript_Sample {
  functions [ExtractEvidenceFromTranscript]
  args {
    transcript #"
Kai K, College Freshman
Rick 6/11
Audio transcripts from video-> Wav file -> Assembly.ai

SPEAKER 1
Okay, so um, so Kai, appreciate you getting. So just for clarification, what's your um, year, ah, in school. And what are you studying?
SPEAKER 2
I'm going to be starting my second year in college and I'm studying for a major of business administration.
SPEAKER 1
Okay, super. Um, and let's see, can you tell. So what we want to focus on is um, how students are studying and learning and doing their work for what we call like longer duration, uh, skills acquisition. So not like simply asking a question of the Internet of you know, what is this? Or how do you do that but more complex, in depth subjects where you might spend more time, um, and multiple sessions over it. So that's in particular what we're, what we're curious about. Um, but uh, maybe you can tell me a little bit about like reflecting of your last semester m to um, like what your day looks like.
SPEAKER 2
Um, okay, so my last two couple semesters I did a lot of in person classes. So my day consisted of just waking up breakfast and then I would head off to school. And then depending on the class I took during the day, for example I'd had a couple math classes. I would usually go to the library before and study up on just previous homeworks and then maybe after I would go to see a tutors because I, at Palomar I have a couple free tutors that I use. So I'd go there, study with some tutors and then I'd also take some individual times and like the little pods to write essays and focus on other classes.
SPEAKER 1
Okay, cool. What, what kind of information do you usually work with? Like what subjects?
SPEAKER 2
Subjects?
SPEAKER 1
Yeah, subjects.
SPEAKER 2
Recently I took um, I did a couple film classes, I did speech class, a couple math classes, some calculus, algebra, and then I took an English critical thinking class as well.
SPEAKER 1
Okay, super. How do you usually start, um, diving into a new topic or subject?
SPEAKER 2
Um, when I start diving in usually from, if I'm given materials from my professors, I usually try and read as much of the material that they give me like books or examples or like lectures and examples from that is where I start the most with my research.
SPEAKER 1
Okay, so with the material that you've been given and then if you need to you go um, elsewhere. Um, yeah, anything with like study groups or um, apps or websites.
SPEAKER 2
Um, I mean sometimes groups. Because in my past I've had a couple classes where I use my math tutors and I meet with groups of people in the same class and we kind of bounce off each other with ideas for studying and stuff like that. But besides that I don't really use study groups that often.
SPEAKER 1
Okay, um, how about, like, you know, AI and, uh, things like that?
SPEAKER 2
Yeah, I use a lot of A.I. just for, like, I use A.I. i would say majority of the time when I'm working through something, let's say I'm writing an essay and I've kind of, like, lost my train of thought or like, I'm kind of just missing something to connect my ideas together. I'll run something through AI and like, it'll help me connect my. What I wanted. What my evidence and what I wanted to say, to analyze it and helps me put it all together. And I also used it for, like, in math situations when I'd been struggling with the problem and I'd been, like, trying to solve it. I couldn't figure out the correct, like, format or equation. I would use that and have it show me the step by step of how to do it. And then I would apply that to other problems that were on my homework or my exams or things like that.
SPEAKER 1
Okay, so can you maybe tell me a little bit more about, like, the kind of the critical thinking or writing when you lost your train of thought? That sounds, um, interesting.
SPEAKER 2
Yeah. So like, when I would use, like, for example, like, the last essay I wrote was about connecting multiple books that we read during my class to. Or, uh, it was supposed to be what was your favorite piece of material you read and what. For what reasons? And we just had to describe that with multiple subtopics of literary, uh, elements. And so I had to use a couple outside sources. So I took from, like, Skull and also books that I've read in class. And I had A.I. ah. Help me sometimes with connecting those outside sources to the book. Because I knew the book and I had the material, but I just didn't know really how to put them together in, like, an efficient way that made the most sense for me to use. So I had AI Kind of helped me understand how I can put this piece to this piece to make a whole piece to use for the evidence for the essay. So it kind of just helped me to put things together. And then from there I was able to revise my, um, sentences or paragraphs.
SPEAKER 1
Okay, super. So what. What kind of a prompt would you give it? Like, would you say, here's what I have so far. Help me fill in the blanks? Or how would you.
SPEAKER 2
Yeah, I would say things along the lines of that. I would say, this is. This is what I have written from this paragraph so far, and I'm, um, happy. And then I would put A chunk of evidence that I needed to incorporate. I'd say copy and paste what I had so far and said, can you help me incorporate this next piece of evidence to make it flow smoothly into my paragraph? Something along the lines of that. And then it would give me, it would show what I'd already written and then another chunk that they added onto it and then I was able to revise from there.
SPEAKER 1
Okay, and then are you editing in the AI or are you copying and pasting into like Google Doc or something?
SPEAKER 2
I usually do, uh, Google Docs, so I get, I try and write my own stuff in Google Docs and then when I'm given the revised version, I open a separate Google Doc and I have them side by side so I can compare from what my work looks like to the example I'd say that AI's giving me so I can see them side by side and try and use the best parts of it together so I can make the best paragraph for myself.
SPEAKER 1
Oh, okay. Is that, how does that work, work out for you? Is it easy or is it pretty, uh, is there any friction with that?
SPEAKER 2
Uh, I haven't ran into too many problems about from that. Just being able to have the AI in a document that's I can edit and then also have mine open so I can see what my edits are looking like is pretty problemless. I haven't ran into any.
SPEAKER 1
Okay, so you can easily tell the difference between the documents?
SPEAKER 2
Yeah, yeah, no, I haven't, never had any, haven't had any issues using AI to help me edit with anything.
SPEAKER 1
Okay, cool. Um, so what was like maybe the last time you worked with um, that type of a project? What was the, um, what was the subject and how did that, uh, how'd that go? Can you walk me through that a little bit more?
SPEAKER 2
Yeah, sure. So the last time I'd say was that essay I was talking about is, uh, supposed to be a nine page or. Yeah, a nine page essay for my critical thinking and composition class. And the prompt was about my favorite book and using outside sources and stuff and. Sorry, can you say the question again? I got a little lost.
SPEAKER 1
Yeah, no, just like, just walk me through the, the whole project. Yeah, yeah.
SPEAKER 2
So once I had given my prompt, I started to do a rough draft. We did a rough draft in class or an outline I should say. And we were able to outline our paragraphs, created a thesis statement and then introduction sentences for each paragraph. Um, and then from there we were given feedback from our professor and then we were given time on our own to incorporate our body paragraphs to add on to those topic sentences from uh, two outside sources that we needed to find on our own and then a book of our choice that we read in the class. So then from there I just spent time revising like my. How making my topic sentence for the paragraphs correct and then putting the information that I found from the. Either the novel or outside source, depending on the paragraph or the subtopic, uh, that I was doing. And then I would start by in saying like, this is how this is from this like using the evidence. And then I would uh, analyze it using my own like, perspective of the book. And then I kind of just did that for the different subtopics and then finished it with a conclusion.
SPEAKER 1
Okay, cool. So is that. Were you. When did you start that? Um, it seems like you have to read there's some like, research or learning part.
SPEAKER 2
Yeah.
SPEAKER 1
And then the writing part. Or is that. How did that go?
SPEAKER 2
So yeah, we were. During the semester we had read various novels, so we just were able to pick a novel of our choice and then we were also told to find outside sources about that novel. So we spent some time looking online, going through scholarly articles to find something that would fit good into like how our um, the choice of our book and how the literary omens affect what making the book so good.
SPEAKER 1
How did you like, when you were doing, going through that? It probably didn't just all happen in a day, right. There was probably days, multiple days or weeks, right?
SPEAKER 2
Yeah, no, I for sure took multiple days to chunk it out and try and find. There's a lot of time on the Internet scrolling through to find the sites that I could, that I knew for sure because I had already had some ideas of what my paragraphs were going to be about. So I just mainly spending a lot of time trying to figure out sites that I could use that would fit good into the subtopics and it wouldn't all take one day. It took a lot of like, time and planning it all out.
SPEAKER 1
So how, how did you like, take notes on the pieces of information that you were coming across and um, the thoughts you were having as you were going through that?
SPEAKER 2
I used a Google Doc. So I would read this, I would find the site and I would read and then I had a Google Doc open as well. And as if I found something interesting, like a good piece of evidence that I thought I could use, I could just copy and paste it into another Google Doc and then I would just press Enter and then I'd do a little bullet Point. And I'd say like, I could use this for this example of um, imagery and I could just like jot down a little bit of ideas and then I just start a new space underneath. Kind of just go through and say where I think I could use this information in my paragraphs.
SPEAKER 1
Okay, super. Um, are there parts of like that process or the tools that you really love or really hate?
SPEAKER 2
In that process, I didn't find anything that I like truly hated. I'd say, I think that it was a pretty neutral thing. Like it wasn't difficult to ever find information and then just transferring it over into like a little uh, like evident sheet. I didn't have anything that gave me too much trouble or was too hard, but it also, I wasn't, I obviously didn't enjoy it. Like, it wasn't like something that was like, oh wow, this worked really good. It was kind of just drag and drop stuff.
SPEAKER 1
Okay, and what, when you were searching, what were you, Were you using Google Search or chat or like when you'd go to look for sources or did you. All the above.
SPEAKER 2
So for the sources, I started out with Google and I couldn't really find anything that like met the requirements that my teacher wanted. So I just started to use um, Google Scholar and so I could find scholarly articles. And then what I would do is I would find a site and I'd read through it and I'd find the evidence. And then I also took it into chat and I would say, I ah, would copy the link and I would say I'm writing an essay on this. Do you think that this site and this information that I've taken would work? Would flow, get into a paragraph and then I would receive these back from chat.
SPEAKER 1
Okay, um, can you think of a time that you felt overwhelmed or uh, frustrated with the, the process?
SPEAKER 2
Yeah, no, I've definitely went through some times of stress when I was trying to pile all my life information together. And sometimes like I would just hit like roadblocks or the evidence that I found. Like I thought it really was gonna work, but the way that I had approached the topic, it kind of changed what I was gonna say. So there's multiple times when I had like thought I had it all laid out perfectly and then my essay just kind of took a turn. Like I was like, yeah, you know, I don't really want to write about this part anymore. So I kind of like had to scratch the evidence, some of the evidence that I had, and go back and find more from those sources. So it definitely did get A little frustrating at symptoms.
SPEAKER 1
Okay. Um, but was that more like. Was that about the tooling, like the tools you're using, or more just the kind of. You think that's part of the process or. Um, I guess. Let me. Let me ask you a different question.
SPEAKER 2
Yeah.
SPEAKER 1
What would the perfect solution look like for you? Forget about anything that you've seen me working on before or just given what you're doing now. Can you imagine a better way? Something that would make your life easier?
SPEAKER 2
Yeah, I think that something that would make my life a lot easier is if I was able to throw my sight, the source that I was using into a program that would. And I could tell, like, what I wanted how. Or I could start and throwing it into there and then saying, I'm missing these pieces, like the evidence pieces. And I would like you to give me, uh, some ideas of what I could fill this in with. I already had my outline, but I could put it into a program that would give me, like. Because what I struggled with on mine was finding those pieces to put in there. So when I. If I had a program that would give me some pieces that would be a lot helpful, like in good formatting too, as well.
SPEAKER 1
Um, and what. In those pieces, what would they be, like? Um, points to support your thesis. Or like.
SPEAKER 2
Yeah, I'd say points to support my introduction statements for each of the paragraphs. Like, something that would for sure, like, be concrete, um, evidence that I could rely on and not, like, have to go back because some, like, I looked at my sources and thought I could use it. And then I realized, okay, that's not really a good point that I wanted to use anymore. But if I had something that would give me something right away that I knew, then I could feel more confident in writing something about that.
SPEAKER 1
Okay, so, like, just getting started with, like, supporting points and telling you what's relevant or potentially relevant.
SPEAKER 2
Yeah.
SPEAKER 1
Yeah. Okay. Um. How much of your time do you think you spend doing this type of work?
SPEAKER 2
During this type of work, during the school semester, it's a lot more than now. Not obviously. I haven't been doing any school work this summer. I didn't take any summer classes. But throughout my first two semesters, I'd say I did a lot of work. Essays and stuff like that. And I used a lot. I've had a lot of help from AI to help format and stuff like that as well. As well as with the other classes too. I'd say I was using the programs Google Docs and Chat a lot during my first. My first year power.
SPEAKER 1
Yeah. And like the most important, um, I guess the highest stak situations where you need to do this type of work would be what.
SPEAKER 2
O the highest stakes so far for me had been either my communication class or my critical thinking class were the highest stakes because for me like speaking class wasn't like I'm not a person who enjoys uh, public speaking so like having chat to help me like word my speeches correctly. So I was confident in what I was going to say. Helped a lot as well as with my writing. I feel like just chat gives me a lot of confidence and helps me like really gets the ball rolling when I'm starting my work.
SPEAKER 1
Yeah. Okay, that's, that's interesting. So do you find you, you work solo or more in groups then how does that affect that?
SPEAKER 2
Definitely more solo I'd say. And I think, I think personally I work better when I'm alone.
SPEAKER 1
Mhm.
SPEAKER 2
It's my take on that.
SPEAKER 1
Cool. Um, yeah, so I think that's pretty much um, the bulk of what we wanted to ask. Um, but I guess this is like in terms of um, I guess maybe you can tell me a little bit more about time management and how you plan your day out or plan out working for a, you know, learnings content for a course. How do you approach that?
SPEAKER 2
Yeah, for sure. So I try before I go to class, let's say I have class the next day or tomorrow the next day. I'd spend the day trying to get ahead on material that my teacher has given us. Like if we're supposed to be doing reading and reading for sure. And I'm making sure that I'm even a couple pages ahead and taking lots of notes and stuff like that. Just so I know that when I come to class I'm thinking fully prepared. Uh, and I try and manage my time well like I'll spend during the school year I was spending a lot of time like waking up, checking my email, checking any notifications I had on my Palomar account and then running through canvas and going through each of my classes to check, okay, when's homework due, when are readings due, what are my upcoming dates? And then I have a calendar that I use and I kind of just set up like this is do this, this is do that and I have time here and I work this day. So I use a calendar to kind of spread out my information that I know. So I know when I have free time to do stuff on my own or when I have time to. Okay, I need to do all my work now.
SPEAKER 1
Uh, okay. Cool. Yeah. And you got, you have one job that you're working alongside when you're in school?
SPEAKER 2
Yeah, just one job in a restaurant.
SPEAKER 1
And how, how much time do you spend a week in that.
SPEAKER 2
In the restaurant? I'm only working, um, it's usually two to three days. So uh, it's around, I'd say 15 to 20 hours a week. So it's not super heavy, but.
SPEAKER 1
Mhm. So you find it uh, easy enough to m. Set up your schedule like the way you're doing it now or um, does it change? Is it like more work when you get into a new class to like map it out or.
SPEAKER 2
Yeah, I'd say, uh, that when I, when I start any class, it's kind of just like finding my bearings. Okay. This is how the teacher likes. This is their setup and this is what we're going to do weekly. So once I get like in the groove, like trying to get to a new class and get in my groove so I can, so I can understand what are my week to week's gonna look like so I can plan out my day to day in between and find out. Okay, I can do homework here, here and here. And then I'll be prepared for whenever this week's gonna throw at me.
SPEAKER 1
Got it. Super. Yeah. Okay, well that kind of concludes the interview at this point. Um, anything else you wanted to share or thought we should know?
SPEAKER 2
I think you covered it all. Had some questions I didn't think you're gonna ask, but yeah, I think you got it all.
SPEAKER 1
Okay, super. Um, so next I wanted to take a couple minutes and show you some um, concepts that we're working on, um, that you know, may or may not relate directly to what you were saying. But we're trying to um, work through some different ideas. Um, so let me, let me try and load this up and I'll share my screen and um. All right. Okay. So these are, these are just some concepts. M. I'm going to kind of walk through how we envision this potentially working and I'd love for you to just jump in and um, you know, ask questions or um, say hey, that's cool. Or that I wouldn't use that, that's, that's useless. Or you know, give a thumbs up, thumbs down, or ask further. So, so one of the ideas here is that we'd start um, in the beginning with allowing you to ask something. So you could type in a question or you um, could, um, let's see. Or you could upload some content. Right.
SPEAKER 2
And so yeah, I like that that's a good, um, adaptation because I feel if you don't have like, I feel for the most other AI sites that you, that are on the Internet already, you have to be signed in or have an account, some cost money, even just like upload images. And I feel like if I had the ability to upload stuff like that, it would make things a lot m. Easier than having to copy and paste or reword what I'm saying. So I like that. So.
SPEAKER 1
Okay, um, cool. And then after you, you upload something, we want to, you know, dive in deeper and ask you a couple questions so we can give you better, um, guidance. So what are you trying to do, like master a topic, write an essay, and then we want to ask you what do you already know about this subject? Um, okay, so to help gauge where to start and at what level. Right. And so what level of education should, should we be thinking about? Right. College. And you know, you could say, I know nothing. Or um, you know, you can add, add that in. And in terms of, as well onboarding, we, we want to ask you, like, well, how deep do you want to go? Right. Um, do you want to just an introductory level intermediate, or you want to go really deep and, and get expert on it? Right. Um, yeah. Is that clear what we're, we're doing there?
SPEAKER 2
Yeah. No, I think that's really smart. I feel like other AIs are just giving you, if you're asking it a question, they're just giving you the answer at a level you don't even know. So it's kind of hard. Like for example, if someone's gonna have a math problem and they're in 10th grade for whatever, and then AI is gonna give them a way to solve it that they don't even know yet because they haven't learned, which when, if you use this program, you would have known because AI, ah, the AI would have said, okay, he's in 10th grade. He shouldn't be doing calculus to solve this problem. He should be doing algebra. So I think that's pretty cool to know what level you want the response in.
SPEAKER 1
Yeah, super. Okay, so the next thing we going to ask you is, um, breadth versus depth. Um, we allow you to choose how many different topics in, in this, in the subject to cover and explore. So you can have like a really narrow, focused view, um, or pick on this scale of how broad and comprehensive um, you want to go. And there's just this little image here that um, I don't think all the images are exactly right, but um, I'm wondering if this is clear to you and you understand what it's talking about.
SPEAKER 2
Yeah, no, I understand from the diagram, I understand that.
SPEAKER 1
Could you see yourself using this in some way, um, to con. Control the experience?
SPEAKER 2
Yeah, no, I could see that working well in my, in my experience of schooling and using AI, I think this would work well.
SPEAKER 1
Okay. And then, um, the other, you know, this is kind of like question that we had asked before we dive into it is, you know, what mode do you want to work in right now? Um, you know, considering the other tools you have, this is a little different because we're giving you options to have more of a conversational dialogue, like use the AI as a chat partner, like where it'll converse with you or you can say, you know, I just need to do exam prep. So it's a, I want to have more of a, uh, quiz and flashcard type of approach to things. Tell, uh, me the key terms, uh, break things down. Uh, for me, um, versus some of the others are more, um, you know, analytical or creative in their nature.
SPEAKER 2
Yeah.
SPEAKER 1
So maybe just take a second and see if, you know, be curious if this makes sense to you.
SPEAKER 2
Yeah, I know that makes total sense to me. I, I can understand that as well. When I, uh, sometimes when I need to use AI, I need to use it strictly for preparing for an exam, which obviously I would use exam prep. And I think that putting the options of the mode is like really important because you need, if you know what you're using AI for, like if you know exactly what you're coming in to get. I think that these modes make it easier for. To not get mixed up and stuff that isn't going to apply to you directly. So I think this is a great, another tool that works great.
SPEAKER 1
Super. Okay, so those are like those four questions. And then, um, what we do is we. You then say, okay, create my learning plan. And what it will do is if you uploaded a document, it will analyze that. If you just give it a question, it'll analyze that and it will come up with learning objectives. So a series of things to learn in steps, kind of like a plan. Um, and then it will also map out each of the topics, um, into sub points. And so, um, does this screen, um, how does this speak to you? Do you, um.
SPEAKER 2
I, I like this. Again, I think this is interesting because if by applying a document you can. I didn't. I think it's interesting to have that the AI will create their own subtopics and also like the progress bar. So to keep track of what, how far you've come and things like that I also think would be like a good addition, if this was at all possible, is like going through the topics and then the ones that you've mastered or the ones that you're consistently getting correct, like slowly begin to drop out of your studying because you've already known them. Like the still questions will still pop up occasionally, but, uh, it won't be as heavily focused on that one section that you fully grasp.
SPEAKER 1
Super great, great idea. Yeah. Um, okay, well let me dive into some of these here. And so, um, the topic map, again, this is, think of this as. This isn't exactly what it looks like, but you've seen other versions, right. Where the lines are connecting to give you the hierarchy. So that's kind of what's in there. Um, the learning plan is a newer thing. And so this is like taking the whole, all the whole topic map and then breaking it into chunks that you would then go through and work on. And so it starts here with, um. Well, I guess let me just ask you if you understand what's, what's in here or if you have any questions before I explain it.
SPEAKER 2
Yeah, no, I think I get it. I think I understand.
SPEAKER 1
Okay. So when you finish certain things, you just simply cross them off. Right. And then that will update your progress bar.
SPEAKER 2
Um.
SPEAKER 1
Um, I'm curious your feedback on this. So there's something called the Bloom taxonomy, which kind of uh, measures how deep you're getting into a subject. And there's like six different levels. And starting with just remembering the facts and then being able to understand them, compare them to other things, make judgments, and then actually synthesize and create new ideas based on what you've just learned. And so that's what these little B1, B2, B4, that's what those things are. And then you see at the end you get down to B6 of creating.
SPEAKER 2
Uh, so those are the levels of understanding that are, you can work for example, that first bullet, that first line that identified the major components of Earth's water cycle. So that's at a B1 right now, but it'll, it can increase up the scale to a B6.
SPEAKER 1
Yeah. So the, the understanding the components of the water cycle would be like the first step in the journey, like up the mountain. Think of it that way. Like, think of it like a two dimensional space. There's a breadth of things and then there's like how, how deep you, you get into them. And so at the end here is you, it Wants you to design a water management plan. Um, and so that's actually creating. So it builds on the fact of all the stuff that you've remembered and learned before.
SPEAKER 2
Yeah, yeah, I get that. I like that a lot.
SPEAKER 1
Okay, cool. And then, um, you could also have things in here like, you know, write a paper or, um, study, you know, study for a quiz. So think of it like a little task management.
SPEAKER 2
Yeah.
SPEAKER 1
Thing. And one thing that's not in here that I'm considering is integrating it with the calendar in some way, so to say. Um, okay, you've got a test on Friday, today is Wednesday. Um, let's break up your studying over the next two and a half days into these sections.
SPEAKER 2
Yeah, no, I think that's a great idea. And personally, for me as a person who likes. I love. I like to have all my stuff laid out and understand how to chunk up my work efficiently. And I think that this breakdown is very good. And I would like. I would enjoy working with something like this. And then also to have it on my calendar as well would help me even more to lay out my days, which makes my life a lot easier personally. Uh-huh.
SPEAKER 1
Okay. So you actually use the calendar in your phone or like that?
SPEAKER 2
Yeah, I have. Have paper calendars I write down stuff on.
SPEAKER 1
Okay.
SPEAKER 2
But I do utilize my phone calendars.
SPEAKER 1
Okay. Um, so would even like showing it as a list of like, here's like the three things and be helpful. Could you imagine what else you would want that to look like?
SPEAKER 2
Like comparing the list.
SPEAKER 1
Well, how would. What would work best for you? What would your ideal be? Given that now, you know, I can maybe create these, um, these tasks for you. How would you ideally want to consume them and. And use them in your day?
SPEAKER 2
So, yeah, I think that putting them on a calendar would be a good idea. And then from like having a time, like, you could also cut out personally, you could cut out a time period every day that you know that you're going to work on it. And then having like, maybe a link from. If you want to start the first step and then having clicking the link and it'll be able to pop up and show you where you should work on stuff like that. Like, having an open link to use would be a good idea. I think I would use that for sure.
SPEAKER 1
Super. Okay, so like, if you clicked on one of these things and then you were taken to a page like this, so this would give you the information. And then what if you could then click, uh, on discuss and then you can actually have a chat with An AI mentor.
SPEAKER 2
Yeah, that sounds really smart.
SPEAKER 1
And then you could take a practice quiz on that specific set of information in that topic.
SPEAKER 2
Yeah. Test your knowledge at the end to see how far you've come. I like that too.
SPEAKER 1
Okay, cool. Um, and then you could see your progress of how far you've gotten.
SPEAKER 2
I like that mastery the progress a lot. Especially when it gives you the breakdown of those topics with their other topics. I think that's really cool. Cause that, uh, I like to see how far I've come in, what I've learned so far. And like, the breakdown is just looks really good.
SPEAKER 1
Okay, super. So, uh, that's. That's really all I wanted to show you and get, get your feedback on these different things.
SPEAKER 2
Yeah. Sweet. No, I mean, it looks amazing compared to all the other AIs I've used this program from, like the way that it's mapping out topics and then the planning, especially if the calendar could be incorporated. And then the progress bar, it looks best like, compared to all the other AIs that I've used. And this looks like it'd be the most promising.
SPEAKER 1
Super. Okay, curious. Do you. Do you pay for any of the other tools that you use?
SPEAKER 2
I do not. No, I don't pay for any of them. I just mainly utilize the free ones.
    "#
    chapters [ { start_ms 0, end_ms 60000, title "Onboarding" } ]
    language "en"
    facet_catalog {
      kinds []
      facets []
      version "test"
    }
  }
}

// -----------------------------------------------------------------------------
// Theme auto-grouping: propose themes and evidence links
// -----------------------------------------------------------------------------

class EvidenceLinkProposal {
  evidence_id string @description("UUID of existing evidence to link")
  rationale string @description("Why this evidence belongs in the theme")
  confidence float @description("0.0 - 1.0 confidence in the link")
}

class ThemeCandidate {
  name string @description("Concise theme name, 2-5 words")
  statement string? @description("1-2 sentence theme statement capturing the common thread")
  inclusion_criteria string? @description("What counts as part of this theme")
  exclusion_criteria string? @description("What should not be included")
  synonyms string[]? @description("Alternative labels or related terms")
  anti_examples string[]? @description("Edge cases that should be excluded")
  links EvidenceLinkProposal[] @description("Which evidence to attach and why")
}

class AutoGroupThemesResponse {
  themes ThemeCandidate[] @description("Proposed themes with evidence linking directives")
}

function AutoGroupThemes(
  evidence_json: string,
  guidance: string
) -> AutoGroupThemesResponse {
  client "CustomGPT4oMini"
  prompt #"
    You are clustering normalized evidence into coherent, decision-useful themes.

    Evidence JSON (array of objects) — each has at least:
    - id (uuid)
    - verbatim (string)
    - kind_tags (array of strings)
    - personas (array of strings)
    - segments (array of strings)
    - journey_stage (string | null)
    - support (supports | refutes | neutral)

    Evidence:
    {{ evidence_json }}

    Guidance (account/project context, naming conventions, priorities):
    {{ guidance }}

    Rules:
    - Prefer a small number of high-signal themes over many weak ones (3-8 typical).
    - Themes must be mutually comprehensible and non-overlapping where possible.
    - Each theme should have crisp inclusion/exclusion criteria to avoid drift.
    - Link only evidence that clearly fits; provide a brief rationale and a confidence 0.0-1.0.
    - Use concise names; avoid UI-feature names; prefer conceptual labels.
    - If evidence contradicts, you may still link it and note rationale; low confidence allowed.

    Output strictly in {{ ctx.output_format }} as AutoGroupThemesResponse.
  "#
}
