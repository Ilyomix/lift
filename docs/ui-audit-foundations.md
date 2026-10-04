# UI foundations audit — settings and navigation

Audit date: 4 October 2026. Baseline: `79d002d137758d00ea6efd97757fe2f21293d47b`.

Scope: shared components, tokens, decorative artwork, routing, history and swipe navigation. The More/Settings extraction was in progress during this audit; its temporary import errors are not product findings. This is a source-level audit with focused executable checks, not a claim of complete accessibility or visual conformance. No native code, user data or 3D assets were changed.

## Verdict and verified findings

The existing system is coherent enough to reuse: Geologica, one signal accent, neutral surfaces, shared controls and conservative navigation. The regrouping should change where settings live, not invent a second visual system.

| Priority | Verified baseline issue | Evidence and impact | Resolution in this pass |
| --- | --- | --- | --- |
| P2 | A malformed hash can interrupt route rendering. | `src/lib/router.ts`, `useRoute`, directly mapped `decodeURIComponent`. `#/plus/%` and `#/plus/%E0%A4%A` both throw `URIError` before `Routes` can render its fallback. | `decodeRouteHash` returns the home route for malformed escapes. Tests also preserve historical hashes, UTF-8 names and a literal encoded `%2F` in an ID. History behavior is unchanged. |
| P2 | Several shared actions violated Lift's own 44 px target rule. | `ui.tsx`: DateInput's clear button was explicitly 36 × 36; MonthCalendar overrode its arrow buttons to 40 × 40; Toaster's action had only text plus 4 px vertical padding and no minimum target. These are separate from the intentionally compact seven-column date grid. | Clear and month buttons are 44 × 44. Toast actions have a 44 px minimum height and width. Date cells remain unchanged. This finding is against the internal target policy; it is not a claim that every smaller target fails WCAG AA. |
| P2 | SPA navigation reset scroll but did not transfer focus to the destination. | `App.tsx`'s route effect only calls `scrollTo`. Menu rows can unmount while focused; neither `router.ts` nor the destination Header supplies route focus management. The code contains no destination announcement/focus step. | New `RouteFocus`, integrated after Routes, focuses the destination `main h1`, or `main` if there is no heading, only on a changed route. It does not focus on initial mount or ordinary state updates and yields to open modal dialogs. Keyboard/screen-reader runtime confirmation remains required. |
| P3 | The reusable menu-row pattern existed only inside More. | The local `MoreMenuRow` combined `Row`, 32 px artwork, a label, a hint and a chevron. A settings hub would otherwise copy this composition. | Extracted `SettingsMenuRow` in `src/components/SettingsMenu.tsx`, preserving the appearance and navigation behavior exactly; `hint` is optional. No additional menu wrapper is needed. |

No contrast defect is asserted here. Theme tokens were inspected, but rendered foreground/background pairs, transparency and computed contrast were not measured in this read-only browser scope. Likewise, possible overflow from long right-hand values is a usage constraint below, not a reproduced overflow finding.

## Settings hierarchy

Keep More a short list of destinations. Keep Settings a hub of six topics, with editing on its child pages:

| Topic | Content owned by the topic | Avoid mixing into the hub |
| --- | --- | --- |
| Goals | Goal mode/date, physique selection and target measurements | Weight fields, explanations of the training plan |
| Training and equipment | Training days, program sessions, equipment/gyms, automatic loads; links to pause and calendar export | A second editable copy of the program |
| Rest and alerts | Rest sound, awake-screen preference, platform notification controls and Live Activity preference | Nutrition or appearance preferences |
| Nutrition targets | Calories, protein policy/range and creatine target | The daily food/nutrition log |
| Appearance | Language, light/dark/system theme, blue/orange accent | Device installation instructions |
| Data and privacy | Backup/restore, deletion entry point, privacy information | Destructive actions directly on the hub |

The hub rows name destinations. A concise hint describes the contents or a useful current state. Do not place toggles, input fields, segmented controls, save buttons or explanatory paragraphs inside a destination row. The whole row has one action. A hint may wrap; no truncation of the destination name.

Subpages contain one subject. A second-level index is justified for Training and equipment, because it links to established editors with different tasks. Do not create further indexes around one toggle. Explanations may use `Disclosure`; the primary setting remains visible. Preserve existing edit/save semantics rather than introducing an unrelated global Save action.

## Component contract

| Use | Component and rules |
| --- | --- |
| Destination | `SettingsMenuRow` with `to`, `art`, `label`, optional `hint`. It intentionally preserves Lift's existing button-driven `navigate()` behavior. Use a single `Card className="divide-y divide-line"` around related rows. |
| Read-only value | `Row` without `onClick`. Keep the right-hand value short; put long dates, equipment lists or explanations in the hint/body. `Row`'s right area is `shrink-0`, so arbitrary long content is unsuitable there. |
| Command | `Button`; `IconButton` when the icon is an established action and a localized label is supplied. Use `LinkButton` for ordinary link actions. Do not put a button, link or toggle inside a clickable `Row`. |
| Boolean | `Toggle` as its own row. Its wrapping label makes the entire row clickable; the actual checkbox exposes `role="switch"` and checked state. Explain platform permission state separately from the user's stored preference. |
| Short exclusive choice | `Segmented` with a visible section/field caption as needed and its required localized group label. Use `layout="fit"` for a small set that fits/wraps; use the scroll layout for a larger set. Retain `aria-pressed`; it is not an ARIA tablist. |
| Scalar field | `Field` wrapping one labeled control with `inputClass`, with optional `hint` and `error`. Input text remains 16 px and the control 48 px high. A placeholder is an example or fallback, never the only label. Show units in the label. |
| Supporting text | `Disclosure` for an optional explanation. Its native `summary` is keyboard-operable. Inside an already separated card, use `bordered={false}`. Do not hide the only route to a normal setting behind an explanation. |
| Protected/short edit | Existing `Sheet`, with its heading, close button and focus restoration. Full settings topics remain routes; no new full-page settings sheet. |

`Field` preserves its enclosing native label. For one direct `input`, `textarea` or `select` child, it now connects the hint/error through unique `aria-describedby` IDs and sets `aria-invalid` when an error is present. Existing description IDs and other control props are preserved. Messages are outside the label, so they do not inflate the control's accessible name. Errors use the existing `text-bad` token. Custom child components are not cloned: use a direct native control for automatic association, or wire their descriptions explicitly. No unlabeled-field failure was established in this pass.

## Exact spacing and typography

These values come from `ui.tsx` and `index.css`; they are reuse rules, not a new scale.

| Element | Current geometry |
| --- | --- |
| Screen | Maximum 640 px; 16 px horizontal padding; existing safe-area top; bottom space `96px + safe-area-inset-bottom` for tab bar/rest controls |
| Page Header | 8 px top, 20 px bottom; optional 44 px back/action row; 8 px gap between artwork and title |
| Page title | Geologica 32 px, weight 600, line-height 1.05, tracking −0.03 em; wrap naturally |
| Page artwork | 64 × 64 px, adjacent to the title; no standalone illustration row above it |
| Section | 24 px separation above, 12 px between heading and content; first section may use `mt-0` after Header |
| Section heading | 17 px / 24 px, weight 600; wrapping title/action layout with 12 px horizontal and 8 px vertical gap |
| Section/menu artwork | 32 × 32 px; decorative, not an independent interactive target |
| Card | One surface, 1 px `line` border, 12 px radius; no nested decorative cards |
| Destination row | 16 px horizontal padding, 14 px vertical padding; 12 px artwork/text gap; 16 px chevron; label 15 px medium, hint 13 px muted |
| Standard Row / Toggle | Minimum 52 px; 16 px horizontal and 12 px vertical padding; label 15 px / 20 px, hint 13 px / 18 px |
| Field | 13 px caption, 6 px caption-to-input gap; 48 px input, 12 px horizontal inset, 10 px radius; 4 px before a hint |
| Actions | Shared small/medium minimum 44 px, large minimum 52 px; full-width labels wrap |

At 320 px, Screen leaves 288 px for content. A 64 px header illustration plus 8 px gap leaves 216 px for the heading. A menu row with card border, standard padding, artwork and chevron leaves approximately 182 px for label/hint. Long French/English labels therefore need more height, not a smaller font, clipped text or a narrower input.

Use `text-text` for labels, `text-text-2` for secondary content and `text-muted` for genuine supporting detail. Use `text-signal-text` for accent text, rather than using the colored fill token as a text color. Use `signal` with `signal-ink` for filled active controls. Preserve the separate semantic text/mark tokens. Do not introduce route-specific hex colors.

## Artwork and motion

`SportArt` already hides decorative artwork from assistive technology, reserves its dimensions, shows a static fallback, loads the renderer on visibility and disposes its slot on unmount. The shared renderer watches theme/accent changes, document visibility, native app activity and reduced motion.

Retain this implementation. Do not replace each settings icon with a separate WebGL context or CSS rotation. `sportModelMotion.ts` authors brief internal gestures with staggered cycles of 24–32 seconds; workout clips retain their native six-second gesture and a long rest. Coach stays still. The renderer skips unchanged GPU tiles; it still schedules animation frames while a visible animated model is eligible. This is a source-level observation, not a new battery/cadence measurement.

For reduced motion, keep a useful still illustration and all selected/error states. The current CSS also shortens generic animations to 0.01 ms; no lost state was demonstrated here. Any new animated setting must preserve its meaning without animation.

## Routes, return and legacy links

1. Keep settings under `plus/reglages`. Topic paths may be `objectifs`, `seances`, `repos`, `nutrition`, `apparence`, `donnees`; inner editors such as `jours` and `materiel` may share the prefix. TabBar remains on More because it selects `path[0]`.
2. Give each screen a logical `Header backTo`: hub → `plus`; topic → `plus/reglages`; training editor → `plus/reglages/seances`. `back()` first honors actual Lift history, so entering a shared editor from Calendar returns to Calendar. Its fallback is for direct entry, not a replacement for actual history.
3. Keep old operational routes that still serve the same task. Moving their menu entry alone does not require renaming a URL. In particular, daily nutrition and nutrition targets are different destinations; backup/restore and its settings index are also different destinations.
4. When a route really moves, use a `replace` redirect, following `LegacyProgramRedirect`. Preserve any validated exercise/workout argument; do not add a redirect entry that makes Back loop. Direct legacy entry must still have a useful parent fallback.
5. Preserve both `#/...` and historical `#...` decoding. Decode once per segment. Malformed escapes now produce the home route instead of throwing; no URL contents are executed and no data is changed.
6. Mount `<RouteFocus route={routeKey} />` once alongside Routes, without a route key on RouteFocus itself. It skips initial mount and same-route updates. It focuses the new heading without scrolling or a decorative focus ring. An open Sheet/dialog owns focus and suppresses this step. Verify the actual keyboard/screen-reader result during the parent UI pass.
7. Do not add nested settings paths to `MAIN_ROUTES`/`mainRouteIndex`. Existing swipe code correctly treats them as secondary: only a right swipe starting 20–56 px inside the content edge can invoke actual Back, and only when Lift history exists. With no history, the visible Back button supplies the parent fallback.
8. Preserve exclusions: outer 20 px for the OS/browser, controls, labels, horizontal scrollers, canvases, editable fields, text selection and modal dialogs. A settings toggle or 3D illustration must never become a navigation gesture surface.
9. Route changes currently reset scroll to the top. This pass does not add scroll restoration or alter Calendar's existing shared screen key. Do not silently change those semantics during the menu extraction.

## Validation and remaining runtime checks

Completed:

- Impeccable static detector on `ui.tsx`, `SportArt.tsx`, `SettingsMenu.tsx` and `index.css`: no findings. This does not prove runtime accessibility.
- Malformed hash baseline reproduced with the route's original decoder; regression tests now pass.
- `node --import tsx --test tests/field-accessibility.test.ts tests/router-decoding.test.ts tests/navigation-history.test.ts tests/swipe-navigation.test.ts`: 24 tests pass. Includes real server-rendered input/textarea/select labels and error relationships, unique message IDs, external-history protection, replace/back behavior, secondary-page gestures and control exclusions.
- `npm run typecheck`: passes after the concurrent screen integration completed.
- `git diff --check` on this pass: clean.

One coordinated runtime pass remains appropriate: 320 px and a larger width; French/English; light/dark; populated hints and values. Inspect the six hub rows, the longest subpage title, an expanded explanation and a populated form. Check keyboard route focus, Back, a direct child URL, a legacy alias and an open Sheet. Confirm that a timer/state update does not move focus. Measure contrast only on the rendered token pairs before asserting a ratio. No additional redesign is required by this audit.
