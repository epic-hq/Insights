// Mock Supabase server client for Storybook

export const getServerClient = (_request: Request) => {
	// Return a mock supabase client
	const mockClient = {
		from: () => ({
			select: () => ({
				eq: () => ({
					single: () => Promise.resolve({ data: null, error: null }),
					order: () => Promise.resolve({ data: [], error: null }),
				}),
				order: () => Promise.resolve({ data: [], error: null }),
			}),
		}),
	}

	return {
		client: mockClient,
		headers: new Headers(),
	}
}

export function createSupabaseAdminClient() {
	// Return a mock admin client
	return {
		from: () => ({
			select: () => ({
				eq: () => ({
					single: () => Promise.resolve({ data: null, error: null }),
					order: () => Promise.resolve({ data: [], error: null }),
				}),
				order: () => Promise.resolve({ data: [], error: null }),
			}),
		}),
	}
}
