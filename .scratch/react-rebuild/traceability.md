# React rebuild — ticket ↔ requirements map

Which numbered requirements (from `02-requirements.md` in the Obsidian vault) each
ticket implements. Maintain it by hand: when a ticket's scope changes or it closes,
update its row here.

**Amendment convention:** a closed ticket never reopens. Follow-up work on the same
seam gets its own file numbered `NN.1`, `NN.2`, … with a `Parent: NN` line and its
own status/checklist. Chains may grow without limit — a long chain is evidence the
original ticket was scoped too small, not something to restructure away.

| Ticket | Status | Requirements |
|---|---|---|
| 01 Scaffold + Auth + Design system | done | R41 (verify-email gate, web), R43 (trial-expired block, web), R45b, R46 |
| 02 Timer page + timer bar | done | R1, R2, R2a, R3, R4, R6, R7 (same-device reload), R8, R8a, R9, R9a, R9d, R9e |
| 02.1 Breaks during a timer session | ready | R5 |
| 03 Moments (in the day log) | done | R15, R15a, R17 (edit only — removal moved to 13), R9g (landed with 03's follow-up commits, 599d1a5) |
| 04 Habits page | done | R18, R19, R20, R21, R22, R23, R23b, R23c |
| 04.1 Undo a back-filled habit day | needs-triage | R23b (back-fill half) |
| 05 Projects page (was "Workspace") | done | R10, R11, R12, R13, R14, R60 (projects half), R61 |
| 05.3 Workspace form rows | done | — (UI defect) |
| 05.4 Time entry ↔ project | done | R10, R11 (time attributed to a project) |
| 05.6 Workspace becomes Projects | done | R60 (projects half) |
| 05.5 See a project's time entries | done | R12 (project detail) |
| 06 Study page core | done | R24, R27, R27a, R28, R29, R30, R31s |
| 06.1 Study item links | ready | R29a, R29b |
| 06.2 Study prompt + note images | done | R24 (images half) |
| 06.3 Study reveals the answer | done | R27a (study interaction), R24 (answer is text or image) |
| 06.4 Study row creation date + recency | done | R28 (dates shown per item) |
| 06.5 Study images fill the row | done | R24 (images half) |
| 06.6 Prompt is text or an image | done | R24 (prompt half) |
| 06.7 Prime/Study confirmation sound | done | R27a (legacy parity) |
| 06.8 Add study item above the list | done | — (UI) |
| 07 Dashboard (period selector; no separate /stats) | ready | R31, R32, R33, R33a |
| 08 Scheduled tasks + Calendar | **wontfix — out of rebuild scope** | R33b, R60 (scheduled-tasks half), R62, R62a, R63, R63a, R64, R64a, R64b |
| 09 Spaced repetition | ready | R31t, R31u, R31v |
| 10 Audio recording for study items | ready | R24a, R24b, R24c, R24d, R24e |
| 11 TTS generation + Play-all | ready | R24f, R24g |
| 12 Voice moments | ready | R17c |
| 13 Archive/delete TimeEntry + Moment | ready | R9h, R17 (removal half) |
| 14 Settings page (export/import) | ready | R38, R39, R40 |
| 15 Midnight rollover | ready | R33e |
| 16 Edit times on logged items | ready | R9f, R17b |
| 17 Countdown completion sound | done | R2b |

Cross-cutting: **R57a** (optimistic UI on every mutation) is a checklist item on
tickets 02–13 rather than one ticket's scope.

## Gaps — requirement with no ticket

- **R9c** — timer started on any device reflected on all others within 2 seconds.
  No web ticket implements live sync; R7 (reload restore) is the closest and only
  covers fetch-on-load.
- **R57 / R59** — 500ms performance requirements; not ticketed, presumably verified
  ad hoc.

*(Resolved 2026-09-13: R5 → ticket 02.1; R29a/R29b → ticket 06.1. Tickets 12 and 15
gained requirements R17c and R33e.)*

## Dropped from the rebuild (2026-09-13, owner's scope call)

The app's surface is now: Dashboard, Timer (with moments in the day log),
Projects, Habits, Study, Settings.

- **Scheduled tasks + daily calendar** (ticket 08, wontfix) — **R33b, R62, R62a,
  R63, R63a, R64, R64a, R64b**, and R60's scheduled-tasks half, have no ticket
  and are not implemented. A calendar is its own feature; the part worth keeping
  is R64a (scheduled vs actual start), which needs a list rather than a calendar
  and can return as a new ticket.
- **Separate /stats page** — folded into the dashboard (ticket 07). R31/R32/R33
  are still met there via the period selector; only the extra page is gone.
- **R60 wording** — "the workspace is where projects and scheduled tasks are
  created" no longer matches: the page is /projects and holds projects only.
  Needs rewording in the Obsidian requirements doc.

## Not applicable to the web rebuild

Platform/CLI requirements with no web ticket by design: R9b, R17a, R23a (Apple
Watch); R33c, R33d (iOS push); R34–R37 (CLI, already built); R44, R42, R45, R41's
email-sending half (backend, already built); R45a, R47–R53 (native apps, macOS
hotkey); R54–R56 (cross-device sync); R58 (macOS hotkey latency).
