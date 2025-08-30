# UI Style & Component Palette

## Current UI Design Principles

Designing for mobile first. Then we will make it look good on desktop.
Desire is to be bold and modern, with a clean aesthetic. Based on top Apps like Linear, Vercel, and Superhuman. Here are some interim design principles to adhere to.

Titles of content section will be outside the card, and the card will be the content. The card border will be hidden on sm breakpoint. And only appear on md & larger. Padding will be tighter as well.
Reference implementation is currently on `ProjectGoalsScreen` and color styles reference `EnhancedPersonaCard`

Tailwind css brand logo color is --brand-logo
TBD define other colors and style elements.

Category colors we use for content on badges established as `color` variant eg as used in `InterviewQuestionManager`


### **1. Tile-Based Information Architecture**

- **Primary Navigation**: Four main sections (Personas, Insights, Encounters, Projects) displayed as large, colorful tiles in a 2x2 grid
- **Expandable Hierarchy**: Tapping a main tile expands to show sub-tiles in a compact bento box layout
- **Visual Hierarchy**: Tile sizes vary (small, medium, wide) to indicate importance and content density

### **2. Color-Coded Context System**

- **Section Identity**: Each main section has a distinct color (blue for Personas, green for Insights, orange for Encounters, purple for Projects, gray for People)
- **Visual Continuity**: Section colors carry through to breadcrumbs, headers, and chat interfaces to maintain context
- **Status Communication**: Progress bars, badges, and status indicators use semantic colors (green=complete, yellow=in-progress, red=high priority)

### **3. Progressive Disclosure Navigation**

- **Three-Level Structure**: Main tiles → Sub-tiles → Full-screen details
- **Consistent Navigation**: All navigation controls stay in the upper-right corner of parent containers
- **Contextual Titles**: Detail views show "Section: Item Name" format for clear location awareness

### **4. Adaptive Interface Elements**

- **Fixed Bottom Bar**: AI Chat and contextual Add buttons remain accessible at all times
- **Smart Buttons**: Add button function changes based on current context (Add Persona, Add Insight, etc.)
- **Sliding Chat**: AI assistant slides up from bottom (mobile) or right side (desktop) while staying within current section context

### **5. Content-First Design**

- **Image Integration**: Content images display as backgrounds, side boxes, or corner elements for visual variety
- **High Contrast**: Dark backgrounds with white text ensure readability across all tile levels
- **Typography Scale**: Large, bold titles with clear hierarchy using consistent font weights

### **6. Mobile-Optimized Interactions**

- **Touch-Friendly**: All interactive elements sized for finger navigation
- **Gesture Support**: Swipe and tap interactions feel natural and responsive
- **Space Efficiency**: Bento box layout maximizes information density while maintaining visual breathing room

This design creates an intuitive, visually striking interface that makes complex user research data easily navigable while maintaining the bold, confident aesthetic of the Metro design language.

A modern, clean aesthetic inspired by Linear, Vercel, and Superhuman.

---

## 1. Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `primary-500` | #2563EB (Vibrant Blue) | Key actions; modern feel |
| `primary-600` | #1E4FDB | Hover/active |
| `accent-teal` | #14B8A6 | Positive highlights, success |
| `accent-magenta` | #E11D48 | Call-outs, novelty heat |
| `accent-gold` | #F59E0B | Impact scores, badges |
| `gray-900` | #0F172A | Headings |
| `gray-700` | #334155 | Body text |
| `gray-300` | #CBD5E1 | Borders, dividers |
| `gray-50`  | #F8FAFC | Page background |
| `error` | #DC2626 | Error states |

### Tailwind Config Snippet

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#2563EB',
          600: '#1E4FDB',
        },
        accent: {
          yellow: '#FACC15',
          orange: '#FB923C',
        },
      },
    },
  },
};
```

---

## 2. Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Headline (`h1`) | Inter, sans | 32px / 2rem | 600 |
| Sub-headline (`h2`) | Inter | 24px | 500 |
| Body | Inter | 16px | 400 |
| Caption | Inter | 14px | 400, `gray-500` |

Inter is available via Google Fonts; fallback to `system-ui`.

---

## 3. Elevation & Spacing

- **Elevation**: subtle shadow `shadow-sm` on cards and dialogs. No heavy drop-shadows.

- **Radius**: `rounded-lg` (8 px) on cards, `rounded` (4 px) on inputs.
- **Grid**: base spacing unit `4 px`; use multiples (8 / 12 / 16 / 24).

---

## 4. shadcn/ui Component Mapping

| Screen Element | shadcn Base | Variants/Notes |
|----------------|-------------|----------------|
| Primary Button | `Button` | `variant="default"` primary-500 |
| Secondary Btn  | `Button` | `variant="outline"` gray-200 |
| Dialog / Modal | `Dialog` | For edit insight |
| Sheet / Drawer | `Sheet`  | Side panel filtered insight list |
| Data Table     | `Table` + `ScrollArea` | Dashboard tables |
| Tabs           | `Tabs`    | Persona / Themes switch |
| Tooltip        | `Tooltip` | Heat-map cell details |

---

## 5. State Styles

| State | Style |
|-------|-------|
| Hover | Slight darken (`brightness-95`) & `translate-y-0.5` for buttons |
| Focus | `ring-2 ring-primary-500` |
| Disabled | `opacity-50 cursor-not-allowed` |
| Error | Border `error` + icon |

---

## 6. Accessibility Checklist

- Ensure color contrast ≥ 4.5:1 (WCAG AA) for text.

- Provide keyboard focus outlines on interactive components.
- Semantic HTML in Remix templates (e.g., `<header>`, `<nav>`).

---

## 7. Next Design Steps

1. Apply tokens in Tailwind config.
2. Build Storybook setup to visual-test components.
3. Iterate with high-fidelity mock-ups if needed.


## Resources

### Generate Icons for mobile and favicon.ico

```sh
npx tsx scripts/generate-icons.ts
```
