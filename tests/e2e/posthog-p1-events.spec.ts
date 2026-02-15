/**
 * PostHog P1 Events - E2E Test Suite
 *
 * Verifies that all 4 Priority-1 PostHog server-side tracking events
 * are properly fired and contain correct properties.
 *
 * Prerequisites:
 * - Application running (local/staging)
 * - Test user account exists
 * - Test survey exists
 * - PostHog API key configured in env
 *
 * Run with:
 *   npx playwright test tests/e2e/posthog-p1-events.spec.ts
 */

import { chromium } from "playwright";
import { expect, test, type Page } from "playwright/test";

// Configuration
const TEST_CONFIG = {
	// Application URLs
	baseUrl: process.env.APP_URL || 'http://localhost:3000',

	// Test credentials
	testEmail: process.env.TEST_EMAIL || 'test+posthog@example.com',
	testPassword: process.env.TEST_PASSWORD || 'test-password-123',

	// Test survey (create one with slug 'test-posthog-events')
	surveySlug: process.env.TEST_SURVEY_SLUG || 'test-posthog-events',

	// PostHog config
	posthogApiKey: process.env.POSTHOG_KEY,
	posthogHost: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',

	// Timeouts
	eventTimeout: 10000, // 10 seconds to wait for events
	aiProcessingTimeout: 60000, // 60 seconds for AI analysis
};

/**
 * Helper: Intercept PostHog capture calls
 */
async function interceptPostHogEvents(page: Page): Promise<Array<any>> {
	const capturedEvents: Array<any> = [];

	await page.route('**/batch', async (route) => {
		const postData = route.request().postDataJSON();
		if (postData?.batch) {
			capturedEvents.push(...postData.batch);
		}
		await route.continue();
	});

	await page.route('**/capture', async (route) => {
		const postData = route.request().postDataJSON();
		if (postData) {
			capturedEvents.push(postData);
		}
		await route.continue();
	});

	return capturedEvents;
}

/**
 * Helper: Wait for specific event in captured events
 */
async function waitForEvent(
	events: Array<any>,
	eventName: string,
	timeout: number = TEST_CONFIG.eventTimeout
): Promise<any> {
	const startTime = Date.now();

	while (Date.now() - startTime < timeout) {
		const event = events.find((e) => e.event === eventName);
		if (event) return event;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	throw new Error(`Event "${eventName}" not found after ${timeout}ms. Captured: ${events.map(e => e.event).join(', ')}`);
}

/**
 * Helper: Login to application
 */
async function login(page: Page) {
	await page.goto(`${TEST_CONFIG.baseUrl}/auth/login`);
	await page.fill('input[type="email"]', TEST_CONFIG.testEmail);
	await page.fill('input[type="password"]', TEST_CONFIG.testPassword);
	await page.click('button[type="submit"]');

	// Wait for redirect after login
	await page.waitForURL(/\/a\//, { timeout: 10000 });
}

/**
 * Helper: Clear session cookie to force new session_started event
 */
async function clearSessionCookie(page: Page) {
	const context = page.context();
	await context.clearCookies({ name: 'last_session_date' });
}

// ==============================================================================
// Test Suite
// ==============================================================================

test.describe('PostHog P1 Events', () => {
	test.beforeEach(async () => {
		// Skip tests if PostHog not configured
		if (!TEST_CONFIG.posthogApiKey) {
			test.skip(true, 'POSTHOG_KEY not configured');
		}
	});

	// ============================================================================
	// Test 1: session_started
	// ============================================================================

	test('Event 1: session_started - fires on first login of the day', async ({ page }) => {
		const events: Array<any> = [];

		// Set up event interception
		await page.route('**/e', async (route) => {
			const postData = route.request().postDataJSON();
			if (postData?.event === 'session_started') {
				events.push(postData);
			}
			await route.continue();
		});

		// Clear session cookie to force new session
		await clearSessionCookie(page);

		// Login
		await login(page);

		// Wait for session_started event
		await page.waitForTimeout(2000); // Give time for event to fire

		// Verify event was captured
		expect(events.length).toBeGreaterThan(0);

		const sessionEvent = events[0];
		expect(sessionEvent.event).toBe('session_started');
		expect(sessionEvent.distinct_id).toBeTruthy();
		expect(sessionEvent.properties.session_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(sessionEvent.properties.timestamp).toBeTruthy();
	});

	test('Event 1: session_started - does NOT fire on same-day page refresh', async ({ page }) => {
		const events: Array<any> = [];

		await page.route('**/e', async (route) => {
			const postData = route.request().postDataJSON();
			if (postData?.event === 'session_started') {
				events.push(postData);
			}
			await route.continue();
		});

		// Login first time
		await clearSessionCookie(page);
		await login(page);
		await page.waitForTimeout(2000);

		const firstEventCount = events.length;
		expect(firstEventCount).toBe(1);

		// Refresh page - should NOT fire again
		await page.reload();
		await page.waitForTimeout(2000);

		expect(events.length).toBe(firstEventCount); // No new events
	});

	// ============================================================================
	// Test 2: survey_response_received
	// ============================================================================

	test('Event 2: survey_response_received - fires on survey completion', async ({ page }) => {
		let capturedEvent: any = null;

		// Intercept PostHog capture
		await page.route('**/e', async (route) => {
			const postData = route.request().postDataJSON();
			if (postData?.event === 'survey_response_received') {
				capturedEvent = postData;
			}
			await route.continue();
		});

		// Navigate to survey
		await page.goto(`${TEST_CONFIG.baseUrl}/ask/${TEST_CONFIG.surveySlug}`);

		// Fill out survey (adjust selectors based on your survey)
		await page.fill('input[type="email"]', `test+${Date.now()}@example.com`);
		await page.click('button:has-text("Continue")');

		// Wait for survey form
		await page.waitForSelector('textarea, input[type="text"]', { timeout: 5000 });

		// Fill first question (assuming text input)
		const firstInput = page.locator('textarea, input[type="text"]').first();
		await firstInput.fill('This is a test response for PostHog event verification');

		// Submit answer
		await page.click('button:has-text("Next"), button:has-text("Submit")');

		// Wait for completion
		await page.waitForSelector('text=/thank you|complete/i', { timeout: 10000 });

		// Wait for event to be sent
		await page.waitForTimeout(3000);

		// Verify event
		expect(capturedEvent).toBeTruthy();
		expect(capturedEvent.event).toBe('survey_response_received');
		expect(capturedEvent.properties.survey_id).toBeTruthy();
		expect(capturedEvent.properties.survey_name).toBeTruthy();
		expect(capturedEvent.properties.response_id).toBeTruthy();
		expect(capturedEvent.properties.response_mode).toMatch(/^(form|chat|voice)$/);
		expect(capturedEvent.properties.question_count).toBeGreaterThan(0);
		expect(typeof capturedEvent.properties.has_person).toBe('boolean');
	});

	test('Event 2: survey_response_received - tracks anonymous responses', async ({ page }) => {
		let capturedEvent: any = null;

		await page.route('**/e', async (route) => {
			const postData = route.request().postDataJSON();
			if (postData?.event === 'survey_response_received') {
				capturedEvent = postData;
			}
			await route.continue();
		});

		// Use anonymous survey URL if available
		const anonymousSurveySlug = process.env.TEST_ANONYMOUS_SURVEY_SLUG || TEST_CONFIG.surveySlug;
		await page.goto(`${TEST_CONFIG.baseUrl}/ask/${anonymousSurveySlug}`);

		// Fill and submit (no email required for anonymous)
		await page.waitForSelector('textarea, input[type="text"]', { timeout: 5000 });
		const firstInput = page.locator('textarea, input[type="text"]').first();
		await firstInput.fill('Anonymous test response');
		await page.click('button:has-text("Next"), button:has-text("Submit")');

		await page.waitForSelector('text=/thank you|complete/i', { timeout: 10000 });
		await page.waitForTimeout(3000);

		// Verify event captured with responseId as distinctId
		expect(capturedEvent).toBeTruthy();
		expect(capturedEvent.distinct_id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
		expect(capturedEvent.properties.has_person).toBe(false);
	});

	// ============================================================================
	// Test 3: survey_ai_analyzed
	// ============================================================================

	test('Event 3: survey_ai_analyzed - fires after AI processing', async ({ page }) => {
		const surveyEvent: any = { properties: {} };
		let aiEvent: any = null;

		// Capture both events
		await page.route('**/e', async (route) => {
			const postData = route.request().postDataJSON();
			if (postData?.event === 'survey_response_received') {
				Object.assign(surveyEvent, postData);
			}
			if (postData?.event === 'survey_ai_analyzed') {
				aiEvent = postData;
			}
			await route.continue();
		});

		// Complete survey with identified email
		await page.goto(`${TEST_CONFIG.baseUrl}/ask/${TEST_CONFIG.surveySlug}`);
		await page.fill('input[type="email"]', `test+${Date.now()}@example.com`);
		await page.click('button:has-text("Continue")');

		await page.waitForSelector('textarea', { timeout: 5000 });
		await page.fill('textarea', 'This is a detailed response to test AI evidence extraction');
		await page.click('button:has-text("Submit"), button:has-text("Next")');

		await page.waitForSelector('text=/thank you|complete/i', { timeout: 10000 });

		// Wait for AI processing (Trigger.dev task)
		console.log('Waiting for AI analysis... (up to 60s)');
		await page.waitForTimeout(TEST_CONFIG.aiProcessingTimeout);

		// Verify AI event was captured
		expect(aiEvent).toBeTruthy();
		expect(aiEvent.event).toBe('survey_ai_analyzed');
		expect(aiEvent.properties.response_id).toBe(surveyEvent.properties.response_id);
		expect(aiEvent.properties.evidence_count).toBeGreaterThan(0);
		expect(aiEvent.properties.text_questions_analyzed).toBeGreaterThan(0);
		expect(aiEvent.properties.analysis_method).toBe('extraction');
	}, TEST_CONFIG.aiProcessingTimeout + 20000); // Extended timeout

	// ============================================================================
	// Test 4: agent_message_sent
	// ============================================================================

	test('Event 4: agent_message_sent - fires after agent response', async ({ page }) => {
		let capturedEvent: any = null;

		await page.route('**/e', async (route) => {
			const postData = route.request().postDataJSON();
			if (postData?.event === 'agent_message_sent') {
				capturedEvent = postData;
			}
			await route.continue();
		});

		// Login
		await login(page);

		// Navigate to chat
		await page.goto(`${TEST_CONFIG.baseUrl}/a/*/chat`); // Adjust URL pattern

		// Wait for chat interface
		await page.waitForSelector('textarea[placeholder*="message"], input[placeholder*="message"]', { timeout: 10000 });

		// Send message to agent
		const chatInput = page.locator('textarea[placeholder*="message"], input[placeholder*="message"]').first();
		await chatInput.fill('What are my top themes?');
		await chatInput.press('Enter');

		// Wait for agent response to complete
		await page.waitForSelector('text=/theme|evidence|insight/i', { timeout: 30000 });
		await page.waitForTimeout(3000); // Give time for event to fire

		// Verify event
		expect(capturedEvent).toBeTruthy();
		expect(capturedEvent.event).toBe('agent_message_sent');
		expect(capturedEvent.properties.agent_id).toBeTruthy();
		expect(capturedEvent.properties.agent_name).toBeTruthy();
		expect(capturedEvent.properties.thread_id).toBeTruthy();
		expect(capturedEvent.properties.message_type).toBe('assistant');
		expect(typeof capturedEvent.properties.tool_calls).toBe('number');
		expect(Array.isArray(capturedEvent.properties.tools_used)).toBe(true);
	});

	test('Event 4: agent_message_sent - includes tool usage', async ({ page }) => {
		let capturedEvent: any = null;

		await page.route('**/e', async (route) => {
			const postData = route.request().postDataJSON();
			if (postData?.event === 'agent_message_sent') {
				capturedEvent = postData;
			}
			await route.continue();
		});

		await login(page);
		await page.goto(`${TEST_CONFIG.baseUrl}/a/*/chat`);

		await page.waitForSelector('textarea[placeholder*="message"], input[placeholder*="message"]');

		// Ask question that requires tools
		const chatInput = page.locator('textarea[placeholder*="message"], input[placeholder*="message"]').first();
		await chatInput.fill('Show me recent evidence');
		await chatInput.press('Enter');

		await page.waitForTimeout(10000); // Wait for response

		// Verify tools were used
		expect(capturedEvent).toBeTruthy();
		expect(capturedEvent.properties.tool_calls).toBeGreaterThan(0);
		expect(capturedEvent.properties.tools_used.length).toBeGreaterThan(0);

		// Check for common tools
		const toolsUsed = capturedEvent.properties.tools_used;
		const hasEvidenceTool = toolsUsed.some((tool: string) =>
			tool.includes('Evidence') || tool.includes('evidence')
		);
		expect(hasEvidenceTool).toBe(true);
	});

	// ============================================================================
	// Cross-Event Validation
	// ============================================================================

	test('Full Flow: Session → Chat → Survey → AI', async ({ page }) => {
		const events: Array<any> = [];

		// Capture all events
		await page.route('**/e', async (route) => {
			const postData = route.request().postDataJSON();
			if (postData?.event) {
				events.push(postData);
			}
			await route.continue();
		});

		// 1. Start session
		await clearSessionCookie(page);
		await login(page);
		await page.waitForTimeout(2000);

		// Verify session_started
		const sessionEvent = events.find(e => e.event === 'session_started');
		expect(sessionEvent).toBeTruthy();

		// 2. Chat with agent
		await page.goto(`${TEST_CONFIG.baseUrl}/a/*/chat`);
		const chatInput = page.locator('textarea[placeholder*="message"], input[placeholder*="message"]').first();
		await chatInput.fill('Hello');
		await chatInput.press('Enter');
		await page.waitForTimeout(5000);

		// Verify agent_message_sent
		const agentEvent = events.find(e => e.event === 'agent_message_sent');
		expect(agentEvent).toBeTruthy();

		// 3. Complete survey
		await page.goto(`${TEST_CONFIG.baseUrl}/ask/${TEST_CONFIG.surveySlug}`);
		await page.fill('input[type="email"]', `test+${Date.now()}@example.com`);
		await page.click('button:has-text("Continue")');
		await page.waitForSelector('textarea');
		await page.fill('textarea', 'Test response for full flow');
		await page.click('button:has-text("Submit")');
		await page.waitForSelector('text=/thank you/i');
		await page.waitForTimeout(3000);

		// Verify survey_response_received
		const surveyEvent = events.find(e => e.event === 'survey_response_received');
		expect(surveyEvent).toBeTruthy();

		// 4. Wait for AI analysis
		await page.waitForTimeout(TEST_CONFIG.aiProcessingTimeout);

		// Verify survey_ai_analyzed
		const aiEvent = events.find(e => e.event === 'survey_ai_analyzed');
		expect(aiEvent).toBeTruthy();

		// Verify all 4 events present
		const eventTypes = events.map(e => e.event);
		expect(eventTypes).toContain('session_started');
		expect(eventTypes).toContain('agent_message_sent');
		expect(eventTypes).toContain('survey_response_received');
		expect(eventTypes).toContain('survey_ai_analyzed');

		console.log(`✅ Full flow complete: ${events.length} events captured`);
		console.log('Event sequence:', eventTypes);
	}, TEST_CONFIG.aiProcessingTimeout + 30000);
});

// ==============================================================================
// Helper Tests for Debugging
// ==============================================================================

test.describe('PostHog Debug Tests', () => {
	test.skip('Debug: List all PostHog events captured', async ({ page }) => {
		const events: Array<any> = [];

		await page.route('**/e', async (route) => {
			const postData = route.request().postDataJSON();
			if (postData) {
				events.push(postData);
				console.log('📊 Event captured:', postData.event, postData.properties);
			}
			await route.continue();
		});

		await login(page);
		await page.waitForTimeout(5000);

		console.log(`\n📈 Total events captured: ${events.length}`);
		events.forEach((e, i) => {
			console.log(`${i + 1}. ${e.event}`, JSON.stringify(e.properties, null, 2));
		});
	});

	test.skip('Debug: Check PostHog client initialization', async ({ page }) => {
		await page.goto(TEST_CONFIG.baseUrl);

		const posthogExists = await page.evaluate(() => {
			return typeof (window as any).posthog !== 'undefined';
		});

		console.log('PostHog client loaded:', posthogExists);

		if (posthogExists) {
			const config = await page.evaluate(() => {
				const ph = (window as any).posthog;
				return {
					api_host: ph.config?.api_host,
					loaded: ph.__loaded,
				};
			});
			console.log('PostHog config:', config);
		}
	});
});
