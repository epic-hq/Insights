import {
	ActionBarPrimitive,
	BranchPickerPrimitive,
	ComposerPrimitive,
	ErrorPrimitive,
	MessagePrimitive,
	ThreadPrimitive,
} from "@assistant-ui/react"
import {
	ArrowDownIcon,
	ArrowUpIcon,
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	CopyIcon,
	PencilIcon,
	RefreshCwIcon,
	Square,
} from "lucide-react"
import { domAnimation, LazyMotion, MotionConfig } from "motion/react"
import * as m from "motion/react-m"
import type { FC } from "react"
import {
	ComposerAddAttachment,
	ComposerAttachments,
	UserMessageAttachments,
} from "~/components/assistant-ui/attachment"
import { MarkdownText } from "~/components/assistant-ui/markdown-text"
import { ToolFallback } from "~/components/assistant-ui/tool-fallback"
import { TooltipIconButton } from "~/components/assistant-ui/tooltip-icon-button"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

export const Thread: FC<{ className?: string }> = ({ className }) => {
	return (
		<LazyMotion features={domAnimation}>
			<MotionConfig reducedMotion="user">
				<ThreadPrimitive.Root
					className={"aui-root aui-thread-root @container flex h-full flex-col bg-background"}
					style={{
						["--thread-max-width" as string]: "44rem",
					}}
				>
					<ThreadPrimitive.Viewport
						className={cn(
							"aui-thread-viewport relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll px-4",
							className
						)}
					>
						<ThreadWelcome />

						<ThreadPrimitive.Messages
							components={{
								UserMessage,
								EditComposer,
								AssistantMessage,
							}}
						/>
						<div className="aui-thread-viewport-spacer min-h-8 grow" />
						<Composer />
					</ThreadPrimitive.Viewport>
				</ThreadPrimitive.Root>
			</MotionConfig>
		</LazyMotion>
	)
}

const ThreadScrollToBottom: FC = () => {
	return (
		<ThreadPrimitive.ScrollToBottom asChild>
			<TooltipIconButton
				tooltip="Scroll to bottom"
				variant="outline"
				className="aui-thread-scroll-to-bottom -top-12 absolute z-10 self-center rounded-full p-4 disabled:invisible dark:bg-background dark:hover:bg-accent"
			>
				<ArrowDownIcon />
			</TooltipIconButton>
		</ThreadPrimitive.ScrollToBottom>
	)
}

const ThreadWelcome: FC = () => {
	return (
		<ThreadPrimitive.Empty>
			<div className="aui-thread-welcome-root mx-auto my-auto flex w-full max-w-[var(--thread-max-width)] flex-grow flex-col">
				<div className="aui-thread-welcome-center flex w-full flex-grow flex-col items-center justify-center">
					<div className="aui-thread-welcome-message flex size-full flex-col justify-center px-8">
						<m.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 10 }}
							className="aui-thread-welcome-message-motion-1 font-semibold text-2xl"
						>
							Hello there!
						</m.div>
						<m.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 10 }}
							transition={{ delay: 0.1 }}
							className="aui-thread-welcome-message-motion-2 text-2xl text-muted-foreground/65"
						>
							How can I help you today?
						</m.div>
					</div>
				</div>
			</div>
		</ThreadPrimitive.Empty>
	)
}

const ThreadWelcomeSuggestions: FC = () => {
	return (
		<div className="aui-thread-welcome-suggestions grid w-full @md:grid-cols-2 gap-2">
			{[
				{
					title: "Customer Discovery",
					label: "Plan Interview Questions",
					action: "Help me clarify my research plan so we can do qualitative interviews",
				},
				{
					title: "Validate assumptions",
					label: "about customer needs",
					action: "Help me develop experiments and interviews to test hypothesis",
				},
			].map((suggestedAction, index) => (
				<m.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 20 }}
					transition={{ delay: 0.05 * index }}
					key={`suggested-action-${suggestedAction.title}-${index}`}
					className="aui-thread-welcome-suggestion-display @md:[&:nth-child(n+3)]:block [&:nth-child(n+3)]:hidden"
				>
					<ThreadPrimitive.Suggestion prompt={suggestedAction.action} method="replace" autoSend asChild>
						<Button
							variant="ghost"
							className="aui-thread-welcome-suggestion h-auto w-full flex-1 @md:flex-col flex-wrap items-start justify-start gap-1 rounded-3xl border px-5 py-4 text-left text-sm dark:hover:bg-accent/60"
							aria-label={suggestedAction.action}
						>
							<span className="aui-thread-welcome-suggestion-text-1 font-medium">{suggestedAction.title}</span>
							<span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground">
								{suggestedAction.label}
							</span>
						</Button>
					</ThreadPrimitive.Suggestion>
				</m.div>
			))}
		</div>
	)
}

const Composer: FC = () => {
	return (
		<div className="aui-composer-wrapper sticky bottom-0 mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-4 overflow-visible rounded-t-3xl bg-background pb-4 md:pb-6">
			<ThreadScrollToBottom />
			<ThreadPrimitive.Empty>
				<ThreadWelcomeSuggestions />
			</ThreadPrimitive.Empty>
			<ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col rounded-3xl border border-border bg-muted px-1 pt-2 shadow-[0_9px_9px_0px_rgba(0,0,0,0.01),0_2px_5px_0px_rgba(0,0,0,0.06)] dark:border-muted-foreground/15">
				<ComposerAttachments />
				<ComposerPrimitive.Input
					placeholder="Send a message..."
					className="aui-composer-input mb-1 max-h-32 min-h-16 w-full resize-none bg-transparent px-3.5 pt-1.5 pb-3 text-base outline-none placeholder:text-muted-foreground focus:outline-primary"
					rows={1}
					autoFocus
					aria-label="Message input"
				/>
				<ComposerAction />
			</ComposerPrimitive.Root>
		</div>
	)
}

const ComposerAction: FC = () => {
	return (
		<div className="aui-composer-action-wrapper relative mx-1 mt-2 mb-2 flex items-center justify-between">
			{/* <ComposerAddAttachment /> */}
			{/* Empty div for spacing */}
			<div />

			<ThreadPrimitive.If running={false}>
				<ComposerPrimitive.Send asChild>
					<TooltipIconButton
						tooltip="Send message"
						side="bottom"
						type="submit"
						variant="default"
						size="icon"
						className="aui-composer-send size-[34px] rounded-full p-1"
						aria-label="Send message"
					>
						<ArrowUpIcon className="aui-composer-send-icon size-5" />
					</TooltipIconButton>
				</ComposerPrimitive.Send>
			</ThreadPrimitive.If>

			<ThreadPrimitive.If running>
				<ComposerPrimitive.Cancel asChild>
					<Button
						type="button"
						variant="default"
						size="icon"
						className="aui-composer-cancel size-[34px] rounded-full border border-muted-foreground/60 hover:bg-primary/75 dark:border-muted-foreground/90"
						aria-label="Stop generating"
					>
						<Square className="aui-composer-cancel-icon size-3.5 fill-white dark:fill-black" />
					</Button>
				</ComposerPrimitive.Cancel>
			</ThreadPrimitive.If>
		</div>
	)
}

const MessageError: FC = () => {
	return (
		<MessagePrimitive.Error>
			<ErrorPrimitive.Root className="aui-message-error-root mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive text-sm dark:bg-destructive/5 dark:text-red-200">
				<ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
			</ErrorPrimitive.Root>
		</MessagePrimitive.Error>
	)
}

const AssistantMessage: FC = () => {
	return (
		<MessagePrimitive.Root asChild>
			<div
				className="aui-assistant-message-root fade-in slide-in-from-bottom-1 relative mx-auto w-full max-w-[var(--thread-max-width)] animate-in py-4 duration-200 last:mb-24"
				data-role="assistant"
			>
				<div className="aui-assistant-message-content mx-2 break-words text-foreground leading-7">
					<MessagePrimitive.Parts
						components={{
							Text: MarkdownText,
							tools: { Fallback: ToolFallback },
						}}
					/>
					<MessageError />
				</div>

				<div className="aui-assistant-message-footer mt-2 ml-2 flex">
					<BranchPicker />
					<AssistantActionBar />
				</div>
			</div>
		</MessagePrimitive.Root>
	)
}

const AssistantActionBar: FC = () => {
	return (
		<ActionBarPrimitive.Root
			hideWhenRunning
			autohide="not-last"
			autohideFloat="single-branch"
			className="aui-assistant-action-bar-root -ml-1 col-start-3 row-start-2 flex gap-1 text-muted-foreground data-floating:absolute data-floating:rounded-md data-floating:border data-floating:bg-background data-floating:p-1 data-floating:shadow-sm"
		>
			<ActionBarPrimitive.Copy asChild>
				<TooltipIconButton tooltip="Copy">
					<MessagePrimitive.If copied>
						<CheckIcon />
					</MessagePrimitive.If>
					<MessagePrimitive.If copied={false}>
						<CopyIcon />
					</MessagePrimitive.If>
				</TooltipIconButton>
			</ActionBarPrimitive.Copy>
			<ActionBarPrimitive.Reload asChild>
				<TooltipIconButton tooltip="Refresh">
					<RefreshCwIcon />
				</TooltipIconButton>
			</ActionBarPrimitive.Reload>
		</ActionBarPrimitive.Root>
	)
}

const UserMessage: FC = () => {
	return (
		<MessagePrimitive.Root asChild>
			<div
				className="aui-user-message-root fade-in slide-in-from-bottom-1 mx-auto grid w-full max-w-[var(--thread-max-width)] animate-in auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-2 px-2 py-4 duration-200 first:mt-3 last:mb-5 [&:where(>*)]:col-start-2"
				data-role="user"
			>
				<UserMessageAttachments />

				<div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
					<div className="aui-user-message-content break-words rounded-3xl bg-muted px-5 py-2.5 text-foreground">
						<MessagePrimitive.Parts />
					</div>
					<div className="aui-user-action-bar-wrapper -translate-x-full -translate-y-1/2 absolute top-1/2 left-0 pr-2">
						<UserActionBar />
					</div>
				</div>

				<BranchPicker className="aui-user-branch-picker -mr-1 col-span-full col-start-1 row-start-3 justify-end" />
			</div>
		</MessagePrimitive.Root>
	)
}

const UserActionBar: FC = () => {
	return (
		<ActionBarPrimitive.Root
			hideWhenRunning
			autohide="not-last"
			className="aui-user-action-bar-root flex flex-col items-end"
		>
			<ActionBarPrimitive.Edit asChild>
				<TooltipIconButton tooltip="Edit" className="aui-user-action-edit p-4">
					<PencilIcon />
				</TooltipIconButton>
			</ActionBarPrimitive.Edit>
		</ActionBarPrimitive.Root>
	)
}

const EditComposer: FC = () => {
	return (
		<div className="aui-edit-composer-wrapper mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-4 px-2 first:mt-4">
			<ComposerPrimitive.Root className="aui-edit-composer-root ml-auto flex w-full max-w-7/8 flex-col rounded-xl bg-muted">
				<ComposerPrimitive.Input
					className="aui-edit-composer-input flex min-h-[60px] w-full resize-none bg-transparent p-4 text-foreground outline-none"
					autoFocus
				/>

				<div className="aui-edit-composer-footer mx-3 mb-3 flex items-center justify-center gap-2 self-end">
					<ComposerPrimitive.Cancel asChild>
						<Button variant="ghost" size="sm" aria-label="Cancel edit">
							Cancel
						</Button>
					</ComposerPrimitive.Cancel>
					<ComposerPrimitive.Send asChild>
						<Button size="sm" aria-label="Update message">
							Update
						</Button>
					</ComposerPrimitive.Send>
				</div>
			</ComposerPrimitive.Root>
		</div>
	)
}

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({ className, ...rest }) => {
	return (
		<BranchPickerPrimitive.Root
			hideWhenSingleBranch
			className={cn(
				"aui-branch-picker-root -ml-2 mr-2 inline-flex items-center text-muted-foreground text-xs",
				className
			)}
			{...rest}
		>
			<BranchPickerPrimitive.Previous asChild>
				<TooltipIconButton tooltip="Previous">
					<ChevronLeftIcon />
				</TooltipIconButton>
			</BranchPickerPrimitive.Previous>
			<span className="aui-branch-picker-state font-medium">
				<BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
			</span>
			<BranchPickerPrimitive.Next asChild>
				<TooltipIconButton tooltip="Next">
					<ChevronRightIcon />
				</TooltipIconButton>
			</BranchPickerPrimitive.Next>
		</BranchPickerPrimitive.Root>
	)
}
