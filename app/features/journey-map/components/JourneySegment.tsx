/**
 * JourneySegment - A stop on the journey path.
 * Renders the segment node (circle), label, and expandable card deck.
 */

import { Check, Lock } from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "~/lib/utils";
import type { RouteDefinitions } from "~/utils/route-definitions";
import {
  type JourneyPhaseConfig,
  type PhaseState,
  isCardComplete,
} from "../journey-config";
import { JourneyCard } from "./JourneyCard";

interface JourneySegmentProps {
  phase: JourneyPhaseConfig;
  state: PhaseState;
  routes: RouteDefinitions;
  counts: Record<string, number | undefined>;
  journeyProgress: {
    contextComplete: boolean;
    promptsComplete: boolean;
    hasConversations: boolean;
    hasInsights: boolean;
  };
  defaultExpanded?: boolean;
  index: number;
}

export function JourneySegment({
  phase,
  state,
  routes,
  counts,
  journeyProgress,
  defaultExpanded = false,
  index,
}: JourneySegmentProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const Icon = phase.icon;

  const completedCards = phase.cards.filter((card) =>
    isCardComplete(card, counts, journeyProgress),
  ).length;

  const toggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <div
      className={cn(
        "relative z-10 w-full cursor-pointer",
        index % 2 === 0 ? "mt-[50px]" : "mt-[140px]",
        state === "locked" && "opacity-60",
      )}
    >
      {/* Segment node */}
      <div
        className="mb-4 flex justify-center"
        onClick={toggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleExpand();
          }
        }}
      >
        <div
          className={cn(
            "relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 hover:scale-110 lg:h-20 lg:w-20",
            state === "completed" &&
              "bg-gradient-to-br from-emerald-500 to-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]",
            state === "active" &&
              "bg-gradient-to-br from-indigo-500 to-violet-500 shadow-[0_0_30px_rgba(99,102,241,0.4),0_0_60px_rgba(99,102,241,0.15)] animate-[pulse-glow_3s_ease-in-out_infinite]",
            state === "upcoming" &&
              "border-2 border-indigo-500/30 bg-indigo-500/15",
            state === "locked" &&
              "border-2 border-dashed border-slate-500/40 bg-slate-700/60",
          )}
        >
          {/* Phase number badge */}
          <span
            className={cn(
              "absolute -top-2 -right-2 z-20 flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold text-white",
              state === "active" &&
                "bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_2px_8px_rgba(245,158,11,0.4)]",
              state === "completed" && "bg-emerald-500",
              (state === "upcoming" || state === "locked") &&
                "bg-slate-700/80 text-slate-400",
            )}
          >
            {phase.number}
          </span>

          {state === "completed" ? (
            <Check
              className="h-6 w-6 text-white lg:h-8 lg:w-8"
              strokeWidth={2}
            />
          ) : state === "locked" ? (
            <Lock className="h-6 w-6 text-slate-500 opacity-40 lg:h-8 lg:w-8" />
          ) : (
            <Icon
              className={cn(
                "h-6 w-6 lg:h-8 lg:w-8",
                state === "active" && "text-white",
                state === "upcoming" && "text-slate-400",
              )}
            />
          )}
        </div>
      </div>

      {/* Segment label */}
      <div className="mb-4 text-center">
        <h3 className="text-[13px] font-bold lg:text-[15px]">{phase.title}</h3>
        <p className="text-xs text-slate-400">
          {completedCards}/{phase.cards.length} done
        </p>
      </div>

      {/* Card deck (expandable) */}
      <div
        className={cn(
          "relative overflow-visible transition-all duration-400",
          expanded ? "h-auto" : "h-0",
        )}
      >
        <div
          className={cn(
            "flex flex-col gap-2 transition-all duration-350",
            expanded
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-2.5 opacity-0",
          )}
        >
          {phase.cards.map((card) => {
            const done = isCardComplete(card, counts, journeyProgress);
            return (
              <JourneyCard
                key={card.id}
                card={card}
                done={done}
                href={card.getRoute(routes)}
                locked={state === "locked"}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
