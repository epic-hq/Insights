

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
	useChatRuntime,
	AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { Thread } from "~/components/assistant-ui/thread";
// import {
//   SidebarInset,
//   SidebarProvider,
//   SidebarTrigger,
// } from "~/components/ui/sidebar";
// import { ThreadListSidebar } from "~/components/assistant-ui/threadlist-sidebar";
import { Separator } from "@/components/ui/separator";
// import {
//   Breadcrumb,
//   BreadcrumbItem,
//   BreadcrumbLink,
//   BreadcrumbList,
//   BreadcrumbPage,
//   BreadcrumbSeparator,
// } from "~/components/ui/breadcrumb";

import { DefaultChatTransport } from 'ai';
import { useState } from 'react';
import { useChat } from '@ai-sdk/react';

import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from '~/components/ai-elements/conversation';
import { Message, MessageContent } from '~/components/ai-elements/message';
import { Input } from '~/components/ui/input';
import {
	PromptInputTextarea,
	PromptInputSubmit,
	PromptInput,
} from '~/components/ai-elements/prompt-input';
import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolOutput,
	ToolInput,
} from '~/components/ai-elements/tool';
import { Response as AiResponse } from '~/components/ai-elements/response';
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { data, Link, useLoaderData, useNavigate, useRouteLoaderData } from "react-router"
import { memory } from '~/mastra/memory';
import consola from "consola"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"
import { convertMessages } from '@mastra/core/agent';
import type { Route } from "./+types/assistant-ui-chat";


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


	return data({
		messages: aiv5Messages,
	})
}

export default function Assistant({ loaderData }: Route.ComponentProps) {
	const { messages } = loaderData
	const runtime = useChatRuntime({
		transport: new AssistantChatTransport({
			api: "/api/chat/signup",
		}),
		messages,
	});

	return (
		<AssistantRuntimeProvider runtime={runtime}>
			<div className="grid h-dvh grid-cols-[1fr] gap-x-2 px-4 py-4">
				{/* <div className="grid h-dvh grid-cols-[200px_1fr] gap-x-2 px-4 py-4"> */}
				{/* <ThreadList /> */}
				<Thread />
			</div>
		</AssistantRuntimeProvider>
	);
};
