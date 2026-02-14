import type { MetaFunction } from "react-router";
import QuestionQualityDemo from "~/components/questions/QuestionQualityDemo";

export const meta: MetaFunction = () => {
	return [
		{ title: "Question Quality Evaluator - Test" },
		{ name: "description", content: "Test the question quality evaluation functionality" },
	];
};

export default function TestQuestionQuality() {
	return (
		<div className="min-h-screen bg-background">
			<div className="container mx-auto py-8">
				<div className="mb-8">
					<h1 className="font-bold text-3xl">Question Quality Evaluator</h1>
					<p className="mt-2 text-muted-foreground">
						Test the AI-powered question quality evaluation system for interview questions.
					</p>
				</div>
				<QuestionQualityDemo />
			</div>
		</div>
	);
}
