import type { UIMessage } from "ai";
import type { InferMastraUITools } from "./ai-tool-type-helpers";
import { displayComponentTool } from "./tools/display-component";
import { displayInterviewPromptsTool } from "./tools/display-interview-prompts";
import { displayUserQuestionsTool } from "./tools/display-user-questions";
import { fetchInterviewContextTool } from "./tools/fetch-interview-context";
import { fetchProjectStatusContextTool } from "./tools/fetch-project-status-context";
import { navigateToPageTool } from "./tools/navigate-to-page";
import { recommendNextActionsTool } from "./tools/recommend-next-actions";
import { requestUserInputTool } from "./tools/request-user-input";
import { saveProjectSectionsDataTool } from "./tools/save-project-sections-data";
import { saveUserSettingsDataTool } from "./tools/save-usersettings-data";

// Example from https://ai-sdk.dev/docs/reference/ai-sdk-core/ui-message#creating-your-own-uimessage-type
// const metadataSchema = z.object({
//   someMetadata: z.string().datetime(),
// });

// type MyMetadata = z.infer<typeof metadataSchema>;

// const dataPartSchema = z.object({
//   someDataPart: z.object({}),
//   anotherDataPart: z.object({}),
// });

// type MyDataPart = z.infer<typeof dataPartSchema>;

export const tools = {
	displayComponent: displayComponentTool,
	displayInterviewPrompts: displayInterviewPromptsTool,
	displayUserQuestions: displayUserQuestionsTool,
	fetchProjectStatusContext: fetchProjectStatusContextTool,
	fetchInterviewContext: fetchInterviewContextTool,
	navigateToPage: navigateToPageTool,
	recommendNextActions: recommendNextActionsTool,
	requestUserInput: requestUserInputTool,
	saveUserSettingsData: saveUserSettingsDataTool,
	saveProjectSectionsData: saveProjectSectionsDataTool,
};

type UpsightTools = InferMastraUITools<typeof tools>;
type UpsightDataParts = {
	a2ui: {
		messages: Array<Record<string, unknown>>;
	};
	navigate: {
		path: string;
	};
	"tool-progress": {
		tool?: string;
		status?: string;
		message?: string;
		progress?: number;
	};
	network: {
		steps?: Array<{
			name?: string;
			status?: string;
		}>;
	};
	status: {
		status?: string;
		message?: string;
	};
};

export type UpsightMessage = UIMessage<Record<string, never>, UpsightDataParts, UpsightTools>;
