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
