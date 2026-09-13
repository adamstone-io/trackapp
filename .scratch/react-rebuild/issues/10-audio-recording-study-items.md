# 10: Audio recording for study items

**What to build:** The ability to record, manage, and play back audio on study items. Each study item can have multiple recordings with exactly one marked as primary. The user can upload a recording, promote any recording to primary, delete recordings, and play the primary recording with playback tracking.

**Blocked by:** 06 (Study page core)

**Status:** deferred — after the portfolio MVP (2026-09-13, owner)

**Why:** wanted, not dropped. The owner's priority is a showable MVP; this
comes off the back burner once that ships. Distinct from ticket 08's old
wontfix: nothing here has been decided against.

- [ ] Backend: AudioRecording model (study_item FK nullable, moment FK nullable, audio_file, is_primary, is_generated, duration_seconds, playback_count, last_played_at, created_at)
- [ ] Backend: one-primary-per-parent constraint enforced at DB level
- [ ] Backend: AudioRecording CRUD endpoints (upload, list, delete)
- [ ] Backend: set-primary action (promotes a recording, demotes previous primary)
- [ ] Backend: playback tracking endpoint (increment playback_count, update last_played_at)
- [ ] Frontend: record audio button on study item detail
- [ ] Frontend: list recordings for an item, show which is primary
- [ ] Frontend: promote any recording to primary
- [ ] Frontend: delete a recording
- [ ] Frontend: play button plays the primary recording
- [ ] Frontend: playback count and last-played date displayed per recording
- [ ] Frontend: creation date displayed per recording
