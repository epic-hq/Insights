#!/usr/bin/env node

// Quick test script to verify BAML integration
import { b } from "./baml_client/index.js"

async function testBAMLIntegration() {
	try {
		const _questions = await b.GenerateResearchQuestions(
			"pizza shop owners",
			"small business owners",
			"understand operational challenges"
		)
		const _execsum = await b.GenerateExecutiveSummary(
			"understand operational challenges for pizza shops",
			"Staff scheduling takes 3-5 hours weekly. 15-20% food waste due to poor forecasting.",
			"Tony: biggest challenge is finding reliable staff. Maria: struggling with rising costs."
		)
	} catch (_error) {
		process.exit(1)
	}
}

testBAMLIntegration()
