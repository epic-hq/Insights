import type { UIMessage } from "ai";
import type { HTMLAttributes } from "react";
import { cn } from "~/lib/utils";

type MessageProps = HTMLAttributes<HTMLDivElement> & {
	from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
	<div
		className={cn(
			"group flex w-full items-end justify-end gap-2 py-4",
			from === "user" ? "is-user" : "is-assistant flex-row-reverse justify-end",
			"[&>div]:max-w-[80%]",
			className
		)}
		{...props}
	/>
);

type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({ children, className, ...props }: MessageContentProps) => (
	<div
		className={cn(
			"flex flex-col gap-2 overflow-hidden rounded-lg px-4 py-3 text-foreground text-sm",
			"group-[.is-user]:rounded-xl group-[.is-user]:bg-gray-300 group-[.is-user]:text-gray-900",
			"group-[.is-user]:dark:bg-gray-700 group-[.is-user]:dark:text-gray-100",
			"group-[.is-assistant]:bg-background group-[.is-assistant]:text-foreground",
			className
		)}
		{...props}
	>
		{children}
	</div>
);
