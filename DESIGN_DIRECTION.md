# Deadline Rescue Design Direction

This document preserves the app's visual intent for future phases and future Codex sessions. It is a creative brief, not authorization to add screens or components before they are requested.

## Current phase constraint

The app is still in Phase 1. Keep the existing scaffold unchanged unless the user explicitly requests implementation work. When later phases introduce real screens and components, use this direction to style only those requested features. Do not invent sample content, additional UI, icons, illustrations, or interactions to demonstrate the direction.

## Creative idea

Deadline Rescue should feel like a calm guide arriving when schoolwork feels tangled. The interface reduces pressure by revealing one manageable next move. It borrows the confidence, whitespace, clear hierarchy, rounded controls, and single-action focus seen in polished productivity onboarding, while remaining an original product.

The visual metaphor is **a clear path through a busy week**: small route lines, time blocks, check marks, and a warm rescue-coral accent. Avoid literal copies of reference artwork, logos, screen compositions, or wording.

## Personality

- Calm, capable, and non-judgmental.
- Encouraging without sounding childish or overly celebratory.
- Honest about shortfalls and uncertainty.
- Focused: one dominant action per section or state.

## Visual system

- **Ink:** deep navy rather than pure black, for a softer academic feel.
- **Primary:** coral red for decisive actions and urgent moments.
- **Supporting:** mint and sky surfaces for progress, planning, and time.
- **Canvas:** warm cream with white elevated surfaces.
- **Typography:** bold, compact display headings paired with highly readable body text.
- **Shape:** restrained rounded controls and cards; avoid oversized pills, heavy containers, and inflated visual scale.
- **Depth:** thin borders and restrained shadows; never glossy or heavily dimensional.
- **Motion:** short, purposeful transitions only; respect reduced motion.

These are future styling guidelines. Existing Phase 1 CSS remains the implementation source until a later phase intentionally introduces design tokens.

## Composition principles

1. Lead each page with a small context label, plain-language heading, and one sentence of support.
2. Keep primary actions visually unmistakable; secondary actions should be quiet bordered or tinted controls.
3. Separate deadline, scheduled time, and remaining effort using labels and layout—not colour alone.
4. Use cards to group decisions, not to wrap every piece of text.
5. On phones, prefer a single agenda and a persistent three-item bottom navigation.
6. On desktop, use the sidebar plus asymmetric content grids that give the next action visual priority.
7. Focus mode removes unrelated navigation and visual noise.

## Signature elements

- Compact coral actions with restrained hover feedback.
- Small uppercase context labels with moderate tracking.
- Soft mint status treatments for work that fits.
- Coral/amber attention treatments that always include explicit text.
- Simple time and progress treatments when the feature genuinely needs them.
- Use icons only when the user or feature specification calls for them; never add decorative icon systems by default.

## Content style

- Prefer “You have 45 minutes planned” over abstract system language.
- Use short headings that answer the user's immediate question.
- Avoid guilt-based copy, streak pressure, or claims that the schedule is perfect.
- Use “Replan” consistently for schedule rebuilding.
- Keep “Saved in this browser. No account needed.” visible during onboarding.

## Screen intent

- **Welcome:** an inviting editorial hero, a compact original planning illustration, and two clear ways to begin.
- **Plan:** status first, then one dominant Next Up card, followed by today's agenda and workload context.
- **Assignments:** clean task rows, quick scanning by deadline, and a prominent add action.
- **Availability:** weekly rhythm and fixed commitments presented as editable time blocks.
- **Assignment details:** a readable summary with schedule and progress, not a dense settings form.
- **Focus:** one assignment, a large timer, minimal controls, and no unrelated work.

## Do not do

- Do not use Todoist's red, logo, illustrations, exact authentication layout, or copy.
- Do not imitate iOS chrome or include fake device status bars.
- Do not add decorative gradients everywhere; reserve them for subtle atmosphere.
- Do not hide core actions behind hover, swipe, or icon-only controls.
- Do not let empty states look unfinished; they should explain the next useful action.
