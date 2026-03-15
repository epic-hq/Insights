import { useChat } from "@ai-sdk/react";
import { convertMessages } from "@mastra/core/agent";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import consola from "consola";
import { Brain, Check, Loader, Pencil, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { data, useNavigate, useRouteLoaderData } from "react-router";
import { Streamdown } from "streamdown";
import { Conversation, ConversationContent, ConversationScrollButton } from "~/components/ai-elements/conversation";
import { Message, MessageContent } from "~/components/ai-elements/message";
import { PromptInput, PromptInputSubmit, PromptInputTextarea } from "~/components/ai-elements/prompt-input";
import { Response as AiResponse } from "~/components/ai-elements/response";
import { Task, TaskContent, TaskTrigger } from "~/components/ai-elements/task";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { TextShimmer } from "~/components/ui/text-shimmer";
import { AudioRecorder } from "~/features/voice/audio-recorder";
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/client.server";
import { cn } from "~/lib/utils";
import { memory } from "~/mastra/memory";
import type { UpsightMessage } from "~/mastra/message-types";
import { SignupDataWatcher } from "../components/SignupDataWatcher";
import type { Route } from "./+types/ai-sdk-chat";

type SignupData = Record<string, unknown> & {
	completed?: boolean;
};

type ToolPartView = {
	type: string;
	text?: string;
	state?: string;
	input?: Record<string, unknown>;
	output?: Record<string, unknown>;
};

function asSignupData(value: unknown): SignupData | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	return value as SignupData;
}

function asToolPartView(value: unknown): ToolPartView {
	return (value ?? {}) as ToolPartView;
}

function getQuestions(part: ToolPartView): string[] {
	const questions = part.input?.questions;
	return Array.isArray(questions) ? questions.filter((question): question is string => typeof question === "string") : [];
}

function getOutputData(part: ToolPartView): Record<string, unknown> | null {
	const data = part.output?.data;
	if (!data || typeof data !== "object" || Array.isArray(data)) return null;
	return data as Record<string, unknown>;
}

function getStringValue(data: Record<string, unknown> | null, key: string): string | null {
	const value = data?.[key];
	return typeof value === "string" && value.length > 0 ? value : null;
}

function getBooleanValue(data: Record<string, unknown> | null, key: string): boolean | null {
	const value = data?.[key];
	return typeof value === "boolean" ? value : null;
}

export async function loader({ context, request }: LoaderFunctionArgs) {
	const { user } = await getAuthenticatedUser(request);
	if (!user) {
		throw new Response("Unauthorized", { status: 401 });
	}

	const { client: supabase } = getServerClient(request);
	// Basic usage with default parameters
	const result = await memory.listThreads({
		filter: { resourceId: `signupAgent-${user.sub}` },
		orderBy: { field: "createdAt", direction: "DESC" },
		page: 0,
		perPage: 100,
	});

	consola.log("Result: ", result);
	let threadId = "";

	if (!(result?.total > 0)) {
		const newThread = await memory.createThread({
			resourceId: `signupAgent-${user.sub}`,
			title: "Signup Chat",
			metadata: {
				user_id: user.sub,
			},
		});
		consola.log("New thread created: ", newThread);
		threadId = newThread.id;
	} else {
		threadId = result.threads[0].id;
	}

	// Get messages in the V2 format (roughly equivalent to AI SDK's UIMessage format)
	const { messages } = await memory.recall({
		threadId: threadId,
		perPage: 50,
	});
	const aiv5Messages = convertMessages(messages).to("AIV5.UI") as UpsightMessage[];

	// Get existing chat data from user_settings
	const { data: userSettings } = await supabase
		.from("user_settings")
		.select("signup_data")
		.eq("user_id", user.sub)
		.single();

	const existingChatData = asSignupData(userSettings?.signup_data);

	return data({
		messages: aiv5Messages,
		existingChatData,
		user,
		threadId,
	});
}

export default function SignupChat({ loaderData }: Route.ComponentProps) {
	const { messages: initialMessages, existingChatData, user } = loaderData;
	const [input, setInput] = useState("");
	const [prompts, _setPrompts] = useState<string[]>(["I'm on home page"]);
	const navigate = useNavigate();

	// Ai SDK chat
	const { messages, sendMessage, status, addToolResult } = useChat<UpsightMessage>({
		transport: new DefaultChatTransport({
			api: "/api/chat/signup",
			body: () => ({
				system: prompts ? prompts.join("\n\n") : null,
			}),
		}),
		messages: initialMessages,
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,

		// run client-side tools that are automatically executed:
		async onToolCall({ toolCall }) {
			// Check if it's a dynamic tool first for proper type narrowing
			if (toolCall.dynamic) {
				return;
			}

				if (toolCall.toolName === "navigateToPage") {
					consola.log("Navigating to page: ", toolCall.input);
					const toolInput = toolCall.input as { path?: string } | undefined;
					const path = typeof toolInput?.path === "string" ? toolInput.path : undefined;
					if (!path) return;
					navigate(path);
				// No await - avoids potential deadlocks
				addToolResult({
					tool: "navigateToPage",
					toolCallId: toolCall.toolCallId,
					output: true,
				});
			}
		},
	});

	// Onboarding data
	const [_onboardingData, setOnboardingData] = useState<SignupData | undefined>(existingChatData);
	const [chatCompleted, setChatCompleted] = useState(Boolean(existingChatData?.completed === true));
	const rootData = useRouteLoaderData("root") as { clientEnv?: Record<string, unknown> } | undefined;
	const clientEnv = rootData?.clientEnv;
	const chatRequired = Boolean(clientEnv?.SIGNUP_CHAT_REQUIRED === "true");
	// If signup chat is not required, or it's already completed, send users home immediately.
	useEffect(() => {
		if (!chatRequired) {
			navigate("/home");
		} else if (chatCompleted) {
			navigate("/signup-chat/completed");
		}
	}, [chatCompleted, navigate, chatRequired]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (input.trim()) {
			sendMessage({ text: input });
			setInput("");
		}
	};

	// Ref for auto-focusing the input
	const inputRef = useRef<HTMLTextAreaElement>(null);

	// Auto-focus the input when the assistant finishes responding
	useEffect(() => {
		if (status === "ready" && inputRef.current) {
			inputRef.current.focus();
		}
	}, [status, messages.length]);

	return (
		<div className="relative mx-auto flex size-full h-dvh max-w-6xl flex-col rounded-lg px-2 md:flex-row md:px-4">
			{/* <div className="grid h-dvh grid-cols-1 gap-x-2 px-4 pt-16 pb-4 md:grid-cols-[200px_1fr] md:pt-4 lg:grid-cols-[400px_1fr]"> */}
			<div className="w-full md:w-1/3">
				<SignupDataWatcher
					userId={user?.sub}
					data={existingChatData}
					onDataUpdate={(data) => {
						consola.log("onDataUpdate", data);
						setOnboardingData(data);
					}}
					onCompleted={() => setChatCompleted(true)}
				/>
			</div>
			<div className="flex h-full w-full flex-col md:w-2/3">
				<Conversation>
					<ConversationContent>
						{messages?.map((message) => (
							<Message from={message.role} key={message.id}>
								<MessageContent>
										{message?.parts?.map((part, i) => {
											const toolPart = asToolPartView(part);
											const outputData = getOutputData(toolPart);
											switch (toolPart.type) {
												case "tool-updateWorkingMemory":
													return (
														<Task key={i}>
															<TaskTrigger title="Update Working Memory" icon={<Brain className="size-4" />} />
															<TaskContent>
																<Streamdown className="rounded-2xl bg-white p-2">
																	{typeof toolPart.input?.memory === "string" ? toolPart.input.memory : ""}
																</Streamdown>
															</TaskContent>
														</Task>
													);
												case "tool-displayUserQuestions":
													switch (toolPart.state) {
														case "input-streaming":
															return <Loader />;
														case "input-available":
														return (
															<Card>
																<CardHeader>
																	<CardTitle>Research Questions</CardTitle>
																</CardHeader>
																<CardContent>
																	{getQuestions(toolPart).map((question, i) => (
																		<div key={i}>{question}</div>
																	))}
																</CardContent>
															</Card>
														);
													case "output-available":
														return (
															<Card>
																z
																<CardHeader>
																	<CardTitle className="flex items-center gap-2">
																		<Check /> Research Questions
																	</CardTitle>
																</CardHeader>
																<CardContent>
																	{getQuestions(toolPart).map((question, i) => (
																		<div key={i}>{question}</div>
																	))}
																</CardContent>
															</Card>
														);
												}
											case "tool-saveUserSettingsData":
													return (
														<Task className="rounded-lg border p-4">
															<TaskTrigger title="Saved details" icon={<Pencil className="size-4" />} />
															<TaskContent>
																{getStringValue(outputData, "challenges") && (
																	<div>
																		<span className="font-bold">Challenges:</span> {getStringValue(outputData, "challenges")}
																	</div>
																)}
																{getStringValue(outputData, "content_types") && (
																	<div>
																		<span className="font-bold">Content Types:</span> {getStringValue(outputData, "content_types")}
																	</div>
																)}
																{getStringValue(outputData, "goal") && (
																	<div>
																		<span className="font-bold">Goal:</span> {getStringValue(outputData, "goal")}
																	</div>
																)}
																{getStringValue(outputData, "other_feedback") && (
																	<div>
																		<span className="font-bold">Other Feedback:</span>{" "}
																		{getStringValue(outputData, "other_feedback")}
																	</div>
																)}
																{getBooleanValue(outputData, "completed") !== null && (
																	<div className="flex items-center gap-2">
																		<span className="font-bold">Completed:</span>{" "}
																		{getBooleanValue(outputData, "completed") ? (
																			<Check className="size-4 text-emerald-500" />
																		) : (
																			<X className="size-4" />
																		)}
																	</div>
																)}
															</TaskContent>
														</Task>
													);
												case "tool-saveProjectSectionsData":
													return (
														<Task className="rounded-lg border p-4">
															<TaskTrigger title="Save sections" icon={<Pencil className="size-4" />} />
															<TaskContent>{getStringValue(toolPart.output ?? null, "message") ?? ""}</TaskContent>
														</Task>
													);
												case "text": // we don't use any reasoning or tool calls in this example
													return <AiResponse key={`${message.id}-${i}`}>{toolPart.text ?? ""}</AiResponse>;
											default:
												return null;
										}
									})}
								</MessageContent>
							</Message>
						))}
					</ConversationContent>
					<ConversationScrollButton />
				</Conversation>

				<div className="flex flex-row justify-between gap-2">
					<AudioRecorder
						onAfterTranscription={(transcription) => {
							console.log("transcription", transcription);
							// setInput((prev) => prev?.trim() ? prev + "\n" + transcription : transcription)
							if (transcription.trim()) {
								sendMessage({ text: transcription });
								// setInput("")
							}
						}}
					/>
					<span>
						<TextShimmer
							className={cn(
								"mt-1 hidden font-mono text-sm",
								status === "streaming" || (status === "submitted" && "block")
							)}
							duration={3}
						>
							Thinking...
						</TextShimmer>
						<div className={cn("mt-1 hidden font-mono text-destructive text-sm", status === "error" && "block")}>
							Error
						</div>
					</span>
				</div>
				<PromptInput onSubmit={handleSubmit} className="relative mx-auto mt-1 mb-6 w-full max-w-2xl">
					<PromptInputTextarea
						ref={inputRef}
						value={input}
						placeholder="Say something..."
						onChange={(e) => setInput(e.currentTarget.value)}
						className="pr-12"
						autoFocus
					/>
					<PromptInputSubmit
						status={status === "streaming" ? "streaming" : "ready"}
						disabled={!input.trim()}
						className="absolute right-1 bottom-1"
					/>
				</PromptInput>
			</div>
		</div>
	);
}
