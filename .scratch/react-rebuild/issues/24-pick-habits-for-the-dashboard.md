# 24: Pick which habits reach the dashboard

**What to build:** the dashboard drew every active habit. With thirteen of
them the card is a wall, and R33a's "at a glance" stops being true.

**Owner decision (2026-09-24):** a habit can be picked out for the dashboard,
and only picked ones show there. With none picked, the dashboard falls back to
the first three registered.

**Status:** done (2026-09-24)

New requirements recorded first in the vault: **R33f** (pick which appear) and
**R33g** (the first three registered when none are picked).

- [x] `Habit.is_favorite`, defaulting false — migration `0019_habit_is_favorite`
- [x] Patchable through the existing habit endpoint; the serializer excludes
      only `completed_dates`, so it came back on the list for free
- [x] `features/dashboard/dashboardHabits.ts` holds the selection rule on its
      own, away from the card that renders it
- [x] The fallback sorts by `created_at` — the only ordering that does not
      shift under the person as they log things — and leaves retired habits out
- [x] Picking one habit shows one, not one topped up to three: picking is a
      choice, and the fallback is for the absence of one
- [x] The habits page's row menu toggles it, labelled "Show on dashboard" /
      "Hide from dashboard"
- [x] A newly created habit is not picked — it would displace what is already
      on the card
- [x] 2 Django tests, 5 Vitest tests

**On the label:** the owner asked for "favourite". The field is `is_favorite`,
matching the codebase's existing American spelling (`DurationFavorite`,
`tempotrack_favorites_duration`), but the menu says "Show on dashboard"
because that is what the action does — "favourite" names the flag and says
nothing about where the habit turns up. Easy to change if the other word is
wanted on screen.

**Deployment:** migration `0019_habit_is_favorite`, and the API wants
deploying before the frontend — an older API returns no `is_favorite`, so
every habit reads as unpicked and the dashboard shows the oldest three. That
degrades quietly rather than breaking, unlike the password reset.
