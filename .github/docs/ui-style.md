# UI Style & Component Palette

_Last updated: 2025-07-06 23:14-06:00_

A modern, clean aesthetic inspired by Linear, Vercel, and Superhuman.

---

## 1. Color Palette – "Bold-Business × Artsy"
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
* **Elevation**: subtle shadow `shadow-sm` on cards and dialogs. No heavy drop-shadows.
* **Radius**: `rounded-lg` (8 px) on cards, `rounded` (4 px) on inputs.
* **Grid**: base spacing unit `4 px`; use multiples (8 / 12 / 16 / 24).

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
* Ensure color contrast ≥ 4.5:1 (WCAG AA) for text.
* Provide keyboard focus outlines on interactive components.
* Semantic HTML in Remix templates (e.g., `<header>`, `<nav>`).

---

## 7. Next Design Steps
1. Apply tokens in Tailwind config.
2. Build Storybook setup to visual-test components.
3. Iterate with high-fidelity mock-ups if needed.
