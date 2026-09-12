# 17: Countdown completion sound

**What to build:** When a countdown timer reaches zero, play an audible completion sound (requirement R2b, added 2026-09-13). The legacy app already does this (`frontend/js/controllers/timer-controller.js` plays `frontend/sounds/timer-finished/alert-04/alert-04-short.mp3` on countdown-zero); the behavior was dropped in the rebuild because it was never captured as a requirement.

**Blocked by:** 02 (Timer page)

**Status:** done (2026-09-13)

- [x] Reuse the legacy sound asset (`alert-04-short.mp3`), bundled via Vite — copied to `web/src/assets/sounds/timer-finished.mp3`
- [x] Play the sound in the countdown-zero auto-stop path (`TimerControls`), once per expiry — `playTimerFinishedSound()` in `web/src/lib/sounds.ts`
- [x] No sound on manual stop — countdown expiry only (matches legacy)
- [x] Test: sound plays when the countdown reaches zero (module mocked in `TimerPage.test.tsx`)

**Out of scope:** playing the sound when the countdown expires while the user is on a page other than /timer — the auto-stop itself only fires from the timer page today; if that moves to an app-level seam later, the sound moves with it.
