# ICP Discovery - User Guide

## What is ICP Discovery?

**ICP (Ideal Customer Profile)** is a highly specific, data-driven description of the perfect type of customer that would derive maximum value from your solution and provide maximum value (profitability, retention) in return.

Unlike broad market segments, an ICP combines:
- **Person attributes**: Job function, seniority level, goals, behaviors
- **Organization attributes**: Industry, company stage, size, revenue
- **Pain intensity**: What problems they face and how badly
- **Fit score**: How well they align with your solution (bullseye score)

## The ICP Discovery Workflow

### 1. **Gather Research Data**
- Upload and transcribe customer interviews
- System extracts people, their attributes (facets), and pain points
- Each person gets:
  - Person facets: job_function, seniority_level, department, etc.
  - Org facets: industry, company_stage, company_size, etc.
  - Bullseye score: 0-10 rating of fit with your product

### 2. **Analyze Pain × Segments (ICP Discovery Page)**

Navigate to the **ICP Discovery** page to see:

#### Pain Matrix Visualization
- **Y-axis**: Pain themes (problems customers face)
- **X-axis**: Customer segments (grouped by facets)
- **Cell intensity**: How much that segment experiences that pain
- **Filter by segment**: Click segment pills to focus on specific groups

This answers: *"Which customer groups experience which pains most intensely?"*

#### ICP Recommendations (AI-Powered)

Click **"Generate ICP Recommendations"** to have the system analyze all your data and identify:

**Top 5 ICP Candidates** ranked by:
- **Bullseye Score**: How well they fit your solution (higher = better)
- **Market Size**: How many people match this profile (larger = more opportunity)
- **Pain Intensity**: What problems they're experiencing (helps prioritize features)

Each recommendation shows:
- **Name**: e.g., "VP Engineering at Series B SaaS"
- **Market Size**: Number of people who match this profile
- **Avg Bullseye**: Average fit score (0-10)
- **Top Pains**: Most common pain themes for this group

**The Algorithm:**
```
ICP Score = Avg Bullseye × log(Market Size + 1)
```

This balances quality (fit) with quantity (market opportunity).

### 3. **Create Personas from ICPs**

For each ICP recommendation, click **"Create Persona from This"**.

The system automatically:
1. ✅ Creates a new persona with the ICP name
2. ✅ Adds description with stats and top pains
3. ✅ **Auto-populates the persona** with all people who match the facet criteria
4. ✅ Stores the facet criteria so future people can be automatically assigned
5. ✅ Links to relevant evidence, themes, and interviews

Now you have a **living persona** that:
- Represents a specific, validated customer segment
- Is backed by real interview data
- Includes actual people you can contact
- Can be used for targeting, feature prioritization, and messaging

### 4. **Use Personas for Product Decisions**

With your ICP-based personas, you can:

#### View Persona Details
- See all people who match this ICP
- Review their pain points and evidence
- Understand their goals and behaviors
- Track their bullseye fit over time

#### Prioritize Features
- Which pains should we solve first?
- Which features will impact the most valuable customers?
- What messaging will resonate with this ICP?

#### Refine Your ICP
- Add/remove people manually
- Adjust facet criteria as you learn
- Regenerate recommendations as new interviews come in

## Understanding the Components

### Facets (Attributes)
Categorical attributes used to segment customers:

**Person Facets:**
- job_function (e.g., Engineering, Product, Sales)
- seniority_level (e.g., IC, Manager, VP, C-Level)
- department
- role_type

**Org Facets:**
- industry (e.g., SaaS, Healthcare, Fintech)
- company_stage (e.g., Seed, Series A, Series B, Enterprise)
- company_size (e.g., 1-10, 11-50, 51-200, 201-500, 500+)
- revenue_range
- company_type (B2B, B2C, B2B2C)

### Bullseye Score
A 0-10 rating of how well a person/company fits your ideal customer profile, based on:
- Problem-solution fit
- Willingness to pay
- Company characteristics
- Buying authority
- Budget availability

Higher scores = better fit = higher priority customers.

### Pain Themes
Recurring problems or frustrations extracted from interviews, tagged with:
- Intensity: How painful (1-10)
- Frequency: How often mentioned
- Evidence: Specific quotes and examples

## B2C vs B2B

### B2B Use Case
ICPs combine person + organization:
- "VP Engineering at Series B SaaS companies"
- "Product Manager at Healthcare companies with 200+ employees"

### B2C Use Case
ICPs focus on person attributes only:
- "Parents with children under 5"
- "Tech-savvy early adopters in urban areas"

### Exploratory Research
When org attributes are unknown, the system:
- Groups by person facets only
- Shows recommendations based on available data
- Allows you to add org context later as you learn

## Tips for Success

### 1. **Start with Rich Data**
- Conduct 10+ interviews before generating ICPs
- Ensure people have facets tagged
- Complete bullseye scoring

### 2. **Validate Recommendations**
- Don't blindly accept the top ICP
- Review the people in each group
- Consider strategic factors (TAM, competition, access)

### 3. **Iterate**
- Regenerate ICPs as you gather more data
- Refine personas based on new learnings
- Track how ICPs evolve over time

### 4. **Combine with Pain Matrix**
- Use segment filters to deep-dive into specific groups
- Validate that top ICPs actually have painful problems
- Ensure you can solve their pains profitably

## Example Workflow

### Scenario: B2B SaaS Analytics Tool

1. **Research Phase**
   - Interviewed 25 potential customers
   - 15 from Series A/B SaaS companies
   - 10 from Enterprise companies

2. **ICP Discovery**
   - Generated recommendations
   - Top ICP: "VP Engineering at Series B SaaS" (8 people, 8.2 bullseye)
     - Top Pains: "Hard to debug production issues", "Manual data analysis"
   - Second: "Data Analyst at Enterprise SaaS" (6 people, 7.5 bullseye)
     - Top Pains: "No unified dashboard", "Slow query performance"

3. **Decision**
   - Create persona from top ICP (better fit, growing market)
   - Deprioritize Enterprise segment (longer sales cycle, custom needs)

4. **Product Impact**
   - Focus next sprint on production debugging features
   - Write messaging targeting VP Engineering pain points
   - Sales focuses on Series B SaaS companies

## Frequently Asked Questions

### When should I regenerate ICP recommendations?
- After every 5-10 new interviews
- When entering a new market
- When strategic priorities change
- Every quarter as a review

### Can I have multiple ICPs?
Yes! Most companies have 2-3 primary ICPs. Create personas for each and track them separately.

### What if the recommendations don't make sense?
This means:
- Not enough data yet (need more interviews)
- Bullseye scores not calibrated
- Facets not consistently tagged
- Your market is truly fragmented (no clear winner)

### How is this different from personas?
- **Traditional Personas**: Fictional, static, based on assumptions
- **ICP-Based Personas**: Real, dynamic, backed by interview data and metrics

### Can I manually create personas without ICP recommendations?
Yes! The "New Persona" button still works. But ICP recommendations help you discover data-driven segments you might miss.

## Next Steps

1. Navigate to **ICP Discovery** page
2. Review the pain matrix to understand your landscape
3. Click **"Generate ICP Recommendations"**
4. Create personas from top recommendations
5. Use those personas to prioritize product decisions

---

*Need help? See [Understanding Bullseye Scores](./bullseye-scores.md) or [Working with Personas](./personas-guide.md)*
