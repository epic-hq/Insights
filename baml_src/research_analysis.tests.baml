test GenerateResearchQuestions_Pizza_Needs {
  functions [GenerateResearchQuestions]
  args {
    icp "mom and pop pizza shops"
    role "small business owners"
    research_goal "needs"
    custom_instructions ""
  }
}

test GenerateResearchQuestions_SaaS_Willingness {
  functions [GenerateResearchQuestions]
  args {
    icp "early-stage SaaS companies"
    role "founding engineers"
    research_goal "willingness"
		custom_instructions ""
  }
}

test GenerateResearchQuestions_Custom_Instructions {
  functions [GenerateResearchQuestions]
  args {
    icp "pizza shop owners"
    role "owner-chefs"
    research_goal "needs"
    custom_instructions "Focus on pricing and cost management questions"
  }
}

test GenerateQuickInsights_Pizza_Basic {
  functions [GenerateQuickInsights]
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
"""#
  }
}