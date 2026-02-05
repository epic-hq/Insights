# Insights Loop

The insights loop is the core experience flow of the product. It is the process of generating insights and guidance from interviews and conversations.

Start:

- Upload recordings or transcripts.

- Ask user (while uploading?)
  - What kind of content? interviews with customers, live conversations, focus groups, etc.
  - What is the goal? decide on pricing, new features, changes in service terms, etc.

- Respond: OK, I will(insert specifics, search for pain, refine persona, explore motivations, etc)

Template: I want to ___ so I can ____.
While trying to do **GOAL/Desired_outcome**, people struggle with **pain** because **WHY: Details/context**.

**Dashboard Key Value**: Quickly tell users:

- top pain points or insights (impact vs frequency) & themes
- suggested next steps, questions
- product/service opportunities.
- dynamic persona descriptions

## Visualizing Insights

There are too many. We need to group them so they are more easy to udnerstand and actionable.
So we cluster them into THEMES and SUBTHEMES.

```tsx
# ---------- Types ----------
class FeedbackPoint {
  id       string
  field1   string        # short summary / tag
  field2   string        # full sentence of feedback
  field3   string?       # optional extra context (screen, persona …)
}

class GroupingInstructions {
  goals              string?   # e.g. “surface UX pain points”
  focus_on           string?   # e.g. “checkout flow”
  language           string?   # e.g. “Spanish”
  max_themes         int?      # hard cap on top-level groups
  max_subthemes      int?      # hard cap per theme
  target_cluster_sz  int?      # hint for leaf cluster size
}

class ClusterNode {
  title        string          # human-readable theme name
  size         int             # total descendant record count
  record_ids   string[]?       # present only on leaf nodes
  children     ClusterNode[]?  # absent on leaf nodes
}

# ---------- LLM function ----------
function GroupFeedback(
  records: FeedbackPoint[],
  instructions: GroupingInstructions
) -> ClusterNode[] {
  client "openai/gpt-4o-mini"

  prompt #"
    You are a senior insights analyst.

    • Goals: {{ instructions.goals }}
    • Focus: {{ instructions.focus_on }}
    • Respond in: {{ instructions.language | default('English') }}
    • Hard limits → max {{ instructions.max_themes }} themes,
      max {{ instructions.max_subthemes }} sub-themes each.
    • Aim for ~{{ instructions.target_cluster_sz | default(10) }} items
      per leaf cluster.
    • Title each cluster with a concise noun phrase.
    • Return the data **exactly** in the schema shown below.

    {{ ctx.output_format }}

    {{ _.role("user") }}
    JSON array of feedback points:
    {{ records }}
  "#
}
```

```tsx
// ClusterTree.tsx
import React, { useState } from "react";

export interface ClusterNode {
  title: string;
  size: number;
  record_ids?: string[];
  children?: ClusterNode[];
}

interface Props {
  data: ClusterNode[];
  onSelectRecord?: (id: string) => void;   // optional drill-through
}

export const ClusterTree: React.FC<Props> = ({ data, onSelectRecord }) => {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const toggle = (path: string) =>
    setOpen((o) => ({ ...o, [path]: !o[path] }));

  const renderNode = (node: ClusterNode, path: string): JSX.Element => (
    <li key={path} className="mt-1">
      <div
        className="cursor-pointer select-none"
        onClick={() => node.children && toggle(path)}
      >
        {node.children ? (open[path] ? "▼" : "▶") : "•"}{" "}
        <span className="font-medium">{node.title}</span>{" "}
        <span className="text-xs text-gray-500">({node.size})</span>
      </div>

      {node.children && open[path] && (
        <ul className="ml-4 border-l pl-2">
          {node.children.map((c, i) => renderNode(c, `${path}-${i}`))}
        </ul>
      )}

      {!node.children && node.record_ids && open[path] && (
        <ul className="ml-6 list-disc text-sm">
          {node.record_ids.map((id) => (
            <li
              key={id}
              className="hover:underline cursor-pointer"
              onClick={() => onSelectRecord?.(id)}
            >
              {id}
            </li>
          ))}
        </ul>
      )}
    </li>
  );

  return <ul className="text-sm">{data.map((n, i) => renderNode(n, `${i}`))}</ul>;
};


// ClusterMap.tsx
import { ClusterTree } from "./ClusterTree";

const GroupedView = ({ clusters }: { clusters: ClusterNode[] }) => (
  <ClusterTree
    data={clusters}
    onSelectRecord={(id) => /* open modal or navigate */ null}
  />
);

```

## Insights Coloring by Emotion

```json
{
  "Angry": {
    "color": {
      "bg": "bg-red-500",
      "hoverBg": "hover:bg-red-600",
      "text": "text-white",
      "darkBg": "bg-red-700"
    },
    "Let down": ["Betrayed", "Resentful"],
    "Humiliated": ["Disrespected", "Ridiculed"],
    "Bitter": ["Indignant", "Violated"],
    "Mad": ["Furious", "Jealous"],
    "Aggressive": ["Provoked", "Hostile"],
    "Frustrated": ["Infuriated", "Annoyed"],
    "Distant": ["Withdrawn", "Numb"],
    "Critical": ["Skeptical", "Dismissive"]
  },
  "Disgusted": {
    "color": {
      "bg": "bg-gray-600",
      "hoverBg": "hover:bg-gray-700",
      "text": "text-white",
      "darkBg": "bg-gray-800"
    },
    "Disapproving": ["Judgmental", "Embarrassed"],
    "Disappointed": ["Appalled", "Revolted"],
    "Awful": ["Nauseated", "Detestable"],
    "Repelled": ["Horrified", "Hesitant"]
  },
  "Sad": {
    "color": {
      "bg": "bg-blue-500",
      "hoverBg": "hover:bg-blue-600",
      "text": "text-white",
      "darkBg": "bg-blue-700"
    },
    "Hurt": ["Disappointed", "Embarrassed"],
    "Depressed": ["Inferior", "Empty"],
    "Guilty": ["Remorseful", "Ashamed"],
    "Despair": ["Powerless", "Grief"],
    "Vulnerable": ["Victimized", "Fragile"],
    "Lonely": ["Abandoned", "Isolated"]
  },
  "Happy": {
    "color": {
      "bg": "bg-yellow-300",
      "hoverBg": "hover:bg-yellow-400",
      "text": "text-black",
      "darkBg": "bg-yellow-500"
    },
    "Playful": ["Cheeky", "Aroused"],
    "Content": ["Free", "Joyful"],
    "Interested": ["Curious", "Inquisitive"],
    "Proud": ["Successful", "Confident"],
    "Accepted": ["Respected", "Valued"],
    "Powerful": ["Courageous", "Creative"],
    "Peaceful": ["Loving", "Thankful"],
    "Trusting": ["Sensitive", "Intimate"],
    "Optimistic": ["Hopeful", "Inspired"]
  },
  "Surprised": {
    "color": {
      "bg": "bg-purple-400",
      "hoverBg": "hover:bg-purple-500",
      "text": "text-white",
      "darkBg": "bg-purple-600"
    },
    "Excited": ["Energetic", "Eager"],
    "Amazed": ["Awe", "Astonished"],
    "Confused": ["Perplexed", "Disillusioned"],
    "Startled": ["Shocked", "Dismayed"]
  },
  "Bad": {
    "color": {
      "bg": "bg-green-500",
      "hoverBg": "hover:bg-green-600",
      "text": "text-white",
      "darkBg": "bg-green-700"
    },
    "Bored": ["Indifferent", "Apathetic"],
    "Busy": ["Pressured", "Rushed"],
    "Stressed": ["Overwhelmed", "Out of control"],
    "Tired": ["Sleepy", "Unfocussed"]
  },
  "Fearful": {
    "color": {
      "bg": "bg-orange-400",
      "hoverBg": "hover:bg-orange-500",
      "text": "text-black",
      "darkBg": "bg-orange-600"
    },
    "Scared": ["Helpless", "Frightened"],
    "Anxious": ["Overwhelmed", "Worried"],
    "Insecure": ["Inadequate", "Inferior"],
    "Weak": ["Worthless", "Insignificant"],
    "Rejected": ["Excluded", "Persecuted"],
    "Threatened": ["Nervous", "Exposed"]
  }
}
```

**JSON Format** for BAML (leaner)

```json
{
  "emotions": [
    {
      "core": "Angry",
      "children": [
        { "label": "Let down", "details": ["Betrayed", "Resentful"] },
        { "label": "Humiliated", "details": ["Disrespected", "Ridiculed"] },
        { "label": "Bitter", "details": ["Indignant", "Violated"] },
        { "label": "Mad", "details": ["Furious", "Jealous"] },
        { "label": "Aggressive", "details": ["Provoked", "Hostile"] },
        { "label": "Frustrated", "details": ["Infuriated", "Annoyed"] },
        { "label": "Distant", "details": ["Withdrawn", "Numb"] },
        { "label": "Critical", "details": ["Skeptical", "Dismissive"] }
      ]
    },
    {
      "core": "Disgusted",
      "children": [
        { "label": "Disapproving", "details": ["Judgmental", "Embarrassed"] },
        { "label": "Disappointed", "details": ["Appalled", "Revolted"] },
        { "label": "Awful", "details": ["Nauseated", "Detestable"] },
        { "label": "Repelled", "details": ["Horrified", "Hesitant"] }
      ]
    },
    {
      "core": "Sad",
      "children": [
        { "label": "Hurt", "details": ["Disappointed", "Embarrassed"] },
        { "label": "Depressed", "details": ["Inferior", "Empty"] },
        { "label": "Guilty", "details": ["Remorseful", "Ashamed"] },
        { "label": "Despair", "details": ["Powerless", "Grief"] },
        { "label": "Vulnerable", "details": ["Victimized", "Fragile"] },
        { "label": "Lonely", "details": ["Abandoned", "Isolated"] }
      ]
    },
    {
      "core": "Happy",
      "children": [
        { "label": "Playful", "details": ["Cheeky", "Aroused"] },
        { "label": "Content", "details": ["Free", "Joyful"] },
        { "label": "Interested", "details": ["Curious", "Inquisitive"] },
        { "label": "Proud", "details": ["Successful", "Confident"] },
        { "label": "Accepted", "details": ["Respected", "Valued"] },
        { "label": "Powerful", "details": ["Courageous", "Creative"] },
        { "label": "Peaceful", "details": ["Loving", "Thankful"] },
        { "label": "Trusting", "details": ["Sensitive", "Intimate"] },
        { "label": "Optimistic", "details": ["Hopeful", "Inspired"] }
      ]
    },
    {
      "core": "Surprised",
      "children": [
        { "label": "Excited", "details": ["Energetic", "Eager"] },
        { "label": "Amazed", "details": ["Awe", "Astonished"] },
        { "label": "Confused", "details": ["Perplexed", "Disillusioned"] },
        { "label": "Startled", "details": ["Shocked", "Dismayed"] }
      ]
    },
    {
      "core": "Bad",
      "children": [
        { "label": "Bored", "details": ["Indifferent", "Apathetic"] },
        { "label": "Busy", "details": ["Pressured", "Rushed"] },
        { "label": "Stressed", "details": ["Overwhelmed", "Out of control"] },
        { "label": "Tired", "details": ["Sleepy", "Unfocussed"] }
      ]
    },
    {
      "core": "Fearful",
      "children": [
        { "label": "Scared", "details": ["Helpless", "Frightened"] },
        { "label": "Anxious", "details": ["Overwhelmed", "Worried"] },
        { "label": "Insecure", "details": ["Inadequate", "Inferior"] },
        { "label": "Weak", "details": ["Worthless", "Insignificant"] },
        { "label": "Rejected", "details": ["Excluded", "Persecuted"] },
        { "label": "Threatened", "details": ["Nervous", "Exposed"] }
      ]
    }
  ]
}
```

## Values

Brene Brown inspired list of what they're looking for. Where are they wanting to go?

```json
[
  {
    "group": "Personal Character",
    "icon": "user-check",
    "values": [
      "Accountability", "Authenticity", "Integrity", "Self-discipline", "Self-respect",
      "Humility", "Wisdom", "Vulnerability", "Courage", "Honesty"
    ]
  },
  {
    "group": "Achievement & Growth",
    "icon": "trending-up",
    "values": [
      "Achievement", "Ambition", "Learning", "Growth", "Excellence", "Competence",
      "Success", "Perseverance", "Personal fulfillment", "Being the best",
      "Wealth", "Power", "Recognition", "Legacy"
    ]
  },
  {
    "group": "Relationships & Connection",
    "icon": "users",
    "values": [
      "Belonging", "Compassion", "Caring", "Friendship", "Family", "Trust", "Love",
      "Kindness", "Giving back", "Service", "Connection", "Inclusion"
    ]
  },
  {
    "group": "Civic & Social Responsibility",
    "icon": "globe",
    "values": [
      "Community", "Justice", "Equality", "Diversity", "Responsibility", "Stewardship",
      "Future generations", "Patriotism", "Ethics", "Contribution", "Tradition"
    ]
  },
  {
    "group": "Work & Discipline",
    "icon": "briefcase",
    "values": [
      "Leadership", "Career", "Teamwork", "Reliability", "Commitment", "Initiative",
      "Efficiency", "Resourcefulness", "Job security", "Order", "Thrift"
    ]
  },
  {
    "group": "Lifestyle & Well-being",
    "icon": "heart",
    "values": [
      "Balance", "Health", "Well-being", "Serenity", "Simplicity", "Leisure",
      "Time", "Beauty", "Home", "Nature", "Travel"
    ]
  },
  {
    "group": "Freedom & Expression",
    "icon": "feather",
    "values": [
      "Creativity", "Curiosity", "Spirituality", "Freedom", "Independence", "Joy",
      "Optimism", "Faith", "Openness", "Self-expression", "Vision", "Humor",
      "Risk-taking"
    ]
  }
]
```
