

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


export const Assistant = () => {
	const runtime = useChatRuntime({
		transport: new AssistantChatTransport({
			api: "/api/chat/signup",
		}),
	});

	return (
		<AssistantRuntimeProvider runtime={runtime}>
			<div className="grid h-dvh grid-cols-[200px_1fr] gap-x-2 px-4 py-4">
				{/* <ThreadList /> */}
				<Thread />
			</div>
		</AssistantRuntimeProvider>
	);
};
