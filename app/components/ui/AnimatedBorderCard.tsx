import React from "react"

export function AnimatedBorderCard({
  active,
  children,
  className = "",
}: {
  active?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`relative rounded-xl ${className}`}
      style={{
        boxShadow: active ? "inset 0 0 0 1px rgba(37, 99, 235, 0.4)" : undefined,
      }}
    >
      {active && (
        <div className="pointer-events-none absolute inset-0 rounded-xl" style={{
          background:
            "linear-gradient(90deg, rgba(37,99,235,0.2) 0%, rgba(37,99,235,0) 50%, rgba(37,99,235,0.2) 100%)",
          maskImage: "linear-gradient(90deg, transparent, black 15%, black 85%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, black 15%, black 85%, transparent)",
          animation: "aborder 3s linear infinite",
        }} />
      )}
      <style>{`
        @keyframes aborder {
          0% { opacity: .9; }
          50% { opacity: .4; }
          100% { opacity: .9; }
        }
      `}</style>
      <div className="relative z-10">{children}</div>
    </div>
  )
}

