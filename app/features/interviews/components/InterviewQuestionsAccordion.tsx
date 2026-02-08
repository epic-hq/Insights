import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Database } from "~/../supabase/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Badge } from "~/components/ui/badge";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { getSupabaseClient } from "~/lib/supabase/client";

type EvidenceWithPeople = Database["public"]["Tables"]["evidence"]["Row"] & {
	evidence_people: Array<{
		person_id: string | null;
		people: {
			id: string | null;
			name: string | null;
		} | null;
	}> | null;
};

interface InterviewQuestionsAccordionProps {
	interviewId: string;
	projectId: string;
	accountId: string;
}

export function InterviewQuestionsAccordion({ interviewId, projectId, accountId }: InterviewQuestionsAccordionProps) {
	const routes = useProjectRoutes(`/a/${accountId}/${projectId}`);
	const supabase = getSupabaseClient();
	const [questions, setQuestions] = useState<EvidenceWithPeople[]>([]);

	useEffect(() => {
		const fetchQuestions = async () => {
			const { data: evidenceData, error } = await supabase
				.from("evidence")
				.select(`
					*,
					evidence_people (
						person_id,
						people (
							id,
							name
						)
					)
				`)
				.eq("interview_id", interviewId)
				.eq("is_question", true)
				.order("created_at", { ascending: true });

			if (error) {
				console.warn("Failed to fetch questions:", error.message);
				setQuestions([]);
				return;
			}

			setQuestions(evidenceData as EvidenceWithPeople[]);
		};

		fetchQuestions();
	}, [interviewId, supabase]);

	const questionsBySpeaker = useMemo(() => {
		const grouped: Record<string, EvidenceWithPeople[]> = {};

		questions.forEach((question) => {
			// Get speaker name from evidence_people junction
			const speakerName = question.evidence_people?.[0]?.people?.name || "Unknown Speaker";
			if (!grouped[speakerName]) {
				grouped[speakerName] = [];
			}
			grouped[speakerName].push(question);
		});

		return grouped;
	}, [questions]);

	const speakerNames = Object.keys(questionsBySpeaker).sort();

	if (speakerNames.length === 0) {
		return null;
	}

	return (
		<div className="mt-8">
			<div className="mb-4 flex items-center justify-between">
				<h3 className="font-semibold text-foreground text-lg">Questions Asked</h3>
				<Badge variant="secondary" className="text-xs">
					{questions.length} question{questions.length !== 1 ? "s" : ""}
				</Badge>
			</div>

			<Accordion type="multiple" className="w-full">
				{speakerNames.map((speakerName) => {
					const speakerQuestions = questionsBySpeaker[speakerName] || [];

					return (
						<AccordionItem key={speakerName} value={speakerName}>
							<AccordionTrigger className="text-left">
								<div className="flex items-center gap-2">
									<span className="font-medium">{speakerName}</span>
									<Badge variant="outline" className="text-xs">
										{speakerQuestions.length} question{speakerQuestions.length !== 1 ? "s" : ""}
									</Badge>
								</div>
							</AccordionTrigger>
							<AccordionContent>
								<div className="space-y-3">
									{speakerQuestions.map((question) => (
										<div key={question.id} className="rounded-md border bg-muted/30 p-3">
											<div className="flex items-start justify-between gap-2">
												<div className="flex-1">
													<p className="mb-2 text-foreground text-sm">
														{question.verbatim || question.chunk || "Question text"}
													</p>
													{question.gist && question.gist !== question.verbatim && (
														<p className="text-muted-foreground text-xs italic">{question.gist}</p>
													)}
												</div>
												<Link
													to={routes.evidence.detail(question.id)}
													className="font-medium text-blue-600 text-xs hover:text-blue-800"
												>
													View
												</Link>
											</div>
											{question.context_summary && (
												<div className="mt-2 border-muted border-t pt-2">
													<p className="text-muted-foreground text-xs">{question.context_summary}</p>
												</div>
											)}
										</div>
									))}
								</div>
							</AccordionContent>
						</AccordionItem>
					);
				})}
			</Accordion>
		</div>
	);
}
