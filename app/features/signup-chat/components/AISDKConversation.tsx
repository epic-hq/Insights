import { useChat } from "@ai-sdk/react"
import { useState } from "react"
import { Conversation, ConversationContent, ConversationScrollButton } from "~/components/ai-elements/conversation"
import { Message, MessageContent } from "~/components/ai-elements/message"
import { PromptInputSubmit, PromptInputTextarea } from "~/components/ai-elements/prompt-input"
import { Response } from "~/components/ai-elements/response"
import { Input } from "~/components/ui/input"

const ConversationDemo = () => {
	const [input, setInput] = useState("")
	const { messages, sendMessage, status } = useChat()

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		if (input.trim()) {
			sendMessage({ text: input })
			setInput("")
		}
	}

	return (
		<div className="relative mx-auto size-full h-[600px] max-w-4xl rounded-lg border p-6">
			<div className="flex h-full flex-col">
				<Conversation>
					<ConversationContent>
						{messages.map((message) => (
							<Message from={message.role} key={message.id}>
								<MessageContent>
									{message.parts.map((part, i) => {
										switch (part.type) {
											case "text": // we don't use any reasoning or tool calls in this example
												return <Response key={`${message.id}-${i}`}>{part.text}</Response>
											default:
												return null
										}
									})}
								</MessageContent>
							</Message>
						))}
					</ConversationContent>
					<ConversationScrollButton />
				</Conversation>

				<Input onSubmit={handleSubmit} className="relative mx-auto mt-4 w-full max-w-2xl">
					<PromptInputTextarea
						value={input}
						placeholder="Say something..."
						onChange={(e) => setInput(e.currentTarget.value)}
						className="pr-12"
					/>
					<PromptInputSubmit
						status={status === "streaming" ? "streaming" : "ready"}
						disabled={!input.trim()}
						className="absolute right-1 bottom-1"
					/>
				</Input>
			</div>
		</div>
	)
}

export default ConversationDemo
