import { motion } from "framer-motion"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"

interface StudyContextProps {
  researchGoal: string
  studyCode: string
  recruitmentChannel: string
  scriptVersion: string
  className?: string
}

export default function StudyContextCard({
  researchGoal,
  studyCode,
  recruitmentChannel,
  scriptVersion,
  className,
}: StudyContextProps) {
  const themeColor = stringToColor(studyCode || researchGoal || "P")
  const initials = (studyCode || researchGoal || "P")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
  return (
    <motion.div
      className={`relative overflow-hidden rounded-xl border border-border bg-background shadow-md transition-all duration-300 hover:shadow-lg ${className ?? ""}`}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="h-1 w-full" style={{ backgroundColor: themeColor }} />
      <div className="flex items-center gap-4 p-6">
        <Avatar className="h-14 w-14 border-2" style={{ borderColor: themeColor }}>
          <AvatarFallback className="font-medium text-lg text-white" style={{ backgroundColor: themeColor }}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="mb-1 font-bold text-xl" style={{ color: themeColor }}>Study Context</h3>
          <div className="text-xs text-muted-foreground mb-1">{studyCode}</div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-muted px-2 py-0.5">{recruitmentChannel}</span>
            <span className="rounded bg-muted px-2 py-0.5">Script: {scriptVersion}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{researchGoal}</div>
        </div>
      </div>
    </motion.div>
  )
}

// Utility: hash string to color
function stringToColor(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase()
  return "#" + "00000".substring(0, 6 - c.length) + c
}
