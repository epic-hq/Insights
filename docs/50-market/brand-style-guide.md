---
tags:
  - marketing
  - brand
---
# UpSight Brand Style Guide

## Color Palette

### Brand Blue (Primary)

- **Light theme primary**: `#0284c7`
- **Dark theme primary**: `#38bdf8`
- **Usage**:
  - Primary actions in app UI
  - Links and focus rings
  - Logo/brand accents (`--brand-logo-color`)

### Brand Amber (CTA Accent)

- **Marketing CTA amber**: `#f59e0b`
- **Amber glow**: `rgba(245, 158, 11, 0.3)`
- **Usage**:
  - Primary marketing CTAs (buttons, highlights)
  - Key emphasis words in hero headlines
  - Avoid using as default link color in the product UI

### Brand Sky (Highlight Accent)

- **Marketing sky**: `#38bdf8`
- **Usage**:
  - Secondary emphasis in marketing (inline highlights)
  - Brand mark accents on dark surfaces

### Marketing Neutrals (Dark)

- **Marketing background**: `#050508`
- **Marketing background (alt)**: `#0a0a10`
- **Marketing text**: `#eeeef2`
- **Dim text**: `rgba(238, 238, 242, 0.7)`
- **Dim text (alt)**: `rgba(238, 238, 242, 0.6)`
- **Usage**:
  - Hero + long-form marketing sections
  - High-contrast, low-chroma to keep amber/sky legible

## Token Sources (Single Source of Truth)

- **Product theme tokens**: `app/tailwind.css`
  - `--brand-logo-color`
  - `--primary` / `--primary-foreground`
  - `--background` / `--foreground`
  - `--ring` and related semantic tokens
- **Marketing landing tokens**: `app/features/marketing/pages/landing.css`
  - `--lp-amber`, `--lp-sky`, `--lp-bg`, `--lp-bg2`, `--lp-text`

## Usage Rules

### When to use Blue vs Amber

- **Blue** is the *product* brand primary.
- **Amber** is the *marketing* conversion accent.
- If a surface already uses dark hero styling, **amber CTA + sky highlight** is the default pairing.

### Contrast + Accessibility

- Amber-on-dark works best for CTAs and short emphasis strings.
- For body text on dark, use `#eeeef2` / dim variants (avoid pure white).

### Don’ts

- Don’t introduce additional “random” accent colors in marketing pages.
- Don’t use amber as a global primary in the app UI; keep it scoped to marketing CTA intent.

## Typography

### Marketing Landing (Homepage / Dark Hero)

- **Sans**: `Inter`
  - Loaded via Google Fonts in `app/features/marketing/pages/index.tsx`.
  - Weights in use: `300–900`.
- **Mono**: `JetBrains Mono`
  - Used for label-like UI and “operator” voice (e.g. `// THINKS` style annotations).
  - Weights in use: `300–500`.

#### Usage conventions (marketing)

- **H1 / hero headlines**
  - Heavy weight (`800–900`), tight tracking, low line-height.
  - Accent emphasis via **amber** (`--lp-amber`).
- **Meta labels / section tags**
  - `JetBrains Mono`, uppercase, wide tracking.
  - Color: amber.
- **Body copy**
  - `Inter` with lighter weights (`300–500`) and slightly looser line-height.

### Product UI (App)

The product UI primarily uses Tailwind defaults + theme variables from `app/tailwind.css`. We also have a few explicit font treatments:

- **Logo wordmark** (`app/components/branding.tsx`)
  - `font-semibold`
  - `text-brand`
  - `text-xl`
  - `font-stretch-75%`

### Marketing Pricing (If used)

There is a separate pricing implementation that imports:

- **Sans**: `DM Sans`
- **Serif**: `Instrument Serif`

Source: `app/features/marketing/pages/PricingTableV4.jsx`.

If we keep this page long-term, we should decide whether Pricing aligns with the homepage typography (Inter/JetBrains) or stays distinct.

## Iconography

- **Icon set**: `lucide-react`
- **Default stroke style**: `stroke="currentColor"` (Lucide defaults)

Brand mark:

- **Logo icon**: `lucide-scan-eye-icon` SVG in `app/components/branding.tsx`.
- **Logo color**: driven by `text-brand` which maps to `--color-brand` → `--brand-logo-color`.

## Motion

### Marketing Motion

- **Primary easing**: `cubic-bezier(0.16, 1, 0.3, 1)` (`--lp-ease`)
- **General feel**: “confident glide” (slower ease-out, minimal bounce)

Key patterns in `app/features/marketing/pages/landing.css`:

- Hero scene transitions: `opacity 1s` + `transform 1.2s` using `--lp-ease`.
- Reveal transitions: `opacity 0.7s` + `translateY` using `--lp-ease`.
- Respect `prefers-reduced-motion: reduce`.

### Product Motion

Product-level animation tokens live in `app/tailwind.css` under `@theme`:

- `--animate-float`
- `--animate-breathe`
- `--animate-morph`
- `--animate-gradient`

## Layout Primitives

### Radius

- Global radius token: `--radius: 0.625rem` (in `app/tailwind.css`).

Marketing pages sometimes opt into sharper edges for a more editorial feel; product UI follows the shared radius tokens.
