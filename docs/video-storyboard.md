# Final video storyboard (DRAFT for owner approval)

Instant video, English, ~65–70 s, 16:9 1920×1080 @ 25 fps. The 9:16 social version is a center crop of the same frames.
The Custom video uses the same opening and ending; only the middle is personalized.

## Timeline

| Time | Shot | What we see | What we hear | How it's made |
|---|---|---|---|---|
| 0:00–0:07 | **1. Slow open** (no speech) | Slow camera push-in across the cozy cabin: fire crackling, tree lights twinkling. Santa sits in his armchair, glasses low on his nose, reading his big red book. He doesn't see us yet. The shot ends **exactly on still #3's framing** | Soft music bed fades in (piano + sleigh bells), fire crackle, a page turning | Image-to-video with a fixed **end frame = still #3**, so it hands off to shot 2 with no cut. One-time render |
| 0:07–0:12 | **2. Notice** | Santa looks up, smiles warmly, sets the book down | *(chuckle)* "Oh! There you are! Come closer, let me get a good look at you." | OmniHuman part A, starting from still #3 |
| 0:12–0:20 | **3. Greeting (name slot)** | Santa leans in slightly, delighted | "Ho ho ho! **Hello, Emma!** The elves have been telling me all about you." | Part A; only "Hello, Emma!" (~2.4 s) is lip-synced per name |
| 0:20–0:33 | **4. Proud** | Warm, sincere | "And I have to say, I am so very proud of you this year…" | Part A (must stay < 30 s per OmniHuman render) |
| 0:33–0:50 | **5. North Pole** | Livelier, playful | "Here at the North Pole, everyone is busy, busy, busy!…" | **Part B**, rendered starting from part A's **last frame** (keeps head pose continuous) |
| 0:50–0:58 | **6. List + advice** | Thoughtful "hmm" beat, then gentle | "I'll be checking my list very carefully… keep being kind…" | Part B |
| 0:58–1:03 | **7. Goodbye** | Small wave, big smile | "Merry Christmas! Ho ho ho!" | Part B |
| 1:03–1:08 | **8. End card** | B2C: soft snowfall over the fire, "Merry Christmas, Emma ✨". Business: their logo + one-line thank-you | Music resolves and fades | ffmpeg overlay on a looped background plate; name rendered with drawtext |

## Pacing changes vs. the 25 s test master
- TTS speed 0.90 (was 0.95); 0.8–1.0 s pauses between sentences (was 0.6 s); breath and chuckle beats written into the script.
- Music bed throughout at about −24 LUFS under the voice, with fire crackle ambience. Music: generated once (ElevenLabs music) or licensed royalty-free. **Never a recognizable carol recording.**

## Beating OmniHuman's 30 s limit
1. Part A is rendered from still #3, and part B from the **last frame of part A**, so Santa's pose carries straight over.
2. The A→B boundary sits inside a ~1 s pause, with a 3-frame crossfade if any micro-jump is visible.
3. Fallback if the seam still shows: cover it with a 1–2 s insert shot (close-up of the book or the fire), then come back to Santa.

## One-time cost per language (estimate)
| Item | Cost |
|---|---|
| Shot 1 slow open (image-to-video, ~7 s, end frame fixed) | ~$1–3 |
| OmniHuman parts A + B (~55 s @ $0.16/s) | ~$8.80 |
| Music bed + end-card plate | ElevenLabs credits / ~$0 |
| **Total** | **≈ $10–12** |

## Open choices for the owner
1. Opening action: Santa **reading his book** (default above), **writing in his list with a quill**, or **checking a letter from a child**?
2. End card: show the child's name ("Merry Christmas, Emma"), or keep it generic?
3. Music: generated original bed, or a licensed royalty-free track?
