// Mock Supabase server client for Storybook only.
// Storybook aliases this module via .storybook/vite.config.ts so the real
// server implementation (which expects Request/cookies) never runs in the
// browser. Keep the API surface compatible with ~/lib/supabase/client.server.

const createMockSupabaseClient = () => ({
	from: () => ({
		select: () => ({
			eq: () => ({
				single: () => Promise.resolve({ data: null, error: null }),
				order: () => Promise.resolve({ data: [], error: null }),
			}),
			order: () => Promise.resolve({ data: [], error: null }),
		}),
	}),
	auth: {
		getSession: () =>
			Promise.resolve({ data: { session: null }, error: null }),
		getClaims: () => Promise.resolve({ data: null, error: null }),
	},
})

const mockClient = createMockSupabaseClient()

export const getServerClient = (_request: Request) => ({
	client: mockClient,
	headers: new Headers(),
})

export function createSupabaseAdminClient() {
	return createMockSupabaseClient()
}

export async function getAuthenticatedUser() {
	return null
}

export async function getSession() {
	return null
}

export const supabaseAnon = mockClient

export function getRlsClient() {
	return mockClient
}

export const supabaseAdmin = createSupabaseAdminClient()
export { supabaseAnon as db }
