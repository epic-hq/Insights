import consola from "consola"
import { Outlet, useParams } from "react-router-dom"

export default function Accounts() {
	const params = useParams()
	consola.log("Accounts Params:", params)

	return <Outlet />
}
