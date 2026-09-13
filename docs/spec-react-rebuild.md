# React Frontend Rebuild — TypeScript + React SPA replacing vanilla JS

**Label:** ready-for-agent

## Problem Statement

The TrackApp frontend is a vanilla JavaScript SPA with no framework, built as one esbuild IIFE bundle per page. It works but is difficult to extend — adding new features (spaced repetition, scheduled tasks, audio recording, TTS) requires manual DOM manipulation, hand-rolled state management, and duplicated patterns across controllers. There is no optimistic UI system, no component reuse, and no test coverage on the frontend.

## Solution

Rebuild the frontend as a single-page TypeScript + React application. The Django REST API backend stays and will be extended for new features. The new frontend consumes the same API endpoints, adds new ones where needed, and introduces optimistic UI, spaced repetition, scheduled tasks, audio recording, TTS generation, and a comprehensive design system based on CSS custom properties.

## User Stories

### Time Tracking
1. As an account holder, I want to start a stopwatch timer with a task title, so that I can track how long I spend on work.
2. As an account holder, I want to start a countdown timer with a chosen duration, so that I can work within a fixed time box.
3. As an account holder, I want the countdown input to reject non-numeric values, so that I don't accidentally set an invalid duration.
4. As an account holder, I want only one timer running at a time, so that my tracking stays unambiguous.
5. As an account holder, I want to pause and resume a running timer, so that breaks don't inflate my tracked time.
6. As an account holder, I want to log a break during a session, so that the break can become its own recorded entry.
7. As an account holder, I want stopping a timer to immediately create a time entry in the UI, so that I see the result without waiting for the server.
8. As an account holder, I want my timer state to survive page reloads and device switches, so that I never lose an in-progress session.
9. As an account holder, I want to manually enter a time entry without a live timer, so that I can log work after the fact.
10. As an account holder, I want manual entry to default start time to the end of my last entry and end time to now, so that I can log quickly.
11. As an account holder, I want to see today's time entries and moments in a single list (most recent first), so that I have a complete view of my day.
12. As an account holder, I want a persistent bar showing elapsed time on every page when a timer is running, so that I always know my timer status.
13. As an account holder, I want a countdown percentage indicator showing how much time I've used, so that I can pace myself.

### Projects & Tasks
14. As an account holder, I want to create projects with a name, description, and color, so that I can organize my work.
15. As an account holder, I want to create tasks optionally inside a project, so that I can structure my time entries.
16. As an account holder, I want deleting a project to leave its tasks unassigned (not deleted), so that I don't lose task history.
17. As an account holder, I want to archive a project or task without losing history, so that I can declutter without data loss.
18. As an account holder, I want to see total tracked time per task and per project, so that I can evaluate where my time goes.

### Moments
19. As an account holder, I want to log a moment with one button press, so that I can capture a thought instantly.
20. As an account holder, I want a moment to appear in the list immediately (optimistic UI), so that I don't wait for the server.
21. As an account holder, I want to edit or delete a moment after creation, so that I can fix mistakes.
22. As an account holder, I want to record a voice-only moment (audio without text), so that I can capture thoughts hands-free.
23. As an account holder, I want to see playback count on voice moments, so that I know how often I've revisited them.

### Habits
24. As an account holder, I want to define a habit with independent daily, weekly, and monthly targets, so that I can track at multiple time scales.
25. As an account holder, I want to log habit progress with one action that updates all three counters, so that logging is fast.
26. As an account holder, I want counters to reset automatically at the start of each new day/week/month in my timezone, so that my tracking stays accurate.
27. As an account holder, I want my streak to track consecutive days the daily target was met and reset to 1 (not 0) after a gap, so that I see my consistency.
28. As an account holder, I want logging against an inactive habit to have no effect, so that paused habits stay frozen.
29. As an account holder, I want to archive a habit without losing history, so that I can retire habits cleanly.
30. As an account holder, I want to remove a mistaken habit log entry, so that my counts stay accurate.
31. As an account holder, I want to log a habit entry for a past date, so that I can back-fill missed entries.

### Study Workflow
32. As an account holder, I want to add a study item with a title, notes, category, and optional images, so that I can build my study collection.
33. As an account holder, I want to record audio against a study item, so that I can practice pronunciation or recall.
34. As an account holder, I want multiple recordings per study item with exactly one marked as primary, so that I can keep my best take.
35. As an account holder, I want to promote any recording to primary, so that I can control which one plays by default.
36. As an account holder, I want the system to track creation date, playback count, and last-played date per recording, so that I can see my engagement.
37. As an account holder, I want pressing play to always play the primary recording, so that playback is predictable.
38. As an account holder, I want pressing play on an item with no recording to generate audio via TTS (OpenAI), save it as primary, and play it, so that every item is playable.
39. As an account holder, I want a spinner on the play button while TTS generates, then automatic playback when it arrives, so that I know something is happening.
40. As an account holder, I want TTS-generated audio saved permanently so subsequent plays are instant, so that I only wait once per item.
41. As an account holder, I want my own recording to replace TTS-generated audio as primary when I record one, so that my voice takes priority.
42. As an account holder, I want a play-all button that plays through all items in the current filtered list sequentially, so that I can study hands-free.
43. As an account holder, I want to log a prime interaction on any item, so that I can track exposure.
44. As an account holder, I want to log a study interaction on any item that has notes, so that I can track deep engagement.
45. As an account holder, I want the system to record first-ever and most-recent dates for both prime and study interactions, so that I can see my history.
46. As an account holder, I want to archive and restore study items, so that I can manage my collection.
47. As an account holder, I want to filter study items by category, so that I can focus on a topic.
48. As an account holder, I want categories to autocomplete from existing values, so that I stay consistent.

### Spaced Repetition
49. As an account holder, I want a "Spaced" mode that shows only items due or overdue for review, so that I study at optimal intervals without over-studying.
50. As an account holder, I want the system to automatically schedule the next review at progressively longer intervals (1, 3, 7, 14, 30, 60, 120 days) after each interaction, so that I retain knowledge efficiently.
51. As an account holder, I want either a prime or study interaction to count as a review and push the schedule forward, so that any engagement counts.
52. As an account holder, I want an "All" mode that shows every item ordered by least-recently-touched (never-touched first), so that I can browse and find anything.
53. As an account holder, I want the mode selection (Spaced vs All) to persist across sessions, so that I don't have to re-select each time.
54. As an account holder, I want a reset button on a study item to restart its spacing schedule from the beginning, so that I can re-learn forgotten items.
55. As an account holder, I want new study items to appear immediately in the Spaced view but at the back of the due list, so that I interact with them without jumping the queue.

### Dashboard & Stats
56. As an account holder, I want a dashboard showing total time tracked and breakdown by task for today, yesterday, this week, and this month, so that I can review my productivity.
57. As an account holder, I want prime/study interaction counts in the same period view, so that I see all activity together.
58. As an account holder, I want all period boundaries computed in my timezone, so that "today" means my today.
59. As an account holder, I want habits shown in compact mode on the dashboard (daily count, weekly count, streak), so that I get a quick status.
60. As an account holder, I want scheduled tasks listed in ascending chronological order, so that I see what's coming up.

### Scheduled Tasks
*In scope as a **daily task scheduler in the workspace**, not a calendar
(2026-09-13). No grid, no week or month view: pick a day, list its tasks in
order, start one. A page called "Calendar" would promise a feature set this
isn't building.*

61. As an account holder, I want to create a scheduled task with a title, start time, end time, optional project assignment, and optional notes, so that I can plan my day.
62. As an account holder, I want a workspace page where I create and manage projects and scheduled tasks, so that I have a planning hub.
63. As an account holder, I want the workspace to show a chosen day's scheduled tasks in chronological order, so that I can see my day at a glance.
64. As an account holder, I want a start button on each scheduled task that immediately starts a timer, so that I can begin working with one tap.
65. As an account holder, I want the system to log both scheduled start time and actual start time when I begin a scheduled task, so that I can compare plan vs reality.
66. As an account holder, I want the time entry from a completed scheduled task to appear alongside other entries in the day's log, so that my record is complete.

### Optimistic UI & Error Handling
67. As an account holder, I want every create/update/delete action to reflect immediately in the UI without waiting for the server, so that the app feels instant.
68. As an account holder, I want the UI to revert the change and show an error toast if the server rejects a mutation, so that I know something went wrong.
69. As an account holder, I want error toasts to disappear after a few seconds, so that they don't clutter the screen.

### Midnight Rollover
70. As an account holder, I want the app to automatically refresh all day-dependent data when midnight passes in my timezone, so that I'm always looking at the current day.
71. As an account holder, I want the app to catch up on the day change if my device was asleep at midnight, so that stale data doesn't persist.

### Data Portability
72. As an account holder, I want a download button in settings that exports all my data as JSON, so that I can back up my data.
73. As an account holder, I want a file upload in settings that imports a JSON backup, upserting records without duplicates, so that I can restore or migrate data.

### Access Control
74. As an account holder, I want to be blocked from using the app after my trial expires but never have my data deleted, so that I can reactivate later.
75. As an account holder, I want the trial-expired page to show a contact link, so that I can request access.
76. As an account holder, I want grandfathered accounts to have permanent access, so that existing users aren't disrupted.

### Auth
77. As an account holder, I want JWT auth with automatic token refresh, so that I stay logged in without manual re-authentication.
78. As an account holder, I want to be redirected to login when my session expires, so that I know to re-authenticate.

## Implementation Decisions

### Frontend Stack
- TypeScript + React (single-page application)
- React Router v6 for client-side routing
- TanStack Query (React Query) for server state, caching, optimistic updates, and rollback
- CSS Modules for component-scoped styles
- All visual values via CSS custom properties (design tokens) — no hardcoded colors, spacing, or sizes
- React Testing Library + MSW (Mock Service Worker) for frontend tests
- Custom toast component for error notifications (no library dependency)

### Design System
- Dark theme: near-black backgrounds (#0a0a0a), coral accent (#e8613a)
- Two font families: Inter (sans) for content (headings, body, notes); JetBrains Mono (mono) for UI chrome (nav, labels, tags, timestamps, timer display)
- Mobile-first: base styles target mobile, min-width queries for larger screens
- Touch target minimum: 44px
- Component-scoped CSS modules; global styles limited to tokens, resets, typography
- Accent is rationed — only allowed on: active nav underline, links, primary CTA button fill, kicker labels, selected tags, left-border callout stripes

### Routing
| Route | Page |
|---|---|
| / | Dashboard (period selector: today / yesterday / week / month) |
| /timer | Timer + today's log |
| /workspace | Projects + scheduled tasks for a day |
| /study | Study items (Spaced / All toggle) |
| /habits | Habit management and logging |
| /settings | Account, export/import |
| /login | Login |
| /verify-email | Email verification |
| /trial-expired | Trial expired + contact link |

### Optimistic UI Pattern (Uniform)
All mutations (create/update/delete across all types) follow the same pattern:
1. Apply change optimistically via TanStack Query onMutate
2. Fire API call
3. On success: no action (UI is already correct)
4. On failure: revert via onError rollback, show error toast (auto-dismiss after 3-4 seconds)

### Midnight Rollover
- setTimeout targeting midnight in the user's timezone
- On fire: invalidate all TanStack Query caches for day-dependent data
- visibilitychange listener as safety net for sleep/wake

### Spaced Repetition
- No manual recall rating — automatic spacing based on interaction history
- Either prime or study interaction counts as a "review"
- Fixed interval sequence: 1, 3, 7, 14, 30, 60, 120 days
- interval_index tracks position in the sequence; advances on each review
- next_due_date computed as last_reviewed_at + intervals[interval_index]
- Reset button sets interval_index back to 0 and next_due_date to today
- New items: interval_index = 0, next_due_date = now (due immediately, sorted to back of due list)
- Spaced mode: only shows items where next_due_date <= now
- All mode: shows everything, ordered by least-recently-touched (never-touched first)
- Mode selection persisted in localStorage

### TTS Generation
- Provider: OpenAI TTS
- Voice: nova, quality: tts-1 (hardcoded constants)
- Generated on first play — no pre-fetching
- Spinner replaces play button while generating; audio plays automatically on response
- Generated audio saved as an AudioRecording with an is_generated flag
- User recording replaces TTS as primary
- TTS audio is NOT regenerated when notes are edited — user deletes and re-plays to regenerate
- No file size limit on recordings

### Audio Recording Model
- New AudioRecording model shared by study items and moments
- Fields: study_item FK (nullable), moment FK (nullable), audio_file, is_primary, is_generated, duration_seconds, playback_count, last_played_at, created_at
- One primary per parent (study item or moment); constraint enforced at DB level

### Backend Extensions Needed
- AudioRecording model + CRUD endpoints + upload/set-primary/delete actions
- TTS generation endpoint (calls OpenAI, saves AudioRecording)
- ScheduledTask model (separate from Task): title, scheduled_start, scheduled_end, notes, project FK (nullable), user FK
- TimeEntry extended: nullable scheduled_task FK + is_scheduled boolean + scheduled_start field
- StudyItem extended: next_due_date (DateTimeField), interval_index (IntegerField), update log_interaction() to advance the spaced repetition schedule
- TimeEntry and Moment: add archived boolean field + archive/unarchive actions
- Export/import API endpoints (wrapping existing management commands)

### Scheduled Task to TimeEntry Flow
- ScheduledTask is a distinct model from Task
- Starting a scheduled task creates an ActiveTimer and logs both scheduled_start and actual start time
- Stopping creates a TimeEntry with scheduled_task FK, is_scheduled=True, and both start times preserved
- Notes live on ScheduledTask only, not duplicated to TimeEntry

### Subscribe Flow
- Out of scope for this rebuild
- Trial-expired page shows contact link
- is_subscribed flag flipped manually in the database

### Registration
- Registration endpoint exists but UI stays hidden (same as current state)

## Testing Decisions

### What makes a good test
Tests verify external behavior from the user's perspective, not implementation details. A test should break only when the behavior changes, never when code is refactored internally.

### Testing seam
The HTTP API boundary. Frontend tests mock the API with MSW; backend tests hit the real Django database. One seam, two sides.

### Frontend tests (React Testing Library + MSW)
- Render components, simulate user interactions, assert on DOM output
- MSW intercepts API calls and returns controlled responses
- Test: optimistic updates appear immediately, rollbacks revert on error, toast appears on failure
- Test: spaced repetition ordering (due items only in Spaced mode, least-recent-first in All mode)
- Test: midnight rollover triggers cache invalidation
- Test: timer state persistence across navigation
- Test: countdown percentage indicator updates
- Test: mode selection persists in localStorage
- Test: play button shows spinner during TTS generation
- Test: new study items appear at back of due list

### Backend tests (Django TestCase)
- Test: habit counter resets at timezone-aware day/week/month boundaries
- Test: streak logic (consecutive days, gap resets to 1)
- Test: single active timer constraint
- Test: spaced repetition schedule advances on log_interaction
- Test: scheduled task start logs both scheduled and actual times
- Test: archive flag on TimeEntry and Moment
- Test: audio recording primary flag constraint (one per parent)
- Test: TTS generation saves AudioRecording with is_generated=True
- Test: export/import upserts without duplicates

### Prior art
- Backend: backend/tracker/tests.py (Django TestCase)
- Frontend: no existing tests — this rebuild establishes the test suite

## Out of Scope

- Native apps (iOS, macOS, Apple Watch) — separate project
- CLI and Raycast extension — already working, unaffected by this rebuild
- Cross-device real-time sync (polling on focus is sufficient for v1)
- Subscription / payment integration (Stripe etc.)
- Registration UI (endpoint exists, button stays hidden)
- Background job queue infrastructure
- Offline mode
- Study item linking (bidirectional links between items) — deferred to a future iteration
- Grace / freeze days for habit streaks
- Push notifications (requires background job queue)

## Further Notes

### Existing documentation
All requirements, use cases, domain analysis, and design specs are maintained in Obsidian. The design spec (12-design-spec.md) is the single source of truth for all CSS tokens and component rules.

### Backend API reference
The backend API is documented in CLAUDE.md at the repo root (gitignored). All endpoints require JWT auth. UserOwnedViewSet scopes every query to the authenticated user. The frontend sends x-user-timezone header for date boundary calculations.

### Fonts
Font files (Inter, JetBrains Mono) are in frontend/fonts/. The React app references the same files.

### CLAUDE.md is gitignored
Do not commit CLAUDE.md — it contains local development context only.
