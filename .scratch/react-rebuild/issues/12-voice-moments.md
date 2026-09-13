# 12: Voice moments

**What to build:** The ability to record audio-only moments — capture a thought by voice without typing. The moment is saved with audio, a timestamp, and no text required. Playback count is tracked and displayed. Satisfies requirement R17c (added 2026-09-13).

**Blocked by:** 03 (Moments page), 10 (Audio recording for study items)

**Status:** deferred — after the portfolio MVP (2026-09-13, owner)

**Why:** wanted, not dropped. The owner's priority is a showable MVP; this
comes off the back burner once that ships. Distinct from ticket 08's old
wontfix: nothing here has been decided against.

- [ ] Record audio button on moment creation (reuses AudioRecording model from ticket 10)
- [ ] Create moment with audio recording, timestamp, and optional (not required) text description
- [ ] Moment appears in list immediately (optimistic UI)
- [ ] Play button on voice moments plays the recording
- [ ] Playback count displayed on voice moments
- [ ] Last-played date tracked
