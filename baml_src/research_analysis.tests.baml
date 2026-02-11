test GenerateQuestionSet_Pizza_Needs {
  functions [GenerateQuestionSet]
  args { inputs {
    target_org "mom and pop pizza shops"
    target_roles "small business owners"
    research_goal "understand operational needs"
    research_goal_details "Identify key pain points and operational challenges facing small pizza shop owners"
    assumptions "Pizza shops struggle with staffing and inventory management"
    unknowns "What specific operational challenges cause the most impact on profitability"
    custom_instructions ""
    session_id "test_pizza_001"
    round 1
    total_per_round 8
    per_category_min 1
    per_category_max 3
    interview_time_limit 30
  } }
}

test GenerateQuestionSet_Salon_Scheduling {
  functions [GenerateQuestionSet]
  args { inputs {
    target_org "Independent salons and neighborhood barbershops"
    target_roles "Salon owners, Barbers, Front-desk staff"
    research_goal "Improve appointment scheduling and reduce no‑shows"
    research_goal_details "Explore booking flow, reminders, walk‑ins vs. appointments, and peak‑time bottlenecks"
    assumptions "SMS reminders reduce no‑shows; most rescheduling happens within 24 hours"
    unknowns "Where do booking mistakes happen? Which reminders actually get noticed? How do walk‑ins impact schedule?"
    custom_instructions "Avoid placeholders; keep questions conversational and specific to salons and barbers."
    session_id "test_salon_sched_001"
    round 1
    total_per_round 8
    per_category_min 1
    per_category_max 3
    interview_time_limit 30
  } }
}

test GenerateQuestionSet_Journaling_Moms {
  functions [GenerateQuestionSet]
  args { inputs {
    target_org "Consumer mobile apps (wellness & journaling)"
    target_roles "Moms of young kids, Caregivers"
    research_goal "Understand journaling habits, constraints, and motivations for busy moms"
    research_goal_details "When/where they journal, prompts that help, barriers (time/energy), privacy needs, notifications"
    assumptions "Short prompts lower friction; voice capture helps when hands are busy"
    unknowns "Which moments are most journal‑worthy? What keeps streaks going? What feels intrusive?"
    custom_instructions "Friendly tone. No template brackets. Prefer ‘Tell me about…’ and ‘Walk me through…’ when helpful."
    session_id "test_journaling_moms_001"
    round 1
    total_per_round 10
    per_category_min 1
    per_category_max 3
    interview_time_limit 45
  } }
}

test GenerateQuestionSet_SaaS_Willingness {
  functions [GenerateQuestionSet]
  args { inputs {
		target_org "HealthCareVibe"
		target_roles "Founding CEO, CTO, CMO"
		research_goal "willingness to adopt our healthcare technology"
		research_goal_details "We are a healthcare technology company and are looking to understand the willingness of healthcare providers to adopt our platform."
		assumptions "Healthcare providers are willing to adopt our technology but may have concerns about integrating our platform into their existing systems."
		unknowns "We are unsure how healthcare providers will perceive our technology and how much they will be willing to pay for it."
		custom_instructions "Please generate a list of 5-10 questions to interview healthcare providers about their willingness to adopt our technology. Include questions about their concerns about integrating our platform, their perception of our technology, and their willingness to pay for our services. Please also include questions about their current technology stack and how they currently manage their patient data."
		session_id "test_healthcare_001"
		round 1
		total_per_round 10
		per_category_min 1
		per_category_max 3
		interview_time_limit 30
  }
	}
}

test GenerateQuestionSet_Custom_Instructions {
  functions [GenerateQuestionSet]
  args { inputs {
    target_org "Regional nonprofit hospital network (6 clinics, 450-bed hospital)"
    target_roles "Patients (outpatient), Front-desk staff, Nurses, Primary-care physicians"
    research_goal "Improve patient intake and follow-up experience"
    research_goal_details "Reduce waiting time, clarify instructions, and raise follow-up adherence for chronic care patients (diabetes, hypertension)."
    assumptions "Patients miss follow-ups due to confusing discharge instructions; staff tools are fragmented."
    unknowns "Which steps create the most confusion? How do staff prioritize time? What would increase adherence?"
    custom_instructions "Favor plain language for patients 8th-grade reading level; include at least 2 questions about accessibility and language."
    session_id "proj_health_001"
    round 1
    total_per_round 8
    per_category_min 1
    per_category_max 3
    interview_time_limit 45
  } }
}

test GenerateQuestionSet_Validation_Mode {
  functions [GenerateQuestionSet]
  args { inputs {
    target_org "Early-stage SaaS startups"
    target_roles "Founders, Heads of Product"
    research_goal "Validate whether the onboarding problem is painful enough to pay for"
    research_goal_details "Focus on evidence for the four validation gates: pain, awareness, quantified impact, acting."
    assumptions "Teams are losing trial users during onboarding and already track the impact manually."
    unknowns "How do they measure churn today? What action do they take when onboarding fails?"
    custom_instructions "Keep prompts short and conversational."
    research_mode "validation"
    session_id "validation_sample_001"
    round 1
    total_per_round 12
    per_category_min 1
    per_category_max 3
    interview_time_limit 30
  } }
}

test GenerateExecutiveSummary_Pizza_Basic {
  functions [GenerateExecutiveSummary]
  args {
    research_goal "understand operational challenges for pizza shop owners"
    insights_content #"""
Pizza shop owners face three major operational challenges:

1. **Staff Scheduling**: Manual scheduling takes 3-5 hours weekly
2. **Inventory Waste**: 15-20% food waste due to poor forecasting
3. **Technology Overwhelm**: Current POS systems too complex

Key findings from 2 interviews with pizza shop owners.
"""#
    interview_content #"""
Tony (Pizza Palace, 8 years):
- Biggest challenge: finding reliable part-time staff
- Uses spreadsheets for everything
- Rush hour wait time complaints

Maria (Mama Mia's, 15 years):
- Family business struggling with rising costs
- Paper schedules, constant sick callouts
- Would pay for time-saving solutions
""#,
					custom_instructions ""
				}

}
