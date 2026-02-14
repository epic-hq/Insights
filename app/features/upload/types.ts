import type { InsightInsert, Interview } from "~/types";

export interface ProcessingResult {
	stored: InsightInsert[];
	interview: Interview;
}
