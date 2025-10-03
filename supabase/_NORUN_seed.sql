-- Sample seed data for Insights application
-- Uses fixed UUIDs so front-end can reference deterministically

-- 1. Create users in auth schema ----------------------------------------------
-- Note: In production, users would be created through Supabase Auth, not direct inserts
-- These are placeholder users for development purposes only
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'owner@example.com', '$2a$10$abcdefghijklmnopqrstuvwxyz', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Account Owner"}'),
  ('00000000-0000-0000-0000-000000000002', 'member@example.com', '$2a$10$abcdefghijklmnopqrstuvwxyz', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Team Member"}');

-- 2. Create account in accounts schema ---------------------------------------
INSERT INTO accounts.accounts (id, primary_owner_user_id, name, slug, personal_account, created_at, updated_at, created_by, updated_by)
VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'StudySmart Inc.', 'studysmart', false, NOW(), NOW(), '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');

-- 3. Create account members --------------------------------------------------
INSERT INTO accounts.account_user (account_id, user_id, account_role)
VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'member');

-- 4. Create account settings -------------------------------------------------
INSERT INTO public.account_settings (id, account_id, title, onboarding_completed, created_at, updated_at, created_by, updated_by)
VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'StudySmart Settings', true, NOW(), NOW(), '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');

-- 5. Create projects ---------------------------------------------------------
INSERT INTO public.projects (id, account_id, title, description, status, created_at, updated_at)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'AI Learning App Student Study Habits', 'Qualitative research interviews with students to understand study patterns when using AI-assisted learning.', 'active', NOW(), NOW());

-- 6. Create interviews -------------------------------------------------------
INSERT INTO public.interviews (id, account_id, project_id, title, interview_date, participant_pseudonym, segment, duration_min, status, transcript)
VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Interview – Freshman JC Student', '2025-06-10', '"Kai"', 'Undergraduate', 45, 'transcribed',
	$$
	Kai K, College Freshman Rick 6/11
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
SPEAKER 1
Okay, cool. Um. All right, that's it.
$$),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Interview – Working Adult MBA', '2025-06-11', '"Jamie"', 'Graduate', 50, 'transcribed', 'Full transcript placeholder.'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Interview – High-School Senior', '2025-06-12', '"Taylor"', 'High School', 40, 'transcribed', 'Full transcript placeholder.'),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Interview – Teacher', '2025-06-10', '"Jerad"', 'Teacher', 45, 'transcribed',
	$$
	Interviewer’s Notes
3 years
East Palo Alto Tutoring and Tennis epatt.org
Mental and physical tennis are related
Mentorship emphasis

Oral Report. Actively organize info in a ‘debate’ format
Teachers would want to see this: help student to debate, defend, exercise this info
Design with this in mind
Metaphors. Generate to support learning.
Emphasizing novel nature of collaborative discussion, peer learning

Student issues:
Difficulty imagining a future, not exposed to different world views
Don’t have flexibility to dream, more stuck in what they have to do, due to financial, social constraints of family unit

Pairs students with Stanford students. Social imbalance.
Creates exercises, extraC, exp -> resume
Essay prompts
Supports getting students to converse more. Get them to PRODUCE vs listen.
Imp to use words they know to get them to where they need to be
Also sensitizing tutor to situation: Meet students where they are
Aristotle, plato first 1-1 tutors. Empathy. We need shared language.
But schools need to find the average.which doesnt serve everyone.
Has lots of IEP students.

Diff ways to organize and view knowledge helps reach students

Solid feedback about user interface.
Put Mode  (step 4) up front to get students excited and differentiate from a chat/google search, then ask what do you want to learn, how deep, broad.
What do you want to learn? Most important
Some negative  bias against node-linked graph approach but likes the output from manipulating it in the depth-breadth part of learning plan creation
Add a tutorial for 1st time run to explain WHY and what will happen; otherwise likes low verbiage UI. eg AI will setup a customized learning plan.

TODO:
Follow up and go deeper on UI concepts

Full Transcript
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



	$$);

-- 7. Create insights ---------------------------------------------------------
INSERT INTO public.insights (id, account_id, interview_id, name, category, journey_stage, impact, novelty, jtbd, details, evidence, confidence, related_tags, created_at, updated_at, created_by, updated_by)
VALUES
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'AI as Writing Assistant', 'Writing Process', 'Execution', 4, 3, 'Help me connect ideas in my writing when I lose my train of thought', 'Students use AI to connect ideas and evidence in their writing when they get stuck', 'Student uses AI to help connect evidence with analysis in essays when they lose their train of thought', 'high', ARRAY['writing', 'essays', 'academic'], NOW(), NOW(), '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'AI for Math Problem Solving', 'Problem Solving', 'Learning', 5, 4, 'Show me step-by-step solutions to math problems I am struggling with', 'Students use AI to learn math problem-solving techniques by requesting step-by-step solutions', 'Student mentions using AI to get step-by-step solutions for math problems they cannot solve, then applying those techniques to other problems', 'high', ARRAY['math', 'problem-solving', 'learning'], NOW(), NOW(), '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Side-by-Side Document Comparison', 'Workflow', 'Evaluation', 3, 2, 'Help me compare AI suggestions with my own work', 'Students work with multiple documents side-by-side to compare their work with AI suggestions', 'Student describes using separate Google Docs to compare their original writing with AI-assisted versions', 'medium', ARRAY['workflow', 'comparison', 'editing'], NOW(), NOW(), '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');

-- 8. Create comments ---------------------------------------------------------
INSERT INTO public.comments (id, account_id, insight_id, user_id, content, created_at, updated_at)
VALUES
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'This matches what we heard in other interviews with English majors.', NOW(), NOW()),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'We should explore how this connects to the revision process.', NOW(), NOW()),
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'This is a high-impact insight that could inform our tutoring feature.', NOW(), NOW());

-- 4. Transcripts (simplified) --------------------------------------------------
-- Merged into interviews

-- 5. Themes --------------------------------------------------------------------
insert into public.themes (id, org_id, name, category, color_hex)
values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Time-Management', 'Behavior', '#3b82f6'),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Motivation', 'Behavior', '#10b981'),
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Distraction', 'Pain-Point', '#f59e0b');

-- 6. Personas ------------------------------------------------------------------
insert into public.personas (id, org_id, name, description, percentage, color_hex)
values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Focused Planner', 'Students who allocate study blocks and follow schedules', 0.35, '#2563EB'),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Last-Minute Crammer', 'Students who study primarily right before deadlines', 0.4, '#E11D48'),
  ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Steady Improver', 'Students who review material incrementally each day', 0.25, '#14B8A6');

-- 7. Insights ------------------------------------------------------------------
insert into public.insights (id, org_id, interview_id, name, category, journey_stage, impact, novelty, jtbd, motivation, pain, desired_outcome, confidence, created_at)
values
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Need micro-goals', 'Engagement', 'During Study', 4, 3, 'Break big assignments into bite-sized tasks', 'Wants sense of progress', 'Feels overwhelmed by long modules', 'See steady progress bar', 'high', now()),
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'Prefers audio summaries', 'Accessibility', 'Pre-Study', 3, 4, 'Review material on commute', 'Limited time', 'Reading long articles on phone is hard', 'Get concise audio overview', 'medium', now()),
  ('60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'AI reminders reduce cramming', 'Retention', 'Post Study', 5, 4, 'Receive prompts before forgetting', 'Wants better grades', 'Tends to procrastinate', 'Automated spaced-repetition nudges', 'high', now());

-- 8. Comments ------------------------------------------------------------------
-- First, create a function to safely add comments with error handling
CREATE OR REPLACE FUNCTION safe_insert_comment(
  p_id uuid,
  p_org_id uuid,
  p_insight_id uuid,
  p_user_id uuid,
  p_content text,
  p_created_at timestamptz
) RETURNS void AS $$
BEGIN
  -- Only insert if the user exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    INSERT INTO public.comments (id, org_id, insight_id, user_id, content, created_at)
    VALUES (p_id, p_org_id, p_insight_id, p_user_id, p_content, p_created_at)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get a valid user ID from auth.users if available, or use NULL
DO $$
DECLARE
  valid_user_id uuid;
BEGIN
  -- Try to get a valid user ID from auth.users
  SELECT id INTO valid_user_id FROM auth.users LIMIT 1;

  -- Insert comments using the valid user ID if available, otherwise use NULL
  PERFORM safe_insert_comment(
    '60000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001',
    valid_user_id,
    'This insight about micro-goals aligns with our previous research on student motivation. We should consider adding a progress visualization feature.',
    now() - interval '2 days'
  );

  PERFORM safe_insert_comment(
    '60000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001',
    valid_user_id,
    'We tested a similar approach last quarter but with daily goals instead of task-based ones. The completion rate was 15% higher with task-based goals.',
    now() - interval '1 day'
  );

  PERFORM safe_insert_comment(
    '60000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000002',
    valid_user_id,
    'Audio summaries could be a game-changer for accessibility. We should explore text-to-speech integration options.',
    now() - interval '3 hours'
  );

  PERFORM safe_insert_comment(
    '60000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000003',
    valid_user_id,
    'The AI reminder feature shows great potential. Lets consider A/B testing different notification frequencies to find the optimal balance.',
    now() - interval '1 hour'
  );

  PERFORM safe_insert_comment(
    '60000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000003',
    valid_user_id,
    'We should check if this aligns with our existing spaced repetition algorithm or if we need to modify it.',
    now() - interval '30 minutes'
  );
END $$;

-- Clean up the helper function
DROP FUNCTION IF EXISTS safe_insert_comment(uuid, uuid, uuid, uuid, text, timestamptz);

-- 9. Quotes --------------------------------------------------------------------
insert into public.quotes (id, org_id, insight_id, quote, timestamp_sec)
values
  ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'I lose track when a lesson drags on for 30 minutes straight.', 120),
  ('70000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 'Listening to a summary on the bus would save me so much time.', 85),
  ('70000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', 'The AI nudges keep me from forgetting the content before exams.', 200);

-- 9. Tags ----------------------------------------------------------------------
insert into public.tags (tag, description)
values
  ('Time-Management', 'Managing study time effectively'),
  ('Motivation', 'Staying motivated to learn'),
  ('Accessibility', 'Making learning content easier to consume');

-- 10. Insight Tags -------------------------------------------------------------
insert into public.insight_tags (insight_id, tag)
values
  ('60000000-0000-0000-0000-000000000001', 'Time-Management'),
  ('60000000-0000-0000-0000-000000000002', 'Accessibility'),
  ('60000000-0000-0000-0000-000000000003', 'Motivation');

-- 11. Opportunities ------------------------------------------------------------
insert into public.opportunities (id, org_id, title, owner_id, kanban_status, related_insight_ids)
values
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Micro-Goal Feature', null, 'Explore', ARRAY['60000000-0000-0000-0000-000000000001'::uuid]),
  ('80000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Audio Summary Mode', null, 'Validate', ARRAY['60000000-0000-0000-0000-000000000002'::uuid]),
  ('80000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Spaced-Repetition Reminders', null, 'Build', ARRAY['60000000-0000-0000-0000-000000000003'::uuid]);

-- Facet catalog seeds -------------------------------------------------------
INSERT INTO public.facet_kind_global (slug, label, description)
VALUES
  ('goal', 'Goal', 'Desired outcomes and success definitions'),
  ('pain', 'Pain', 'Frustrations, blockers, and negative moments'),
  ('behavior', 'Behavior', 'Observable actions and habits'),
  ('task', 'Task', 'Jobs to be done, workflows, or steps'),
  ('tool', 'Tool', 'Products, platforms, or solutions referenced'),
  ('value', 'Value', 'What the user values or optimizes for'),
  ('differentiator', 'Differentiator', 'Signals that separate this persona or segment'),
  ('decision_criteria', 'Decision Criteria', 'Factors weighed when making a choice'),
  ('scale', 'Scale', 'Spectrum-based assessments such as price sensitivity')
ON CONFLICT (slug)
DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description, updated_at = now();

WITH kind_map AS (
  SELECT slug, id FROM public.facet_kind_global
)
INSERT INTO public.facet_global (kind_id, slug, label, synonyms, description)
SELECT
  km.id,
  datum.slug,
  datum.label,
  datum.synonyms,
  datum.description
FROM (
  VALUES
    ('goal', 'goal_finish_faster', 'Finish Faster', ARRAY['finish quickly','reduce time to complete'], 'Speed-oriented goal'),
    ('goal', 'goal_reduce_stress', 'Reduce Stress', ARRAY['less stressful','feel calmer'], 'Emotional relief goal'),
    ('pain', 'pain_tool_overload', 'Too Many Tools', ARRAY['tool sprawl','app switching'], 'Fragmented tool landscape'),
    ('pain', 'pain_manual_reporting', 'Manual Reporting', ARRAY['spreadsheet toil','manual updates'], 'Manual effort pain'),
    ('behavior', 'behavior_deadline_driven', 'Deadline Driven', ARRAY['works last minute','deadline crunch'], 'Behaviors tied to deadlines'),
    ('behavior', 'behavior_collaborative', 'Collaborative', ARRAY['co-creates','shares drafts'], 'Collaboration behavior'),
    ('task', 'task_progress_tracking', 'Track Progress', ARRAY['monitor status','check progress'], 'Monitoring tasks'),
    ('tool', 'tool_ai_companion', 'AI Companion', ARRAY['copilot','assistant'], 'AI helper tools'),
    ('tool', 'tool_notetaking', 'Note-taking App', ARRAY['notes app','documentation tool'], 'Notes applications'),
    ('value', 'value_autonomy', 'Autonomy', ARRAY['self-directed','independent'], 'Autonomy value'),
    ('value', 'value_guidance', 'Guidance', ARRAY['needs coaching','step-by-step'], 'Guidance value'),
    ('differentiator', 'diff_speed_vs_depth', 'Speed vs. Depth', ARRAY['shallow vs deep','breadth vs depth'], 'Preference between speed and depth'),
    ('decision_criteria', 'criteria_cost', 'Cost Fit', ARRAY['budget fit','affordable'], 'Cost-based decision criteria'),
    ('decision_criteria', 'criteria_integrations', 'Integrations', ARRAY['connects to tools','integration support'], 'Ecosystem decision factor')
) AS datum(kind_slug, slug, label, synonyms, description)
JOIN kind_map km ON km.slug = datum.kind_slug
ON CONFLICT (slug)
DO UPDATE SET
  label = EXCLUDED.label,
  synonyms = EXCLUDED.synonyms,
  description = EXCLUDED.description,
  updated_at = now();

-- Enable seed project with core facets --------------------------------------
WITH project_row AS (
  SELECT id, account_id FROM public.projects WHERE id = '10000000-0000-0000-0000-000000000001'
)
INSERT INTO public.project_facet (
  project_id,
  account_id,
  facet_ref,
  scope,
  is_enabled,
  alias,
  pinned,
  sort_weight
)
SELECT
  pr.id,
  pr.account_id,
  CONCAT('g:', fg.id) AS facet_ref,
  'catalog',
  true,
  NULL,
  CASE WHEN fg.slug IN ('goal_finish_faster','pain_tool_overload') THEN true ELSE false END,
  CASE WHEN fg.slug = 'goal_finish_faster' THEN 10 ELSE 0 END
FROM project_row pr
JOIN public.facet_global fg ON fg.slug IN (
  'goal_finish_faster',
  'goal_reduce_stress',
  'pain_tool_overload',
  'behavior_deadline_driven',
  'task_progress_tracking'
)
ON CONFLICT (project_id, facet_ref)
DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  alias = EXCLUDED.alias,
  pinned = EXCLUDED.pinned,
  sort_weight = EXCLUDED.sort_weight,
  updated_at = now();
