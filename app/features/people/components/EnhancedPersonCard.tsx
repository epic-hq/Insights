import { formatDistance } from "date-fns"
import { motion } from "framer-motion"
import { Palette, User } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Card, CardContent, CardFooter, CardHeader } from "~/components/ui/card"
import { cn } from "~/lib/utils"
import type { Database } from "~/types"

// Types
export type PersonRow = Database["public"]["Tables"]["people"]["Row"] & {
  people_personas?: Array<{
    personas?: { name?: string; color_hex?: string }
  }>
}

interface EnhancedPersonCardProps {
  person: PersonRow
  className?: string
}

export default function EnhancedPersonCard({ person, className }: EnhancedPersonCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  // Persona color or fallback
  const persona = person.people_personas?.[0]?.personas
  const themeColor = persona?.color_hex || "#6366f1" // Indigo fallback

  // Name and avatar logic
  const name = person.name || "Unnamed Person"
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?"

  return (
    <Link to={`/people/${person.id}`} tabIndex={0} aria-label={`View details for ${name}`}>
      <motion.div
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-background",
          "transition-all duration-300 ease-out",
          "hover:shadow-black/10 hover:shadow-lg dark:hover:shadow-white/5",
          className
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ y: -4, scale: 1.02 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {/* Theme color accent bar */}
        <div className="h-1 w-full" style={{ backgroundColor: themeColor }} />

        {/* Gradient overlay on hover */}
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-0"
          style={{ background: `linear-gradient(135deg, ${themeColor}15 0%, ${themeColor}05 100%)` }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />

        <Card className="border-0 bg-transparent shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-start">
              <motion.div className="relative" whileHover={{ scale: 1.1 }} transition={{ duration: 0.2 }}>
                <Avatar className="h-16 w-16 border-2" style={{ borderColor: themeColor }}>
                  {person.image_url && (
                    <AvatarImage src={person.image_url} alt={name} />
                  )}
                  <AvatarFallback className="font-medium text-lg text-white" style={{ backgroundColor: themeColor }}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <motion.div
                  className="-bottom-1 -right-1 absolute flex h-6 w-6 items-center justify-center rounded-full shadow-sm"
                  style={{ backgroundColor: themeColor }}
                  animate={{ rotate: isHovered ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <User className="h-3 w-3 text-white" />
                </motion.div>
              </motion.div>
              <div className="flex w-full items-start justify-between">
                <div>
                  <motion.h3
                    className="mb-3 ml-4 font-bold text-foreground text-xl leading-tight"
                    style={{ color: isHovered ? themeColor : undefined }}
                    transition={{ duration: 0.3 }}
                  >
                    {name}
                  </motion.h3>
                  {persona?.name && (
                    <div className="ml-4 mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: themeColor + '22', color: themeColor }}>
                      {persona.name}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Description, segment, etc. */}
            <p className="mb-2 line-clamp-2 text-muted-foreground text-sm leading-relaxed">
              {person.description || person.segment || "No additional details."}
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {person.segment && <span className="rounded bg-muted px-2 py-0.5">{person.segment}</span>}
              {person.age && <span>Age: {person.age}</span>}
              <span>Added {formatDistance(new Date(person.created_at), new Date(), { addSuffix: true })}</span>
            </div>
          </CardContent>
          <CardFooter>
            <div className="flex w-full justify-end text-muted-foreground/50 text-xs">
              {person.updated_at && (
                <span>Updated {formatDistance(new Date(person.updated_at), new Date(), { addSuffix: true })}</span>
              )}
            </div>
          </CardFooter>
        </Card>
        {/* Bottom gradient border effect */}
        <motion.div
          className="absolute right-0 bottom-0 left-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent 0%, ${themeColor} 50%, transparent 100%)` }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />
      </motion.div>
    </Link>
  )
}
