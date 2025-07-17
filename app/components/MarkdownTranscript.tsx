interface MarkdownTranscriptProps {
	transcript: string
	className?: string
}

// This component uses <pre> for line breaks and preserves whitespace, but can be swapped to a markdown renderer if added later
export default function MarkdownTranscript({ transcript, className }: MarkdownTranscriptProps) {
	return (
		<div className={className}>
			<pre
				style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "1rem", fontFamily: "inherit", margin: 0 }}
			>
				{transcript}
			</pre>
		</div>
	)
}
