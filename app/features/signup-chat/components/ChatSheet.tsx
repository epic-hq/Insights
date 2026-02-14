// ChatSheet.tsx
import { useState } from "react";

export default function ChatSheet() {
	const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
	const [text, setText] = useState("");
	const send = async () => {
		if (!text.trim()) return;
		const user = { role: "user" as const, text };
		setMessages((m) => [...m, user]);
		setText("");
		// call your backend here -> const aiText = await api.chat(text)
		setMessages((m) => [...m, { role: "ai", text: "…stub…" }]);
	};
	return (
		<div className="fixed inset-x-0 bottom-0 border bg-white md:static md:ml-auto md:max-w-sm md:rounded-xl">
			<div className="h-64 space-y-2 overflow-y-auto p-3">
				{messages.map((m, i) => (
					<div key={i} className={`text-sm ${m.role === "ai" ? "text-slate-700" : "text-slate-900"}`}>
						{m.text}
					</div>
				))}
			</div>
			<div className="flex gap-2 border-t p-2">
				<input
					className="flex-1 rounded-md border px-3 py-2"
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder="Ask AI…"
				/>
				<button className="rounded-md bg-black px-3 py-2 text-white" onClick={send}>
					Send
				</button>
			</div>
		</div>
	);
}
