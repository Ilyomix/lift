# Lift interface patterns

The source of truth is `src/components/ui.tsx` and the light/dark, blue/orange tokens in `src/index.css`. Preserve Geologica, neutral surfaces and one signal accent.

- Use `Button` for actions, `LinkButton` for navigation links and `IconButton` for icon-only actions. Interactive buttons have a minimum 44 px height; large actions have a 52 px minimum. Full-width labels can wrap without clipping. Compact calendar date grids remain an intentional exception.
- Use `Disclosure` for expandable content. Its native summary supports keyboard interaction, uses the shared chevron instead of a browser triangle, and has a minimum 52 px height. Set `bordered={false}` inside a card that already provides separators.
- Use `Segmented` for a choice of view or filter. Its buttons expose their pressed state. `layout="fit"` stays within a narrow container; the default scroll layout is for larger option sets.
- Page headers integrate 64 px illustrations beside their title; section/menu artwork is 32 px. Do not add a separate decorative header object.
- Forms use `Field` and `inputClass`: labels above fields, minimum 16 px input text, theme-token placeholders and visible validation errors. Save actions name their result.
- Let a section action, date navigation or long label move onto another line. Do not reduce text or input width to preserve a desktop row on a phone.
- Exercise view controls remain together. Keep gesture instructions accessible to assistive technology without repeating a permanent caption between controls and muscle information.

For UI changes, check the affected real components at 320 px and a larger width, in French and English and both themes. Inspect open/closed disclosures, long labels, keyboard focus and populated inputs, not only empty screens. Keep test fixtures and example data outside the shipped app.
