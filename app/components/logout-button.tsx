"use client"

import { useNavigate } from "react-router"
import { Button } from "~/components/ui/button"
import { createClient } from "~/lib/supabase/client"

export function LogoutButton() {
	const navigate = useNavigate()

	const logout = async () => {
		const supabase = createClient()
		await supabase.auth.signOut()
		navigate("/auth/login")
	}

	return <Button onClick={logout}>Logout</Button>
}
