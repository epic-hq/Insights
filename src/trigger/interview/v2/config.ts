export const workflowRetryConfig = {
	maxAttempts: 3,
	factor: 1.8,
	minTimeoutInMs: 500,
	maxTimeoutInMs: 30_000,
	randomize: false,
}
