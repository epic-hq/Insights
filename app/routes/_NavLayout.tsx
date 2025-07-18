import { Outlet, useMatches } from "react-router"
import PageHeader from "~/components/navigation/PageHeader"

function _Breadcrumbs() {
	const matches = useMatches()
	const crumbs = matches
		// first get rid of any matches that don't have handle and crumb
		.filter((match) => Boolean(match.pathname))
		// now map them into an array of elements, passing the loader
		// data to each one
		.map((match) => (match.pathname as { crumb: (data: unknown) => React.ReactNode }).crumb(match.data))

	// consola.log("crumbs", crumbs, "matches: ", matches)

	return (
		<ol>
			{crumbs.map((crumb, index) => (
				<li key={index}>{crumb}</li>
			))}
		</ol>
	)
}

export default function NavLayout() {
	return (
		<div className="mx-auto max-w-[1440px] pt-4">
			{/* <_Breadcrumbs /> */}
			<PageHeader title="Opportunities" />
			<Outlet />
		</div>
	)
}
