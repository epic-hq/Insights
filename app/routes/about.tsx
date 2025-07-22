export default function AboutPage() {
	// const { user, loading } = useAuth()
	// const navigate = useNavigate()

	// useEffect(() => {
	// 	if (!loading && user) {
	// 		// If already authenticated, send the user to the main dashboard
	// 		navigate("/", { replace: true })
	// 	}
	// }, [user, loading, navigate])

	// if (loading) return null

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-900">
			<div className="w-full max-w-md space-y-8">
				<h1>About</h1>
				<h2 className="text-center font-bold text-2xl text-gray-900 tracking-tight dark:text-white">
					Distill critical insights quickly from interviews and conversations
				</h2>
			</div>
		</div>
	)
}
