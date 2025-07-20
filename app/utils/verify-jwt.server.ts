import { verifyJwt } from "@supabase/supabase-js"

const JWKS_URI = process.env.SUPABASE_JWKS_URL as string
if (!JWKS_URI) {
	throw new Error("Missing SUPABASE_JWKS_URL env")
}

export async function verifyUserJwt(token: string) {
	const { payload } = await verifyJwt(token, { jwksUri: JWKS_URI })
	return payload
}
