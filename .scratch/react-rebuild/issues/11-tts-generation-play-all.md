# 11: TTS generation + Play-all

**What to build:** Automatic text-to-speech for study items without recordings, and a play-all button for hands-free study sessions. When the user presses play on an item with no recording, the system calls OpenAI TTS, saves the generated audio as primary, and plays it. A spinner shows during generation. The user's own recording replaces TTS as primary. A play-all button plays through all items in the current filtered list sequentially.

**Blocked by:** 10 (Audio recording for study items)

**Status:** deferred — after the portfolio MVP (2026-09-13, owner)

**Why:** wanted, not dropped. The owner's priority is a showable MVP; this
comes off the back burner once that ships. Distinct from ticket 08's old
wontfix: nothing here has been decided against.

- [ ] Backend: TTS generation endpoint — accepts study item ID, calls OpenAI TTS API (voice: nova, quality: tts-1), generates audio from item's notes, saves as AudioRecording with is_generated=True and is_primary=True
- [ ] Backend: TTS endpoint returns the audio file for immediate playback
- [ ] Frontend: press play on item with no recording → call TTS endpoint
- [ ] Frontend: spinner replaces play button icon during TTS generation
- [ ] Frontend: audio plays automatically when TTS response arrives
- [ ] Frontend: TTS-generated audio saved permanently, subsequent plays are instant
- [ ] Frontend: when user records their own audio, it replaces TTS as primary
- [ ] Frontend: TTS audio is NOT regenerated when notes are edited
- [ ] Frontend: play-all button on study page
- [ ] Frontend: play-all plays through all items in the current filtered list sequentially
- [ ] Frontend: play-all skips items with no audio and no notes (TTS has no text to generate from)
- [ ] No file size limit on recordings
