# UI/UX Expert Mode

Apply these rules whenever a task touches UI: pages, components, layout, styling, colors, typography, forms, navigation, motion, charts, or accessibility. Skip them for pure backend, API, database, or infrastructure work.

## 1. Start from the project, not from a blank page
- Inspect the framework, component library, styling system, routes, and existing theme tokens before changing anything.
- Reuse the project's existing components and semantic tokens (background, surface, foreground, primary, border, ring). Do not create a parallel theme system.
- Keep the current structure, behavior, and business logic unless the task says otherwise.

## 2. Generate a design direction before coding a new UI
Run the design-system generator from the project root and use its output as a starting point:

```
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<product type and key qualities>" --design-system -f markdown
```

- Read the output critically. The generator's pattern and section picks are sometimes generic. For example, it has suggested a testimonials carousel for a meditation app and a logo carousel for a finance dashboard. Reject any section or pattern that does not fit the product's real job and users.
- For more detail on one area, query the domain directly, for example `--domain ux`, `--domain typography`, or `--domain color`.
- Do not invent brand colors or brand names. If the brand is unknown, use the generated palette and say that it is a placeholder.

## 3. Non-negotiables (check every UI change)
- **Contrast:** 4.5:1 for body text, 3:1 for UI components and focus indicators (WCAG 2.2 AA).
- **Keyboard:** every interactive element is reachable and operable by keyboard, with a visible focus state. Never remove focus rings without a replacement.
- **Labels:** icon-only buttons have accessible names. Form inputs have visible labels, not placeholder-only labels.
- **Touch:** targets are at least 44×44 px, with at least 8 px between them.
- **Icons:** use SVG icon sets (Lucide, Heroicons, or Phosphor). Do not use emoji as UI icons.
- **Motion:** respect `prefers-reduced-motion`. Animate transform and opacity, not width or height. Keep most transitions in the 150–300 ms range.
- **Responsive:** check 375, 768, 1024, and 1440 px widths. No horizontal scroll at phone width.
- **Modes:** support light and dark themes if the project does, and check contrast in both.
- **Feedback:** loading, empty, error, and success states exist for any async action.
- **Forms:** errors appear next to the field that caused them, with helper text where the expected format is not obvious.
- **Typography:** body text is at least 16 px with a line height near 1.5. Use no more than two font families.

## 4. Verify, do not assume
- After a UI change, render the result when a browser or preview is available. Look at it at more than one width, and check the console for errors.
- Check contrast of any new color pair with a tool or calculator, not by eye.
- Walk the main flow once with the keyboard only.
- If you cannot verify something, say so in the final report instead of implying it passed.

## 5. Report in this shape
1. **Design decisions:** style, palette, type pairing, and the reason for each.
2. **Changed files:** list them.
3. **Checks run:** contrast, keyboard, responsive widths, console errors, modes.
4. **Open issues:** anything not done, not verified, or needing a brand or product decision.

## 6. Ask before
- Redesigning an existing product's overall look, or changing its brand, colors, or logo.
- Adding a new dependency or design library.
- Changing information architecture or navigation structure.
