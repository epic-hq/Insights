import { useSearchParams } from "react-router-dom";
import QuestionsScreen from "~/features/onboarding/components/QuestionsScreen";

export default function ProtectedQuestionsRoute() {
	const [params] = useSearchParams();
	const projectId = params.get("projectId") || undefined;

	// Render QuestionsScreen without the onboarding stepper.
	// Pass-through minimal props so user can generate/select questions immediately.
	return (
		<QuestionsScreen
			target_orgs={[]}
			target_roles={[]}
			research_goal=""
			research_goal_details=""
			assumptions={[]}
			unknowns={[]}
			onNext={() => {
				/* no-op: standalone usage does not advance */
			}}
			onBack={() => {
				history.back();
			}}
			showStepper={false}
			projectId={projectId}
		/>
	);
}
