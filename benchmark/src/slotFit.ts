/**
 * The master video has a fixed-length "name slot" (e.g. 4.5 s of Santa saying
 * "Ho ho ho! Hello, ___! The elves have been telling me all about you…").
 *
 * For the splice to be invisible, the lip-synced clip must be EXACTLY slot-length:
 * the frame after the clip is the master's original frame, so any length mismatch
 * shows up as a jump in Santa's head position or an A/V drift.
 *
 * Greeting TTS length varies by name ("Al" vs "Maximiliano") and by take, so every
 * greeting audio must be fitted to the slot BEFORE it is sent to the lip-sync provider.
 */
export type SlotFit =
  | { action: "pad"; padSeconds: number }
  | { action: "speedUp"; tempo: number }
  | { action: "reject"; reason: string };

/**
 * Decide how to fit a greeting of `greetingSeconds` into a slot of `slotSeconds`.
 *
 * - "pad": append silence (Santa listens/smiles at the end) — safe when shorter.
 * - "speedUp": ffmpeg atempo > 1.0 — keeps pitch, but above ~1.08 Santa starts to
 *   sound hurried, which is exactly the "voice change on the name" complaint we want to avoid.
 * - "reject": regenerate the TTS (e.g. with a shorter phrasing or speed setting) instead.
 *
 * TODO(owner): implement this policy (5-10 lines). See CLAUDE.md "Name splice" for context.
 */
export function fitGreetingToSlot(greetingSeconds: number, slotSeconds: number): SlotFit {
  if (!(greetingSeconds > 0) || !(slotSeconds > 0)) {
    throw new Error(`Invalid durations: greeting=${greetingSeconds}, slot=${slotSeconds}`);
  }
  throw new Error("fitGreetingToSlot is not implemented yet (owner decision, see TODO)");
}
