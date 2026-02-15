import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const target = url.search ? `/customer-discovery${url.search}` : "/customer-discovery";
	return redirect(target, { status: 301 });
}

export default function CustomerInterviewsRedirect() {
	return null;
}
