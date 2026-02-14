# Mobile Responsive UX Assessment (BMad UX Expert Lens)

**Date:** 2026-02-08  
**Reviewer Lens:** `_bmad/bmm/agents/ux-designer.md` + responsive/accessibility criteria from `step-13-responsive-accessibility.md`  
**Scope Reviewed:** App shell, navigation, onboarding, research form surfaces, and core responsive behavior in `app/`

## Executive Assessment

The mobile experience has strong structural direction (top nav + bottom tab + AI entry points), but there are multiple implementation-level gaps causing layout instability, cramped interactions, and device-class mismatch (especially tablet widths and iOS viewport behavior).  

Overall status: **Partially responsive**.  
Priority to fix now: **P0 shell and breakpoint behavior**, then **P1 form-density and nav clarity**.

## Findings (Prioritized)

### P0-1: Dynamic viewport issues in app shell (risk of clipped/hidden content on iOS/Chrome mobile)
- Evidence:
  - `app/routes/_ProtectedLayout.tsx:413` uses `h-screen`
  - `app/routes/link.tsx:62` uses `h-screen`
  - `app/components/layout/AIAssistantPanel.tsx:467` uses `calc(100vh - 72px)`
- Impact:
  - Browser URL/tool bars changing height can clip content or create jumpy layouts.
  - Keyboard open states can hide bottom controls.
- Recommendation:
  - Prefer `h-dvh` / `min-h-dvh` with fallback.
  - Replace fixed `100vh` math with dynamic viewport-safe sizing.

### P0-2: Bottom nav spacing does not include safe-area inset in content padding
- Evidence:
  - `app/components/layout/SplitPaneLayout.tsx:125` uses `pb-[72px]`
  - `app/components/layout/AppLayout.tsx:98` uses `pb-[72px]`
  - Bottom tab itself uses safe area: `app/components/navigation/BottomTabBar.tsx:133`
- Impact:
  - On notched devices, page content can still sit under nav/home indicator.
- Recommendation:
  - Use `pb-[calc(72px+env(safe-area-inset-bottom))]` wherever content reserves bottom-tab space.

### P0-3: Breakpoint model is too coarse (phone-only mobile detection)
- Evidence:
  - `app/hooks/useDeviceDetection.ts:10` sets mobile at `<768` only.
  - Tablet widths receive desktop behaviors.
- Impact:
  - Tablet users can get dense desktop UI not optimized for touch.
  - UX diverges from your navigation wireframe intent for 768-1024 behavior.
- Recommendation:
  - Introduce `isTablet` (e.g., 768-1023).
  - Apply tablet-specific defaults (collapsed AI panel, simplified nav behaviors, touch-first spacing).

### P0-4: AI panel width defaults can over-compress content at tablet/small desktop widths
- Evidence:
  - `app/components/layout/AIAssistantPanel.tsx:118-120` min/default/max = `360/440/600`
  - `app/components/layout/SplitPaneLayout.tsx:127` pushes main content via `paddingLeft: aiPanelWidth + 20`
- Impact:
  - On 768-1024 widths, content can become too narrow and readability drops.
- Recommendation:
  - Clamp panel width against viewport (`maxWidth = min(configMax, viewport - minContentWidth)`).
  - Default panel collapsed on tablet.

### P1-1: Bottom tab label readability is too small
- Evidence:
  - `app/components/navigation/BottomTabBar.tsx:66` uses `text-[10px]`.
- Impact:
  - Reduced scanability and accessibility for lower-vision users.
- Recommendation:
  - Increase to `text-xs`/11-12px equivalent.
  - Keep touch targets >=44x44 (already mostly satisfied).

### P1-2: Route active-state detection is brittle (`pathname.includes`)
- Evidence:
  - `app/components/navigation/BottomTabBar.tsx:93-108`
  - `app/components/navigation/TopNavigation.tsx:181-190`
- Impact:
  - Potential false positives/negatives on nested or similarly named routes.
  - Inconsistent active feedback increases navigation uncertainty on mobile.
- Recommendation:
  - Switch to route matching via React Router path matching utilities.

### P1-3: Dense multi-column inputs on narrow screens
- Evidence:
  - `app/routes/research.$slug.tsx:1425` forces `grid-cols-2` for name fields.
  - `app/components/onboarding/OnboardingWalkthrough.tsx:167` starts at `grid-cols-3`.
  - `app/components/onboarding/OnboardingWalkthrough.tsx:252` uses fixed `grid-cols-2`.
- Impact:
  - Cramped controls and label wrapping on 320-360px widths.
- Recommendation:
  - Default to single column (`grid-cols-1`) and scale up at `sm`.
  - Prioritize vertical scan order for form completion speed.

### P1-4: Mobile menu sheet width can be too rigid at smallest widths
- Evidence:
  - `app/components/navigation/TopNavigation.tsx:248` uses fixed `w-80`.
- Impact:
  - Edge-to-edge pressure on 320px devices; limited breathing room.
- Recommendation:
  - Use `w-[min(20rem,100vw)]` and safe-area-aware padding.

## Responsive Strategy (Recommended)

- Device classes:
  - Phone: `<768`
  - Tablet: `768-1023`
  - Desktop: `>=1024`
- Navigation:
  - Phone: top bar + bottom tabs, no persistent AI panel.
  - Tablet: top bar + collapsed AI affordance by default, optional expand.
  - Desktop: full panel behavior.
- Content density:
  - Phone-first single-column defaults.
  - Scale to two columns only where value is clear and labels remain readable.

## Accessibility Strategy (Recommended Baseline)

- Target: **WCAG 2.2 AA** for primary product surfaces.
- Immediate checks:
  - Minimum touch target 44x44.
  - Minimum readable body text size for nav labels and controls.
  - No critical action hidden by fixed UI when keyboard is open.
  - Focus/active states visible for tab and sheet navigation.

## Testing Strategy

- Add responsive smoke tests across:
  - 320x568, 375x812, 390x844, 768x1024, 1024x1366.
- Validate:
  - No horizontal overflow.
  - Bottom controls remain visible with keyboard.
  - Active nav state correct on key routes.
  - Safe-area handling on iOS-style viewports.

## Implementation Plan

1. **P0 shell fixes**: replace viewport units and safe-area content padding.
2. **P0 breakpoint model**: add `isTablet` and adapt AI/nav behavior.
3. **P1 nav/form polish**: active-state matching, label size, column density.
4. **P1/P2 validation**: add responsive/a11y test coverage and regression snapshots.

## Notes

- This assessment is code-based (static review) and references existing implementation points directly.
- No runtime visual QA session was executed in this pass.
