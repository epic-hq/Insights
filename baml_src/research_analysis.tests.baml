test GenerateQuestionSet_Pizza_Needs {
  functions [GenerateQuestionSet]
  args { inputs {
			target_org "mom and pop pizza shops"
			target_roles "small business owners"
			research_goal "needs"
			research_goal_details ""
			assumptions ""
			unknowns ""
			custom_instructions ""
  }
}
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
			interview_time_limit "30 minutes"
	 }
	  }
}

test GenerateQuestionSet_Custom_Instructions {
  functions [GenerateQuestionSet]
  args { inputs {
    target_org "Regional nonprofit hospital network (6 clinics, 450-bed hospital)",
    target_roles "Patients (outpatient), Front-desk staff, Nurses, Primary-care physicians",
    research_goal "Improve patient intake and follow-up experience",
    research_goal_details "Reduce waiting time, clarify instructions, and raise follow-up adherence for chronic care patients (diabetes, hypertension).",
    assumptions "Patients miss follow-ups due to confusing discharge instructions; staff tools are fragmented.",
    unknowns "Which steps create the most confusion? How do staff prioritize time? What would increase adherence?",
    custom_instructions "Favor plain language for patients 8th-grade reading level; include at least 2 questions about accessibility and language.",
    session_id "proj_health_001",
    round 1,
    total_per_round 8,
    per_category_min 1,
    per_category_max 3
  }
	}
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