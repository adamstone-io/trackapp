# 09: Spaced repetition

**What to build:** An automatic spacing system for study items. The user toggles between "Spaced" mode (only due/overdue items) and "All" mode (everything, least-recently-touched first). Each prime or study interaction advances the schedule to progressively longer intervals. The user can reset an item back to the beginning. New items appear at the back of the due list. The mode selection persists across sessions.

**Blocked by:** 06 (Study page core)

**Status:** ready-for-agent

- [ ] Backend: add next_due_date (DateTimeField) and interval_index (IntegerField) to StudyItem
- [ ] Backend: update log_interaction() to advance interval_index and compute next_due_date
- [ ] Backend: interval sequence: 1, 3, 7, 14, 30, 60, 120 days
- [ ] Backend: either prime or study interaction counts as a review
- [ ] Backend: reset endpoint sets interval_index=0 and next_due_date=now
- [ ] Backend: new study items created with interval_index=0, next_due_date=now
- [ ] Frontend: Spaced / All mode toggle on study page
- [ ] Spaced mode: only shows items where next_due_date <= now
- [ ] All mode: shows all items ordered by least-recently-touched (never-touched first)
- [ ] New items in Spaced mode appear at the back of the due list
- [ ] Reset button on each study item to restart spacing schedule
- [ ] Mode selection persisted in localStorage
- [ ] Migration to set next_due_date and interval_index for existing study items
