import consola from "consola";
import type { LoaderFunctionArgs } from "react-router-dom";
import { useLoaderData } from "react-router-dom";

export async function loader({ params }: LoaderFunctionArgs) {
	consola.log("params", params);
	return {
		personaId: params.personaId,
		interviewId: params.interviewId,
	};
}

export default function InterviewRoute() {
	const { personaId, interviewId } = useLoaderData<typeof loader>();
	return (
		<div>
			<h1>Interview {interviewId}</h1>
			<p>Persona ID: {personaId}</p>
		</div>
	);
}
