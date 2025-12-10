/**
 * Conversation Lens Tasks
 *
 * Auto-apply all system lenses to interviews after processing.
 */

export { applyLensTask, type ApplyLensPayload } from "./applyLens"
export { applyAllLensesTask, type ApplyAllLensesPayload, type ApplyAllLensesResult } from "./applyAllLenses"
export { synthesizeLensSummaryTask, type SynthesizeLensSummaryPayload } from "./synthesizeLensSummary"
export { applyQALensTask, type ApplyQALensPayload } from "./applyQALens"
