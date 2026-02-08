// CopilotKit removed

// CopilotKit UI removed
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data, Link, useLoaderData, useNavigate, useRouteLoaderData } from "react-router";

// Add custom CSS for progress animation
const _progressStyles = `
@keyframes progress {
  from { width: 0%; }
  to { width: 100%; }
}
`;

import consola from "consola";
import { ArrowLeft, Mic } from "lucide-react";
import type { z } from "zod";
import { JsonDataCard } from "~/features/signup-chat/components/JsonDataCard";
import { SignupDataWatcher } from "~/features/signup-chat/components/SignupDataWatcher";
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/client.server";
import { cn } from "~/lib/utils";
import type { SignupAgentState } from "~/mastra/agents";
import { memory } from "~/mastra/memory";

type AgentState = z.infer<typeof SignupAgentState>;

export async function loader({ context, request }: LoaderFunctionArgs) {
	const { user } = await getAuthenticatedUser(request);
	if (!user) {
		throw new Response("Unauthorized", { status: 401 });
	}

	const { client: supabase } = getServerClient(request);

	// Optional restart to clear prior answers
	const url = new URL(request.url);
	const restart = url.searchParams.get("restart") === "1";
	if (restart) {
		await supabase.rpc("upsert_signup_data", {
			p_user_id: user.sub,
			p_signup_data: { completed: false },
		});
	}

	// Get existing chat data from user_settings
	const { data: userSettings } = await supabase
		.from("user_settings")
		.select("signup_data")
		.eq("user_id", user.sub)
		.single();

	const existingChatData = userSettings?.signup_data as AgentState;

	// Basic usage with default parameters
	const result = await memory.listThreadsByResourceId({
		resourceId: `signupAgent-${user.sub}`,
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
		selectBy: {
			last: 50,
		},
	});

	const mastraBase = (process.env.MASTRA_URL || "http://localhost:4111").replace(/\/$/, "");
	return data({
		user,
		existingChatData,
		copilotRuntimeUrl: "/api/copilotkit",
		mastraUrl: `${mastraBase}/copilotkit/signup`,
		result,
		messages,
		threadId,
	});
}

export async function action({ request }: ActionFunctionArgs) {
	const { user } = await getAuthenticatedUser(request);
	if (!user) {
		throw new Response("Unauthorized", { status: 401 });
	}

	const formData = await request.formData();
	const action = formData.get("action");

	if (action === "save_chat_data") {
		const chatData = JSON.parse(formData.get("chatData") as string) as AgentState;

		const { client: supabase } = getServerClient(request);

		// Use the upsert function to save signup chat data
		const { error } = await supabase.rpc("upsert_signup_data", {
			p_user_id: user.sub,
			p_signup_data: chatData,
		});

		if (error) {
			// Using throw instead of console.error for better error handling
			throw new Response(`Error saving chat data: ${error.message}`, {
				status: 500,
			});
		}

		return data({ success: true });
	}

	return data({ success: false, error: "Invalid action" }, { status: 400 });
}

export default function SignupChat() {
	const { clientEnv } = useRouteLoaderData("root");
	const {
		existingChatData,
		copilotRuntimeUrl,
		user,
		threadId,
		messages: loaderMessages,
		mastraUrl,
	} = useLoaderData() as any;
	const navigate = useNavigate();
	const [chatCompleted, setChatCompleted] = useState(Boolean(existingChatData?.completed || false));
	const [onboardingData, setOnboardingData] = useState(existingChatData);
	const _chatRequired = Boolean(clientEnv?.SIGNUP_CHAT_REQUIRED === "true");

	// If signup chat is not required, or it's already completed, send users home immediately.
	useEffect(() => {
		// if (!chatRequired) {
		// 	navigate("/home")
		// } else if (chatCompleted) {
		// 	navigate("/signup-chat/completed")
		// }
		if (chatCompleted) {
			navigate("/signup-chat/completed");
		}
	}, [chatCompleted, navigate]);

	// Subscription moved into SignupDataWatcher component

	// If chat is already completed, show completion message
	// Moved to chat-completed.tsx
	// if (chatCompleted) {
	// 	return (
	// 		<>
	// 			<style dangerouslySetInnerHTML={{ __html: progressStyles }} />
	// 			<div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
	// 				{/* Header */}
	// 				<header className="border-gray-200 border-b bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
	// 					<div className="mx-auto flex max-w-2xl items-center justify-between">
	// 						<Link
	// 							to="/home"
	// 							className="flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
	// 						>
	// 							<ArrowLeft className="h-5 w-5" />
	// 							Back
	// 						</Link>
	// 						<div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
	// 							<CheckCircle className="h-4 w-4 text-green-500" />
	// 							<span className="text-gray-700 text-sm dark:text-gray-300">Complete</span>
	// 						</div>
	// 					</div>
	// 				</header>

	// 				{/* Progress Bar */}
	// 				{/* <div className="border-gray-200 border-b bg-white dark:border-gray-800 dark:bg-gray-900">
	// 					<div className="mx-auto max-w-2xl px-4">
	// 						<div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
	// 							<div className="h-full w-full rounded-full bg-purple-500" />
	// 						</div>
	// 					</div>
	// 				</div> */}

	// 				{/* Main Content */}
	// 				<main className="flex flex-1 items-center justify-center px-4 py-16">
	// 					<div className="w-full max-w-lg text-center">
	// 						<div className="mb-8">
	// 							<CheckCircle className="mx-auto mb-6 h-16 w-16 text-green-500" />
	// 							<h1 className="mb-4 font-bold text-3xl text-gray-900 dark:text-white">Welcome to UpSight!</h1>
	// 							<p className="mb-2 text-gray-600 text-lg leading-relaxed dark:text-gray-300">Let's go!</p>
	// 						</div>

	// 						{/* Auto-redirect indicator */}
	// 						<div className="mb-8">
	// 							<p className="mb-3 text-gray-500 text-sm dark:text-gray-400">Redirecting to home in 3 seconds...</p>
	// 							<div className="mx-auto h-1 w-48 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
	// 								<div
	// 									className="h-full rounded-full bg-purple-500"
	// 									style={{ animation: "progress 3s linear forwards" }}
	// 								/>
	// 							</div>
	// 						</div>

	// 						{/* Action Button */}
	// 						<Link
	// 							to="/home"
	// 							className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-8 py-4 font-semibold text-white transition-all hover:bg-purple-700 hover:shadow-lg"
	// 						>
	// 							<ArrowRight className="h-5 w-5" />
	// 							Get Started Now
	// 						</Link>
	// 						<div className="mt-3">
	// 							<Link to="/signup-chat?restart=1" className="text-gray-500 text-xs underline">
	// 								Start over (capture fresh answers)
	// 							</Link>
	// 						</div>
	// 					</div>
	// 				</main>
	// 			</div>
	// 		</>
	// 	)
	// }

	return (
		<div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
			{/* Header */}
			<header className="border-gray-200 border-b bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
				<div className="mx-auto flex max-w-2xl items-center justify-between">
					<Link
						to="/"
						className="flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
					>
						<ArrowLeft className="h-5 w-5" />
						Back
					</Link>
					<div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
						<div className="h-2 w-2 animate-pulse rounded-full bg-purple-500" />
						<span className="text-gray-700 text-sm dark:text-gray-300">Setup</span>
					</div>
				</div>
			</header>

			{/* Progress Bar */}
			{/* <div className="border-gray-200 border-b bg-white dark:border-gray-800 dark:bg-gray-900">
				<div className="mx-auto max-w-2xl px-4">
					<div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
						<div className="h-full w-1/3 rounded-full bg-gradient-to-r from-purple-500 to-purple-600" />
					</div>
				</div>
			</div> */}

			{/* Main Content */}
			<main className="flex min-h-0 flex-1 flex-col">
				{/* <AiSdkChat /> */}
				<div className="h-full min-h-0 w-full flex-1 p-0">
					{/* Replace with ai-sdk chat when ready */}
					<ChatWithChecklist existingChatData={onboardingData} messages={loaderMessages} />
					{/* Hidden watcher subscribes to updates and signals completion */}
					<SignupDataWatcher
						userId={user?.sub}
						data={onboardingData}
						onDataUpdate={setOnboardingData}
						onCompleted={() => setChatCompleted(true)}
						showCard={false}
					/>
				</div>
			</main>
		</div>
	);
}

function _ModernChatInterface({ existingChatData }: { existingChatData?: any }) {
	// Placeholder now that CopilotKit is removed
	const state = existingChatData;

	useEffect(() => {
		consola.log("[signupAgent state]", state);
	}, [state]);

	return (
		<div className="flex flex-1 flex-col">
			{/* Hero Section */}
			<div className="mb-8 text-center">
				<div className="mb-4">
					<h1 className="font-bold text-3xl text-gray-900 dark:text-white">Welcome to UpSight 🎉</h1>
				</div>
			</div>

			{/* Chat Interface */}
			<div className="flex-1 rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
				{/* AI Agent Header */}
				<div className="border-gray-100 border-b p-4 dark:border-gray-700">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-purple-600">
							<span className="font-bold text-3xl text-white">🤖</span>
						</div>
						<div>
							<h3 className="font-semibold text-gray-900 dark:text-white">Uppy Assistant</h3>
						</div>
					</div>
				</div>

				{/* Chat UI removed */}
				<div className="flex h-[500px] items-center justify-center text-muted-foreground text-sm">
					Chat UI disabled (CopilotKit removed)
				</div>
			</div>

			{/* Alternative Input Options */}
			{process.env.NODE_ENV === "development" && (
				<div
					className="mt-8 text-center"
					onClick={() => {
						alert("Coming soon");
					}}
				>
					<div className="mb-4 flex items-center justify-center gap-4">
						<button className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-600 transition-all hover:bg-purple-700 hover:shadow-lg">
							<Mic className="h-6 w-6 text-white" />
						</button>
					</div>
					<p className="mb-3 text-gray-600 text-sm dark:text-gray-400">Start a voice conversation</p>
				</div>
			)}

			{/* Development Panel */}
			{process.env.NODE_ENV === "development" && (
				<div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
					<h4 className="mb-2 font-semibold text-gray-900 text-sm dark:text-white">Development Panel</h4>
					<JsonDataCard title="Signup Data" jsonData={state?.signupChatData} />
				</div>
			)}
		</div>
	);
}

function _AiSdkChat() {
	const { error, status, sendMessage, messages, regenerate, stop } = useChat({
		transport: new DefaultChatTransport({
			api: "http://localhost:4111/chat/signup",
		}),
	});

	return (
		<div>
			<button onClick={() => sendMessage({ text: "Hello" })}>Send</button>
			<div>{status}</div>
			{messages.map((message) => {
				switch (message.role) {
					case "user":
						return <div key={message.id}>{message.parts.map((part) => part).join("")}</div>;
					case "assistant":
						return <div key={message.id}>{message.parts.map((part) => part).join("")}</div>;
				}
			})}
		</div>
	);
}

function ChatWithChecklist({ existingChatData, messages }: { existingChatData?: any; messages?: any }) {
	// Legacy component - keeping for backwards compatibility
	const { state } = useCoAgent<AgentState>({
		name: "signupAgent",
	});
	const { messages: copilotMessages, setMessages } = useCopilotMessagesContext();
	console.log("messages", messages);

	// useEffect(() => {
	// 	setMessages(messages)
	// }, [messages])

	return (
		<div className="flex h-full min-h-0 w-full flex-1 flex-col">
			<div className={cn("h-full min-h-0 w-full flex-1 rounded-lg bg-white shadow-xl dark:bg-gray-800")}>
				<CopilotChat
					className="h-full min-h-0 w-full"
					labels={{
						title: "UpSight Signup Chat",
						initial:
							"Hi, welcome to UpSight. I'm Uppy! Lets get you started gathering insights to level up your business.<br />What brings you here today?",
					}}
				/>
			</div>
			{process.env.NODE_ENV === "development" && (
				<div className="">
					{/* Development: */}
					<SignupDataWatcher title="Signup Data" data={existingChatData} subscribe={false} />
				</div>
			)}
		</div>
	);
}
