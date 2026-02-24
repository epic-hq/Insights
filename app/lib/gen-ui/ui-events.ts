import { z } from "zod";

const unknownRecordSchema = z.record(z.string(), z.unknown());
export const UI_EVENT_DISPATCH_TEXT = "[UIEventDispatch]";

export const canvasActionEventSchema = z.object({
	type: z.literal("canvas_action"),
	componentType: z.string().min(1),
	componentId: z.string().min(1),
	actionName: z.string().min(1),
	payload: unknownRecordSchema.nullish(),
	persisted: z.boolean().optional(),
	persistError: z.string().nullish(),
	source: z.enum(["canvas", "chat-inline"]).default("canvas"),
	occurredAt: z.string().datetime().optional(),
});

export const userInputEventSchema = z.object({
	type: z.literal("user_input"),
	prompt: z.string().min(1),
	promptKey: z.string().optional(),
	selectedIds: z.array(z.string()).default([]),
	freeText: z.string().nullish(),
	source: z.enum(["chat-inline"]).default("chat-inline"),
	occurredAt: z.string().datetime().optional(),
});

export const uiEventSchema = z.discriminatedUnion("type", [
	canvasActionEventSchema,
	userInputEventSchema,
]);

export const uiEventBatchSchema = z.array(uiEventSchema).min(1).max(20);

export type CanvasActionEvent = z.infer<typeof canvasActionEventSchema>;
export type UserInputEvent = z.infer<typeof userInputEventSchema>;
export type UiEvent = z.infer<typeof uiEventSchema>;
