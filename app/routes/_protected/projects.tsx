import consola from "consola"
import { Outlet, useParams } from "react-router-dom"

export default function Projects() {
	const params = useParams()
	consola.log("Project Params:", params)

	return <Outlet />
}
