// ============================================================================
// Extract Evidence - Primary BAML Schema and Function
// ============================================================================
// Produces normalized evidence units from transcripts with timestamp anchors
// for precise media playback and auditability.
//
// Previous version (extract_evidence.baml with string-based Anchor class) has
// been deprecated in favor of this integer-based millisecond approach.
// ============================================================================

// === TurnAnchors: Standardized anchor format for transcript evidence ===
// Uses integer milliseconds for direct video/audio seeking
class TurnAnchors {
  start_ms int? @description("CRITICAL: Start time in milliseconds. Extract from transcript timestamps or chapter data. This is REQUIRED for video playback.")
  end_ms int? @description("End time in milliseconds when available")
  chapter_title string? @description("Optional chapter/section title")
  char_span int[]? @description("Optional [start,end] character offsets in transcript")
}

class EvidenceTurn {
  person_key string @description("REQUIRED: Exact match to Person.person_key (e.g., 'participant-1', 'interviewer-1'). Must reference a person defined in the people array.")
  speaker_label string? @description("Literal transcript speaker label, e.g., 'SPEAKER A', 'Speaker B' or the provided diarization name")
  gist string @description("≤12-word essence of the turn; slide-like headline")
  chunk string @description("2–5 sentences capturing the person's full thought")
  verbatim string @description("≤15-word exact quote/snippet from the chunk")
  anchors TurnAnchors @description("Anchors to source for auditability")
  // confidence string @description("low | medium | high")
  why_it_matters string? @description("≤10 words on consequence/importance (e.g., trigger/impact; note if generalizable)")
	facet_mentions FacetMention[] @description("Facet mentions that appear in this turn")
  isQuestion bool? @description("TRUE if this turn contains a question (any speaker). Useful for filtering question-response patterns.")

  // Empathy map (high-signal only; leave empty if none)
  says string[]? @description("High-signal quotes only; 0–2 (≤120 chars). Use when wording carries unique meaning beyond verbatim.")
  does string[]? @description("High-signal behaviors; 0–2. Imperative phrasing (present-habitual). Include frequency/recency if available.")
  thinks string[]? @description("High-signal inferred beliefs; 0–2. Only when justified by evidence.")
  feels string[]? @description("High-signal emotions; 0–2, with brief context and trigger if present.")
  pains string[]? @description("High-signal obstacles; 0–2. Prefer job-story: When [situation], blocked by [obstacle].")
  gains string[]? @description("High-signal outcomes; 0–2. Prefer job-story: so I can [outcome].")
}

class FacetMention {
  // index int @description("0-based index within the stream for ordering")
  // parent_index int @description("Index of the EvidenceTurn this mention derives from")
  person_key string @description("REQUIRED: Exact match to Person.person_key. Must match the person_key of the parent EvidenceTurn.")
  kind_slug string @description("One: goal | pain | behavior | tool | value | requirements | preference | demographic | context | artifact | emotion")
  value string @description("CRITICAL: Human-readable descriptive text (≤12 words), NOT an ID or reference number. Examples: 'Healthcare Professional', 'prefers explicit topic mapping for workflow', 'requires calendar integration to schedule study'. NEVER use formats like 'ID:123' or numeric references. Prefer verb+object or noun+modifier. Include trigger/condition and objective when helpful.")
  quote string? @description("Optional ≤15-word supporting quote from the parent turn")
  // confidence float? @description("Discrete buckets recommended: 1, 0.75, 0.5, 0.25, 0")
}

class Scene {
  scene_id string @description("Stable id for the scene/segment")
  start_index int @description("First EvidenceTurn index in the scene")
  end_index int @description("Last EvidenceTurn index in the scene")
  topic string @description("Short topic label for the scene")
  summary string? @description("1–2 sentence summary of what the scene covers")
}

class Person {
  person_key string @description("REQUIRED: Deterministic slug like 'participant-1', 'participant-2', 'interviewer-1'. Number based on first appearance order. This MUST be used consistently in all EvidenceTurn and FacetMention references.")
  speaker_label string? @description("Literal transcript speaker label, e.g., 'SPEAKER A', 'Speaker B' or the provided diarization name")
	person_name string? @description("The person's common name, like John Smith, Sally A., etc.")
	inferred_name string? @description("Preferred name if confidently inferred from context")
	role string? @description("their role in the coversation (participant | interviewer | observer | moderator | customer | Sales Rep")
}

class Extraction {
	//  people EvidenceParticipant[]
	 people Person[]
	 evidence EvidenceTurn[] @description("Chronological stream of evidence turns")
	 facet_mentions FacetMention[] @description("Flattened array of all facet mentions for easier phase-2 processing")
	 scenes Scene[]
}

class SpeakerUtterance {
  speaker string @description("Speaker label like 'SPEAKER A', 'SPEAKER B'")
  text string @description("The utterance text")
  start int? @description("Start time in milliseconds")
  end int? @description("End time in milliseconds")
}

// === Shared Support Classes ===

class Chapter {
  start_ms int @description("Chapter start time in milliseconds")
  end_ms int? @description("Chapter end time in milliseconds (optional)")
  summary string? @description("Brief summary of this chapter/section")
  title string? @description("Chapter or section title")
}

class FacetCatalogKind {
  slug string @description("Kind identifier, e.g., goal | pain | task | tool | value")
  label string @description("Display label for the kind")
}

class FacetCatalogEntry {
  facet_account_id int @description("Facet account ID (primary key from facet_account table)")
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

function ExtractEvidenceFromTranscriptV2(
  speaker_transcripts: SpeakerUtterance[],
  chapters: Chapter[],
  language: string,
  facet_catalog: FacetCatalog
) -> Extraction {
  client CustomGPT4oMini
  prompt #"
You are an expert UX researcher extracting structured evidence from interview transcripts.

## Steps
1. Identify all speakers and create a deterministic `person_key` (e.g., `participant-1`, `interviewer-1`) based on first appearance order.
2. Extract one `EvidenceTurn` per speaker turn with: gist (≤12 words), chunk (2-5 sentences), verbatim quote (≤15 words), and timing anchors.
3. For each turn, extract `FacetMention` items for distinct signals: goals, pains, behaviors, tools, values, preferences, demographics, context, artifacts, emotions.
4. Create `Scene` segments when topics shift significantly.

## What to Extract
Focus on: pains, goals, behaviors, workarounds, switching triggers, decision criteria, tool mentions, willingness-to-pay.

## What to Skip
Skip: weather talk, pleasantries, procedural questions, generic acknowledgments, interviewer transitions without user signals.

## EvidenceTurn Format
- `person_key`: Match exactly to Person.person_key (e.g., 'participant-1', 'interviewer-1')
- `gist`: ≤12 words headline
- `chunk`: 2-5 sentences from speaker
- `verbatim`: ≤15-word quote
- `anchors.start_ms`: REQUIRED - use SpeakerUtterance.start (milliseconds for video playback)
- `isQuestion`: TRUE if turn contains a question
- `facet_mentions`: Array of FacetMention objects (one per signal)
- Optional: empathy map fields (says, does, thinks, feels, pains, gains) - use sparingly, only when adding unique value

## FacetMention Format
- `person_key`: Match person who EXPRESSED the signal (not who was discussed)
- `kind_slug`: goal | pain | behavior | tool | value | preference | demographic | context | artifact | emotion
- `value`: ≤12 words, concrete (e.g., "uses Google Docs for essay drafts", "frustrated by finding information")
- `quote`: ≤15 words when high-signal
- Output one FacetMention per distinct signal

## Scenes
Create scenes when topics shift. Include `start_index`, `end_index`, `topic`.

## Input Data

Speaker Transcripts ({{ language }}):
{{ speaker_transcripts }}

{% if chapters|length > 0 %}
Chapters:
{{ chapters }}
{% endif %}

{% if facet_catalog and facet_catalog.facets|length > 0 %}
Available Facets (reference only, do not link):
{{ facet_catalog }}
{% endif %}

Output JSON only. Ensure contiguous 0-based indices. {{ ctx.output_format }}
"#
}

// Simple empathy test
test ExtractEvidenceFromTranscriptV2_EmpathyTest {
  functions [ExtractEvidenceFromTranscriptV2]
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
test ExtractEvidenceFromTranscriptV2_Sample {
  functions [ExtractEvidenceFromTranscriptV2]
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
