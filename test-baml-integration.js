#!/usr/bin/env node

// Quick test script to verify BAML integration
import { b } from './baml_client/index.js'

async function testBAMLIntegration() {

  try {
    const questions = await b.GenerateResearchQuestions(
      'pizza shop owners',
      'small business owners',
      'understand operational challenges'
    )

    console.log('\n2. Testing GenerateQuickInsights...')
    const execsum = await b.GenerateExecutiveSummary(
      'understand operational challenges for pizza shops',
      'Staff scheduling takes 3-5 hours weekly. 15-20% food waste due to poor forecasting.',
      'Tony: biggest challenge is finding reliable staff. Maria: struggling with rising costs.'
    )
    console.log('✅ Quick insights generated:', {
      findings: execsum.key_findings?.length || 0,
      completion: execsum.completion_percentage,
      confidence: execsum.confidence
    })

    console.log('\n✅ All BAML functions working correctly!')

  } catch (error) {
    console.error('❌ BAML integration test failed:', error)
    process.exit(1)
  }
}

testBAMLIntegration()