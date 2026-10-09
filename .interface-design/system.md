# Fireflies clone — reference-based design baseline

Saved October 9, 2026 at the user's request. Preserve the original Fireflies
workspace appearance; this is a fidelity baseline, not permission to redesign.

## Direction and hierarchy

- Audience: a single-user workspace reviewing meetings, notes, transcripts,
  tasks, and grounded AskFred answers.
- Feel: restrained, neutral charcoal productivity UI with purple action accents.
- Domain: meeting library, speakers, timestamps, chapters, action items,
  provenance, playback, and meeting-scoped questions.
- Signature: notebook channels + library + docked AskFred; full-screen Notepad
  with icon rail, Smart Search, centered notes, Transcript/AskFred, bottom player.
- Let meeting titles, transcript text, and notes lead. Secondary metadata is
  muted. Avoid generic dashboard statistics, invented heroes, extra icons,
  oversized assistant cards, or pill-shaped prompts absent from references.
- Preserve functional controls while matching their surrounding visual language.
  LLM integration must not change the approved layout or expose API keys.

## Tokens, typography, and depth

Source of truth: `frontend/src/app/globals.css`. Reuse semantic tokens and
existing shadcn/Radix primitives rather than creating competing styles.

| Role | Current dark token |
|---|---|
| Canvas | `--background: #141314` |
| Surface/sidebar | `--surface / --sidebar: #1e1e1f` |
| Elevated input/popover | `--elevated / --popover: #26262a` |
| Primary text | `--foreground: #f5f5f7` |
| Supporting text | `--muted-foreground: #b8b8bc` |
| Metadata | `--subtle: #9a9a9e` |
| Purple action | `--primary: #6938ef` |
| Purple link | `--primary-soft: #8b7cff` |
| Success | `--success: #3ba774` |
| Border | `rgba(255,255,255,0.09)` |

- DM Sans for headings; Inter for body, labels, and transcripts.
- Body 14px; metadata 12px; panel titles 14px; greetings 18–24px; meeting title
  24px/medium. Use weight and muted color for hierarchy, not arbitrary size jumps.
- Spacing base: 4px, typically 8/12/16/20/24/32/40px. Reference-specific geometry
  such as 52px headers is deliberate.
- Depth: subtle surface shifts plus hairline borders; no dramatic shadows or
  purple-tinted page backgrounds. Floating upload queue may have a subtle shadow.
- Radius: roughly 4px compact controls/prompts, 6px standard controls, 8px cards;
  existing Dialog uses 12px. Avoid fully rounded suggestion cards/composers.
- Dialog backdrop: black at 50% with subtle blur; retain Radix focus management,
  Escape, and keyboard behavior. Do not invent exact original modal measurements
  without a reference.

## Layout geometry

Values below are implemented reference-based desktop targets, not claims of
pixel-exact measurement. Keep per-page proportions rather than one universal rail.

| Element | Geometry / behavior |
|---|---|
| Topbar | 56px high; dark surface; global search max-width 320px |
| Full sidebar | 240px; compact 36px navigation rows; secondary navigation at bottom |
| Icon-only sidebar | 56px on library; Notepad owns its separate icon rail |
| Library channels | 250px; full-height alongside topbar, not underneath it |
| Library toolbar | Minimum 72px |
| Home content | max-width 884px including 32px horizontal padding |
| Home AskFred | 320px base; 416px from `xl` |
| Meetings AskFred | 320px base; 480px at `xl`; 584px at `2xl` |
| Notepad header | 56px |
| Notepad Smart Search | 288px base; 348px at `xl` |
| Notepad Transcript/AskFred | 320px base; 480px at `xl` |
| Notepad panel headers | 52px |
| Notes prose | Centered max-width 640px; video spans wider center column |
| Upload main content | max-width 1332px including 40px horizontal padding |
| Upload banner | max-width 1140px |
| Upload drop zone | Minimum 328px high; purple dashed border; canvas fill |
| Upload queue | Bottom-right floating panel; max 475px wide / 65vh high |

`xl` and `2xl` refer to the project's Tailwind breakpoints. Desktop layout was
checked at approximately 1920px and at 1440px; mobile parity remains unverified.

## Reusable component patterns

- **MeetingRow:** transparent resting surface, subtle hover border/surface,
  20px horizontal / 16px vertical padding, thumbnail, title, one metadata line.
  Overflow and outlined Details remain visible without hover. Home can omit
  actions and show compact metadata. Do not reintroduce `hidden group-hover:flex`.
- **AskFred:** one header only, left-aligned greeting, compact rectangular
  suggestions, subdued 14px chat text, and a larger bottom composer. Send control
  is compact and square-rounded, not circular. Keep citations interactive.
- **ConnectContextBanner:** shared across global and meeting AskFred, compact
  purple-tinted surface, integration tiles, copy, Connect, and dismiss control.
- **Smart Search:** 48px filter/sentiment/speaker rows, small radii and hairline
  borders, sentiment percentages rather than tiny inline graphs; purple talk rings.
- **TranscriptTurn:** 20px single-letter square avatar, readable 14px timestamp,
  14px text / 28px line-height, subtle separators, active accent. Never autofocus
  Find on page entry merely to add a large purple ring.
- **Notes:** topic headings and bullets, clickable source timestamps, centered
  prose; preserve summary/task editing and player synchronization.
- **Tasks:** subtle bordered meeting containers, header/row dividers,
  right-aligned assignee labels; shared task editor remains accessible.
- **Editors:** existing Dialog/Input/Select/Button components, readable labels,
  restrained spacing, pending/error states, purple Save, neutral Cancel.

## References and verification

Original screenshots at repository root:

- `original.png`: Home, 1912 × 862.
- `meetings.png`: library, 1917 × 877.
- `upload.png`: uploads, 1917 × 901.
- `notepad1.png`: AskFred/video, 1912 × 887.
- `notepad2.png`: Transcript/video, 1912 × 902.
- `notepad3.png`, `notepad4.png`: notes/action-items/continuation states; some
  captures are cropped and should not be treated as full viewport geometry.

Current captures: `docs/screenshots/after/`; historical baseline:
`docs/screenshots/before/`. Detailed change log and limitations:
`docs/07-VISUAL-PARITY-REVIEW.md`.

For future UI changes:

1. Read this baseline and inspect current source/user changes before editing.
2. Compare fresh screenshots against the relevant original at matching viewport,
   page, tab, scroll position, and content state when possible.
3. Match structure/proportion/spacing first, then typography/color/radius.
4. Run build/lint and verify rendered controls, wrapping, clipping, and errors.
5. Review with the user before advancing phases. Never claim pixel-identical
   parity from compilation alone.

## Known limits

Current sample content differs from the original account. Media, user photos,
thumbnails, and integration tiles are placeholders/approximations. No original
Tasks or actual modal-dialog reference is present in the saved root screenshot
set. Do not fabricate recordings, copy account images, or infer unsupported
reference details. The assignment permits placeholder media and integrations.
