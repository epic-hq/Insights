enum Emotions {
  Abandoned
  Accepted
  Aggressive
  Amazed
  Angry
  Annoyed
  Anxious
  Apathetic
  Appalled
  Aroused
  Ashamed
  Astonished
  Awe
  Awful
  Bad
  Betrayed
  Bitter
  Bored
  Busy
  Cheeky
  Confident
  Confused
  Content
  Courageous
  Creative
  Critical
  Curious
  Depressed
  Despair
  Detestable
  Disappointed
  Disapproving
  Disgusted
  Disillusioned
  Dismayed
  Dismissive
  Disrespected
  Distant
  Eager
  Embarrassed
  Empty
  Energetic
  Excited
  Excluded
  Exposed
  Fearful
  Fragile
  Free
  Frightened
  Frustrated
  Furious
  Grief
  Guilty
  Happy
  Helpless
  Hesitant
  Hopeful
  Horrified
  Hostile
  Humiliated
  Hurt
  Inadequate
  Indifferent
  Indignant
  Inferior
  Infuriated
  Inquisitive
  Insecure
  Insignificant
  Inspired
  Interested
  Intimate
  Isolated
  Jealous
  Joyful
  Judgmental
  Let_down
  Lonely
  Loving
  Mad
  Nauseated
  Nervous
  Numb
  Optimistic
  Out_of_control
  Overwhelmed
  Peaceful
  Perplexed
  Persecuted
  Playful
  Powerful
  Powerless
  Pressured
  Proud
  Provoked
  Rejected
  Remorseful
  Repelled
  Resentful
  Respected
  Revolted
  Ridiculed
  Rushed
  Sad
  Scared
  Sensitive
  Shocked
  Skeptical
  Sleepy
  Startled
  Stressed
  Successful
  Surprised
  Thankful
  Threatened
  Tired
  Trusting
  Unfocussed
  Valued
  Victimized
  Violated
  Vulnerable
  Weak
  Withdrawn
  Worried
  Worthless
}


enum BBValues {
    Accountability
    Achievement
    Adaptability
    Adventure
    Altruism
    Ambition
    Authenticity
    Balance
    Beauty
    Being_the_best
    Belonging
    Career
    Caring
    Collaboration
    Commitment
    Community
    Compassion
    Competence
    Confidence
    Connection
    Contentment
    Contribution
    Cooperation
    Courage
    Creativity
    Curiosity
    Dignity
    Diversity
    Environment
    Efficiency
    Equality
    Ethics
    Excellence
    Fairness
    Faith
    Family
    Financial_stability
    Forgiveness
    Freedom
    Friendship
    Fun
    Future_generations
    Generosity
    Giving_back
    Grace
    Gratitude
    Growth
    Harmony
    Health
    Home
    Honesty
    Hope
    Humility
    Humor
    Inclusion
    Independence
    Initiative
    Integrity
    Intuition
    Job_security
    Joy
    Justice
    Kindness
    Knowledge
    Leadership
    Learning
    Legacy
    Leisure
    Love
    Loyalty
    Making_a_difference
    Nature
    Openness
    Optimism
    Order
    Parenting
    Patience
    Patriotism
    Peace
    Perseverance
    Personal_fulfillment
    Power
    Pride
    Recognition
    Reliability
    Resourcefulness
    Respect
    Responsibility
    Risk_taking
    Safety
    Security
    Self_discipline
    Self_expression
    Self_respect
    Serenity
    Service
    Simplicity
    Spirituality
    Sportsmanship
    Stewardship
    Success
    Teamwork
    Thrift
    Time
    Tradition
    Travel
    Trust
    Truth
    Understanding
    Uniqueness
    Usefulness
    Vision
    Vulnerability
    Wealth
    Well_being
    Wholeheartedness
    Wisdom
}


class ExtractedInsight {
	// While trying to do **GOAL/Desired_outcome**, people struggle with **pain** because **WHY: Details/context**.

	name string @description("Short Text description of the insight in up to 5 words")
	pain string | null @description("Pain, discomfort, or friction the user experiences in doing a task")
	details string | null @description("The why or cause of the pain. Details and background leading to or causing the pain. Multiple sentences or bullet points as needed.")
	evidence string | null @description("A verbatim quote from the participant in their own words. Include time stamp at end in parentheses.")
	desiredOutcome string | null @description("Desired outcome or benefit the user wants to achieve")

	// Research validation fields
	assumptionAlignment string | null @description("How this insight relates to existing assumptions: 'SUPPORTS', 'REFUTES', 'NEUTRAL', or 'UNEXPECTED'. Be explicit about which assumption it addresses.")
	researchQuestionAnswered string | null @description("Which specific research or decision question does this insight help answer? Be explicit about the connection.")
	evidenceStrength string | null @description("Strength of supporting evidence: 'DIRECT_QUOTE', 'CLEAR_BEHAVIOR', 'IMPLIED', or 'WEAK'. How confident are we in this finding?")
	productImplication string | null @description("What does this mean for product decisions? How should this insight influence our roadmap or strategy?")
	followUpQuestions string | null @description("What new questions does this insight raise? What should we investigate further?")

	emotionalResponse Emotions @description("describe the emotion the person feels about this using the Emotions enum.")
	underlyingMotivation string | null @description("why do they want to achieve this, or overcome the pain?")
	values BBValues[] @description("Which values is the person expressing?")
	category string @description("The topical theme or category of the insight to help us group similar insights") @@dynamic
	journeyStage string @description("User journey stage in the application or process of insight, e.g. Awareness, Onboarding, Planning, Learning, Assessing, Progress, Community, Support, Other")
	jtbd string | null @description("The user story or **Job to be done** style phrasing of what the user wants to accomplish, eg When I … I want to … so I can …")
	contradictions string | null @description("Potential contradictions and themes explicitly or implicitly by omission, things that the participant doesn't say, e.g. given an opportunity to discuss A,B,C, they only discussed A. Does the user discuss opposing claims?")
	relatedTags string[] @description("Related tags or keywords to the insight. Make tags conceptual, not UI feature names (e.g. social_accountability, not leaderboard)")
}

class InterviewMetadata {
	title string @description("Title of interview")
	date string | null	@description("Date of interview in ISO format: YYYY-MM-DD, (e.g. 2024-07-23) or Null if unknown")
	interviewer string | null	@description("Interviewer name, or null if not identifiable")
	durationMin int | null @description("Duration of interview in minutes")
}
// Process
// upload media (video, audio, etc.) create interview record points to media file
// get file -> send to AssemblyAI to transcribe -> TEXT FILE -> add into interview record (string)
// --> extract insights & metadata (about interview)
// -> save interview wrapper, participant, insights :: Some DB Mapping

class Participant {
	name string | null	@description("Participant name, or null if not identifiable from transcript")
	persona string | null	@description("A more fine-grained personalization within the segment that captures the participant's specific experiences, behavior, and preferences. up to 3 words. Null if unclear.")
	participantDescription string | null @description("A concise narrative: who they are, their workflow, top frustrations, aspirations, and any standout quotes that define them. <= 7 sentences. Null if insufficient information.")
	facetSummary string | null @description("Summarize the participant's key persona facets, motivations, and behavioral signals surfaced in the interview. <= 5 sentences. Null if insufficient information.")
	segment string? @description("Participant segment, eg. Teacher, Student, Parent, etc.")
	contactInfo string? @description("Participant contact information if given")
}

class InterviewExtraction {
	metadata InterviewMetadata
	participant Participant
	insights ExtractedInsight[]
	relevantAnswers string[] @description("List of participant responses that directly address the research objectives, business goals, and key decisions.")
	observationsAndNotes string @description("Concise participant description capturing their attitude, needs, and why they matter for the research objectives.")
	highImpactThemes string[] @description("Interview key takeaways. List the 3 strongest takeaways and explicitly tie each to a decision or research question (e.g., 'Decision Q: Pricing — Customers balk at annual contracts')")
	openQuestionsAndNextSteps string @description("What next steps should we take to validate our hypotheses or address our knowledge gaps? Pithy statements.")
}


class SetRecord {
	term string @description("Short, descriptive name (1 - 5 words usually). These are usually tags or keywords, phases, stages, or themes.")
	definition string @description("Succinct definition of the term.")
}

class Set {
	name string @description("Name of the set")
	description string @description("A succinct description of the set and how it will be used.")
	members SetRecord[] @description("A set of terms and definitions. These are usually tags or keywords, phases, stages, or themes that can be applied in various situations to force clarity.")
}

function ExtractInsights(transcript: string, userCustomInstructions: string) -> InterviewExtraction {
  client "CustomGPT4oMini"
  prompt #"
    Extract targeted insights from this interview transcript that directly address research questions and validate/refute key assumptions.

    Focus on extracting succinct takeaways that answer:
    - How do the participant's responses support or challenge our core assumptions?
    - What specific evidence validates or contradicts our hypotheses?
    - Which research questions does this interview help answer and how?
    - What unexpected findings emerged that we didn't anticipate?

    For each insight, be specific about:
    - Whether it SUPPORTS, REFUTES, or is NEUTRAL toward existing assumptions
    - The strength of evidence (direct quote vs. implied behavior)
    - How this finding impacts our understanding of the problem space
    - What follow-up questions this raises for future research

    Prioritize insights that:
    1. Directly answer key research/decision questions
    2. Challenge or validate core product assumptions
    3. Reveal unexpected user behaviors or needs
    4. Provide actionable direction for product decisions

    ## Participant Profile Requirements
    - Populate `participant.participantDescription` with a vivid, objective summary of who the participant is, their workflow, and why they matter for the project (<= 7 sentences).
    - Populate `participant.facetSummary` with the most important persona facets, motivations, and behavioral signals that emerged. Connect facets to supporting evidence where possible.
    - Ensure `relevantAnswers` contains verbatim or paraphrased responses that directly answer our research objectives, including timestamps when available.

    ## Key Takeaway Formatting
- `highImpactThemes` must contain up to three bullets that mention the specific decision or research question they serve (use the exact question text or a concise alias).
- Write each takeaway as "Question Label — conclusion" so the relationship is unambiguous.
- Do not restate raw facts; synthesize the implication relative to the question.
- REQUIRED: Always generate at least 1 highImpactTheme, even if it's a general takeaway about the interview.

Custom research focus:
{{userCustomInstructions}}

Interview transcript:
{{ transcript }}

Output format:
{{ ctx.output_format }}
  "#
}

function CreateSet(instructions: string) -> Set {
	client "CustomGPT4oMini"
	prompt #"
		Create a set of terms with definitions, based on the following instructions.
		When creating the set, try to use simple terms and concise definitions that are easy to understand.
		Try not to repeat words if not needed. e.g instead of A stage, B stage, C stage. Just A, B, C.

		Instructions:
		{{ instructions }}
		Output format:
		{{ ctx.output_format }}
	"#
}

function GenerateKeyTakeawaysFromEvidence(evidence: EvidenceTurn[], userCustomInstructions: string) -> InterviewExtraction {
  client "CustomGPT4oMini"
  prompt #"
    Generate targeted insights and key takeaways from this structured interview evidence data.

    Focus on extracting succinct takeaways that answer:
    - How do the participant's responses support or challenge our core assumptions?
    - What specific evidence validates or contradicts our hypotheses?
    - Which research questions does this interview help answer and how?
    - What unexpected findings emerged that we didn't anticipate?

    For each insight, be specific about:
    - Whether it SUPPORTS, REFUTES, or is NEUTRAL toward existing assumptions
    - The strength of evidence (direct quote vs. implied behavior)
    - How this finding impacts our understanding of the problem space
    - What follow-up questions this raises for future research

    Prioritize insights that:
    1. Directly answer key research/decision questions
    2. Challenge or validate core product assumptions
    3. Reveal unexpected user behaviors or needs
    4. Provide actionable direction for product decisions

    ## Participant Profile Requirements
    - Populate `participant.participantDescription` with a vivid, objective summary of who the participant is, their workflow, and why they matter for the project (<= 7 sentences).
    - Populate `participant.facetSummary` with the most important persona facets, motivations, and behavioral signals that emerged. Connect facets to supporting evidence where possible.
    - Ensure `relevantAnswers` contains verbatim or paraphrased responses that directly answer our research objectives, including timestamps when available.

    ## Key Takeaway Formatting
    - `highImpactThemes` must contain up to three bullets that mention the specific decision or research question they serve (use the exact question text or a concise alias).
    - Write each takeaway as "Question Label — conclusion" so the relationship is unambiguous.
    - Do not restate raw facts; synthesize the implication relative to the question.
    - REQUIRED: Always generate at least 1 highImpactTheme, even if it's a general takeaway about the interview.

    ## Evidence Analysis Guidelines
    - Analyze patterns across multiple evidence units, not just individual quotes
    - Look for contradictions or tensions in the data
    - Identify themes that emerge from combining different types of evidence
    - Consider the context and timing of responses (anchors)
    - Weight evidence by modality (observations > stated preferences > behaviors)

    Custom research focus:
    {{userCustomInstructions}}

    Structured Evidence Data:
    {{ evidence }}

    Output format:
    {{ ctx.output_format }}
  "#
}

test create_set_Personas {
	functions [CreateSet]
	args {
		instructions #"
			Up to 3 Suggested User Personas for an AI Learning Platform. We will use this to test our hypothesis of user problems with learning, organizing and studying.
			We suspect many younger students have some kind of learning difference or accomodation, such as dyslexia, ADHD, Autism, etc..
			Keep it fun and personal.
		"#
	}
}

test create_set_JourneyStages {
	functions [CreateSet]
	args {
		instructions #"
			Create a set of User Journey Stages for an AI Learning App.

		"#
	}
}

test extract_insights_Jerad {
  functions [ExtractInsights]
  args {
		userCustomInstructions #"
		Give me at least 4 insights that only a german scientist would notice.
		"#
    transcript #"
			Speaker B[0:00 - 0:01]: Hey, so today is June 11th, 2025 and I'm Rick and here speaking with Jerad, a friend and tutor.

      Speaker A [0:01 - 1:34]: AI to like, augment technology and use it to. To show that someone's learned something rather than like, they're all afraid that people are going to use AI to avoid learning or avoid work. Um, so if, if AI can be part of the process, you know, as it is here with. With, um, you know, collecting knowledge and organizing knowledge, um, and then the next step would be like, what are you going to do with that knowledge you've collected and organized? And um. I think you're the one that talked about like, the. Whoa. Oral report. You know, that's. That's a really big one. Um, and just, uh, you know, if you went one step further, what if. What if you could actively exercise that information in form of like a debate? And that's what I really came to is like the, the probably most complicated or sophisticated way to use your. The knowledge that you organize through a tool like this would be to, you know, participate in a debate where you had to defend the knowledge that you organized. Because if you're just organizing it and repeating it, you know, that's is organizing. It's basically automated. Um, repeating it is memorizing it. But then. And it's kind of like your hierarchy too, you know, if, if you can debate it with someone else who maybe organized it and takes a different stance, um, now you have to really understand it to do that.

Speaker B [1:34 - 1:36]: Exactly. Yeah.

Speaker A [1:36 - 1:57]: Yeah. So, um, you know, I, I think what, what teachers would like to see is how, um, you could. You could, you know, design with that in. In mind. You know, how. How can this tool be.

Speaker B [1:58 - 1:58]: Um.

Speaker A [1:58 - 2:38]: So right now the tool lets them do what they want, right? You can make a report with it, you can get ready for your oral report, you can make, you know, your notes, stuff like that. But how can it help the teacher by saying, like, by preparing them for a debate, you know, um, or preparing them to, uh, to defend this information, um, or to exercise it. Um, and I don't know if that becomes, you know, um, a description, a feature or a perspective, you know, like, like, um, a way of viewing the information.

Speaker B [2:38 - 2:39]: Yeah, um.

Speaker A [2:40 - 5:05]: Uh, but I, I think that would really. And if you could get, you know, if you could build it around that exercise, all of a sudden that becomes something like a midterm. You know, it's like, hey, class, um, now. Now we're going to, you know, um, pull up this tool and, and get ready for our, you know, once a semester, um, you know, assignment in which we, you know, pick a topic and pick a perspective and you guys are going to go out, you Know, um, collect information, organize it and prepare yourself to participate in some kind of dialogue with the classroom or participate in a dialogue with a different student. Um, and yeah, I think that's. And also like, you know, as I'm m talking about, you know, dialogue, um, going so far as to be able to um, you know, generate, let's say like um, a ah, metaphor or something like that. Like when you teach, um, you use. You lean heavily on metaphors. And I think that was another part of the hierarchy we were talking about too. Um, you know, repeating information and then getting to the point where you can actually teach something. So that requires the student to understand the perspective of their peers, um, and put themselves back in their own shoes, you know, a week ago before they collected this information. And you know, since they went through the process of not knowing, uh, researching, collecting, organizing and now they're at the point where they can, you know, um, make their own opinion on something. And now then they go to teaching, um, they're going to have to uh, let's say, distribute the knowledge. They're going to have to, to give the information to someone else in a way that they can pick up on it without going through the same process that they went, you know, their, their students aren't going to. Or their peers aren't going to collect the information, study it, go through it like they just did. But if they can give it to them in the form of, you know, uh, an analogy or something that um, even better would be to incorporate what they had all learned in that same class.

Speaker B [5:06 - 5:07]: Um, yeah.

Speaker A [5:07 - 5:27]: Um, you know, now they're up there in place of the teacher giving a lecture. Um, so I, I think, yeah, it's, it's really comes down to dialogue. Whether that's a debate or whether that's you know, a giving a lecture. I um, think those are, you know, showing that. That top of the pyramid.

Speaker B [5:27 - 5:27]: Yeah.

Speaker A [5:28 - 6:11]: Um, again, I think we kind of right now the tools are, are aimed at, at the student or they're aimed at the person who's trying to learn and then do something with that knowledge. But if we could have it, um, it's still the same tool but pitched in a way where it's like, hey teachers, this is a great tool to help you, um, incorporate AI into your class while still, you know, um, giving the student an opportunity to learn. Yeah, um, it's going to be part of, part of work. You know, it's, it's, you know, it's letting them practice that. So m. Yeah.

Speaker B [6:12 - 6:52]: Interesting. Now I think that's Because I had shown you a little bit before, and that seems like it sparked, uh, this conversation a little bit. Um, what's new to me is the metaphor and the peer education kind of like, hey, you have one student teaching another student, which I think is indeed novel. Um, at least from my perspective. Could you. Would you mind, like, resetting me, like, on your. Because you're tutoring one on one now, right? Is that correct or.

Speaker A [6:52 - 8:12]: Yeah, so I, I do some tutoring, but now I mostly work with other tutors and kind of program directors. So right now, like, I'll sit down with a tutor, um, we'll look over, like, videos of them tutoring, and I'll help them be a little more effective. Um, I'll help them with exercises, and sometimes I'll help them with theory. Like here's, you know, theory of learning and teaching and stuff like that. Um, and then on the program, you know, direction and development side, um, we create programs that are designed to help our students. Uh, I'm in the high school department, so basically we're focused on, you know, success in high school. Um, we also do some social, emotional, learning. And then like, the key, the big one, is to get into college. So like, right now we're doing a program on, um, college applications and essays. And I'm not why I did get this when someone wasn't there and they needed someone to fill in. But I'm. I'm basically developing the program. I'm putting resources together, lesson plans, and then I'll meet with tutors once every two weeks just to kind of, uh, again, review videos, talk to them about what's going on.

Speaker B [8:12 - 8:18]: Oh, wow. Okay. And is this a private company that you work for or.

Speaker A [8:18 - 8:30]: Uh, yeah, it's a nonprofit. Um, it's a private company. They've been around for, uh, 35 years. I've been there for three years.

Speaker B [8:31 - 8:37]: Okay, what can, what's it called? I'm curious.

Speaker A [8:37 - 9:32]: It's called, uh, E.P.A.T. east Palo Alto Tutoring and Tennis. And their philosophy is that, um, just epat.org will show e P A T T. Um, their philosophy is that, um, you know, mental fitness and physical fitness are related. And in that area, there was a pro tennis player a while ago, um, made some money playing tennis. And then he created like an endowment, um, to help students. You know, uh, there's. There's a lot of, you know, um, unserved, uh, students there, um, like lower income communities. And he wanted to create this place for them to, you know, pursue education while, you know, and, and then incorporating the part of, of uh, just being socially active and playing a sport, you know, hanging out with other students.

Speaker B [9:35 - 9:45]: Yeah. Yeah. Okay, that's, that's coming back to me now. Yeah, that's cool. And the juxtaposition of East Palo Alto and Palo Alto proper.

Speaker A [9:45 - 10:18]: Yeah, and Palo Alto. Yeah. And so a lot of the, their parents are the ones that are, you know, working, uh, the, the worker, the service class to the Palo Alto group. And I mean, anytime you get a lot of, you know, hyper focused, um, you know, high income areas, you're going to have some low income, dense areas kind of thing where it's like a small area that, you know, is this able to service a lot of people that take care of more spread out area of money.

Speaker B [10:18 - 10:46]: Yeah, it makes sense. Like, and so do you find like that these students, um, you know, they obviously have like a range of challenges, but like, how would you, how would you, would you be able to prioritize them or say, like, they're mostly like cognitive or they like time management or a mix or emotional.

Speaker A [10:46 - 14:09]: Yeah, a lot of them just, they're not exposed to other ways of how the world works. You know, they're, they're just basically what they see as with most students. And um, a lot of what they see is just, you know, their parents in the service community. Like I, my first student I worked with, we did an exercise on, you know, how education is the path to anywhere that you want to go. You know, I say, here you are now, you know, you know where you are. You can look around, um, and imagine where you want to be. Imagine, you know, do you want a family? Where do you want to live? What kind of life do you want? And we're going to find a path from here to there through education and academia. And I said, okay, you know, what kind of, you know, if you could do anything, what would you do? And she was like, uh, I don't know. And he came up with, you know, I want to be landscaper. All right? And I was like, let's, let's try and get creative. Let's think of something crazy come back to me. And then when he came back, he's like, what about a baker? And it turns out that his mother was a baker and his father was a landscaper. And he couldn't even think of, of a different career to get into or something that he might want to try out. Um, they just, they don't have access to worldviews. Like, you know, uh, I feel like we do where it's like, oh, what about this. What about that? I think that we're also raised like, you can do anything you want, you can do this, you can do that. The way that they're raised, know, unfortunately, is what you have to do in order to survive. You know, we're like, hey, I can do anything I want, I can thrive. And you know, they're a high school student that ah, can't even go to school because they have to stay home and take care of their younger sister or brother, you know, because their parents have to go to work, uh, or they have to do homework late at night because they, they sleep on a couch. And there's multiple families in the home so they can't work in the daytime because there's a lot of families in the living room. Um, it's, it's these challenging situations that, you know, kind of force them to physically live some way. And then by doing that they're limiting their mental perspective on what they can do because they're used to being limited. You know, it's like, well, what can I do? You know, rather than thinking, um, what do I want to do? Is what can I do? And that's where I see or I, you know, experience that, that limitation. And so, um, you know, that's where we get to eventually is, is opening them up to like, you know, there's all these ways of living that, that ah, you can get to, um, but to increase the probability of you reaching that dream or that ideal life, um, it's, it's a lot more probable you'll get there if you start looking at it now, you know, like, uh, you can rent, you can end up. Which often happens in a situation that, oh, this is great, you know, but if you're going to wait on chance you can end up somewhere else too. Um, so if, if you want to be a doctor when you're a kid, it's a lot easier to get there than if you want to become a doctor when you're in college, you know.

Speaker B [14:11 - 14:16]: Yeah. And you're working mostly with high school age students now.

Speaker A [14:17 - 15:03]: So, um, sometimes I'll pick up like a junior high student and then this fall I'm going to do an elementary school student just to see what it's like. But, um, I, I've always worked, even before I was here, I've always worked with, you know, either college students or high school students, um, just because I can. The conversations I'm interested in are conversations like this, are conversations that involve potential. Um, they involve kind of this like, you know, bootstrap Mentality where it's like, how can I get somewhere or achieve something great with what I have on hand? Um, those are the conversations I like to have. And high school and you know, early college is a great place to have, have those conversations.

Speaker B [15:06 - 15:10]: Yeah, well, those are, that's where they're really forced to make these bigger decisions.

Speaker A [15:11 - 15:11]: Mhm.

Speaker B [15:12 - 15:14]: If they have those opportunities.

Speaker A [15:14 - 15:54]: Yeah, yeah, yeah. When I work with my junior high students, it's more about discipline and attention. You know, it's like, hey, sit down and we're going to work on this and we can't think about anything else. We got to think about this, uh, juxtaposed to high school where it's like, what I'm doing has to do with what I'm going to be doing and what I'm going to be doing has to do with where I want to be. So you have, you know, where you want to be. You know, you got to figure out what do I got to get to doing. And then to get there you got to say, what do I need to focus on now? So it's, you know, it becomes a little more complicated. M which requires more, more planning, um, you know, more sophistication.

Speaker B [15:54 - 15:55]: Yeah.

Speaker A [15:55 - 16:05]: You know, uh, that's when it requires a conversation. You know, when you're younger, it's more like you're instructed to do something, you know. So that's discipline.

Speaker B [16:05 - 16:18]: Yeah, yeah. Can you tell me a little bit more about how these students, um, you know, on the planning side that you just mentioned, how do they go about do that, doing that? What does that look like for them?

Speaker A [16:19 - 20:00]: Okay, so let's see. I, I, it's really a mentorship program. Um, so we uh, work with Stanford a lot. Um, we're usually looking for college students at Stanford to pair up with our high school students. And that's where I come in. I'll talk with the Stanford students, I'll see their experience, their interests. Um, I know all my high school students and I'll try and pair these people up in ways that, you know, uh, makes sense for where the student is interested in where their strengths and weaknesses are sense from like a cultural or like, uh, somewhere where the student's gonna have respect for that college student. Because in high school you get to this point where, um, you know, there's, there's two things. One is like, you think you know a lot or you think you know it all, you don't need help from someone else. But what I see more with our students is, um, they've become so accustomed to, um, not succeeding or like they've gotten F's in a class for so long or on assignments that they're very timid and they're afraid to ask for help either because they don't know what they need help in. It's just like I'm. I went to class, I was so confused. I don't even know what questions to ask or because they're similarly ashamed that the tutor's going to ask them a question that they don't know the answer to and they don't want to seem foolish. So you kind of have this balance of someone who is successful in a way the student's interested in, but also that the student can feel comfortable with. Um, ah. And connect with. Um, and then let's see the planning and then the exercises this the they're gonna do. That's where my program, um, you know, program comes into where it's like I'm, I'm creating either exercises for the tutor to do with the student. Like right now we have a worksheet where they're writing up any extracurricular activities, any experience interests, and then they're going to turn that into a resume. Um, and then they're going to work next week on uh, essay prompts. So just like practice essays for college applications. Um, and then when it's more in school, it's a lot about, it's about theory and stuff like that. Like, um, there's this thing we call like the 5050 rule where you want to try and get your student to speak as a much as you are, because the student is in a classroom, in classrooms all day getting lectured to. Um. And so a tutoring session shouldn't be about lecture. It should be more about conversation and, and practicing. Um, and so we try and get the, the students to talk as much as they can because since we have college tutors, usually they're pretty interested in the subjects that they're teaching. So they can just keep going and keep going and pour it out. But the student doesn't really need another lecture. They need someone that can meet them where they are. And this is where those metaphors come in a lot, you know, where the student has to talk about how they see things and then the tutor has to kind of put themselves in that, in that mindset and say, okay, how can I use um, words that they're familiar with or concepts they're familiar with to get them from where they are to where we need them to be?

Speaker B [20:02 - 20:25]: Yeah, no, that makes a lot of sense. That's where it comes into like the importance of the dialogue that you're talking about. So all this social, this social financial, like family unit stuff, um, is a big stage for backdrop for how you approaching and working with the students.

Speaker A [20:28 - 21:29]: Exactly. Yeah. And that, that often takes a meeting before it starts with me and, and the, the tutors just to talk about a few things so they understand where their student is coming from. Because um, they'll, I've seen them. Well, I've, I've lost a couple tutors walking into sessions and they're like, you know, I'm trying to work with my students but they're just, you know, not responsive. I feel like I'm wasting my time. And they leave and they don't understand, you know, that their student is, you know, he's been through a lot of, you know, like, you know, semi traumatic experiences of trying to do something really hard. And then it turns out that what he was doing wasn't what the requirement was. And so it just kind of really, um, you know, makes them kind of suppress their own uh, I don't know, enthusiasm to try and succeed or try and be creative with, with their um, schoolwork. Mhm.

Speaker B [21:32 - 21:34]: Got it. Okay.

Speaker A [21:34 - 23:38]: Yeah. And the, and the meeting students where they are part that the tutor has to do, that's something unique to tutoring. Um, and that's really how education started. You know, like the first school was, you know, I guess like Plato was, was doing stuff too, but you know, Aristotle was like the original tutor. And that's kind of how education used to be. It was like one person, um, teaching another person. They didn't have classrooms. And what's great about that is when you're, when you talk to someone, you know who they are. And humans have empathy so we can understand that person. And that's how communication works. If we didn't have empathy, I would just be spitting numbers and it would be computers talking to each other. You know, and if computers don't have a shared syntax or a shared language, they can't speak to each other. You know, the communication doesn't work. And we through empathy can create that syntax on the spot. You know, uh, we can come up with our own, you know, like lexicon or whatever it is and, and share information with each other. In school they basically have to like find the average, like this is how I can reach this perspective, is how I'm going to reach the most amount of students. Um, tutoring is, they've already got that, you know, generalized perspective. Now I have to see where they actually are and give them a specialized perspective. And usually a student going to tutoring didn't really pick up on that generalized perspective. We have a lot of like, um, iep, which is like, it's called individualized Education program, I think. And if they just, they need to learn something a certain way, you know, they, they just have a different way of acquiring information, uh, which was, you know, ah, a lot of my experience, you know, I, I failed through school until I, you know, got a little bit older and I realized that I had to find my own way to, to, you know, acquire knowledge in a useful way, you know.

Speaker B [23:38 - 23:39]: Yeah.

Speaker A [23:39 - 24:13]: Um, but I, I almost wonder how, how a tool could provide that individualized perspective, you know, because, um, I'm guessing, you know, the way that AI collects a lot of information and organizes it is based off how information is usually organized online, uh, or usually organized in textbooks or whatever. Whatever they collect from. So that's, that's just another idea of, you know, how can information be.

Speaker B [24:14 - 24:16]: Hey Jen, do you want me to put my headphones on?

Speaker A [24:16 - 24:35]: Or it's like, like you had the, the knowledge graph, you know, or there's the bullet points or there's index cards. So, um, all those different ways to organize and view the knowledge can definitely reach different students in more effective or less effective ways.

Speaker B [24:39 - 24:45]: Yes, yes indeed. I've actually, um, just time check. How much time do you have?

Speaker A [24:46 - 24:55]: Um, I've got about maybe 10 minutes. Okay, thanks for checking. Yeah, I wasn't watching. I start talking about this stuff and I'll get into it all day long.

Speaker B [24:55 - 25:01]: I know, I know. Um, let, let me do. Are you, you on your computer right now?

Speaker A [25:01 - 25:02]: Yeah. Yeah.

Speaker B [25:02 - 25:10]: Okay, let me, let me share a screen because I want to jump um, for it and we might not have enough time for this right now.

Speaker A [25:11 - 25:11]: Yeah.

Speaker B [25:11 - 25:34]: Um, but. Okay. Mhm.

Speaker A [25:54 - 26:39]: Mhm. Okay, I can see your screen. Ask anything.

Speaker B [26:39 - 27:29]: Okay, super. Um, and I don't think we'll be able to get through the whole thing right now, but this will probably take a little bit longer. But I feel like what the conversation is leading to and what we've come up with is a new set of concepts. Um, kind of like trying to get deeper into m. The more holistic situation of a student, not just here's some information. So let me walk you through this and what I'd like to do is show you a screen and then have you respond to it and say, okay, do you understand what it's asking you to do? Does it make sense? And we'll just kind of go through m that got it. And you just tell me when you're out of time and then maybe we can pick up again later some other time.

Speaker A [27:30 - 27:30]: All right, perfect.

Speaker B [27:30 - 27:35]: All right, so let's start with this screen.

Speaker A [27:40 - 27:43]: Um, you're, let's see, asking me to.

Speaker B [27:43 - 28:01]: Oh, okay, so there's two options, right? Like, it's like, this is like the onboarding part of. Okay, I want to learn something. I could either type in a question or I can upload some content. And there's two different ways to start.

Speaker A [28:02 - 29:06]: Yeah, that's, that's, that's how I saw it. I see it as, um, you know, almost. Yeah, yeah, I see it. Yeah. I walk up, ask, um, me something and then the. What would you like to learn? I think is actually kind of important here. I mean, if I was directed here by, by someone who had used this for a certain, like, they're like, hey, if you want to do that, do this, you know. But if I was exploring on my own, like, hey, like, what's a good tool for doing something? Blah, blah, blah. If I saw this without the what would you like to learn? I wouldn't be, I wouldn't think it's, it's so like, you know, based on like, you know, learning something versus like an Ask Jeeves type thing. Like, um, getting. Ah, so learning something versus like being directed somewhere. Like as there's asking for directions and then there's, you know, like, hey, how do I get to like Big Ben to talk in London? And then there's like, hey, what is big? Like what's the history behind it? So what would you like to learn? I think is actually pretty important.

Speaker B [29:06 - 29:09]: Okay, so maybe even elevate that over the asking.

Speaker A [29:10 - 29:22]: Oh yeah, that's a good, that is a, that's a good question. That's a good thought. Yeah. To put what would you like to learn? And then, you know, if you need the subtext like ask here or something like that, or that's kind of in your, uh.

Speaker B [29:23 - 29:45]: Interesting. Okay, super. All right. And then if you. I'll just explain this part. So this is a mock up right now. It doesn't entirely work, but if you were, if you had like course material or an, you know, a reading assignment or something, you could put it in here all and that would, and then the next, if you click next, you'd get to here.

Speaker A [29:53 - 30:40]: Yeah, this, this, this feels a lot, Yeah, I, I feel a lot more like what we're talking about, you know, what do you want to learn? Um, mhm. Okay, so I, I'm, I, I Feel like, what do you want to learn? I'm feeling a lot more the, the first picture because the, the learning goal. Um, I get, I feel a little confused on that. So let's see, like right now, um, I want to learn about, um, certain drawing techniques, you know, and I would look at this. Okay, what do I learn? I want to learn about a certain drawing technique. Um, and my goal would be. I just feel like there's something in between here.

Speaker B [30:41 - 30:41]: Yeah.

Speaker A [30:41 - 31:02]: Okay, what do I want to learn? And then your learning goal. I feel like this is where someone explains to you, hey, so what do you want to learn? I want to learn this. All right, so in order to learn, you got to create a goal or create this. Um, it's, this is tough because I also don't want too much here. Um, what do you want to learn to find your learning goal.

Speaker B [31:04 - 31:13]: So it's feeling a little vague, right? Like maybe some better examples. Like, maybe like be able to be able to write an essay about the.

Speaker A [31:13 - 32:08]: Topic or well, also if, if it's a lot less. Um, so right here it says, what do you want to learn? Once I read underneath. So again, I look at it, I just, I, I read the black text. What do you want to learn? Learning gold, your background. But then once I looked again at, ah, at the, um, the lighter text. What do you want to learn? Define your learning goal and we'll create a personalized learning path. Um, it's, you know, I, I, I would want to do some more looking at this, but it would, what do you want to learn? Um, something that explains that, um, you know, by creating a goal, that it's a lot easier to, to organize the information for you. Or the first part about learning is defining where you want to go. Um, uh, it seems more, more human.

Speaker B [32:09 - 32:09]: Yeah. Yeah.

Speaker A [32:11 - 32:19]: Hey, what do you want to learn? Oh, I want to learn how to water. You know, I want, I want to learn how to, to draw with pastel.

Speaker B [32:19 - 32:20]: That.

Speaker A [32:20 - 33:16]: Okay, well, the first step of learning is, you know, to create a goal or to, you know, what, what is that first step? Something like that. I think it's, yeah. So to start to get you there, let's set a goal, you know, and I be like, okay, so to get to drawing with pastels, I need a goal. I'd like to, you know, know, do a portrait. Ah, with pastels. Yeah. I, it's, and it depends on the environment. Like, if I'm doing this during a classroom exercise, uh, I feel like you're being walked through it. But if I'm Doing this on my own and I'm just using this tool. I feel like the, the, the smaller text could be a little more, um, helpful with understanding why I'm doing it or what I'm doing rather than in telling me what to do.

Speaker B [33:17 - 33:20]: Um, yeah, the why. The why.

Speaker A [33:20 - 33:21]: Yeah, the why. The why.

Speaker B [33:21 - 33:22]: Okay.

Speaker A [33:22 - 33:22]: Yeah.

Speaker B [33:24 - 33:25]: Okay, that's good. There's some good insight.

Speaker A [33:26 - 33:53]: Yeah. Because, because it starts like a conversation, right? It starts like, hey, what do you want to learn? And then it turns into direction and, and I don't know, I don't want to like jump too far, but it could be towards that whole like giving an instruction versus having someone meet you there, like a tutor. And since this is like a one to one thing, it's a person to a tool, maybe it should be a little more meeting you.

Speaker B [33:55 - 34:04]: Yes. Yeah, well, that, that's, that's definitely the sense we're trying to capture. Um, yeah, but okay, this is also.

Speaker A [34:04 - 34:55]: Very concise, which is good too, because, like, you don't want a paragraph of text saying like, you know, according to this theory of learning, it's better for you to create goals and we can go step by step. You definitely want to keep it short like this. And if this is the second time I'm using the tool, this is perfect. You know, so we also got to think about, are we, um, using this tool all the time? In which case this is perfectly designed for that. Probably because you're working on this all the time. Um, and then maybe the first time you go through it, there might be a tutorial or something like that that explains I, you know, by setting goals, this and that. So it, there's, there's a good argument for having a tutorial. I mean, yes, even the most simple apps have a tutorial. So, yeah, um, that's. If we're going to assume there's a tutorial. This is great.

Speaker B [34:56 - 35:00]: Okay, that is the, that is the, the goal to have a tutorial.

Speaker A [35:00 - 35:04]: Uh, yeah, so let's, let's work on, on the tutorial. Let's, let's work with that assumption.

Speaker B [35:04 - 35:04]: Yeah.

Speaker A [35:04 - 35:07]: And yeah, this is perfect. This is exactly super.

Speaker B [35:08 - 35:43]: And then we're asking for your background and I think we could probably reword this, but the, the goal is like, get these students to, and make some kind of a commitment, investment and say, well, I don't know much about water management, but, you know, uh, I know it comes, we get water from Colorado river or something somehow. Right? So now they, they have a starting point as opposed to like, so to your point earlier, they're starting to produce, you know, information instead of just consume it.

Speaker A [35:43 - 35:43]: Yeah.

Speaker B [35:44 - 35:44]: And then we can.

Speaker A [35:44 - 36:17]: And what really quick. What provides more value to. To your, you know, back end? Someone saying, like, um. Like, let's say I know a little bit about the water, like, where the water comes from. Or is it better to say, like, how does a city get its water from the state? Like, is it better for them to ask small questions here? Like, if the big question or the big idea is learning goal, does the background part. Do they want to know small questions or they want to know, uh, small facts?

Speaker B [36:19 - 36:46]: I think for the background, I was intending it to be small facts so that we could say, okay, great, since you know, about the Colorado river, you know, let's start with that to get them invested, maybe, um, as a touch point to find some commonality so they're not immediately getting overwhelmed with a whole bunch of new stuff. But like, a little bit of. Here's what you know. And let's tell you something in addition to that.

Speaker A [36:46 - 37:07]: Um, that's. That's what I get out of this. I get small facts. That's. That's the. And your background is actually, it's, you know, I can't think of two words that are. That are better right now. Like, okay, yeah, even what do you know? Doesn't. That sounds like I'm writing a paper. Your background sounds pretty like. I. I see the. The desire for something more accurate, but it's pretty good.

Speaker B [37:08 - 37:17]: Okay. Yeah. We. And we can. And all this is like, up for debate and change and all that. Like, I'm not invested.

Speaker A [37:17 - 38:54]: I'll keep. And I'll keep thinking too. Yeah. So, uh, I see. Yeah. I, I think of this almost like, um, how much information do I want to get and how complicated is it going to be? I guess how complicated is it going to be is kind of, uh. The first thing that was the first thought and the second thought was how much. So if I just want something quick and something easy, it would. It would be inner. Uh, it'd be introductory. Introductory. But if I wanted a little more information, like, you know, um, I'm not an expert on the water, but let's say like, um, waves. Uh, introductory level would say like, storms create waves that, you know, wind that blows waves to shore. Intermediate would say, um, you know, something like changes in temperature, uh, create weather, which blows waves to shore. And then as you get further up, it would be like, you know, sun sends energy to the earth that heats up different areas at different rates. And that change and the difference between those changes in temperature creates storms and weather, which then creates waves. So I, I see it not just as a complexity but also as an amount thing. So I don't know if those are separate or if that's kind of put together here.

Speaker B [38:54 - 39:13]: Interesting. Um, this was a little bit more, uh, I think what you're addressing is what's on the next page. Um, but this is, um, more. You see these levels down here? These are actually correlating to the Bloom taxonomy levels.

Speaker A [39:13 - 39:14]: Okay.

Speaker B [39:14 - 39:15]: And so that was.

Speaker A [39:16 - 39:21]: Oh, that's nice. Yeah, I didn't, I didn't see you clicking through that. The. Yeah, apply, analyze that.

Speaker B [39:22 - 40:59]: So that, that's what I had started with. Um, and so let me jump to the next page because I'm trying to figure out the best way to organize this. Um, and so here it gets a little bit, this gets a little more complicated. Right. Um, which might be overwhelming for students, but now we get into a phase of like, tell me, um, how much of this do you want to get into? And so this might be an alternate way of dealing with it. What I was thinking is the user could look, uh, at this and maybe draw a circle around how much. Or they could say, all right, they could add a plus. They could say, give me more on this area, less on this. Maybe even kind of prune a tree, if you will, of content to direct, uh, the AI on the topics it wants to cover. Mhm. The idea is maybe you would interact with this tree. You could add topics here and maybe remove some m. You know, so that was kind of like the idea and it would show you. Okay, well this is pretty focused on one side of the knowledge or it's pretty balanced. And I'm not even sure that's super. Uh, this bottom part is something the student need, average student needs to see. Um, so it's all very exploratory.

Speaker A [41:01 - 44:06]: Yeah, this, that's interesting because. And, and this is tough because I have a bias. I, um, I don't know where I, I from, what I remember. So like I have a really strong bias against like network graphs and node structures. Um, and, and I spent a lot of time with them because, um, when I study cognitive science, it's a lot of, you know, network information. Um, the mind as an embedded system and machine learning is really big on these. And I, um, think still now, but for you know, the early, like 2010 to 2020, there was a lot of products like this too. You know, creating your notes into nodes like this. And I think from someone who thinks like a systems Perspective like me. And I'm guessing you node graphs are great. Like I, you know, I was the same way. Oh, so cool. But, um, in, in, um. I don't know if this is like, studies or what. It just seems like it hasn't really hit like there was that node, um, or graph note app for a while that was. I was taking off and it just seems like a lot of these kind of flare out. Um, and when I look at this, as soon as. And here's the thing, it required you to click on those things. I love the bottom piece, but what I love about it is how it changes. I love that when you're adding or subtracting from it that it's giving me. Ah, yeah, an adapting summary. I really, really like that. And I can't think of another way to add or subtract without that graph, you know, so it's, it's tough. Like, um, you know, and maybe, maybe having a graph as an interface rather than as the organizational piece, you know, because, like, um, we had like tools where there's like note cards in place of all of those nodes. Right. And it takes up a lot of space for the amount of information that it holds versus, like a bullet chart. Bullet chart. I love bullet charts. Like, it's just like, like look at how people write their notes by hand. Anyways. People do bullets. Boom, boom, boom, boom. People on computers, we love to put them in these, these graphs. But when we do it by hand, we're usually doing that. I know there's like brainstorming, and I think that's where a lot of this kind of like, how do I get a brainstorm and put it on a computer? Um, um, but. And I see this bottom piece kind of like that bullet point. You know, it's like, let's look at the depths. Boom, boom, boom. You know, let's look at the topics. Boom, boom, boom. Let's look at how balanced it is and what the learning style is. Like. I, that is how I want to read information. So that's great. How I want to interact with the information. Um, yeah, like I said, I can't think of a better way than the node one, but I am a little, um, I have, I just have a personal issue, I guess, with, with uh, information graphs and, and, or like node graphs like that. But I've never used them as an interface. So, um, I, I would want to play with this.

Speaker B [44:06 - 44:06]: Yeah.

Speaker A [44:06 - 44:10]: So, you know, in a couple weeks, you know, when you're back, I want to touch this.

Speaker B [44:11 - 44:11]: Okay.

Speaker A [44:12 - 44:36]: Um, and yeah, it's it's hard for me to think too deeply into it, but um, it makes sense once you touch it, you know, and I'm sure once you know about it. I, um, do wonder how you would know what these topics are. You know, if I'm, if I'm reading this on my, my laptop, like I guess you'd have to put just like a one word description for, for each of these nodes or.

Speaker B [44:37 - 44:47]: Yeah. The way. So this isn't perfect representation of like we instead of circles. So just the prototyping tool I'm using, it came up with circles. But what.

Speaker A [44:47 - 44:49]: I've got like two minutes.

Speaker B [44:49 - 44:50]: Okay.

Speaker A [44:50 - 44:53]: So if you want to keep talking about this, let me know.

Speaker B [44:53 - 45:04]: Yeah, let me just, uh. There's one. Yeah. It would look different than this. It would look different than this where there'd be like two to three words and it's ah, more of a box.

Speaker A [45:05 - 45:11]: But we'll have to create like a more accurate representation or a more accurate situation.

Speaker B [45:12 - 45:21]: Exactly. Yeah. Yeah. This is, this is total mock up. But after that the final step is you go, okay, now pick the mode you want to interact with the tool.

Speaker A [45:23 - 46:12]: Yeah, just, just looking at the left column, mode. Exam prep, mentor chart, think tank, Creative Explorer. I love it. You know that, that makes me feel like right away I look at this and go, wow, I'm saving so much time. Like, and that's what students are trying to do, right? That's what anyone's trying to do is what, you know, um, you know, manage my most, uh, sacred resource of time. Like, wow, great. Boom, boom, boom. And it also feels personal. You know, that's the one on one. And, and I'm gonna, I think I'm just gonna to champion that perspective. You know, the tutor's role like this. I'm gonna think of this tool not as a teacher, but as a tutor. You know, someone who's going to reach you where you are and build that bridge to where you want to go. Um, so I re. I love the left column. I'm gonna look at those.

Speaker B [46:12 - 46:54]: Super. And just the last thing I'll show you and we can come back and talk about it later. Um, is that, that was the. Tell me what you want to achieve and we'll create. Now what's happening is the system's going to create a learning plan and you're going to. And now you're in the interface for the app and we can kind of go through this at another time because I know you got to run, but you would actually jump into the learning here and Go through things and you'd have a chance to discuss, um, and then you could practice with quizzes. But this is where the learning would happen. And we'd show you the learning plan here of. Here's the things you need to do to get through here.

Speaker A [46:55 - 47:15]: Um, so I. I also want to play with the idea of putting that, um. Um, you know, um, what is it? Like exam test prep? Like, what. What are you trying to do with this towards the beginning, you know, even before. What do you want to learn?

Speaker B [47:15 - 47:16]: Yeah, I.

Speaker A [47:16 - 47:58]: Or at least next to it. Um, it's. It's an interesting thought that I think. I think the difference on putting that somewhere, uh, comes into, uh, in the enthusiasm level. Um, just because, like, when I saw it, I'm like, wow, this is cool. If that was, you know, the first thing that I saw that, whoa, this is great. Let me use this tool versus, like, what do you want to learn? Um, you know, like I said, there's. What do you want to learn? There's Google, you know, there's, uh, Wikipedia. There's all these things I can type in something. You haven't really set yourself apart, you know, at least from my eyes. My eyes don't notice difference.

Speaker B [47:58 - 47:59]: Difference.

Speaker A [48:00 - 48:09]: Um, but when I see that exam, whatever, all these different things, my eyes are seeing something. They're seeing a tool that they haven't seen before.

Speaker B [48:10 - 48:12]: Uh, that's good point.

Speaker A [48:13 - 48:45]: Yeah. It's like, if we were going to test that out, the question would be, how much more excited are you to use this tool? You know, how much more interested are you in this tool based on these two different ways of starting it, rather than like, which one do you think is going to get you where you want to go? I think the question is how much more interested in using the tool are you? Because that's what that's going to manipulate. True M. All right, well, I gotta. I gotta get to church.

Speaker B [48:45 - 48:46]: Yeah.

Speaker A [48:46 - 48:50]: Really cool talking to you. Uh, we can. We can just keep talking more and more.

Speaker B [48:50 - 48:51]: Yeah, let's do it.

Speaker A [48:52 - 49:29]: Um, I'll keep thinking about it, especially this summer. It's pretty interesting because I'm, you know, working with these tutors on trying to get students so it's not so much like, hey, I need help with this homework assignment. It's like, hey, how can I get you to, um, do like, some bigger stuff, you know, working on college essay prompts, um, know, exploring ideas and, you know, ultimately, you know, building a life of, uh, fulfillment. You know, that's. That's kind of my thing is how do I build a fulfilling life for the students or how do I help them? Give them the tools they need.

Speaker B [49:29 - 49:31]: Awesome. All right, Jed, I'll let you run.

Speaker A [49:32 - 49:32]: All right?

Speaker B [49:33 - 49:36]: Okay. Take care. Thank you.

    "#
  }
}
