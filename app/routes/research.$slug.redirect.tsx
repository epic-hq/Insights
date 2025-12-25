/**
 * Legacy redirect: /research/:slug -> /survey/:slug
 * Keeps backwards compatibility with old URLs
 */
import { type LoaderFunctionArgs, redirect } from "react-router"

export async function loader({ params }: LoaderFunctionArgs) {
	const { slug } = params
	if (!slug) {
		return redirect("/")
	}
	return redirect(`/survey/${slug}`)
}
