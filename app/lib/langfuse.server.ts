import { Langfuse } from "langfuse";

let langfuseInstance: Langfuse | null = null;

export function getLangfuseClient(): Langfuse {
	if (!langfuseInstance) {
		if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
			console.warn("Langfuse API keys not found. Tracing will be disabled.");
			// Return a mock client that does nothing
			return {
				trace: () => ({
					end: () => {},
					generation: () => ({
						end: () => {},
					}),
				}),
			} as unknown as Langfuse;
		}

		langfuseInstance = new Langfuse({
			publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
			secretKey: process.env.LANGFUSE_SECRET_KEY!,
			baseUrl: process.env.LANGFUSE_HOST || process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
		});
	}

	return langfuseInstance;
}
