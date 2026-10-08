# 01 — UI/UX Research: The Fireflies Design System

> **Purpose:** the assignment says *"your application should totally resemble Fireflies's design — study Fireflies's UI carefully before starting."* This document is that study. Everything below was extracted from (a) the 30 screenshots in `fireflies_ui_ss/` (analyzed visually), (b) the official Fireflies knowledge base (guide.fireflies.ai), (c) the Fireflies blog (Notepad UI improvements), and (d) the fireflies.ai marketing site + product demo video transcript.
>
> Every design token and layout decision in the implementation should trace back to this document.

---

## 1. Brand identity

| Element | Finding |
|---|---|
| Mascot | **Fred** — the pink firefly; leads the brand ("20M+ people trust Fred") |
| Logo mark | Rounded-square dark tile containing a stylized **"F"** in a **pink → magenta/fuchsia gradient** (~#FF3D8B → #C2185B). Used as app avatar, notetaker avatar, and favicon |
| Wordmark | lowercase `fireflies.ai`, clean sans-serif |
| Notetaker | Circular avatar with the pink **F** mark — "Fireflies.ai Notetaker" joins calls as a participant |
| Voice | Friendly, productivity-focused: "Your #1 AI employee", "Get ready for your meeting" |

## 2. Typography (official — from Fireflies' own blog)

> "We've changed our Notepad fonts to **DM Sans for headings** and **Inter for paragraphs and transcripts**."

| Role | Font | Style |
|---|---|---|
| Headings / greeting / section titles | **DM Sans** | Bold, large; white on dark |
| Body, labels, buttons, meta | **Inter** | Regular/medium; small sizes |
| Timestamps in transcript | Inter (tabular-nums) | Muted gray, small |

Scale (approx, from screenshots): display 28–32px · section 18–20px · body 14px · meta/labels 12–13px.

## 3. Color system (the app is **dark-mode-first**)

The real app canvas is a near-black with a purple tint; panels are one step lighter; borders are hairlines, not shadows.

### Core tokens (dark theme — primary)

| Token | Value | Usage |
|---|---|---|
| `--bg-base` | `#0B0B12` | App canvas |
| `--bg-surface` | `#15151D` | Sidebar, panels, cards |
| `--bg-elevated` | `#1C1C28` | Popovers, active rows, dropdowns, input fields |
| `--border-subtle` | `rgba(255,255,255,0.08)` | Hairline borders, dividers |
| `--text-primary` | `#F5F5F7` | Headings, titles |
| `--text-secondary` | `#A8A8B8` | Body text |
| `--text-muted` | `#6E6E82` | Timestamps, helper copy, placeholders |
| `--brand-purple` | `#7C5CFF` | Primary buttons, active nav/tab, links, focus rings, send buttons |
| `--brand-purple-hover` | `#6B4CF0` | Hover state |
| `--logo-pink` | `#FF3D8B` → `#C2185B` gradient | F logo, pink accents, gradient icon tiles |
| `--success-green` | `#22C55E` | "NEW"/"Upgrade" pills, REC tag, check icons, compliance chips |
| `--warning-amber` | `#F59E0B` | Hero card tints, warm accents |

### Speaker palette (distinct chips — "revised speaker avatars so you can easily distinguish each speaker")

`#FF6FB5 · #FFA94D · #FFD43B · #63E6BE · #74C0FC · #B197FC · #F783AC · #38D9A9 · #E599F7 · #FF8787`

### Shape & elevation

- Cards/panels: **radius 12–16px**; buttons/inputs: **radius 8–10px**; pills fully rounded
- **1px hairline borders** (`rgba(255,255,255,0.08)`) instead of heavy shadows
- Focus ring: 2px `--brand-purple`
- Sidebar ~200px expanded (icon + label rows; active item = dark pill + purple text)
- Comfortable spacing, 8px grid; lists are roomy, not dense

## 4. The app shell (every screen after login)

```
┌──────────┬──────────────────────────────────────────────────────────────┐
│          │  [view title]   [ ⌕ global search (Ctrl+K) ]  [3 free meetings] │
│  VISHESH │  [Upgrade ▾ green]  [🔔]  [  ⚡ Capture ▾ purple ]              │
│  ────────│──────────────────────────────────────────────────────────────│
│  Home     │                                                              │
│  AskFred  │                                                              │
│  Meetings │                    MAIN CONTENT AREA                        │
│  Tasks    │                    (varies per page)                         │
│  AI Skills│                                                              │
│  Analytics│                                                              │
│  Voice    │                                                              │
│  Agents   │                                                              │
│  Upgrade  │                                                              │
│  ────────│                                                              │
│  Email    │                                                              │
│  Integr.  │                                                              │
│  Settings │                                                              │
└──────────┴──────────────────────────────────────────────────────────────┘
```

- **Sidebar**: workspace switcher on top (4-square avatar + name + chevron); nav items with small line icons (lucide-style); active item = rounded dark pill w/ purple text; bottom = "Try Email Assistant", "Integrations", "Settings"
- **Topbar**: view label · centered global search with `Ctrl+K` hint · small chips ("3 Free meetings") · green `Upgrade` · notification bell · **`Capture`** primary dropdown:
  - Add to live meeting → *Coming Soon* toast
  - Schedule new meeting → schedule modal (creates an upcoming meeting)
  - Upload audio or video → upload modal (transcript file + optional media)
  - Start recording → *Coming Soon* toast
- Help/chat bubble pinned bottom-right; floating dismissible promo card bottom-left (dot pagination)

## 5. Screen-by-screen specification

### 5.1 Login (`/login`) — replicates the real login page

- Near-black background; pink **F** logo tile top-left
- H1: **"Get the #1 AI Assistant for Your Meetings"**
- Large buttons: **Continue with Google** / **Continue with Microsoft** (dark surface, brand icon, right-arrow)
- Link: *Use Single Sign-On*; legal microcopy with ToS/Privacy links
- Compliance chip row: `SOC 2 TYPE II · GDPR · HIPAA · 256-BIT ENCRYPTION` (green padlock)
- Right side: dark product mockup card ("Marketing Sync" summary + AI prompt input) + testimonial (Vercel logo, 4.8/5)
- **Our behavior**: any button → mock auth → default user (`Vishesh Gupta`) → redirect to Home

### 5.2 Home (`/`)

- Welcome hero card (amber-tinted border/dark fill): "Welcome aboard, VISHESH!" + subtitle + stylized video thumbnail
- **Quick Start** tiles: `Schedule Meeting` / `Upload File` / `Capture Meeting` — dark tiles with colored icon accents (red/teal/purple), right chevron → all three open our real create flows
- Tabs: **Recent · Upcoming · AI Feed** (segmented dark pills; Settings link right)
- Recent rows: pink gradient square thumb, bold title, gray `Thu, Aug 8 2024, 3:52 PM` subline → click opens Notepad
- "Try More" two cards: Desktop App / Mobile App (Download buttons → Coming Soon toast)
- Dashboard stat strip (our addition, keeps page informative with data): total meetings, minutes recorded, open tasks, upcoming

### 5.3 Meetings Library (`/meetings`) — the "Notebook"

Three panes (matches real app):

```
┌─ channels rail ─┬─ meetings list ────────────────────┬─ (optional) AskFred rail ─┐
│ Search channels│ Meetings         [⌕ title/keyword]  │  AskFred                  │
│ My Meetings  ● │ [Hosted by me | Shared with me]     │  Hi VISHESH!              │
│ All Meetings   │ [Filters ▾]                        │  Get ready for your…      │
│ Voice Agent M. │ ┌────────────────────────────────┐  │  [My action items]        │
│ Uploads (NEW)  │ │ ▐ pink thumb │ Meeting title   │  │  [Key decisions]         │
│ All channels   │ │              │ Oct 5 · 2:30 PM │  │  [Key initiatives]        │
│ + Channel      │ │              │ ●●○ participants│  │  ┌────────────────────┐   │
│                │ │              │ 28 min · tag    │  │  │ Ask anything…      │   │
└────────────────┴ └────────────────────────────────┘  │  └────────────────────┘   │
                                                    └────────────────────────────┘
```

- **Meeting row** (reconstructed from real mockups + demo): colored square thumbnail · **title** · date line (`Mar 15 · 11:30 AM`) · participant avatars (overlapping circles + `+3`) · duration · optional tag chips · 3-dot menu (rename / download / delete)
- Filters dropdown: **date range, participant, tag, duration, source**; sort menu: **Recent (default) · Date · Duration · Title**
- Empty state: "Looks like you haven't recorded a meeting yet" + purple **+ Capture** CTA

### 5.4 Meeting Notepad (`/meetings/[id]`) — **the core screen** ★

From the official guide: *"When you open a meeting, you'll see two panels — **Left: AI summary and notes · Right: Transcript**. You can expand either side or go full screen."*

```
┌─ icon rail ─┬──── AI Summary & Notes (left) ────┬──── Transcript (right) ────────────┐
│ ⌕ SmartSearch│ ← Notebook  Meeting Title      ⋯ │  ┌─ media player (sticky top) ─┐ │
│ ▤ Index     │ participants · Mar 15 · 11:30 AM  │  │ ▶  ─────●────────── 12:34/28:09│ │
│ 🎙 Soundbites│ keyword chips: pricing, launch…  │  │  −5s  1×  +5s        ⬇ export │ │
│ 💬 Comments │ [General Summary ▾] [⧉] [⚡] [✎]  │  └──────────────────────────────┘ │
│ 🔖 Bookmarks│ ┌ Overview ────────────────────┐ │  [⌕ Find] [✎ Edit] [AskFred ▸]     │
│             │ │ meeting overview paragraph   │ │  ┌──────────────────────────────┐ │
│ AskFred ⚡  │ └──────────────────────────────┘ │  │ ● Sarah          00:53        │ │
│             │ ┌ Action items (3) ────────────┐ │  │   Yeah, so the kickoff plan…  │ │
│             │ │ ☐ Send deck to client  — Tom │ │  ├──────────────────────────────┤ │
│             │ │ ☑ Book venue        — Priya  │ │  │ ● Janice         01:24        │ │
│             │ └──────────────────────────────┘ │  │   I can take the design…      │ │
│             │ ┌ Notes ───────────────────────┐ │  └──────────────────────────────┘ │
│             │ │ • Use Case  00:00–10:12      │ │   (active line highlighted purple, │
│             │ │ • Metrics & Goals 10:15–…   │ │    auto-scrolls while playing)     │
│             │ └──────────────────────────────┘ │                                    │
└─────────────┴──────────────────────────────────┴────────────────────────────────────┘
```

Real behaviors to implement (each from official docs/demo):

1. **Two-panel layout** with resizable split (drag divider), expand-left / expand-right / full-screen toggles
2. **Collapsible icon rail** on the left (collapse → thin icon strip, exactly like the real 2024 Notepad update)
3. **Summary panel** sections in order: `Overview` → `Action items` → `Bullet Notes` → `Topics/Outline` (timestamped chapters — click → seek player) → `Metrics`; summary toolbar: **Copy**, **Reprocess (regenerate)**, **Edit**, template dropdown (`General Summary ▾` → Sales / 1:1 / BANT)
4. **Action items**: checkbox rows, assignee chip, due date, add-new inline composer, status persists
5. **Transcript panel**: speaker avatar + name chip (speaker palette color) + `mm:ss` timestamp; **click anywhere on a line → player seeks to that timestamp**; while playing, active line gets purple highlight + auto-scroll (`scrollIntoView block:'nearest'`)
6. **Find in transcript**: search box → all matches wrapped in `<mark>`, match count, prev/next arrows, "filter to matches" toggle
7. **Edit mode** (✏): contenteditable lines with autosave (PATCH per segment), undo via re-edit
8. **Smart Search panel** (icon rail): rule-based filter chips — `Questions · Tasks · Dates · Metrics · Pricing · Sentiment · Fillers` — each shows a count; clicking jumps to matches in transcript; plus **speaker talk-time bars + WPM**
9. **Index panel**: section jump list (Action items, Summary sections, Soundbites)
10. **Soundbites**: select transcript text → "Create Soundbite" popover → clip card (title, mm:ss–mm:ss, play clip, delete, share link)
11. **Comments**: timestamped comments pinned to segments (left-aligned thread bubbles + segment quote)
12. **Bookmarks**: save a moment (segment) with a label
13. **AskFred side panel** (⚡ in icon rail): suggested prompts ("What were the key takeaways?", "When was pricing discussed?", "Summarize the action items") + free-text Q&A with **citations that jump the player**
14. **3-dot menu** next to title: Rename · Regenerate notes · Meeting info · Download (transcript/summary/audio) · Copy link · Delete
15. **Media player**: play/pause, seek bar w/ buffered + played ranges, current/total time, ±5s skip, **speed 0.5–2×**, volume, download, minimize to sticky bar
16. **Export menu**: TXT · Markdown · SRT · VTT · JSON · PDF

### 5.5 Tasks (`/tasks`)

- Segmented toggle **My Tasks / All Tasks**; integration banner (Asana/Trello/monday logos + "Connect" → Coming Soon)
- Task rows grouped by meeting: checkbox, description, assignee avatar+name, due date badge, source meeting link (→ opens Notepad and seeks to origin segment), status pills
- **+ New** opens composer (pick meeting, description, assignee, due date) — real CRUD

### 5.6 AskFred page (`/askfred`)

- Left chat-rail (`+ New Chat`, history); centered greeting "Hi VISHESH, how can I help today?"
- Large prompt input ("Ask anything…" + model chip + attach + mic + purple send)
- Suggested prompt cards: "List my action items & todos for this week" · "Summarize my last meeting" · "Prepare me for the upcoming meeting"
- Answers cite meetings/segments ("From: *Sales Discovery Call* @ 14:32") with jump links
- Footer microcopy: "Consumes AI credits"

### 5.7 Settings (`/settings`) & Integrations (`/integrations`)

- Settings: **General** (name/avatar color — persists), **Summary template** (persists), **Playback** (default speed — persists), **Integrations** (grid → Coming Soon), **Team** (Coming Soon), **Danger zone** (reseed demo data)
- Integrations: real-looking grid (Zoom, Google Meet, Slack, HubSpot, Notion…) with Connect → "Coming Soon" toast

## 6. Interaction & UX patterns

| Pattern | Spec |
|---|---|
| Toasts | Bottom-right (or top), dark surface + colored icon + title/message + close; success green check, error red |
| Modals | Centered dialog, dark elevated surface, radius 16, backdrop blur; forms with primary purple submit |
| Dropdown menus | Dark elevated panel, radius 10, item hover `--bg-elevated`, keyboard navigable |
| Loading | Skeleton rows (avatar circle + text bar) exactly like real app; React Query keeps previous data while refetching |
| Empty states | Icon + bold heading + gray subline + purple CTA (copy lifted from real app) |
| Buttons | Primary: purple solid; Secondary: dark surface + hairline border; Ghost; Pill badges for NEW/Upgrade |
| Focus rings | 2px purple — accessibility (real product is WCAG AA conscious) |
| Light mode | Same hues, inverted surfaces (`#F7F7FA` canvas, white panels, dark text) — bonus toggle |

## 7. Copy bank (verbatim from the real app — use it for authenticity)

- "Welcome aboard, VISHESH!" · "Fireflies is now ready to automate your meetings and streamline your workflows."
- "Capture your first meeting or upload a recording to see Fireflies in action."
- "Looks like you haven't recorded a meeting yet" · "Once you record your first meeting with Fireflies, it'll show up right here."
- "All your meeting tasks in one place" · "Manage, assign and update all your meeting tasks here."
- "Hi VISHESH, how can I help today?" · "Ask anything. Type / to run AI skills."
- "Get the #1 AI Assistant for Your Meetings"
- "Automatically send all your tasks to your work apps."
- Compliance chips: "SOC 2 TYPE II · GDPR · HIPAA · 256-BIT ENCRYPTION"

> **Note on honesty:** we clone the *design and experience*, but all copy and assets in our repo are either this short UI text (standard for a UI clone exercise) or our own seed content. No Fireflies code/assets are copied.
