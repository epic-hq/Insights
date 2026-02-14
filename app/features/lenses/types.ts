export type LensSeverity = "info" | "warning" | "critical";

export type LensEvidencePointer = {
	evidenceId: string;
	startMs: number | null;
	endMs: number | null;
	transcriptSnippet: string | null;
};

export type LensHygieneItem = {
	code: string;
	severity: LensSeverity;
	message?: string | null;
	slotLabel?: string | null;
};

export type LensSlotValue = {
	id: string;
	fieldKey: string;
	label: string | null;
	summary: string | null;
	textValue: string | null;
	numericValue: number | null;
	dateValue: string | null;
	status: string | null;
	confidence: number | null;
	ownerName: string | null;
	relatedNames: string[];
	evidenceCount: number;
	evidence: LensEvidencePointer[];
	hygiene: LensHygieneItem[];
};

export type LensStakeholder = {
	id: string;
	displayName: string;
	role: string | null;
	influence: "low" | "medium" | "high" | null;
	labels: string[];
	confidence: number | null;
	personId: string | null;
	personName: string | null;
	personKey: string | null;
	email: string | null;
	organizationName: string | null;
	evidence: LensEvidencePointer[];
};

export type LensObjection = {
	id: string;
	type: string;
	status: string;
	confidence: number | null;
	note?: string | null;
	evidence: LensEvidencePointer[];
};

export type LensNextStep = {
	id: string;
	description: string;
	ownerName: string | null;
	dueDate: string | null;
	confidence: number | null;
	evidence: LensEvidencePointer[];
};

export type LensMilestone = {
	id: string;
	label: string;
	ownerName: string | null;
	dueDate: string | null;
	status: "planned" | "in_progress" | "done";
	evidence: LensEvidencePointer[];
};

export type InterviewLensFrameworkName = "BANT_GPCT" | "SPICED" | "MEDDIC" | "MAP";

export type InterviewLensFramework = {
	name: InterviewLensFrameworkName;
	summaryId?: string;
	computedAt?: string | null;
	hygiene: LensHygieneItem[];
	slots: LensSlotValue[];
};

export type InterviewLensEntities = {
	stakeholders: LensStakeholder[];
	objections?: LensObjection[];
	nextSteps?: LensNextStep[];
	mapMilestones?: LensMilestone[];
};

export type InterviewLensView = {
	frameworks: InterviewLensFramework[];
	entities: InterviewLensEntities;
};
