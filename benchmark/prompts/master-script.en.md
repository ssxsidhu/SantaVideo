# Master v2 script — EN (Mr. Claus voice), one continuous take

Track: `benchmark/out/audio/master-en-v3/master-en-v3.wav` (43.2 s; 1.5 s silent lead-in while Santa reads the letter,
0.7 s pauses, 0.6 s tail). Manifest with the name slot (5.134–7.420 s) sits next to it.

1. "Oh! Ho ho ho! There you are!" — looks up from the letter, delighted surprise
2. **"Hello there, my friend!"** — name slot ("Hello, Emma!")
3. "The elves have told me all about you... and I have to say, I am so very proud of you this year."
4. "You've been kind, you've been brave, and you've been working so hard at growing up."
5. "Now, let me check my list... yes, here you are! Right on the Nice List." — Nice List insert with the child's name
6. "Keep being kind, and get plenty of sleep on Christmas Eve... because that's when the magic happens."
7. "Merry Christmas! Ho ho ho!" — small wave, then end card

---

# (Superseded) Master v1 performance script — EN (Jerry B voice)

Target: ~55 s spoken, slow and warm (~2.4 words/s). One take, generated with ElevenLabs, then
used to animate the master still. Segments are separate TTS calls joined with fixed pauses so
the name slot has an exact, known position.

Rules (from the brief): warm and encouraging; no "naughty list"; never promises a specific gift;
no brands; no medical, religious or political content.

| # | Segment | Text | Notes |
|---|---|---|---|
| 1 | open | "Oh! There you are! Come closer, let me get a good look at you." | warm chuckle in, settles toward camera |
| — | pause | 0.6 s silence | splice boundary (start of slot) |
| 2 | **name slot** | "Ho ho ho! Hello there, my friend! The elves have been telling me all about you." | **fixed 4.5 s** after fitting. Per-order version replaces "my friend" with the child's name |
| — | pause | 0.6 s silence | splice boundary (end of slot) |
| 3 | proud | "And I have to say, I am so very proud of you this year. You've been kind, you've been brave, and you've been working so hard at growing up." | |
| 4 | north pole | "Here at the North Pole, everyone is busy, busy, busy! The elves are wrapping presents, the reindeer are practising their flying, and Mrs. Claus has baked so many cookies that the whole workshop smells like gingerbread." | |
| 5 | list | "I'll be checking my list very carefully, and I'll see what the elves can do." | no gift promise |
| 6 | advice | "Now remember: keep being kind, listen to the grown-ups who love you, and get plenty of sleep on Christmas Eve, because that's when the magic happens." | |
| 7 | close | "Merry Christmas! Ho ho ho!" | small wave is fine; hands return out of frame |

**Test master (Phase 0):** segments 1–3 only (~25 s). That fits OmniHuman's 30-second limit at 1080p, so both avatar models can be compared at full quality. The full 55 s master follows once a model is picked.
