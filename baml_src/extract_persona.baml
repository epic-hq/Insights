class Persona {
  // Demographics
  name string @description("Persona name: up to 3 words")
  description string | null @description("Persona Archetype description: 3-7 sentences summarizing behavior, pain, motivations, and preferences")
  age string | null @description("Most common age or age range, e.g. '25-34'")
  gender string | null @description("Most common gender for this persona")
  location string | null @description("Most common location(s) for this persona")
  education string | null @description("Most common education level(s)")
  occupation string | null @description("Most common occupation(s)")
  income string | null @description("Most common income range or level")
  languages string | null @description("Most common languages spoken")
  segment string | null @description("Segment or group this persona belongs to")
  role string | null @description("Role or job title")
  color_hex string | null @description("Hex color for persona visualization")
  image_url string | null @description("URL to persona avatar/profile image")

  // Psychographics
  motivations string[] | null @description("Key motivations for this persona")
  values string[] | null @description("Core values for this persona")
  frustrations string[] | null @description("Top frustrations or pain points")
  preferences string | null @description("Notable preferences")
  learning_style string | null @description("Preferred learning style")
  tech_comfort_level string | null @description("Comfort level with technology")

  // Behavior
  frequency_of_purchase string | null @description("How often this persona purchases relevant products/services")
  frequency_of_use string | null @description("How often this persona uses relevant products/services")
  key_tasks string[] | null @description("Key tasks this persona performs")
  tools_used string[] | null @description("Tools or products commonly used by this persona")
  primary_goal string | null @description("Primary goal for this persona")
  secondary_goals string[] | null @description("Secondary goals for this persona")
  sources string[] | null @description("Main sources of information or influence")
  quotes string[] | null @description("Representative quotes from this persona")
  percentage float | null @description("Estimated percentage of users represented by this persona")
}

function ExtractPersona(people: string, insights: string, interviews: string) -> Persona {
  client "CustomGPT4oMini"
  prompt #"
    You are an expert UX researcher. Given the following people records and their insights, generate a detailed persona profile.

    1. Create a UX persona that represents the people records and insights.
       - Use up to 3 words for a catchy name.
       - Write a 3-7 sentence description summarizing behavior, pain, motivations, and preferences.
    2. For each of the following fields, aggregate and summarize the most common or representative value(s) from the data:
       - age, gender, location, education, occupation, income, languages, segment, role, color_hex, image_url
       - motivations, values, frustrations, preferences, learning_style, tech_comfort_level
       - frequency_of_purchase, frequency_of_use, key_tasks, tools_used, primary_goal, secondary_goals, sources, quotes, percentage
    3. For array fields, provide 2-5 representative items. For string fields, provide the most common or relevant value.
    4. Use direct quotes from the data where possible for the 'quotes' field.
    5. If a field is not present in the data, return null.

		Interview records:
		{{ interviews }}

    People records:
    {{ people }}

    Insights:
    {{ insights }}

    Output format:
    {{ ctx.output_format }}
  "#
}

function GeneratePersonas(interviews: string, people: string, insights: string) -> Persona[] {
  client "CustomGPT4oMini"
  prompt #"
    You are an expert UX researcher and strategist. Below are a mixture of transcribed conversations, interviews, notes, and insights.
		Your task is to generate 4 personas based on the data.

		1. Find each distinct persona in the data, summarizing each as a Persona object in a descriptive manner to help us identify other people like them.
    - For each persona, fill out all fields in the Persona schema, using the most representative or common values.
    - For array fields, provide 2-5 representative items. For string fields, provide the most common or relevant value.
    - Use direct quotes from the data where possible for the 'quotes' field.
    - If a field is not present in the data, return null.

    2. Generate a up to 3 additional personas that are not present but would be expected in this context, based on gaps or patterns in the data. Mark these as 'projected' in the description.

		Do not group people into personas that are too different from each other.

		DO Not generate personas that are too similar to each other.

    Interview records:
    {{ interviews }}

    People records:
    {{ people }}

    Insights:
    {{ insights }}

    Output format:
    {{ ctx.output_format }}
  "#
}

test ExtractPersona_Sample {
  functions [GeneratePersonas]
  args {
    people #"""
[
  {
    "name": "Alice",
    "age": 29,
    "gender": "female",
    "location": "San Francisco",
    "education": "Bachelor's",
    "occupation": "Product Manager"
		makign 200k plus for years now
  },
  {
    "name": "Bob",
    "age": 32,
    "gender": "male",
    "location": "New York",
    "education": "Master's",
    "occupation": "designs menus for sushi restaurants"
		hates to eat raw fish
		earns 100k
		lives in a penthouse

  }
]
"""#
    insights #"""
[
  {
    "summary": "Struggles with onboarding",
    "details": "Both Alice and Bob found the onboarding process confusing and time-consuming."
  },
  {
    "summary": "Values collaboration",
    "details": "They prefer tools that make it easy to share progress and feedback with teammates."
  }
]
"""#
interviews #"""
	Nate Heon
Recording: 

Background on Education, Journey, Now:
2 Years at Palomar playing water polo
“Not going to be hard at all”
	•	Teacher does 2% of the teaching for you. 98% of learning is up to you
	•	Didn’t do so well
	•	Needed to do one thing: Switch to online classes -> Better GPA
	•	Got too busy
	◦	Other classes slipped and is needing to do more classes to catch up
	◦	Retaking English
	◦	Reevaluating Majors
	▪	Communications: Too much writing
	▪	Marketing: Like to the concept of having new ideas

Working at a Movie Theater
	•	Time is wide open.
	•	Starting a Summer Session

Walk me through a typical day: 
	•	Wake up around 7 - 7:30
	•	Drink water, make breakfast
	•	Sit around, waiting for class
	•	drive
	•	Get there 11
	•	30 Minutes to collect himself
	•	Go to Class

Took a Intro to Media
	•	Material wasn’t interesting
	•	Not very engaging -> did not do well
	•	Distracted?
	◦	No, the content wasn't interesting. Specific HW. Projects were worth a majority of grades. Took a lot of time to do

Feel Overwhelmed by Content
	•	Statistics takes a lot to do
	•	MacBook for a bunch of software to download
	•	Spent most of Saturday trying to do Statistics work

Tactics or Strategies:
	•	No, just learned it and figured it out
	•	Outlines + Chat
	•	Academic Papers and Resources
	•	Canvas AI system thinks that students are generating AI essays and are catching students
	•	Papers have to be from scratch. AI can still be used for an outline.
	•	Grammarly is helpful
	◦	Dings text regardless… what is it checking?
	•	Helps with planning degrees

How can someone get better with AI?
	•	For Water Polo
	◦	Giving a personalized playbook
	◦	This is what you did, you actually need to do this
	◦	Create Comparisons
	•	Video all practices or do 1:1 sessions to fix habits

Each time he is writing a prompt:
	•	Teachers give an outline (we should get an example) -> Connection to Mike here
	•	Write paper based on outline
	•	Teacher assumed he cheated. Teacher still gave him a zero. “Right before summer, he gave me a zero”
	•	Conversation back and forth?
	◦	Yes, it’s closely tied to what the teachers wants and being able to get as many points as possible. (Not much of an emphasis on learning the content)
	•	Sources of Content
	◦	J-store. Palomar Resource Database for Papers, Books, Docs
	◦	Fed into the AI tool
	◦	Don’t have time to read. Either sports or HW.

How much time?
	•	4 days to deep-read each article and make a summary.

Working on your own?
	•	Usually works on his own

Most frustrating part of the process
	•	AI Summarizes the articles perfectly
	•	Puts into his own words -> then submit it
	•	** but gets caught for cheating

AI is an Intelligence machine
	•	Words you haven’t used before
	•	Docks points on the originality

Has premium version of chat
	•	No Limit
	•	After 1st year of Palomar. Need to focus on getting information from Chat
	•	Uses Chat for asking question
	◦	Helps him get through
	◦	Ask questions based off course material
	◦	Law Class
	◦	Microeconomics
	▪	Really helped. Lots of graphs and questions that were confusing.
	◦	English
	◦	Theater
	◦	Can create study guides
	◦	Hallucinations were a pain point. Need specific answers 

What would a perfect solution look like?
	•	Professors don’t fear AI as much
	•	“It’s doing their job”
	•	“Teachers don’t like you using it”
	•	“They trust you”

Grammarly edits, Summary Note Cards. Sees that you’re trying to make it into your own words
There’s a lot of friction with this user and the professor. Lots of malice. 

Said our Concept demo was “Flawless”
Liked quizlet
Needs Mobile app


-----------

SPEAKER 1
Okay, so um, so Kai, appreciate you getting. So just for clarification, what's your um, year, ah, in school. And what are you studying?
SPEAKER 2
I'm going to be starting my second year in college and I'm studying for a major of business administration.
SPEAKER 1
Okay, super. Um, and let's see, can you tell. So what we want to focus on is um, how students are studying and learning and doing their work for what we call like longer duration, uh, skills acquisition. So not like simply asking a question of the Internet of you know, what is this? Or how do you do that but more complex, in depth subjects where you might spend more time, um, and multiple sessions over it. So that's in particular what we're, what we're curious about. Um, but uh, maybe you can tell me a little bit about like reflecting of your last semester m to um, like what your day looks like.
SPEAKER 2
Um, okay, so my last two couple semesters I did a lot of in person classes. So my day consisted of just waking up breakfast and then I would head off to school. And then depending on the class I took during the day, for example I'd had a couple math classes. I would usually go to the library before and study up on just previous homeworks and then maybe after I would go to see a tutors because I, at Palomar I have a couple free tutors that I use. So I'd go there, study with some tutors and then I'd also take some individual times and like the little pods to write essays and focus on other classes.
SPEAKER 1
Okay, cool. What, what kind of information do you usually work with? Like what subjects?
SPEAKER 2
Subjects?
SPEAKER 1
Yeah, subjects.
SPEAKER 2
Recently I took um, I did a couple film classes, I did speech class, a couple math classes, some calculus, algebra, and then I took an English critical thinking class as well.
SPEAKER 1
Okay, super. How do you usually start, um, diving into a new topic or subject?
SPEAKER 2
Um, when I start diving in usually from, if I'm given materials from my professors, I usually try and read as much of the material that they give me like books or examples or like lectures and examples from that is where I start the most with my research.
SPEAKER 1
Okay, so with the material that you've been given and then if you need to you go um, elsewhere. Um, yeah, anything with like study groups or um, apps or websites.
SPEAKER 2
Um, I mean sometimes groups. Because in my past I've had a couple classes where I use my math tutors and I meet with groups of people in the same class and we kind of bounce off each other with ideas for studying and stuff like that. But besides that I don't really use study groups that often.
SPEAKER 1
Okay, um, how about, like, you know, AI and, uh, things like that?
SPEAKER 2
Yeah, I use a lot of A.I. just for, like, I use A.I. i would say majority of the time when I'm working through something, let's say I'm writing an essay and I've kind of, like, lost my train of thought or like, I'm kind of just missing something to connect my ideas together. I'll run something through AI and like, it'll help me connect my. What I wanted. What my evidence and what I wanted to say, to analyze it and helps me put it all together. And I also used it for, like, in math situations when I'd been struggling with the problem and I'd been, like, trying to solve it. I couldn't figure out the correct, like, format or equation. I would use that and have it show me the step by step of how to do it. And then I would apply that to other problems that were on my homework or my exams or things like that.
SPEAKER 1
Okay, so can you maybe tell me a little bit more about, like, the kind of the critical thinking or writing when you lost your train of thought? That sounds, um, interesting.
SPEAKER 2
Yeah. So like, when I would use, like, for example, like, the last essay I wrote was about connecting multiple books that we read during my class to. Or, uh, it was supposed to be what was your favorite piece of material you read and what. For what reasons? And we just had to describe that with multiple subtopics of literary, uh, elements. And so I had to use a couple outside sources. So I took from, like, Skull and also books that I've read in class. And I had A.I. ah. Help me sometimes with connecting those outside sources to the book. Because I knew the book and I had the material, but I just didn't know really how to put them together in, like, an efficient way that made the most sense for me to use. So I had AI Kind of helped me understand how I can put this piece to this piece to make a whole piece to use for the evidence for the essay. So it kind of just helped me to put things together. And then from there I was able to revise my, um, sentences or paragraphs.
SPEAKER 1
Okay, super. So what. What kind of a prompt would you give it? Like, would you say, here's what I have so far. Help me fill in the blanks? Or how would you.
SPEAKER 2
Yeah, I would say things along the lines of that. I would say, this is. This is what I have written from this paragraph so far, and I'm, um, happy. And then I would put A chunk of evidence that I needed to incorporate. I'd say copy and paste what I had so far and said, can you help me incorporate this next piece of evidence to make it flow smoothly into my paragraph? Something along the lines of that. And then it would give me, it would show what I'd already written and then another chunk that they added onto it and then I was able to revise from there.
SPEAKER 1
Okay, and then are you editing in the AI or are you copying and pasting into like Google Doc or something?
SPEAKER 2
I usually do, uh, Google Docs, so I get, I try and write my own stuff in Google Docs and then when I'm given the revised version, I open a separate Google Doc and I have them side by side so I can compare from what my work looks like to the example I'd say that AI's giving me so I can see them side by side and try and use the best parts of it together so I can make the best paragraph for myself.
SPEAKER 1
Oh, okay. Is that, how does that work, work out for you? Is it easy or is it pretty, uh, is there any friction with that?
SPEAKER 2
Uh, I haven't ran into too many problems about from that. Just being able to have the AI in a document that's I can edit and then also have mine open so I can see what my edits are looking like is pretty problemless. I haven't ran into any.
SPEAKER 1
Okay, so you can easily tell the difference between the documents?
SPEAKER 2
Yeah, yeah, no, I haven't, never had any, haven't had any issues using AI to help me edit with anything.
SPEAKER 1
Okay, cool. Um, so what was like maybe the last time you worked with um, that type of a project? What was the, um, what was the subject and how did that, uh, how'd that go? Can you walk me through that a little bit more?
SPEAKER 2
Yeah, sure. So the last time I'd say was that essay I was talking about is, uh, supposed to be a nine page or. Yeah, a nine page essay for my critical thinking and composition class. And the prompt was about my favorite book and using outside sources and stuff and. Sorry, can you say the question again? I got a little lost.
SPEAKER 1
Yeah, no, just like, just walk me through the, the whole project. Yeah, yeah.
SPEAKER 2
So once I had given my prompt, I started to do a rough draft. We did a rough draft in class or an outline I should say. And we were able to outline our paragraphs, created a thesis statement and then introduction sentences for each paragraph. Um, and then from there we were given feedback from our professor and then we were given time on our own to incorporate our body paragraphs to add on to those topic sentences from uh, two outside sources that we needed to find on our own and then a book of our choice that we read in the class. So then from there I just spent time revising like my. How making my topic sentence for the paragraphs correct and then putting the information that I found from the. Either the novel or outside source, depending on the paragraph or the subtopic, uh, that I was doing. And then I would start by in saying like, this is how this is from this like using the evidence. And then I would uh, analyze it using my own like, perspective of the book. And then I kind of just did that for the different subtopics and then finished it with a conclusion.
SPEAKER 1
Okay, cool. So is that. Were you. When did you start that? Um, it seems like you have to read there's some like, research or learning part.
SPEAKER 2
Yeah.
SPEAKER 1
And then the writing part. Or is that. How did that go?
SPEAKER 2
So yeah, we were. During the semester we had read various novels, so we just were able to pick a novel of our choice and then we were also told to find outside sources about that novel. So we spent some time looking online, going through scholarly articles to find something that would fit good into like how our um, the choice of our book and how the literary omens affect what making the book so good.
SPEAKER 1
How did you like, when you were doing, going through that? It probably didn't just all happen in a day, right. There was probably days, multiple days or weeks, right?
SPEAKER 2
Yeah, no, I for sure took multiple days to chunk it out and try and find. There's a lot of time on the Internet scrolling through to find the sites that I could, that I knew for sure because I had already had some ideas of what my paragraphs were going to be about. So I just mainly spending a lot of time trying to figure out sites that I could use that would fit good into the subtopics and it wouldn't all take one day. It took a lot of like, time and planning it all out.
SPEAKER 1
So how, how did you like, take notes on the pieces of information that you were coming across and um, the thoughts you were having as you were going through that?
SPEAKER 2
I used a Google Doc. So I would read this, I would find the site and I would read and then I had a Google Doc open as well. And as if I found something interesting, like a good piece of evidence that I thought I could use, I could just copy and paste it into another Google Doc and then I would just press Enter and then I'd do a little bullet Point. And I'd say like, I could use this for this example of um, imagery and I could just like jot down a little bit of ideas and then I just start a new space underneath. Kind of just go through and say where I think I could use this information in my paragraphs.
SPEAKER 1
Okay, super. Um, are there parts of like that process or the tools that you really love or really hate?
SPEAKER 2
In that process, I didn't find anything that I like truly hated. I'd say, I think that it was a pretty neutral thing. Like it wasn't difficult to ever find information and then just transferring it over into like a little uh, like evident sheet. I didn't have anything that gave me too much trouble or was too hard, but it also, I wasn't, I obviously didn't enjoy it. Like, it wasn't like something that was like, oh wow, this worked really good. It was kind of just drag and drop stuff.
SPEAKER 1
Okay, and what, when you were searching, what were you, Were you using Google Search or chat or like when you'd go to look for sources or did you. All the above.
SPEAKER 2
So for the sources, I started out with Google and I couldn't really find anything that like met the requirements that my teacher wanted. So I just started to use um, Google Scholar and so I could find scholarly articles. And then what I would do is I would find a site and I'd read through it and I'd find the evidence. And then I also took it into chat and I would say, I ah, would copy the link and I would say I'm writing an essay on this. Do you think that this site and this information that I've taken would work? Would flow, get into a paragraph and then I would receive these back from chat.
SPEAKER 1
Okay, um, can you think of a time that you felt overwhelmed or uh, frustrated with the, the process?
SPEAKER 2
Yeah, no, I've definitely went through some times of stress when I was trying to pile all my life information together. And sometimes like I would just hit like roadblocks or the evidence that I found. Like I thought it really was gonna work, but the way that I had approached the topic, it kind of changed what I was gonna say. So there's multiple times when I had like thought I had it all laid out perfectly and then my essay just kind of took a turn. Like I was like, yeah, you know, I don't really want to write about this part anymore. So I kind of like had to scratch the evidence, some of the evidence that I had, and go back and find more from those sources. So it definitely did get A little frustrating at symptoms.
SPEAKER 1
Okay. Um, but was that more like. Was that about the tooling, like the tools you're using, or more just the kind of. You think that's part of the process or. Um, I guess. Let me. Let me ask you a different question.
SPEAKER 2
Yeah.
SPEAKER 1
What would the perfect solution look like for you? Forget about anything that you've seen me working on before or just given what you're doing now. Can you imagine a better way? Something that would make your life easier?
SPEAKER 2
Yeah, I think that something that would make my life a lot easier is if I was able to throw my sight, the source that I was using into a program that would. And I could tell, like, what I wanted how. Or I could start and throwing it into there and then saying, I'm missing these pieces, like the evidence pieces. And I would like you to give me, uh, some ideas of what I could fill this in with. I already had my outline, but I could put it into a program that would give me, like. Because what I struggled with on mine was finding those pieces to put in there. So when I. If I had a program that would give me some pieces that would be a lot helpful, like in good formatting too, as well.
SPEAKER 1
Um, and what. In those pieces, what would they be, like? Um, points to support your thesis. Or like.
SPEAKER 2
Yeah, I'd say points to support my introduction statements for each of the paragraphs. Like, something that would for sure, like, be concrete, um, evidence that I could rely on and not, like, have to go back because some, like, I looked at my sources and thought I could use it. And then I realized, okay, that's not really a good point that I wanted to use anymore. But if I had something that would give me something right away that I knew, then I could feel more confident in writing something about that.
SPEAKER 1
Okay, so, like, just getting started with, like, supporting points and telling you what's relevant or potentially relevant.
SPEAKER 2
Yeah.
SPEAKER 1
Yeah. Okay. Um. How much of your time do you think you spend doing this type of work?
SPEAKER 2
During this type of work, during the school semester, it's a lot more than now. Not obviously. I haven't been doing any school work this summer. I didn't take any summer classes. But throughout my first two semesters, I'd say I did a lot of work. Essays and stuff like that. And I used a lot. I've had a lot of help from AI to help format and stuff like that as well. As well as with the other classes too. I'd say I was using the programs Google Docs and Chat a lot during my first. My first year power.
SPEAKER 1
Yeah. And like the most important, um, I guess the highest stak situations where you need to do this type of work would be what.
SPEAKER 2
O the highest stakes so far for me had been either my communication class or my critical thinking class were the highest stakes because for me like speaking class wasn't like I'm not a person who enjoys uh, public speaking so like having chat to help me like word my speeches correctly. So I was confident in what I was going to say. Helped a lot as well as with my writing. I feel like just chat gives me a lot of confidence and helps me like really gets the ball rolling when I'm starting my work.
SPEAKER 1
Yeah. Okay, that's, that's interesting. So do you find you, you work solo or more in groups then how does that affect that?
SPEAKER 2
Definitely more solo I'd say. And I think, I think personally I work better when I'm alone.
SPEAKER 1
Mhm.
SPEAKER 2
It's my take on that.
SPEAKER 1
Cool. Um, yeah, so I think that's pretty much um, the bulk of what we wanted to ask. Um, but I guess this is like in terms of um, I guess maybe you can tell me a little bit more about time management and how you plan your day out or plan out working for a, you know, learnings content for a course. How do you approach that?
SPEAKER 2
Yeah, for sure. So I try before I go to class, let's say I have class the next day or tomorrow the next day. I'd spend the day trying to get ahead on material that my teacher has given us. Like if we're supposed to be doing reading and reading for sure. And I'm making sure that I'm even a couple pages ahead and taking lots of notes and stuff like that. Just so I know that when I come to class I'm thinking fully prepared. Uh, and I try and manage my time well like I'll spend during the school year I was spending a lot of time like waking up, checking my email, checking any notifications I had on my Palomar account and then running through canvas and going through each of my classes to check, okay, when's homework due, when are readings due, what are my upcoming dates? And then I have a calendar that I use and I kind of just set up like this is do this, this is do that and I have time here and I work this day. So I use a calendar to kind of spread out my information that I know. So I know when I have free time to do stuff on my own or when I have time to. Okay, I need to do all my work now.
SPEAKER 1
Uh, okay. Cool. Yeah. And you got, you have one job that you're working alongside when you're in school?
SPEAKER 2
Yeah, just one job in a restaurant.
SPEAKER 1
And how, how much time do you spend a week in that.
SPEAKER 2
In the restaurant? I'm only working, um, it's usually two to three days. So uh, it's around, I'd say 15 to 20 hours a week. So it's not super heavy, but.
SPEAKER 1
Mhm. So you find it uh, easy enough to m. Set up your schedule like the way you're doing it now or um, does it change? Is it like more work when you get into a new class to like map it out or.
SPEAKER 2
Yeah, I'd say, uh, that when I, when I start any class, it's kind of just like finding my bearings. Okay. This is how the teacher likes. This is their setup and this is what we're going to do weekly. So once I get like in the groove, like trying to get to a new class and get in my groove so I can, so I can understand what are my week to week's gonna look like so I can plan out my day to day in between and find out. Okay, I can do homework here, here and here. And then I'll be prepared for whenever this week's gonna throw at me.
SPEAKER 1
Got it. Super. Yeah. Okay, well that kind of concludes the interview at this point. Um, anything else you wanted to share or thought we should know?
SPEAKER 2
I think you covered it all. Had some questions I didn't think you're gonna ask, but yeah, I think you got it all.
SPEAKER 1
Okay, super. Um, so next I wanted to take a couple minutes and show you some um, concepts that we're working on, um, that you know, may or may not relate directly to what you were saying. But we're trying to um, work through some different ideas. Um, so let me, let me try and load this up and I'll share my screen and um. All right. Okay. So these are, these are just some concepts. M. I'm going to kind of walk through how we envision this potentially working and I'd love for you to just jump in and um, you know, ask questions or um, say hey, that's cool. Or that I wouldn't use that, that's, that's useless. Or you know, give a thumbs up, thumbs down, or ask further. So, so one of the ideas here is that we'd start um, in the beginning with allowing you to ask something. So you could type in a question or you um, could, um, let's see. Or you could upload some content. Right.
SPEAKER 2
And so yeah, I like that that's a good, um, adaptation because I feel if you don't have like, I feel for the most other AI sites that you, that are on the Internet already, you have to be signed in or have an account, some cost money, even just like upload images. And I feel like if I had the ability to upload stuff like that, it would make things a lot m. Easier than having to copy and paste or reword what I'm saying. So I like that. So.
SPEAKER 1
Okay, um, cool. And then after you, you upload something, we want to, you know, dive in deeper and ask you a couple questions so we can give you better, um, guidance. So what are you trying to do, like master a topic, write an essay, and then we want to ask you what do you already know about this subject? Um, okay, so to help gauge where to start and at what level. Right. And so what level of education should, should we be thinking about? Right. College. And you know, you could say, I know nothing. Or um, you know, you can add, add that in. And in terms of, as well onboarding, we, we want to ask you, like, well, how deep do you want to go? Right. Um, do you want to just an introductory level intermediate, or you want to go really deep and, and get expert on it? Right. Um, yeah. Is that clear what we're, we're doing there?
SPEAKER 2
Yeah. No, I think that's really smart. I feel like other AIs are just giving you, if you're asking it a question, they're just giving you the answer at a level you don't even know. So it's kind of hard. Like for example, if someone's gonna have a math problem and they're in 10th grade for whatever, and then AI is gonna give them a way to solve it that they don't even know yet because they haven't learned, which when, if you use this program, you would have known because AI, ah, the AI would have said, okay, he's in 10th grade. He shouldn't be doing calculus to solve this problem. He should be doing algebra. So I think that's pretty cool to know what level you want the response in.
SPEAKER 1
Yeah, super. Okay, so the next thing we going to ask you is, um, breadth versus depth. Um, we allow you to choose how many different topics in, in this, in the subject to cover and explore. So you can have like a really narrow, focused view, um, or pick on this scale of how broad and comprehensive um, you want to go. And there's just this little image here that um, I don't think all the images are exactly right, but um, I'm wondering if this is clear to you and you understand what it's talking about.
SPEAKER 2
Yeah, no, I understand from the diagram, I understand that.
SPEAKER 1
Could you see yourself using this in some way, um, to con. Control the experience?
SPEAKER 2
Yeah, no, I could see that working well in my, in my experience of schooling and using AI, I think this would work well.
SPEAKER 1
Okay. And then, um, the other, you know, this is kind of like question that we had asked before we dive into it is, you know, what mode do you want to work in right now? Um, you know, considering the other tools you have, this is a little different because we're giving you options to have more of a conversational dialogue, like use the AI as a chat partner, like where it'll converse with you or you can say, you know, I just need to do exam prep. So it's a, I want to have more of a, uh, quiz and flashcard type of approach to things. Tell, uh, me the key terms, uh, break things down. Uh, for me, um, versus some of the others are more, um, you know, analytical or creative in their nature.
SPEAKER 2
Yeah.
SPEAKER 1
So maybe just take a second and see if, you know, be curious if this makes sense to you.
SPEAKER 2
Yeah, I know that makes total sense to me. I, I can understand that as well. When I, uh, sometimes when I need to use AI, I need to use it strictly for preparing for an exam, which obviously I would use exam prep. And I think that putting the options of the mode is like really important because you need, if you know what you're using AI for, like if you know exactly what you're coming in to get. I think that these modes make it easier for. To not get mixed up and stuff that isn't going to apply to you directly. So I think this is a great, another tool that works great.
SPEAKER 1
Super. Okay, so those are like those four questions. And then, um, what we do is we. You then say, okay, create my learning plan. And what it will do is if you uploaded a document, it will analyze that. If you just give it a question, it'll analyze that and it will come up with learning objectives. So a series of things to learn in steps, kind of like a plan. Um, and then it will also map out each of the topics, um, into sub points. And so, um, does this screen, um, how does this speak to you? Do you, um.
SPEAKER 2
I, I like this. Again, I think this is interesting because if by applying a document you can. I didn't. I think it's interesting to have that the AI will create their own subtopics and also like the progress bar. So to keep track of what, how far you've come and things like that I also think would be like a good addition, if this was at all possible, is like going through the topics and then the ones that you've mastered or the ones that you're consistently getting correct, like slowly begin to drop out of your studying because you've already known them. Like the still questions will still pop up occasionally, but, uh, it won't be as heavily focused on that one section that you fully grasp.
SPEAKER 1
Super great, great idea. Yeah. Um, okay, well let me dive into some of these here. And so, um, the topic map, again, this is, think of this as. This isn't exactly what it looks like, but you've seen other versions, right. Where the lines are connecting to give you the hierarchy. So that's kind of what's in there. Um, the learning plan is a newer thing. And so this is like taking the whole, all the whole topic map and then breaking it into chunks that you would then go through and work on. And so it starts here with, um. Well, I guess let me just ask you if you understand what's, what's in here or if you have any questions before I explain it.
SPEAKER 2
Yeah, no, I think I get it. I think I understand.
SPEAKER 1
Okay. So when you finish certain things, you just simply cross them off. Right. And then that will update your progress bar.
SPEAKER 2
Um.
SPEAKER 1
Um, I'm curious your feedback on this. So there's something called the Bloom taxonomy, which kind of uh, measures how deep you're getting into a subject. And there's like six different levels. And starting with just remembering the facts and then being able to understand them, compare them to other things, make judgments, and then actually synthesize and create new ideas based on what you've just learned. And so that's what these little B1, B2, B4, that's what those things are. And then you see at the end you get down to B6 of creating.
SPEAKER 2
Uh, so those are the levels of understanding that are, you can work for example, that first bullet, that first line that identified the major components of Earth's water cycle. So that's at a B1 right now, but it'll, it can increase up the scale to a B6.
SPEAKER 1
Yeah. So the, the understanding the components of the water cycle would be like the first step in the journey, like up the mountain. Think of it that way. Like, think of it like a two dimensional space. There's a breadth of things and then there's like how, how deep you, you get into them. And so at the end here is you, it Wants you to design a water management plan. Um, and so that's actually creating. So it builds on the fact of all the stuff that you've remembered and learned before.
SPEAKER 2
Yeah, yeah, I get that. I like that a lot.
SPEAKER 1
Okay, cool. And then, um, you could also have things in here like, you know, write a paper or, um, study, you know, study for a quiz. So think of it like a little task management.
SPEAKER 2
Yeah.
SPEAKER 1
Thing. And one thing that's not in here that I'm considering is integrating it with the calendar in some way, so to say. Um, okay, you've got a test on Friday, today is Wednesday. Um, let's break up your studying over the next two and a half days into these sections.
SPEAKER 2
Yeah, no, I think that's a great idea. And personally, for me as a person who likes. I love. I like to have all my stuff laid out and understand how to chunk up my work efficiently. And I think that this breakdown is very good. And I would like. I would enjoy working with something like this. And then also to have it on my calendar as well would help me even more to lay out my days, which makes my life a lot easier personally. Uh-huh.
SPEAKER 1
Okay. So you actually use the calendar in your phone or like that?
SPEAKER 2
Yeah, I have. Have paper calendars I write down stuff on.
SPEAKER 1
Okay.
SPEAKER 2
But I do utilize my phone calendars.
SPEAKER 1
Okay. Um, so would even like showing it as a list of like, here's like the three things and be helpful. Could you imagine what else you would want that to look like?
SPEAKER 2
Like comparing the list.
SPEAKER 1
Well, how would. What would work best for you? What would your ideal be? Given that now, you know, I can maybe create these, um, these tasks for you. How would you ideally want to consume them and. And use them in your day?
SPEAKER 2
So, yeah, I think that putting them on a calendar would be a good idea. And then from like having a time, like, you could also cut out personally, you could cut out a time period every day that you know that you're going to work on it. And then having like, maybe a link from. If you want to start the first step and then having clicking the link and it'll be able to pop up and show you where you should work on stuff like that. Like, having an open link to use would be a good idea. I think I would use that for sure.
SPEAKER 1
Super. Okay, so like, if you clicked on one of these things and then you were taken to a page like this, so this would give you the information. And then what if you could then click, uh, on discuss and then you can actually have a chat with An AI mentor.
SPEAKER 2
Yeah, that sounds really smart.
SPEAKER 1
And then you could take a practice quiz on that specific set of information in that topic.
SPEAKER 2
Yeah. Test your knowledge at the end to see how far you've come. I like that too.
SPEAKER 1
Okay, cool. Um, and then you could see your progress of how far you've gotten.
SPEAKER 2
I like that mastery the progress a lot. Especially when it gives you the breakdown of those topics with their other topics. I think that's really cool. Cause that, uh, I like to see how far I've come in, what I've learned so far. And like, the breakdown is just looks really good.
SPEAKER 1
Okay, super. So, uh, that's. That's really all I wanted to show you and get, get your feedback on these different things.
SPEAKER 2
Yeah. Sweet. No, I mean, it looks amazing compared to all the other AIs I've used this program from, like the way that it's mapping out topics and then the planning, especially if the calendar could be incorporated. And then the progress bar, it looks best like, compared to all the other AIs that I've used. And this looks like it'd be the most promising.
SPEAKER 1
Super. Okay, curious. Do you. Do you pay for any of the other tools that you use?
SPEAKER 2
I do not. No, I don't pay for any of them. I just mainly utilize the free ones.
SPEAKER 1
Okay, cool. Um. All right, that's it.





Interview: Matt Ford - Professor of African Studies @ USD, and English @ Grossmont HS
6/27

Where do students struggle
Managing assignments

Grading: P/NP. Revise assignments until they pass
Struggling with White supremacist way of grading
So revising way of grading
Had 3 potential Fails, one didnt do work or respond. Other stayed in comm. 
Contract grading vs points-based grading
Need to have clear rubrik before. More relevant in PB


Feature
Contract Grading
Points-Based Grading
Focus
Mastery, effort, meeting expectations
Accuracy, performance on tasks
Origin
1960s–1970s (Peter Elbow, Jane Danielewicz)
Standardized 1900s education
Pros
Clarity, equity, lowers anxiety, encourages risk
Familiar, scalable, precise feedback
Cons
Can feel too "binary", hard to measure excellence
Stressful, discourages revision, grade disputes

Trend?
Unknown. Too much variation experienced.

Time management
Asks students if it’s a reasonable amount of reading.
Standards can differ based on acceptance rates of colleges  eg higher -> lower

Concept test
Compass: what
Upload docs: what does this mean? indicate what will happen next? (vs learning journey)

Education Level -> (Desired) Learning Level
How deep: More clarity on #4 Create. Little fuzzy with concept but understands goal.
Intermediate points. Likes journey.
Breadth vs depth: Make more interactive than perspective
let the user dictate the number of topics, depth and breadth by clicking and dragging to generate a shape. maybe add, remove topic nodes etc. The progress bar would then describe the user creation.

Outlines can be helpful. Eg 4 paragraphs.
Discuss with more educators about diff types of scaffolding
Maybe drop downs for templates like novel, vs essay
Doesnt want to give them a web with no option to change it. Must make it interactive.
Loves Mode
Change icons? Chat bubble for mentor, head

How do i increment progress
Loves time planner idea. How do i find time in my calendar. #1 problem in other writing group.

Learn -> Content
Likes progress from learn content to discuss to practice

Likes the amount of agency we are giving user vs other platforms. Interactive. Choice. Navigation is easier. Clean. clear.
Chatgpt and quizlet get unwieldy quickly.

Adaptive Learning: plan adapts to users style

Topic Map: Use this for onboarding.
Snap grid.
Suggest subtopics, 
Click in/out of scope


OpenAI:
Creative writing is not their goal.
AI can’t do it like a human. Specifically help with memoir, personal voice writing.
Trying to teach AI how to evaluate good writing. W goal of doing good writing.
Wanted writing + rubrik on evaluating.

Researching community problem. Customer discovery.

Detailed Transcript
Interviewer is Speaker A
Interviewee - Matt - is Speaker B

Speaker A [0:00 - 0:07]: Challenges that you're seeing with students. Like, what do you see them having from a teacher's perspective?

Speaker B [0:10 - 0:21]: Um, what kinds of challenges? Like, um, challenges with assignments or, um. Um, like in class instruction or kind of just global challenges, Literally.

Speaker A [0:21 - 1:11]: Yeah. Let's say, like, getting through, like getting through the course. Right. Like, is. Are there parts of, you know, like, your engagement with them? Um, you know, maybe one class. You may have them for multiple classes. But, you know, I'm curious, like your. When you meet a student, you know, a group of students, and you walk them through, like, I've got to witness some of your style, which I think is very, um, engaging and collaborative. But I'm curious, like, what in that period of. Was it 12, 16 weeks? However long the semester is? Like, maybe you can talk about where you see them. Um, maybe struggling with, you know, getting. Getting through the class.

Speaker B [1:13 - 4:38]: Yeah. Um, so I've had so far three students who have been in danger of failing, um, in my two years at USD. Um, I'll say first, um, and I'm not tooting my own horn or anything by this. Um, but because I tried to scaffold the class in a very accessible way, the one thing that maybe is. I wouldn't really call it even like an impediment or something that stops students from getting through it, but it's just something for them to like, keep in mind is the number of assignments that I have. So I have like a lot of like mini assignments and then like three or four major assignments. Um, and so students, like, if they're missing or something or absent for a day or whatever, like, then those are usually the students, like emailing me and coming to office hours and stuff like that, asking questions about like, hey, how can I make up this one thing? Um, so that's one thing that I'm just that I'm changing. Um. Um. I. I'll also be teaching, um, English at Grossmont this fall. Um, so I had, um, my orientation, uh, Wednesday and I talked with some, uh, some of my, um, colleagues and my supervisor, um, about, um, some of their grading methods. Um, and how that helps them to. So long story short, they do what you call contract grading instead of points grading. So it's all assignments are pass, no pass. And students have the opportunity to revise as much as possible to get the pass. Um, and I used to be concerned with, um, too many students like getting A's and they're not being enough grade variation. Um, the long story short, that was actually, um. I was reflecting on this this morning that was Actually because of an. Well let's, let's just be frank. Um, a white supremacist way of grading that my first TA ship at UCSD that they were um, really heavily espoused to. Um, and actually a couple of um, run ins with professors. Me, um, working for them, um, and us not agreeing on their grading methods. Um, and so I've come up with my own. Um, and now I'm thinking of revising that again um, after noticing some things. So I guess that's like one main thing I've been thinking about. Um, the other main thing that I can share is that um, so going back to what I said earlier, so I have. I've had only three students who've been in danger of failing um, in my six semesters at USD so far. Um, one of whom did fail because he completely just did not come. Um, and I am one who doesn't believe in selling a student unless there was literally nothing. And so if you're not coming to class, you're not turning in assignments and when you do turn in, turn in assignments you clearly didn't read anything that we actually read in class. Um, and then you don't respond to my emails asking like, hey, what's up? Are you alive? Like what do you want to do? Then I have literally no choice but to tell you. Just opted not to communicate. I can't do anything with someone that they don't communicate.

Speaker A [4:39 - 4:39]: Right.

Speaker B [4:39 - 6:07]: Um, the second student failed just because they had a bunch of stuff just like going on. They just got like really busy. Personal life caught up to them. Um, but they stayed in communication. This person was, I think maybe it was the following semester. But anyway, both of these were in my first year of teaching. Um, and so I worked with him one on one during office hours to catch up on everything. Um, and he was able to pass. Um, so that I view was just an issue of personal life rubbing into professional life and having to differentiate between the two and having a clear pathway to receiving help or rather having clear access to help and a clear pathway to doing better in the class and improving. Um, the last student is a student who has um, a learning disability. Um, I don't remember precisely what the diagnosis was, but it is both physical and mental and also emotional. Um, they can't like watch videos in class or listen to music. So um, and you know, you've seen my classes, they are heavily multimedia and so he will often have to leave the class or like watch something like on his own in order to participate. Um, he also just Fell really far.

Speaker A [6:07 - 6:09]: So show me a turn down all of his classes.

Speaker B [6:09 - 7:23]: Um, and we worked together over the course of two semesters, um, including this one to catch him up, um, where I was able to give him more direct feedback and able to um, uh, adjust certain um, assignments for him so that he could complete them, um, in a way that was amenable to his disability. Um, and um, gave him more choice in assignments. M. And just kept the communication line open. Um, and also got a third person involved. Demanded that you get an academic counselor on campus and I would communicate with that counselor with all the due dates and it will be his responsibility to follow up and make sure that he does everything. So anyway, that was a lot longer than I had intended. But um, I guess those are the like major issues. Um, three different kinds of students, um, who had I guess a similar issue in catching up and me having to adjust my methods with. With which. With each of them to keep them abreast. And one unfortunately failed.

Speaker A [7:24 - 7:37]: Yeah. Well if they don't communicate it's understandable. But can you, I'm uh, just curious if you can tell me like what you mentioned there was a white supremacist way of grading. Like.

Speaker B [7:37 - 12:17]: Yeah. What does that mean? Yeah, I knew. I like threw that out there and like didn't explain it. Um, so what I mean by this is that grading, um, and we talked about this in orientation, um the other day. Um, what was the story that we went on? Long story short, we went through like a deep dive into like grading and it's history, which is like a five minute but very informative, promising, um, which was also like impossible with us just like thinking openly about grading and the ethics of grading. And so we went back to like where the ABC F, um excluding E system came from. Um, around between 1840 and 1870. It might have been 1871 precisely actually. And just the history of that and how, um because like the more that schools, um the higher enrollment schools had, um, the less um, the harder it was to have like one on one conversations with everyone. And so grading became a very quick, easy, global practice. Um, and became pretty standardized by 1871. Um, fast forwarding to now. Grading is um, pretty evidently um, a racist practice in holding certain students back and advancing certain students. So it's kind of like the same thing with standardized testing. Standardized testing is literally designed um, around the curriculum that wealthy white suburban students learn. Um, so it is literally designed in their interest, um, and um, to exclude um, other students who may be of color or from low income communities. Having certain, um, learning disabilities. And so you also see the ways that people learn become standardized. And now we have like the lecture model today, um, which actually most people can't pay attention in lectures. So that is even a system of capitalism. And how do we pack as many people into a room as possible and also charge them, um, egregious amounts of tuition and make this much money, which is how college became this business. So really this is a larger scaffolding of, um, education being a capitalistic model, but also a white supremacist model and excluding certain students. Um, and particularly what I'm referring to is my first year as a ta. Um, I, um. This is really ironic because my, um, the professor, um, for whom I was working, it was like a large program. It was like 30 or 40 of us Tas. Um, and um, it was also a program that was explicitly for social justice writing. And so the idea is that, okay, we're all coming in to talk about equity. Um, the grading model did not reflect the course content, um, and that the grading model was still reliant on this standardized way of assessing students. And most of our students, um, are um, Brown students, low income or middle income. They are not wealthy white students. Um, and so I apparently was taking too long to grade, um, essays, um, because I quite frankly had had a conflict with their grading model. And I was trying to figure out how do I ethically grade these students, um, and in a timely fashion, um, and also in a way that agrees with my ethics. Um, and so it became a much larger conversation. The like, overall, like program coordinator got involved. Um, and the coordinator, who was, um, a brown woman, said we do not practice politics of disposability and racism. I was also one of I think three black Tas out of like the 30 or 40 that I mentioned. Um, and so race, class, education, ability, all of this stuff gets um, got cobbled up into this big issue. And I think ever since then I've always kind of gone out of my way and really every single semester checked my own pedagogical practices and ethics and philosophies to make sure that they are in line with what I believe is right. And then I'm also growing and advancing and allowing myself to change too. Um, and so that incident, yeah, this very racist incident around grading, um, is kind of, um, snowballed into, I don't know, the next five years of my career.

Speaker A [12:18 - 13:16]: Yeah, okay. Yeah, it seems kind of, ah, like you have a unique experience with that. You know, I, I obviously haven't had that. That Experience. That's why I'm, I'm curious about um, how that's manifesting. Are you, when you say um, like certain, like the grading practices, is it that the, the grading is um, it's not just about the content or is it like a philosophical difference about like we shouldn't be failing people? Or like A, B, C grades? Is, um, um supremacist? Or like how does like it sounds like there's something in there between like the pass, no pass, and then like the grading system that, that you're alluding to.

Speaker B [13:19 - 13:36]: Yeah, I think the core issue is that um. And also sidebar. I know that this is like incredibly um, divergent from the kind of um app that you're creating. So hopefully all of this is somehow useful to you. But this is.

Speaker A [13:36 - 13:59]: No, it is. It's anything that's new. Like anything that's like. Again, remember my opening question is what are students struggling with? Right. And so it sounds like this is an aspect of it. Right? That and it's a, you're bringing new information to me that you know, I wouldn't have thought of because I didn't have this experience. So, um.

Speaker B [13:59 - 20:17]: Yeah, yeah, that's true. Yeah. Um, so I guess with the um. So what we call contract, ah, contract grading versus points based grading, um, they both, um, have, you know, in order to even do an assignment, you have to have a very clear assignment and a very rubric. And the rubric should, um, should, um, in practice, um, be distributed to students, um, before they submit so they know exactly what they're being graded on. Um, and so regardless of whether you're doing contract grading or points based grading, um, but that rubric becomes more relevant in points based grading because students typically care about what's my grade. Even after the end of the semester, I had a student reach out to me and say, hey, I have like an 89 point something, something. Can you just bump me up to an A minus? Um, and I actually told her you are correct. Um, that actually is my practice to round up. But because there are so many things we have to do, so many boxes to check from grading and submitting final grades, I simply forgot. Um, and so I had to contact the dean and officially change um, her grade. And um, another student who was in that same boat, I thought it was just fair. Even though he didn't reach out to me, I thought it was fair to change it for both. Um, and so these kinds of complications tend to arise in points based grading because they're like, okay, I need to get this certain percentage in order to retain this grade. And I have to have this grade to get into this graduate program or get this job or. Just because I was raised as an overachiever and this is now my standard, um, I was one of those kids. I was one of those students who got A's in every single class. And if I got even an A minus, I would complain. I would never, like, be like, bitchy about it, but I would, like, you know, just email the professor or like, call him, or, you know, come to office hours and be like, hey, can we talk? You know, So I also, like, empathize with those students, um, but also see where the issue is. Um, now that I'm in their position 10, 20 years later, um, I see the problems that it's also causing for me. Because, um, something that we talked about yesterday is that. Or, um, Wednesday. Is that one of the other primary issues with points based grading is that it just takes too damn long. Um, you end up wasting a lot of time. Um, like, so I. I've even read a book that's somewhere on my shelf called, like, Specifications Grading, which gave me the idea of like, pass, no pass, or maybe like a middle. So the way that I have my rubric set up are zero. Um, points just means absent. Like, whatever I asked for, you just didn't put it in your paper. I can't find it. It just doesn't exist. Um, one point for developing, which is like, okay, I see where you're kind of going, but it's not clear. Um, two points for proficient. So it's like, this is B level work. Okay, you did what I asked you to do, but it's not. You didn't really go in depth. You just completed the assignment. And then there's of course a level work or three points, what I call advanced or exceptional, which is like, okay, you went above and beyond. Um, and even that is like, is that fair to ask students of like, okay, so you asked me to do something and I did it, and you give me a B. But if I'm going above and beyond, then I get an A. Yes. These are the standards by which are really useful for grad school, because grad school requires excellence. Grad school requires going above and beyond. But if you're an average student, does that mean that you automatically should just get a B? Because, I mean, you did do the work. Um, and so all of these questions, and then, you know, we were talking about, like, how we'll spend five minutes, like, just deciding between, dang, is this A two or three, like, because you did what you know. So like, this really just becomes a tremendous waste of time. Um, I have, I've even talked with other professors, myself included, who've set timers for papers where we give ourselves, you have 10 minutes, um, to read this paper and give it a grade and move on. Um, and if you start to catch yourself and then, then you end up lagging behind and then three hours later you're still grading. So all of these issues that are really about time and M, I think relevance and also again, ethics make the whole question of grading, um, or really the whole concept of points based grading questionable. And so now here we are at contract grading where it's like, okay, I have a very clear standard of what I want. Your job is simply to meet that standard. That's also equitable in that some students may get it right or, but probably most students will get it right on the first time, or rather me go back. Some students will get it right on the first try. Most will get it mostly right. Those are those B level students, those, the proficient students who just did it. Um, a lot of students will miss things. And so instead of us, you know, getting to a point, we're just so sick of grading. We're just like, I'm just going to give the student, you know, an A because I can't look at this paper anymore. Um, you know, whereas you may have been deciding, oh, is it a B plus or A minus? Now it's like you just pass or you know, pass. And then the onus of reaching that standard is now on the student. Um, and so that's where I'm thinking of, um, moving next semester and also cutting about half of my assignments. Um, because I know that I like, I'm fully aware that I have too many, like, small, like little assignments that are hard to keep up with. Um, and that also when it's time to grade those things, I made pass, no pass. But then I'm like, well, if I made those pass, no pass, what if I'll make major assignments pass, no pass, cut all of the little assignments that just take up my time, um, and then make more time for other things in the classroom. Um, so really my entire philosophy and practice around grading is going to pretty significantly, um, change, um, this fall and Seattle.

Speaker A [20:18 - 20:27]: And so, so does contract grading. It sounds like you're saying that helps you, um, reduce the amount of time you spend in grading.

Speaker B [20:28 - 20:36]: Yeah, it's like literally like days does it, does it down maybe a couple hours?

Speaker A [20:36 - 20:51]: How does it impact the, um, feedback that a student might get from grading in a point based system or is it um, similar or is there any trade off there?

Speaker B [20:53 - 26:09]: Yeah, I would say that it's similar and it's something that I'm also like kind of looking into more just now. I've heard of contract grading for years. Um, and as you know, I just told you, like, my whole like journey through grading over the years is now something that I'm like, oh, let me actually like look more deeply into this because I admit I was a little bit stiff at first, um, which is why I didn't employ it in my first year of um, professorship. Um, and so the trade off is that. So I actually think that the feedback in the comments get better in contract grading. Um, because in points based grading. Okay, so I'll put it this way. Points based grading, usually you're not even really like, you don't really even have time to add comments because you're just like, okay, I need to just move through. Even though you should. My rule of thumb, or at least the way that we were taught in grad school is that you always have at least three comments per paper. Um, especially. Well, really almost exclusively if it's not an A. And so if it's not an A, you have to point out exactly what they did wrong. Um, in contract based grading, it's very similar in that. So my system, so when I'm grading I have two windows open. I have the actual paper that I'm reading which has in canvas, I can even show you what it looks like if you want. Um, it's in canvas and all that is on one window. So I'm reading the paper while clicking around the different numbers at the same time in my window next to that. Um, for students who have improvements, um, within like the first, like about like five papers. So I have 35 students on average per class. Um, within the first. Well, uh, not on average. I have 35 students period per class. Intro level classes are always 35. Upper division are always 25. That's just the rule. And my classes tend to be maxed out and I always let people in off the waitlist. So I usually have about almost 40 students in my classes or sounds crazy to say that out loud. Um, but so yes, in contract based grading, um. Oh, sorry. Okay. The window, yes. So within about five papers I tend to know what the typical issues are. And so I can just say topic, sentence, copy and paste. So at that point I'm just copying and pasting feedback. I'm not really having to, like, type up brand new feedback unless something new comes up and then I'll add it. Um, uh, in contract grading, I would do the same thing, but because there are no points and thus it makes the it. Because there are no points, it forces the entire rubric to then be redesigned. So I have to go back and redesign all my rubrics at some point this summer because it's all like, okay, 3, 2, 1, 0. Now the comments would just be pass, no pass. In the past, um, I was still the, um, criteria. So I have usually like 10 criteria per paper, 3 points each. So each assignment is usually about 30 points total. If I'm cutting all the points, I would end up just probably with only two columns. Pass, no pass. And then the criteria for each row. Um, and so it would actually make my comments more in depth and that I'm not just like, okay, do I give this person a two or three? And why now it's like, here's more specifically what you did wrong. Like, I'm also able to give more honest feedback because I have had students who I'm like, I know the student does not deserve an A on this paper, but because of the way that my rubric is set up, I've imprisoned myself. I now know how. I now don't have a choice but to give this person an A, because they technically, they technically did everything correctly. But I am sure that there are some things that need fixing this in students. Of course, if they get an A, they're not going to go back and fix anything. Unless you're like an overachiever. If you get an M, A minus and you want the A. Um, and so I'm like, now I'm losing students. Students who are like, they don't deserve an A. But because my rubric doesn't really have room to actually critique what they did wrong, they are not going to ever go back and fix that problem, which means that they are never going to actually learn that skill, which means that they are missing a skill that they could be learning from my class, which then means that I'm not doing my job as effectively as I can. So that kind of, um, domino effect. And so that's one other greater benefit in that I no longer have to feel pressure to give a student an A. I don't care if it is one little thing, one sentence that's wrong, the sentence is wrong, I can fail that student, force them to fix it, and then they have the A that they actually deserve so that they're actually writing A much more complete paper rather than them writing for a grade. So I'm also kind of processing all of this out loud because I just had this conversation two days ago. So I'm like, uh, okay, what do I need to do? Because I also need to partially rewrite a syllabus. So all this is also helping me figure out what I'm going to change this fall.

Speaker A [26:10 - 26:32]: Okay. So it seems like if I could paraphrase my understanding of it, that it's moving from more of like checkbox based rubric to a more qualitative, uh, freer form feedback that's of higher actual consultative value to the student.

Speaker B [26:33 - 28:33]: Mhm. Absolutely. Yeah. So instead of me. Yeah, it's less quantitative in that I'm just clicking around to see, okay, what's the number? Um, oh, and this is something I also find myself doing, which I really just don't believe in. Um, I would find myself. So like in these cases with these students who I know do not deserve an A, but based on my rubric, they have to get an A. Um, uh, I. What's my train of thought? Oh God, come back. Um, I've been thinking about this a lot. Um, oh. So those students who I have given. Oh, that's what it was. Okay. The students who I've given an A, um, I then find myself looking for ways that I can then take out points to give them the B that they deserve. Um, so I'm like, can I smudge something here or something there? Because I'm like, like this is not an A paper and like you know that they don't deserve that grade. Um, and so that ends up wasting more time of like, oh, how can I take off a point? Because this is a B. This like, this is simply a B paper and I refuse to give this an A because I know that it could be better. Because I've seen evidence from other students who have produced better. Um, and then on the flip side too, those students who I know deserve a higher grade when I'm like, dang, this is kind of technically an A minus paper, but I really feel that you deserve an A. I mean, you know, similarly the student who emailed me being like, hey, I got 89 point something, something, something, can you just bump it up to a 90 so I can have my A minus? And I'm like, for you? Yes, actually, because you have been an exemplary student, I've seen your growth over the course of the semester and you do deserve an A minus. Um, and so I'm able to just give students what they actually deserve, rather than trying to, like, play these tricks and kind of play games with their grades, which is honestly, um, unethical to play with students grades like that.

Speaker A [28:35 - 28:40]: So. So you'll be like, trying this out for the first time this next semester. Sounds like.

Speaker B [28:40 - 29:47]: Yeah. And I'm excited because one of the classes, um, so one class I've taught three times, and this is probably like, just my class until I leave. They always need someone to teach it. I'm always available, so I'm like, sure. Um, and so, um, I now get the chance to kind of, um, refine what the classical version of this class would look like, which I thought I had finished last semester. But I'm like, okay, I think I figured out all the content. Now. How can we tweak and make this just a better overall experience? I think the grading is. Is a, um, will be a, um, tremendously helpful change, um, for that class. It'll help me with just getting through those papers. I'm able to grade a lot quicker. I think students will be happier. And also allows me to experiment a little bit more with other things in the class so that I'm not like, okay, students need grades. Let me come up with all of these stupid discussion board things that I also hate grading. Um, um, you know, I can come up with other ways to engage them in the class, so allows me to be more imaginative and allows them to take the pressure off and not think about grades so much.

Speaker A [29:48 - 30:00]: Now, at the end of the day, at the end of the semester, do you still need to convert those grades to, like the. The A, B and C or, uh, how does that look in. In school?

Speaker B [30:01 - 31:01]: Technically not the way that I'm seeing this. And this is, again, it goes back to that ridiculous issue from 5, and with that one professor who was like, you have too many students with A's. And I was like, I mean, I can't help it. I'm a great professor. I mean, I'm sorry, I know what I'm doing. You hire me because I know what I'm doing. Like, what do you want? Um, and so, um, part of my fear is that that kind of conversation may happen again because then it will become a lot easier. I want to be easier. Actually become a lot more challenging because then I'll have to revise more papers, um, so it might increase my time reading and like, giving more time to grading. But all of the hours, no literal days. And take me about three days, um, two or three days, um, to grade, like, nearly 40 papers, because it just the points thing, it just takes so much time. Um, and so, um. Wait, sorry, I think I got sidetracked. What was the actual question?

Speaker A [31:02 - 31:07]: Do you, do you have to like, if you're doing the contract, it's just pass or no pass, right?

Speaker B [31:07 - 33:16]: Yeah. So, so I, it in theory should make it easier because it won't even be as um, variant of like percentages. Um, it should be pretty much like, like everyone should be getting a 100%. I think there are some things I will still keep, um, um, a little bit more open. Um, so I have like other like short assignments. Um, I think I might keep those. Pass, no pass. And those I literally just count. Like I have like for example like 12 pre writing assignments that I call do Nows, which you do at the beginning of every single class. Like a 10 minute writing exercise. You get like 20 of those a semester. As long as you do them all, those are all pass, no pass. Um, I think I'll keep those that way. So there's a little bit of variation, but I think otherwise I should in theory be fine because the grade is already a grade. I mean it's past notes. So really it's still a grade based system, but not a point based system. So it's still A's, but they're just no more B, C's or D's. It's just A's or F's. So now everyone should be either getting a, uh, 100% entirely in my class, top to bottom. Um, unless you like miss a do now or like miss like a little short assignment or something, um, or everyone dramatically fails. So this is going to be um, an interesting experiment. Oh, and then, um, one other thing I was going to mention. Another class is brand new. I'm teaching class on Beyonce and um, black musical, um, history this fall. And so that is a brand spanking class. Um, uh, so that will be a lot more experimental in how I grade that because they have like weekly like group led discussions. Um, and so I just have to like think about that one a little bit more and just think about how does this translate in terms of grading. But I don't think it should be hard. Yeah.

Speaker A [33:17 - 33:28]: Okay. Do you think, um, is this a trend in education or more, uh, universities or professors, uh, moving towards this?

Speaker B [33:29 - 38:31]: That's a really good question. Um, you know, so that's a really good question. So I've personally experienced many different, um, excuse me, um, styles of evaluation. So this actually reminds me in elementary, in middle school I went to a. This is really ironic. It's called University Preparatory Academy. Um, which is ironic because universities, um, use grades my school didn't. Um, we had what we call narratives. Um, and so at the end of. And I think we were also like quarter based. So those, those course features, we've had to do those every like eight to ten weeks. Um, and so we had narratives where, like, each class that you take. So it was like, okay, math class, the teacher writes like a paragraph about, like, your progress in math, very specifically what you're doing well on, what you're struggling on, and then where, you know, where you could need some help, suggestions, all that. It was incredibly detailed. Now, I don't know how those people had the material bunch of time to do that. Um, and so bringing that back to contract rating, that reminds me of that. So I would do something similar for that. Um, but less words. I don't have that. I have more students. Um, another thing is that the difference between undergrad and grad school. Undergrad, um, is yes, you know, like straight up, like, you know, A's, B, cs, like, whatever. Um, but professors tend to be a little bit more holistic and less nitpicky with their grading. So it wasn't really points based. It was like, now that I'm thinking about it, I don't remember what my undergrad rubrics were like, but anyway, um, I think they were less points based and more narrative. Like, but they still had to translate those into grades. Similarly to, like, my childhood teachers in grad school, it was literally a requirement to get an A in everything. Like, you had to have a 4.0 to graduate. Um, and so all of our classes were pass, no pass. Um, and so it really leveled the playing field and took off the pressure of, like, how much you feel like you're contributing because, like, a poetry student who will write three pages a semester, but write very long, detailed and deep and incredible, wonderful poems is very different from, like, you know, me, I was working on a novel and a memoir, which are much more long form. And so if it were a point space system, I would probably feel pressure to be like, oh, I need more pages, or I need to do this in order to get an A. But because one is grad school, like, we're all adults and we chose to be here, um, and two, um, because we're all coming from different backgrounds, um, the way that we were graded required a lot more openness from our professors, um, that we often then had difficulty translating as grad students were also TAs who needed to give our students, like, points Based grading. So it's like we're getting narrative contract based grading kind of where we all pass, no pass and everybody passes. I mean you don't really fail in grad school unless you just, just don't show up and don't turn anything. Which I don't know how that's possible. Um, or the other way of. Yeah. So anyway, um, I, so to, to directly answer the question like whether this is a trend, I just see a lot of variation. Um, because I've experienced so much variation, I can't really tell what is ah, a trend or what's in decline because I've just experienced it all. Um, but just kind of observing um, conversations and things that I've heard in the field and all of that, I would say that the entire practice of grading is um, in a state of deep questioning. I wouldn't say that like all, uh, 2000 colleges and universities across the country are now rushing to our contract grading. But I would say that I have a lot more complex conversations about grading with my colleagues now than I did before. Even like in Africana studies, I have other professors asking me all the time, hey, like, how many projects do you assign? How do you grade those and all that. Yeah, um, there's one more quick thing I was going to say, um, come back rating trend. I forget. It'll come back.

Speaker A [38:31 - 38:32]: Okay.

Speaker B [38:32 - 38:33]: Yeah, it was good. But hopefully it comes back.

Speaker A [38:34 - 38:57]: Maybe can you talk a little bit about time management and how um, like as you've, you've mentioned, um, maybe reducing some of the assignments and changing that up. Uh, what is the, what's, what do you think those students are experiencing in terms of allocating their time and approaching, um, the assignments that they have to do outside of class?

Speaker B [38:59 - 44:33]: Um, so I straight up ask my students, like, how much time does this take you? How much reading do your other professors assign? And is this a reasonable amount of reading? Obviously as a professor the last call is mine. Um, because I mean like they don't know what a 300 level standard of reading is. Oh, I remember my other thought, but I'm going to come back to that. Um, they, they don't know the difference. They um, don't know what should be a 300 level amount of reading versus a 15 point level. Because they're, they're in college themselves, you know, um, so they don't know. They're just doing what they're told. Um, but I still have that conversation because, because I've gone through it, I can tell them, um, you might think that's normal. But that's not too crazy a. Um. Lot of my students take like six classes. That was not allowed when I was an undergrad at all. Under any circumstance that allowed. Um, I think you had to be a very, very, very exceptional student and really like go at it like with the dean without to have been allowed. We were allowed four and a half classes and I think you could do five. But even that needed. Um. And so I know what too much work looks like. Um, yes, the standard between like where I went to undergrad is maybe just a little less and that where I went, you know, Basser is just a much more selective school. Um, so I think it was like a 20% acceptance rate, whereas USD is I think like 40 or 50, something like that. And so the standard was just a little bit different. Um, but still, like I know what too much work looks like. Um, and so, um, yeah, I'm. I've been thinking about. Because I'm also like, I don't want to things to be prescriptive and you're just like inhaling information. I want you to like, critically think about the information that you're taking in and sit with it. Like have a moment to really sit with it before you come to class. Come to class with questions. Don't let all the questions come up in class. Yes, the questions should come up in class. That's why we're in class. Um, but you should have done a level of thinking before you come so that you can bring substantive thoughts. Um, and so, yeah, I've been thinking about, yeah. How much reading I'm going to assign. Um, how many like smaller assignments versus larger assignments. Um, I'll give. Um, and what that all does for my grading, I think I'm really interested in dramatically or entirely. Well, dramatically reducing or entirely erasing all of the like mini assignments that I have, um, in my intro history class. Um, just because the grading is just too much. It's just way too much. They have to email me things. And all that is just my hate looking for my email. Just, just. It's just a big fat no. Um, and so I have a few things to think about. Okay, well, if I move to contract grading, how will some of the things shift in this class? And it's mainly like the smaller projects. Um, the other thought that I had, um. The previous question was, um, I do notice that these types of conversations around grading and ethics are more common in community colleges. And um, maybe, um, because I don't want to say like smaller or bigger. I don't Think it really depends on how big the university is. I think it depends on how big the class size is. So at ah, Grossmont, even like in my interview I was asked about, um, what are my ethics and practices around late work. Um, and I told them I always accept late work. People have shit going on. It is not my job to dictate how you spend your time. That's just literally not my job. My job is to teach you and to assess your work. It is not my job to tell you how to run your life. Um, and so, um, I accept late work. Um, I prefer you email me with an actual excuse if you have work just like sitting there that you just haven't turned in. But those tend to be like the one or two students who are really struggling. Um, and so I excused them. I was so often one of those students myself, um, who would often get overwhelmed in undergrad, um, and would just take forever to turn things in. But when I turned it in it was always brilliant work. I always got A's, but it took a while. Um, and so I have a lot of empathy for those students, um, who do that too. So I always accept late work. Um, and that's the answer that they wanted. They didn't like tell me that, but I could just read their faces and that they were like, these are community college students. These students are veterans and parents and different ages and disabled and have different abilities. Um, they're not your like standard, like you know, 18 year old, rich white male college student who like goes to Harvard. Um, and so, um, yeah, um, yeah, so the whole grading thing I think tends to happen in spaces where conversations around educational equity are more frequent. And those conversations just happen more often in community colleges than they do in like large private four year universities like the University of San Diego.

Speaker A [44:33 - 45:38]: Yeah, makes sense. Uh, um. Okay, good. Let me. I think what I want to do now is like switch gears and actually show you like a new concept that we're working on that, um, now that we've kind of like touched on a couple of things, this will go in a little bit different direction. But I think some other things you touched on might come up here. So, um, I'm going to share my screen. Are you at a computer where you can see it? Okay. Um. All right, so. All right, can you see that? Okay, so I'm going to walk through and just this is, you know, concept. It doesn't, it's not all completely working. Um, but I want to ask you if this screen is clear. What, um, you know what it's going to do and what the expectation is.

Speaker B [45:39 - 46:37]: Mhm. Yeah. So I like the um, the tagline log line art. Forget the difference between those two. Um, learn anything fast. Um, this clear. It's like, oh, okay, I can learn something very quickly. It's like, okay, ask, ask anything. And I like that it says anything. There's no like, um, there's no like limit to what you can ask. Start with a question topic and will guide your learning journey. I like that you have and will guide your learning journey. So that, that cues me in that I should expect something else to happen. Um, after I type in and click start learning. Um, like the question, what would you like to learn? Um, all of it just feels like very personal. I've, I've always preferred like, I don't know if you remember, like, um, it wasn't Bing, it was like one of those other like search engines from like 20 years ago.

Speaker A [46:37 - 46:39]: Oh, like um, Ask Jeeves or.

Speaker B [46:40 - 46:49]: Yeah, I think it was like Ask Jeeves and there was like, oh, um, ask dot com. I think. Yeah, that might have been it. Um, but yeah, I like sites like that.

Speaker A [46:49 - 46:57]: Okay. Yeah. Um, and this other option here to upload content.

Speaker B [46:59 - 48:14]: Yeah, I was about to mention that. So I like that it's clear that they are different. So I like that you have like the white box versus the gray box, the bold versus the unbolted. Um, but I'm not upload documents or images to learn from your own materials. I admit I'm not really sure what this is for. Um, so if I'm learning from my own materials, um, what are you going to do? So I think here I would appreciate like a similar tagline, log line, directive, something. Well, I guess I'm there to see your directive, upload documents, but some type of tagline, a log line to indicate what exactly learned from your own materials. Need. So I think what will take you on a learning journey that makes me curious. And it's, it's, it's, it's. I want to say vague because it's not vague, it is open. Okay. It's clear enough for me to be like, okay, learning journey word. I got two words. I know what learning means. I know what a journey is. Um, but it's open enough for me to be curious of like, oh, what does that mean? I'm not sure that I have the same effect with upload content. I'm not sure what's happening.

Speaker A [48:14 - 48:41]: That's fair. Yeah, that's fair. I think we could be more specific there. So uh, it's Relatively just the answer is it's, we're also going to create a learning journey for you and guide you through it. So, um, cool. So let's, let's imagine we've done that and now we uh, have uploaded a document, maybe a reading assignment or something.

Speaker B [48:42 - 48:42]: Mhm.

Speaker A [48:42 - 48:46]: And so now we're on, um, the next step.

Speaker B [48:49 - 48:50]: Hm.

Speaker A [48:52 - 48:53]: Does this make sense?

Speaker B [48:53 - 49:52]: Mhm. What do you want to learn? Mhm. Define your learning goal and we'll create a personalized learning path. So I always like things that give me a clear indication of how long this will take. And I know this is Primarily just like 21st century mindset of like, okay, I have limited time. I don't want to sit here and look at this thing all day. Get to the point and tell me how much longer I have to go. Um, so that's just capitalism. Um, but I guess it's also beneficial, um, in that you always know what you're doing. You're never like, oh my God, all day. Um, and I think this also encourages people to go through with all the steps versus if you don't know how long something takes, you're more likely to put it off and never really come back to it. So that's just good. So I like that you have the four dots and it says step one of four. Because I like the visual of like, okay, now I have two green dots, three green dots and it's like, okay, I'm almost done. Great.

Speaker A [49:53 - 49:54]: Um, yeah, that's a good point.

Speaker B [49:55 - 51:00]: Yeah. Yes, I really like. And I also like that you keep the header at the top every step of the way. Adaptive learning platform. So that I always know what this is because I might forget I might be going through the steps and be like, wait, what am I doing again? And so that's, that's just nice to have. Um, I like the, the tagline here again, define your learning goal and we'll create a personalized learning path. So it's very clear. Like, okay, define what you want to learn and then we're going to give you something so you have the learning goal, um, when you start typing. Um, so if I say learn about. Hm, let's say understand. Okay, I'll, I'll keep it really, really simple because I'm starting to think about my, um. M. I'm applying for PhDs and I like. All I'm thinking about right now is my proposal. Let me just think of something like, very simple.

Speaker A [51:00 - 51:00]: Okay.

Speaker B [51:00 - 51:16]: Um, I want to understand, um, jazz, musical concepts. Let's go with that. Or, um, do you like type into this thing or are you just showing me like how.

Speaker A [51:17 - 51:35]: Yeah, you, you would. Like, I could type it in right now, but it wouldn't act on it. So. Um, but you would say, okay, um, right. And then here you would say, what do you know? Right.

Speaker B [51:36 - 53:10]: Like, I like that too. I like, you know, the grade in portion before you start typing. Yeah, Um, I think it could go either way. Um, if you were to just have that underneath your background. So instead of like your background and then tell us about your existing knowledge in this area disappears when you start typing. I think tell us about your existing knowledge in this area could just be on the form itself, right under your background. Kind of like how define your learning goal, etc. Is right underneath. What do you want to learn? Gray versus black. Um, so just thinking about that, like in terms of design. Um, but again, I don't think that's necessary because I think like once you start typing, you know what you're doing. Um, I think this could only be particularly useful if it's like a longer question. Um, and then I might forget the question that I'm answering. But, um, I think for this step this is appropriate. Um, I like that you're also specific and you say, tell us about your existing knowledge in this area. Um, so it's like, okay, what do you know so far? Um, and then education level. Um, I think one, like once a person clicks the drop down menu, then it will become clear what you mean by education level. Because without clicking on it, it sounds like, what is your education level on this subject? And then when you click on it it's like, oh, um, you're asking me what is my like degree level. Um, so I think maybe a little bit of clarity there about what you mean.

Speaker A [53:11 - 53:53]: That's very insightful. I think. Um, we are. This is. Tell me how you'd like. At what education level? You'd like us to treat the subject. Right, right. So. So it's not literally what grade you're in, though most people will understand that. So I probably need to explain at what level would you like me to explain it? Right. Because you know, most Americans, even in the workforce are probably operating at uh, the 10th grade M level. Right, right. But if you're, if you're in grad school, you should probably really select this option.

Speaker B [53:54 - 53:55]: Right, right, right.

Speaker A [53:55 - 53:59]: Or, you know, your professor's going to ding you is right.

Speaker B [53:59 - 53:59]: Right.

Speaker A [54:00 - 54:14]: But you know, if you're in, you know, if you're in middle school or you're, you know. Yeah, you just, uh, we Wanted to give people flexibility so that you're not getting all the same level of language.

Speaker B [54:16 - 55:11]: So what if you change? Because I'm also thinking of when I see education level on a form, usually my mind goes to. Or rather, usually they're just asking, thinking, what is your degree level? Yeah, so I might change education to learning so that it says learning level. Um, and then if you want. Or. Or. Or you could even say desired learning level. Um, because I was gonna say if you want. Like, the thing I said about, like, instead of putting the gray line in the box there to disappear, put it, like, underneath the prompt. You could do that. That question. But I think if you just clarify what the prompt is actually asking, um, you wouldn't even need to do that. So if you just said like, desired learning level. That is. That's. That's a lot clearer to me. And I. And I know what you're asking, and I don't. I don't need the, um, additional tagline.

Speaker A [55:11 - 55:12]: Okay, cool.

Speaker B [55:13 - 55:15]: The suggested line, whatever you call it. Yeah. Cool.

Speaker A [55:15 - 55:17]: All right, I'm going next.

Speaker B [55:19 - 56:46]: M. This is cool. Okay, so how. I also just like, I. I'm a big fan of just like, little icons and stuff, and I like the little gear next to each question. Um, and how. Um. Oh, now this is interesting. Can you. Okay, can you do. Wait, let me read this thing first. Okay. Set your preferred learning depth from introductory to. Okay, I see. So level one, Remember, then understand, or remember and understand. So like, okay, supposedly memorization and recalling key information. Focus on grasping fundamental concepts. Okay, got it. Okay, and then level two, apply and analyze. Okay, so application and analysis. That's a level deeper than memorization. Okay, so apply concepts to solve problems. Okay, so problem solving, application of concepts. Um, level three, evaluate. Okay, so. So I'm looking at this, like, in my head, like, as a teacher. What. What are the different levels of depth that I usually expect? I'm comparing that language to, um. So, like, um, what's. What was the first one again? Okay, uh, so level zero should be.

Speaker A [56:47 - 56:52]: So this is. This is not ideal. It's. So there's a little bug there. It should be remember and understand.

Speaker B [56:52 - 56:54]: Okay. Okay. Yeah.

Speaker A [56:54 - 57:15]: So this is. I'll just. If this is based on the Bloom taxonomy, the hierarchy of learning, where there's these six levels and I've kind of combined, uh, them together. I'm not sure I see familiar with that, but it's, um. There's basically a. A ladder.

Speaker B [57:15 - 57:16]: I see.

Speaker A [57:17 - 57:46]: Of, uh, kind of achieve. When we start learning, we generally start with basic facts. Like, you know, um, when was the constitution written? Right. When was this event? And then who did it affect? Right. What was the, um, you know, what were the implications? What brought this about? Right. And then evaluate it and judge it. And so it's kind of a progression.

Speaker B [57:46 - 57:47]: So.

Speaker A [57:49 - 57:58]: That'S the idea. And if you're at the expert level, you're, you know, synthesizing, combining ideas across different fields.

Speaker B [58:00 - 58:11]: Mhm. Yeah, that's great. Innovative. Okay, then what was level four again? Create.

Speaker A [58:14 - 58:21]: And that might be like write an essay, um, you know, including the previous, you know, about this topic.

Speaker B [58:24 - 58:25]: Okay.

Speaker A [58:26 - 58:26]: Mhm.

Speaker B [58:28 - 58:35]: Okay, so two things. I think with Create, I would like a little bit more clarity on what that means.

Speaker A [58:35 - 58:35]: Yeah.

Speaker B [58:35 - 59:07]: Um, I wasn't sure about the difference between like how. How is that different from level 5? Nap. You kind of explained it. I, I think I mostly understand it, but it's still a little unclear. Um, but I see where you're going with that. Um, so if this. Evaluate and then create. Evaluating something to look up numerics.

Speaker A [59:08 - 59:22]: Let me ask if. Does this ref. Does this is. To what extent could you see this being part of your learning or do you use this way of thinking in, in your learning and teaching?

Speaker B [59:24 - 59:58]: Yeah. So, so I went back to an assignment. Um, it's like, probably like my favorite assignment like ever. Um, at the end of, um, each semester for my theory and aesthetic students who I won't be, um, I won't be teaching that class, um, probably indefinitely. Um, I'm trying out some new classes, but I plan to try out a lot of those same methods in the Beyonce class that I'll be teaching. So this is actually really helpful because that class is structured mostly similarly.

Speaker A [59:58 - 59:59]: Did you say a Beyonce class?

Speaker B [60:00 - 60:05]: Yeah, yeah. Uh, about um, Beyonce and black musical history.

Speaker A [60:05 - 60:06]: Huh. Okay.

Speaker B [60:07 - 60:12]: Yeah, I'm really, really, really excited about that class. Yeah, that's going to be a lot of.

Speaker A [60:12 - 60:13]: Should be a hit.

Speaker B [60:14 - 66:20]: Yeah, it's. Yeah, it's already overfilled. Um, the weight list is maxed out. I have a lot of friends who caught wind. But yeah, I need to figure out those things. Um, just put up here, make a zoom link. I will forget angry people. Okay. Um, so, okay, so what this immediately reminded me of is, um, my favorite assignment. I have my theory and aesthetic students. Um, create theories, um, um, and add on to existing theories, um, and. Or create new ones, um, to solve some of the most important problems plaguing the black community domestically or worldwide today. And so the class so really similarly to actually. Ah, your outline. So the class starts with um, we spend the first few weeks, um, on um, the three pillars of theory, which I identify as um, epistemology, ontology and axiology. Um, and so that's like, you know, um. Well, let me go back to Blooms. So yeah, it's like knowledge and comprehension. Um, or actually yeah, I'll, I'll, I'll go based on, um. Based on yours because I like yours more. So, um. Yeah, that's like, um. That, that's, that's like remembering and understanding. So I even like test them a couple of times. I don't, I don't do like tests but do like little exercises in class and be like, okay, can you identify the epistemology, epistiology and ontology in this, um, document in this argument? We'll do that for like a solid month. Um, level two, um, was. What was level two again? Two. Okay. Applying and analyze. So at that point they have their first paper that's due, um, and they start to analyze their own life and apply these concepts to their own lived experiences. Um, so they'll say this is epistemology. I have experienced epistemology in this way in my own life. And this is also how black people experience epistemology if they are not black identified, since it's an Africana studies class. Um, so yeah. And then level three was, was it, um, evaluate. So evaluate is when they get to their second major assignment, um, which is um, a, um, I just changed the name of it, uh, an annotated bibliography. Um, so there they start to actually evaluate sources based on their chosen research topic, um, for their final group project, um, and they start to um, yeah, just um, review the existing literature, um, in the field of their issue, um, in, you know, like evaluate the merits and limitations of those, um, readings and biography. Um, level four, create. So create. They then, um, they have like a kind of like two part final project. Part of was just too much. Um, but usually they then create. Excuse me. They then create, um, an aesthetic influenced by an aesthetic that we have observed in class. So for example, like we look at everything like films, photography, music, fashion, like you name it, we've looked at it in class, art books, whatever. Um, they will choose an aesthetic of their own, um, and simply show what they've learned in the class and how they will apply it in their daily, political and personal life, um, through their own aesthetics. So some folks might make a playlist. I've had people create like original artwork, etc. Poems, whatever, you name it, um, dances, all that stuff. Um, the level five, um, which was synthesize and what was it? Create. Yes, yes. Innovate. So okay, and I love that word. Innovates and synthesize. So you're creating something new and also combining information in a complex um, and engaging dynamic way. Um, and so um, their final um, uh, along with their self created aesthetic is to create um. Um, to give a team talk, a group presentation. Um, in which they select a theory that we have analyzed in class. Um, and they apply that theory to um, whatever their chosen like black social problem is. Um, and um, they have to add on to that theory. Um, specifically respond to what they are changing or adding to and why. Um, explain why their additions or changes are um, innovative and useful and readily applicable and then defend their entire theory against the whole class. Um, so then we ask them a bunch of questions basically poking holes in their theories and they have to defend it. So pretty much like your 5 levels is pretty much like how I run my class. So I like this a lot. One thing I would.

Speaker A [66:21 - 66:23]: Yeah, super. Yeah.

Speaker B [66:23 - 66:48]: Um, yeah, one is the creating. I would, yeah. Just make that a little bit more um, precise in terms of what you mean. Um, like I'm creating an original work. I'm just, Just. Yeah, like what you mean by that. And then um, I. So I wouldn't know if this is a five point system until I start clicking along the line.

Speaker A [66:48 - 66:49]: Yeah.

Speaker B [66:49 - 67:09]: So I like how you have introductory, intermediate, expert. Um, I would add like maybe like five gray dots along the line so that they, when you click on it then it's like oh, that's what that means. Some um, indication that when I click on this I'm going to see five levels.

Speaker A [67:11 - 67:14]: Yeah, yeah, it looks like there's only three. Right?

Speaker B [67:15 - 68:40]: Yeah, yeah. So I like that it's spaced out between three. But I would just add like three or sorry five dots on the actual line such that then when you click it then you're like oh, okay, this actually means something. And then I also like how it's kind of open because um, even as you go up levels, your depth made, the depth is dynamic. So just because you're on level four doesn't mean that you're either still just intermediate or you're expert. I mean you are in the m. Middle. You are at a place in which you're not intermediate. Like you have a pretty firm grasp on your given subject but you're also not really an expert in that you're not like, you know, people aren't calling you up like the Dalai Lama to give peace talks. Um, and so you're In a space where you are now actively creating and working toward that expert level. So I also like that the bar, um, gets bold as you go along, because a person can kind of see that knowledge is a journey. And you could either. Either just jump to. I want to just go straight to intermediate, or it's like I want to create a plan for going from introductory to expert. So I like that the journey is implied. Also optional. Yeah.

Speaker A [68:43 - 68:43]: Yeah.

Speaker B [68:44 - 68:44]: Uh.

Speaker A [68:50 - 68:53]: Okay, super. Let's go to the next level.

Speaker B [68:55 - 69:11]: Oh, okay. So breath versus step. But can you go back one second to the first, um, step? So I see you have, um. Or the. The first, like, um, step. Like one out of four.

Speaker A [69:12 - 69:14]: Oh, okay. All the way back there.

Speaker B [69:15 - 69:33]: Um, okay, I see. Okay. So you have a compass for what do you want to learn? Um, so I'm thinking of. I'm just thinking of, like, icon association. So if a compass means what? And then I saw the gear. Which was next.

Speaker A [69:34 - 69:35]: Huh?

Speaker B [69:37 - 69:41]: What was the, um. Uh, can, uh, you hit next again?

Speaker A [69:42 - 69:43]: Yeah.

Speaker B [69:45 - 69:48]: Okay, so then you have a gear for how deep.

Speaker A [69:50 - 70:00]: Yeah, it's actually. I think it's like a brain. If you look in there with a gear inside of it.

Speaker B [70:01 - 70:45]: That's pretty cool because. So actually, like, for step one, I was thinking, should this be a brain? But I actually like that that that is more appropriate for healthy because the brain has tissue and curves, and you can just. Yeah, you want to absorb, like, you're looking at the brain like a sponge. And I like the compass because, um, connotes, like, where are we going? Let's identify a point of range. Um, let's identify some coordinates and then decide. Okay. Once we figured out where we want to go. Surface level. Now we can figure out the depth. So. Okay, cool. I was. I was just thinking about that. Okay. Okay. M. So step three.

Speaker A [70:46 - 70:49]: Yeah. So step three is the breadth versus.

Speaker B [70:49 - 71:47]: Depth topics to cover and how deeply to explore each one. Okay. So focused, balanced, comprehensive, breath. So, yes, focus. You're probably really zeroed in balance. You probably want a few perspectives. You're probably just doing something more comparative and then comprehensive. You want to know, like, the state of the field. Okay. Oh, wow. Okay. This grows. Are there, um, comprehensive and deep learning cost many topics. This is ambitious, but. Oh, okay. So is. Is. Is this, like. Okay, two questions? Um, one, um, can you click along the bar again? Like, is it just three points or is it also like the previous one in which there are multiple.

Speaker A [71:47 - 71:52]: Yeah, it's. It's a little bit like the previous one, where there's multiple.

Speaker B [71:55 - 72:35]: I wonder if, um, this can be more interactive than prescriptive. Like if. So, like if, if. If I start off with focused, um, am I forced to learn, like, three topics? Um, so can you, uh, click back on focus again? Okay, so you have the root topic, and then you have two subtopics. Uh, and then these. Can I add on to or subtract from that? Like, is this, this tree interactive?

Speaker A [72:37 - 72:59]: Hmm. M. It's not interactive, but I'm curious. So you're thinking maybe you would want to stretch, like, something, like, to add more. Maybe instead of clicking along a bar, you'd want to draw a shape out on your own.

Speaker B [73:00 - 78:03]: Yeah. No. Or just, um, if I could, like, add a circle, then move, like, where I want it. So if I have the root, I do think the root should be one. You do need one primary topic. There's no such thing as two topics. That does. That doesn't exist. M. Uh, I tell my students, you have to pick one. You cannot have two. Um, so I like that the root is one. Um, I don't necessarily like that I'm being forced to choose between two. Um, so for example, for like, so like for the Beyonce class, I've had to do and still have to do a lot of research because it's a really, really deeply historical class. I'm pulling references and listening to all of her samples. It's actually a lot of work now that I'm reading about it. Um, and so, um, what if. Let's take, for example, this current album, what if. Okay, so I have the root. Beyonce Cowboy Carver album. Um, sub topic one. Um, I want to understand sales. Let's just say how much did the album sales? Topic two, I want to understand its influence on the economy. Um, and then even beneath that, there are many branches. So part of that is fashion. Amazon. Every time Beyonce gets a tour, um, Amazon and all the little stores, Zara, uh, and H M, they usually create sections specifically for the tour because they know that people are shopping for Beyonce. So they will literally, like you walk into Zara, and for three months there will be a Beyonce section because the Renaissance tour is going on. I want to know how much money does Zara make? Um, so that's two interesting three. What are all of its samples? Tell me everything. I want to know every single sample. Um, ah, every single song reference clip that was used on the album, which for Beyonce can often be dozens or hundreds. She is, as my class's title, an American story. She is a historian. She does her homework. Um, and so for someone like me, who might want like okay, three topics. Or even if I'm like writing an essay, say for example, I'm a student, um, I'm writing an essay, I don't know about Beyonce. It has to be, um, I don't force my students to do like you have to have three or four paragraphs. Um, I do encourage them because it's clear. But let's just say for example, I force them if they have to do a, ah, three paragraph paper. Um, this um, um, model automatically wouldn't work for them unless they were to do balanced. But then they will be forced to have so many topics and subtopics. So basically if there is a way that I can design the web, um, that will be great. I guess the only thing is that some students may think that what they're doing is focused and actually professor will tell them this is actually really comprehensive. You're doing too much. Um, you need to focus, focus, focus. Um, and so they may click on breath level focus so their, their bar is a lot shorter. Um, but then they may keep adding so many subtopics that it becomes balanced or comprehensive. Who tells this student that they're doing too much? Um, so basically like what if you flipped the model and that this actually is getting really hairy. Okay, I'm going to say it anyway and then we can go from there. Um, what if you flip the model and the student had. Okay, so if the breadth level bar was beneath the diagram and if you just reverse them, switch them, um, if you made it interactive in that a student can just keep clicking a plus sign to add bubbles and then those bubbles will automatically create lines when you attach them to certain bubbles or whatever. Um, and create this kind of tree. So basically like let the student create it instead of you creating it for them, then the more information they add, the bar automatically goes up from focus to balance to comprehensive. Because what if I tell the student I want a balanced view? What if they're, you know. So this is actually really useful for my English class this fall because they have to write argumentative papers. What if I tell them I need your paper to be very balanced. I want you to find two perspectives. I want you to argue the pros and cons of each side. Um, and that's it. Nothing else. Um, so I may tell them write a balanced paper, but if this is their first time writing an argument in a paper, they don't know how much. Um, does that make sense?

Speaker A [78:04 - 78:10]: It, it really does. Yeah. I like what you're, um, I, um, like what you're saying.

Speaker B [78:13 - 78:20]: Yeah, yeah. M. Yeah, I'm thinking just more interaction. Um, yeah, yeah, go ahead. Yeah.

Speaker A [78:25 - 79:07]: In fact, I want to try it out. Um, but my one initial concern is that, uh, it could be either genius or folly. I'm not sure. Right. Because it may lead to paralysis, where you're then saying, well, how does a student know how deep they want to go versus how broad? But, um, you might be putting this burden on them because generally when you ask people to produce things, it's a high cognitive burden. Right. But if you do it the right way, this depth and breadth, it might actually.

Speaker B [79:09 - 79:09]: Um.

Speaker A [79:10 - 79:36]: I wonder if it stimulates the juices, you know, Is that. Is that kind of what you're suggesting? That like you're. You're kind of like getting them engaged in the topic without. It's like a pre. Engagement. Like you're not. You're not like reading a ton, but you're. You're almost like selecting, you know, cards or, uh, like bullet items or something.

Speaker B [79:37 - 83:36]: Yeah, yeah. I. Okay. Two things. I know I always have two things. Um, one, um, thought and one, um, a question about the. Your, um. Your learning structure. Um, this is where I think guidelines and like, given outlines are useful. So I always tell my students, okay, so I always give them a very clear, probably like almost overkilled outline of exactly what I want literally each sentence to be about. I give them a sentence by sentence. Um, because the, you know, for their first papers, I don't know where anybody's starting at. There may be some very advanced writers and some very poor writers. Um, and even like using those. Using that language. Advanced versus poor or is, um, unethical. But anyway, different levels of writing. Um, I often find it useful in giving them outlines because all they have to do is fill in the blanks. For example, the first paper is four paragraphs. I don't even want five, um, four paragraphs. Um, and I tell them what I want for each paragraph. Um, and like. And also give them an additional handout which tells them how to write a paragraph from such things. So really I do tell them what to do. Um, and a lot of them who follow the direction find it to be beneficial that they don't have to think as much. Um, so they're not having to think about both the structure and the content. The structure is given to them and they just fill in the blanks, which is, I think, what you're doing. And I like that. I think what I might suggest is talking with more educators around the different types of scaffolding. So I think you could do this in like a kind of hybrid way. Um on one hand so I actually do have like my clients like um, for my writing clients separate from my students like given outlines of like okay, a cover letter should look like this, a novel should look like this, etc etc. Just throwing that right up there. So basically what you have but just replaying it could be really helpful. So if you had like and this could even be like a drop down menu. I um, have to write a five paragraph paper and then you just give me a web already built in. Um, so you have your topic. Um, the breakdown of the paragraphs of course could be interesting because you have no idea what the paragraphs have to be about. Um and so a comparative paper outline like or bubble diagram will look very different um from like my standard history paper. Um so I think that could get a little bit uh. Yeah, that could get a little hairy. And that's why um, on the other hand I still suggest giving the students the option to click on and add bubbles and build onto the web. Um, I think that there's anything that I do completely disagree with is giving them like the web and no oxygen change. So the basically the way that it is now I don't think it will work just because we don't know what papers mean. Um, and so I think making interactive um, in some way shape or form is required because every paper needs something different. But then that leads me to my question. So you're a learning structure and deep dive into a few key topics. You'll become an expert in specific areas. What does that mean? What does that fox supposed to do?

Speaker A [83:39 - 84:06]: Um, so this is basically giving you a visual of you're, you're setting up how, how much content you're going to get. So this is all the pre setup to the learning activity.

Speaker B [84:07 - 84:08]: Mhm.

Speaker A [84:08 - 85:42]: So you're configuring it and so it's setting a goal. So I think I definitely hear what you're saying um, in the interest of time because I know you have to go and so do I. I agree with you. I think you make a hugely important point about making um, it interactive and the value of that. And um, I want to go off and think about how I can do that better and then come back to you. But I think that is potentially very engaging way of getting um, the student to kind of dive into the topic more. And I could even almost imagine like you as a professor you would have your, your syllabus and your learning outcomes that you want to have them cover and a set of Topics, um, and that might be kind of preloaded into this. And they would say, well, okay, I've got limited time. I've got, you know, three kids at home and a part time job. Let me just carve out the sections here that I think I can handle. I'm not gonna be able to do it all. Um, so I think giving people agency over, over the content is part of the theme here that you're, you're identifying.

Speaker B [85:43 - 85:46]: Yeah, yeah, totally.

Speaker A [85:46 - 85:54]: Okay, so we'll uh, if you're okay, I'd like to move on and then come back to you like in a couple weeks and say hey, here's what I think this might look like.

Speaker B [85:55 - 85:56]: Yeah, absolutely.

Speaker A [85:56 - 85:57]: Okay.

Speaker B [85:57 - 85:59]: Oh, so.

Speaker A [86:08 - 86:11]: Yeah, curious if yes, give a second to read it.

Speaker B [86:12 - 86:13]: Mhm.

Speaker A [86:13 - 86:15]: I know it's a lot text.

Speaker B [86:15 - 87:43]: No, no, no, this is, this is great. Um, because even with it being a lot of text, um, it's um. Well actually no, this isn't a lot of text. Like, like they're, they're each a sense. Well there are, I see four sentences and then like a bunch of like very, very short terms. So I think this is super digestible and even like how you um, designed it in that um, there are two columns. Like the topic is separate from what it actually is because it just gives your eyes a break. You're like, I can read from here to there and then learn more here, there, learn more. Instead of like, okay, just a list. I think that's overwhelming. So I just, just, just from a design standpoint this is really digestible and really um, kind m to your users. Um, I might change the icons of the book and the brain just because you already use them. Um, but I do love the idea of icons being there. Maybe mentor can be like a chat bubble, um, or like a, um, like a human head or even like a mouth, something like that. A couple of suggestions. Um, okay, so exam prep. Focus on test preparation with practice questions and consistent explanations. Giving practice tests. And then here can they like select which ones they want? Like are these like selectable bubbles?

Speaker A [87:44 - 87:51]: Uh, not the bubbles inside. Like you can select the mode like Exam Prep or Creative Explorer.

Speaker B [87:54 - 88:20]: Okay, cool. And then so anything so like, so it'll, it'll just give you everything. It'll give you practice test and explanations and key terms and memory techniques. And then it'll be the onus to decide what they actually want to use and keep would be on the user. Or would they be able to further refine these so they don't have like a gigantic file to sort through after.

Speaker A [88:20 - 89:24]: Yeah, I think exactly that that will become, that's a great question. That'll become clear in the next piece, I think. Version one, we're trying to just get the setup for how should we structure your learning exercise. And so we've bundled them. So for exam prep, this is what we're going to do. Uh, fine tuning it and saying I don't want to um, have one of these sub, sub bullets is something we haven't really, we're not quite there yet. We're just trying to say what, what are the different interactive Interact. Uh, modes M and um. So when you select one, uh, now we're going to go and create your learning plan. And so when we create your learning plan we then, you know, it'll take like a minute perhaps. Right. And then you'll see this screen. And so imagine this was like jazz, Jazz concepts.

Speaker B [89:24 - 89:24]: Mhm.

Speaker A [89:25 - 89:25]: Instead.

Speaker B [89:31 - 90:07]: Okay, cool. Oh nice. So it tells. Okay, so you have how many objectives are in the plan, how many topics are in the plan, and then how far along you've been going. Then I assume the progress box syncs up with the upcoming task box. Um, yes. Then that's where you hit continue. Okay. Because I was like, how do you know? Like where's the 25% coming from? How do I access whatever portal I need?

Speaker A [90:10 - 92:04]: Super question. Yeah, so let me like orient you here. That's very astute. Yeah. So there's kind of two things at play here. There's a topic map. And so imagine that these are related. It's kind of similar to what you've seen from us before. Right. And so there's a list of topics and those would be very discrete things. Right. Um, and that is different from the learning plan which looks a little bit more like, okay, what are my sequential things that I'm going to do? Okay, so how am I going to get through this maze? Right? So you think about it like I'm going to choose my own adventure here. Like maybe it's like um, I'm first going to get at Magic, you know, at Magic Mountain. And maybe I'm first going on Rolling Thunder and then I'm going to go to the, the log jam ride or whatever. Right. Like you can look at this and the way it's set up is, um, we've taken this big topic and figured out there are these steps along the way that escalate from the Bloom taxonomy level one up to six Create. So the idea is we're starting you off with some basic memory, uh, and understanding and then building on that knowledge to help you analyze, evaluate and apply and then ultimately to create. And then as you, as you click on these things, you. That will change the. I don't think it's going to happen here, but yeah, uh, as you, as you click these off now you go up in percentage completion.

Speaker B [92:05 - 92:05]: Mhm. Mhm.

Speaker A [92:06 - 92:21]: And um. Yeah, all right, let me, let me get through this to the next, um, let me get back here.

Speaker B [92:22 - 92:22]: Mhm.

Speaker A [92:28 - 92:41]: Okay, so you can also regenerate and say, okay, I want to edit this and give it different instructions.

Speaker B [92:42 - 92:42]: Mhm.

Speaker A [92:43 - 92:55]: Um, and you can also, you know, add your. I don't think it works here, but you'll be able to add your own and then sort them into different orders.

Speaker B [92:56 - 92:56]: Mhm.

Speaker A [92:58 - 93:21]: And you know, part of the idea is that we would then also, um, help you to structure and find time in your calendar to do these things. And so that's what you're seeing here where it says complete the groundwater quiz today, then tomorrow read the conservation article.

Speaker B [93:22 - 93:23]: Mhm.

Speaker A [93:23 - 93:41]: And so we're trying to basically take an entire subject matter, say it's a course, break it into topics, and then generate sequential learning objectives and a plan and help you allocate the time for it.

Speaker B [93:43 - 93:46]: Yeah, yeah, I like that.

Speaker A [93:48 - 93:52]: Wait, now, is that evident from this interface here or.

Speaker B [93:52 - 93:56]: Yeah, I was gonna say by, by helping you find the time for it. Now where's that?

Speaker A [93:58 - 94:01]: Uh, well, we haven't built that yet, but that's okay.

Speaker B [94:01 - 94:12]: But that's like, like next step where it'll like you can like integrate it like with your calendar or something and be like, okay, you have a free hour between practice and appointment.

Speaker A [94:12 - 95:21]: Yeah, I think, yeah, that's what we're thinking like down the line. Um, right now we're just trying to focus on does it make sense to break up these steps into, um, items on your learning plan? And um, like for example, if we knew that there was a quiz on Friday and today was, well, geez, today's Friday. Well, let's say today was Monday. Right. And there's a quiz on Friday. Um, would it be helpful to you know, put item like uh, activities on your, on your calendar that said, okay, review the material on Monday, create flashcards on Tuesday, review them again on Wednesday, do some practice tests on Thursday. Like that's kind of the direction that we're going. That isn't really spelled out here. That's why I'm having to explain it.

Speaker B [95:22 - 97:43]: I like that. I think that's a phenomenal idea. I think that. What, really? So I met with, um, um, a Business mentor yesterday and I was telling her, um, that um, so with my product and um, um, I can like talk about that like really, really brief, briefly before we go. Um, I was, long story short, trying to figure out like just like what are my next steps. Um, and um, so I've been putting myself in like a bunch of writing groups lately so I can just meet a bunch of users and just learn and just, yeah, refine the problem as much as possible. And what, um, what I was finding was that um. Okay, sorry, was like, where am I going with this? Okay, so I'm a part of one particular writing challenge. It's a 14 day, uh, writing challenge and it's asynchronous. It's online. You just fill out like your daily progress report and you're able to like people to like see what your team members are doing. And I've noticed um, across all the different writing groups that I'm in, um, most of them have a hard time with just carving out the time in their schedule and committing to it. Um, and when we're left to our own devices, um, we will of course find excuses not to do things. That's just what humans do. That's also what Americans do. We're overworked anyway, we're tired. So of course any excuse to like relax for a minute, we're probably going to take it and we probably should. But this also means, well, those goals still need to be hit. How do you hit them? Um, and so um, anyway, all these groups create systems of accountability. So I'm just a fan of any, any kind of accountability and helping me to find and commit to the time in my schedule to achieve the goals that I need to achieve. And once I start to do them pretty much daily, you pretty quickly fall into um, a rhythm. Like now I read and write every day, those non adults, um, and if I miss it, I feel bad and I force myself to carve out the next time. So I love that. Um, just a quick question. Um, can you click on Learn, um, in the left bar? What is that?

Speaker A [97:43 - 97:47]: Yes, that is, that's where the learning actually happens.

Speaker B [97:48 - 97:50]: Okay. That's the actual. Okay.

Speaker A [97:50 - 98:16]: Yeah. And so here we have content that's broken down and this is, this is actually a fair amount of content but you could have variable sizes, uh, where it's explaining topic to you. You can then also choose to discuss it. So you can have an interactive chat with the AI mentor.

Speaker B [98:16 - 98:17]: Mhm.

Speaker A [98:18 - 98:27]: So the idea is that it's, you're just having a chat. Explain me this what is that? And it will then ask you, uh, to explain things back to it.

Speaker B [98:28 - 98:29]: Mhm.

Speaker A [98:29 - 98:43]: Um, and then this is more traditional. Okay, quiz me on this. And there might be like flashcards, but the, this tab here is where kind of the actual engagement with the content for learning would happen.

Speaker B [98:45 - 99:22]: Mhm. I like that. Um, the only reason that I asked, well one yet to see what that actually was. And this looks great. And I also really like that it goes from learning to practice or sorry, learning to discussion to practice. Um, because that is way that people typically learn. So I think that that's um, just really intuitive. Um, the only thing just again like thinking from like a design standpoint, having different words between learning plan and learn. So I was thinking maybe call learn content just so that you avoid, um, see or some other word other than learn.

Speaker A [99:22 - 99:22]: Yeah.

Speaker B [99:22 - 101:20]: Or you want to just call learning plan plan and then have learned. But I like the idea of learning plan. I was also thinking what are words that will still encourage people to keep up with their goals? M. If something feels too much like homework, even though obviously you know, like we're here to learn. But if, if everything feels like, oh God, one more thing on my to do list, you're probably not going to want to do it. Um, or um, if it's incentivized, it will encourage you to do it. But I'm a little bit like anti insensibization. Anyway, I have personal thoughts about that. Um, I like what you've done here is something that's kind of in the middle where it's like it is your responsibility to learn but you decide the pace, you decide the concept, the depth, the breadth, um, how you want to learn, um, all of that. So there's, there's. I'm going back to what you're saying about agency earlier. There's just a whole lot of agency in this whole platform, um, that I think is really, really, really important and sets this apart from other like educational platforms. Um, in that those are mostly concerned with just like you have a question, ask it to ChatGPT and we will just dump information at you. Um, and sure, a pretty organized manner, but this is far more interactive, just gives a lot more choice. And it's also much more easy, it's a lot easier to navigate. Um, chatgpt and all those other like learning websites like Quizlet and all that stuff. It gets really unwieldy pretty quickly. Um, this is very clear. Um, it's a very clean format too. Um, I just noticed, um, you also have the same icon for um, adaptive learning and learning contents. Anyway, just like things that I'm just like notice.

Speaker A [101:21 - 101:23]: Yeah, yeah, true.

Speaker B [101:23 - 102:54]: Yeah, no, just like tiny things. You can fix all this stuff like at the end and just make a different icons. But yeah, no, this is, this is great. And I even like what it's called, adaptive learning. Um, in that, um, the learning plan adapts to the user's style. I was trying to think of, is there another word I might use for adaptive? Um, but I think adaptive works for now. Maybe dynamic or choice or trying to think of a word similar to agency. Like, like personal learning, personal learning, agent learning. Um, but I think adaptive gets added pretty closely for now. Okay. Yeah, no, this, this is great. This is super. I see the progress from your first prototype. This is way, um, more, um. Oh, that was. That's. That's amazing. Yeah, this looks way more, um, um, specific. Um, way more targeted and super, super, super clean. Um, I think the one thing that um, I see that is consistent but you're also like having some difficulties figuring out what to do with is the map. So it looks like you've turned your map into like a full blown plan, but you're trying to retain the map, which I think you. Oh, this is different. So this is different from those bubbles I was looking at. I didn't know this was that.

Speaker A [102:55 - 103:08]: Yeah, it's just like an artifact of the prototyping tool we're using. But, um, if it actually had these words in it, I think it would mean a lot more. Right.

Speaker B [103:10 - 103:15]: So I think you could just combine this with. What was it, step one or two.

Speaker A [103:15 - 103:16]: Yeah.

Speaker B [103:16 - 103:19]: Where you have the big bubble map. I think those can just be the same thing.

Speaker A [103:19 - 103:20]: Exactly.

Speaker B [103:20 - 104:17]: Like when we were looking at the bubbles, I thought that was this. Um, because I remember this from your first iteration and how much sense it made to me that it was just like, okay, you have this nice tree and you can add, subtract, you can do whatever you want with it. Then suddenly all the choice was taken away from the user and I was like, what happened? And so I think ditch the other thing and keep this. I think that this is really effective. Or if there's a way to combine this with the other one, um, so that you can make it, um, still work with the like five point bar. Yeah, yeah, that's really cool. But yeah, I think it's like if you could somehow combine those and not keep them separate, that would be really, really nice. And also just make it clearer like what they are. Because I didn't know that those were two different things, but I think it looks like they're doing the same function or should be. So just ditch one.

Speaker A [104:18 - 104:42]: Yeah, yeah, we'll ditch. We'll ditch the. The first one. But it was, uh, this kind of, you know, time and effort. But I think this is a really good point. Yeah. If we show you the actual content and then, like, maybe you draw a line around which parts you care about. Um, you know, or you click on. Click off that kind of a thing. So.

Speaker B [104:43 - 105:19]: Yeah. Or if it was like. So what I'm imagining is like, um, it's like a snap grid kind of situation in which you can add topics. Like how you have the topic thing, but how maybe if you drag it and you hover over a topic, it automatically goes underneath that branch. So I'm thinking, how can you make this interactive but clean? Because people will just make a giant mess.

Speaker A [105:19 - 105:20]: Yeah.

Speaker B [105:20 - 105:41]: And so it looks like a. Take your subtopic and hover it where you want it to go. Then it automatically snaps and creates a line underneath that branch. Or, um, sorry, creates a branch underneath that leaf. I get s. If you're thinking of it like a tree, it keeps it clean and interactive.

Speaker A [105:44 - 105:44]: Yep.

Speaker B [105:45 - 105:59]: It might take some code finagling, um, you know, for you to kind of figure out, like, how to do that. But I think if that's the goal or something like that, I think, um, that will be really, really nice. That will work.

Speaker A [106:01 - 106:11]: Yeah. Okay. Yeah. Super. Well, this is, um. This is exactly what I. The type of feedback I was looking to get.

Speaker B [106:12 - 106:38]: Good. Good. I'm glad. I hope the, um. I don't know how the grading stuff will help you with this one, but I hope all of that was useful. Um, and I also just appreciate getting, um, a minute. So also just, like, think out loud about all of that too, um, as I, um, adapt my courses and change them over the next few weeks. So.

	"""#
  }
}
