export type QuestionStatus =
	| "proposed"
	| "asked"
	| "answered"
	| "skipped"
	| "rejected"
	| "selected"
	| "backup"
	| "deleted"

export interface Question {
	id: string
	text: string
	categoryId: string
	scores: { importance: number; goalMatch: number; novelty: number }
	rationale?: string
	status: QuestionStatus
	timesAnswered: number
	source?: "ai" | "user"
	isMustHave?: boolean
	qualityFlag?: {
		assessment: "red" | "yellow" | "green"
		score: number
		description: string
		color?: string
	}
	estimatedMinutes?: number
	selectedOrder?: number | null
	isSelected?: boolean
	backlog?: boolean
}
