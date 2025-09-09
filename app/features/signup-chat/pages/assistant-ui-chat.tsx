

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
	useChatRuntime,
	AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { Thread } from "~/components/assistant-ui/thread";
import { useAssistantInstructions } from "@assistant-ui/react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { data, Link, useLoaderData, useNavigate, useRouteLoaderData } from "react-router"
import { memory } from '~/mastra/memory';
import consola from "consola"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"
import { convertMessages } from '@mastra/core/agent';
import type { Route } from "./+types/assistant-ui-chat";
import { makeAssistantVisible } from "@assistant-ui/react";
import { Button } from "~/components/ui/button";
// Via makeAssistantVisible's clickable option
const ClickableButton = makeAssistantVisible(Button, {
	clickable: true, // Provides a click tool
});


export async function loader({ context, request }: LoaderFunctionArgs) {
	const user = await getAuthenticatedUser(request)
	if (!user) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const { client: supabase } = getServerClient(request)
	// Basic usage with default parameters
	const result = await memory.getThreadsByResourceIdPaginated({
		resourceId: `signupAgent-${user.sub}`,
		orderBy: "createdAt",
		sortDirection: "DESC",
		page: 0,
		perPage: 100,
	})

	consola.log("Result: ", result)
	let threadId = ""

	if (!(result?.total > 0)) {
		const newThread = await memory.createThread({
			resourceId: `signupAgent-${user.sub}`,
			title: "Signup Chat",
			metadata: {
				user_id: user.sub,
			},
		})
		consola.log("New thread created: ", newThread)
		threadId = newThread.id
	} else {
		threadId = result.threads[0].id
	}

	// Get messages in the V2 format (roughly equivalent to AI SDK's UIMessage format)
	// const messagesV2 = await mastra.getStorage()?.getMessages({ threadId: threadId, resourceId: `signupAgent-${user.sub}`, format: 'v2' });
	const { messages: messagesV1, uiMessages, messagesV2 } = await memory.query({
		threadId: threadId,
		selectBy: {
			last: 50,
		},
	})
	const aiv5Messages = convertMessages(messagesV2).to('AIV5.UI');

	// Get existing chat data from user_settings
	const { data: userSettings } = await supabase
		.from("user_settings")
		.select("signup_data")
		.eq("user_id", user.sub)
		.single()

	const existingChatData = userSettings?.signup_data


	return data({
		messages: aiv5Messages,
		existingChatData,
		user,
	})
}

export default function Assistant({ loaderData }: Route.ComponentProps) {
	const { messages, existingChatData, user } = loaderData
	const [onboardingData, setOnboardingData] = useState(existingChatData)
	const [chatCompleted, setChatCompleted] = useState(Boolean(existingChatData?.completed || false))
	const runtime = useChatRuntime({
		transport: new AssistantChatTransport({
			api: "/api/chat/signup",
		}),
		messages,
	});


	return (
		<AssistantRuntimeProvider runtime={runtime}>
			{/* <NavigateTool /> */}
			{/* <AddInstructions />
			<AddInstructions2 /> */}
			{/* <ClickableButton onClick={() => consola.log("button clicked")}>Click me</ClickableButton> */}
			{/* <div className="grid h-dvh grid-cols-[1fr] gap-x-2 px-4 py-4"> */}
			<div className="grid h-dvh grid-cols-[200px_1fr] lg:grid-cols-[400px_1fr] gap-x-2 px-4 py-4">
				<SignupDataWatcher
					userId={user?.sub}
					data={existingChatData}
					onDataUpdate={(data) => {
						consola.log("onDataUpdate", data)
						setOnboardingData(data)
					}}
					onCompleted={() => setChatCompleted(true)}
				/>
				{/* <ThreadList /> */}
				<Thread className="max-h-[95dvh]" />
			</div>
		</AssistantRuntimeProvider>
	);
};

function AddInstructions() {
	useAssistantInstructions({
		instruction: "This is a test",
		disabled: false,
	})
	return (
		null
	)
}

function AddInstructions2() {
	useAssistantInstructions({
		instruction: "This is a test 2",
		disabled: false,
	})
	return (
		null
	)
}

import { makeAssistantTool, tool } from "@assistant-ui/react";
import { z } from "zod";
import { SignupDataWatcher } from "../components/SignupDataWatcher";
import { useState } from "react";

// Define the tool using the tool() helper
const submitForm = tool({
	parameters: z.object({
		path: z.string(),
	}),
	execute: async ({ path }) => {
		// Implementation
		consola.log("path", path)
		return { success: true };
	},
});

// Create a tool component
const NavigateTool = makeAssistantTool({
	...submitForm,
	toolName: "navigate",
});