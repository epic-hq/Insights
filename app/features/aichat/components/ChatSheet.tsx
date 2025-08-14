// ChatSheet.tsx
import { useState } from "react"

export default function ChatSheet() {
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([])
  const [text, setText] = useState("")
  const send = async () => {
    if (!text.trim()) return
    const user = { role: "user" as const, text }
    setMessages((m) => [...m, user])
    setText("")
    // call your backend here -> const aiText = await api.chat(text)
    setMessages((m) => [...m, { role: "ai", text: "…stub…" }])
  }
  return (
    <div className="fixed inset-x-0 bottom-0 md:static md:rounded-xl bg-white border md:max-w-sm md:ml-auto">
      <div className="h-64 overflow-y-auto p-3 space-y-2">
        {messages.map((m, i) => (
          <div key={i} className={`text-sm ${m.role === "ai" ? "text-slate-700" : "text-slate-900"}`}>{m.text}</div>
        ))}
      </div>
      <div className="flex gap-2 p-2 border-t">
        <input className="flex-1 border rounded-md px-3 py-2" value={text} onChange={(e)=>setText(e.target.value)} placeholder="Ask AI…" />
        <button className="px-3 py-2 rounded-md bg-black text-white" onClick={send}>Send</button>
      </div>
    </div>
  )
}
