import { Outlet } from "react-router-dom"
import MainNav from "~/components/navigation/MainNav"

export default function Layout() {
	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
			<MainNav />
			<main className="py-4">
				<Outlet />
			</main>
			<footer className="mt-auto border-gray-200 border-t py-4 dark:border-gray-800">
				<div className="mx-auto max-w-[1440px] px-4 text-center text-gray-500 text-sm dark:text-gray-400">
					<p>© {new Date().getFullYear()} Research Insights Platform</p>
				</div>
			</footer>
		</div>
	)
}
