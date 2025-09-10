"use client"

import { lazy, memo, Suspense } from "react"
import remarkGfm from "remark-gfm"

// Lazy-load react-markdown to reduce initial bundle size and avoid TDZ in combined chunks
const ReactMarkdown = lazy(async () => {
  const mod = await import("react-markdown")
  return { default: mod.default }
})

type MarkdownTextProps = {
  children?: string
  text?: string
  content?: string
  className?: string
}

function MarkdownTextImpl({ children, text, content, className }: MarkdownTextProps) {
  const md = typeof children === "string" ? children : typeof text === "string" ? text : (content as string) || ""
  return (
    <div className={className}>
      <Suspense fallback={<div>{md}</div>}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {md}
        </ReactMarkdown>
      </Suspense>
    </div>
  )
}

export const MarkdownText = memo(MarkdownTextImpl)
