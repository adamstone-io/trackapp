# 19: Mobile pass

**What to build:** The app survives a phone; it was never designed for one.
There are two width-based media queries in the whole frontend (the container
padding bump in `tokens.css`, and `ManualEntryForm`'s layout), and everything
else only works narrow because the layout discipline is good — flex with wrap,
`min-width: 0` throughout, rem-based tokens. This ticket makes the phone a
considered target rather than a lucky one.

**Owner decision (2026-09-14):** the mobile nav is a **burger menu**, not a
tightened row and not a bottom tab bar.

**Already done (2026-09-14, commit 70a6b39)** — a stopgap, not this ticket:
under 640px the nav's gap and type tighten so six labels fit ~375px instead of
~480px, the timer bar drops its task title, and the day log's inline edit field
no longer holds a `min-width` floor wider than its row. The burger replaces the
tightening; the timer-bar and edit-field fixes stand.

**Blocked by:** nothing — every page it touches exists.

**Status:** ready-for-agent

- [ ] Burger menu for the nav under the mobile breakpoint: trigger in the bar,
      panel listing all six destinations. Reuse `components/RowMenu`'s dropdown
      behaviour where it fits (outside-click and Escape to close, focus returned
      to the trigger) rather than writing a second dropdown; extract the shared
      part if it does not fit as-is
- [ ] The panel closes on navigation — a menu still open over the page you just
      moved to is the classic bug here
- [ ] Keep the timer readout in the bar, outside the burger (see below)
- [ ] `viewport-fit=cover` in `index.html` plus `env(safe-area-inset-*)` on the
      fixed nav and the page's bottom padding. Right now a notched iPhone can
      put the nav under the status bar and the last row under the home indicator
- [ ] Habit chain strip: 28 cells across ~340px is ~12px per 8px dot. Drop to 14
      days under the breakpoint, or scroll the strip — pick one and say why in
      the CSS
- [ ] Fortnight trend: same question, 14 columns on a phone. It may be fine;
      check it on a real 375px viewport before changing anything
- [ ] Sweep the remaining fixed floors for narrow-screen overflow. `min-width`
      beats `max-width`, so any `min-width` in rem is a candidate:
      `RowMenu .panel` (11rem), `HabitList` (4.5rem), `ManualEntryForm` (12rem,
      already behind a 768px query)
- [ ] Check every page at 375px and 390px, not just the dashboard

**Testing note:** jsdom does not evaluate media queries against a viewport, so
Vitest cannot cover the breakpoint behaviour — only the burger's open/close and
focus behaviour, which should be tested properly. The layout half of this ticket
is verified by looking at it; say so in the PR rather than implying coverage.

**Requirements:** the burger and the safe-area handling are new product
requirements. Record them in `02-requirements.md` in the Obsidian vault first
(section 2.6 or a new mobile section), then reference the R numbers here — the
vault is canonical, this file is not.

**Implementer's call, not the owner's — overturnable:** the burger holds the six
destinations and nothing else; the timer readout stays in the bar beside it.
`TimerBar` lives in the nav so a running timer is glanceable from any page, and
a burger that swallows it defeats R9c and ticket 18. Costs ~70px of bar, which
is affordable once six labels are behind the trigger.
