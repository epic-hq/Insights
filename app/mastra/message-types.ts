import type { UIMessage } from "ai"
import type { InferMastraUITools } from "./ai-tool-type-helpers"
import { displayUserQuestionsTool } from "./tools/display-user-questions"
import { fetchProjectStatusContextTool } from "./tools/fetch-project-status-context"
import { fetchInterviewContextTool } from "./tools/fetch-interview-context"
import { navigateToPageTool } from "./tools/navigate-to-page"
import { saveProjectSectionsDataTool } from "./tools/save-project-sections-data"
import { saveUserSettingsDataTool } from "./tools/save-usersettings-data"

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
        displayUserQuestions: displayUserQuestionsTool,
        fetchProjectStatusContext: fetchProjectStatusContextTool,
        fetchInterviewContext: fetchInterviewContextTool,
        navigateToPage: navigateToPageTool,
        saveUserSettingsData: saveUserSettingsDataTool,
        saveProjectSectionsData: saveProjectSectionsDataTool,
}

export type UpsightTools = InferMastraUITools<typeof tools>
export type UpsightMessage = UIMessage<{}, {}, UpsightTools>
