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
