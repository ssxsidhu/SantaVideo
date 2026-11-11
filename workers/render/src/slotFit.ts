/**
 * How a greeting ("Hello there, Emma!") is fitted into the master's fixed-length name slot.
 * The clip must be exactly slot-length: the frame after it is the master's own frame, so any mismatch
 * shows as a jump in Santa's head position.
 *
 * Default policy (owner can change the constants):
 *  - fits in the space after the greeting offset: place it there and pad with silence (Santa listens/smiles)
 *  - up to MAX_TEMPO too long: speed it up with atempo (pitch kept); above that Santa sounds hurried,
 *    which is the "voice change on the name" complaint competitors get
 *  - longer: regenerate the TTS with a faster speaking speed (up to MAX_TTS_SPEED), else fail the clip
 */
export const MAX_TEMPO = 1.08;
export const MIN_TAIL_SECONDS = 0.12;
export const TTS_SPEED_STEP = 0.06;
export const MAX_TTS_SPEED = 1.08;

export type SlotFit =
  | { action: "place"; offset: number; tempo: 1 }
  | { action: "speedUp"; offset: number; tempo: number }
  | { action: "retryFaster" };

/**
 * @param speechSeconds greeting length with leading/trailing silence trimmed
 * @param slotSeconds   frame-aligned slot length
 * @param offset        where speech starts inside the slot (matches the master's own pause)
 */
export function fitGreetingToSlot(speechSeconds: number, slotSeconds: number, offset: number): SlotFit {
  if (!(speechSeconds > 0) || !(slotSeconds > 0) || offset < 0) {
    throw new Error(`Invalid durations: speech=${speechSeconds}, slot=${slotSeconds}, offset=${offset}`);
  }
  // A long name may start a little earlier (use up to half the lead-in) before we touch the tempo.
  const room = slotSeconds - offset - MIN_TAIL_SECONDS;
  if (speechSeconds <= room) return { action: "place", offset, tempo: 1 };
  const earliest = offset / 2;
  const roomEarly = slotSeconds - earliest - MIN_TAIL_SECONDS;
  if (speechSeconds <= roomEarly) return { action: "place", offset: slotSeconds - MIN_TAIL_SECONDS - speechSeconds, tempo: 1 };
  const tempo = speechSeconds / roomEarly;
  if (tempo <= MAX_TEMPO) return { action: "speedUp", offset: earliest, tempo };
  return { action: "retryFaster" };
}

/** Next ElevenLabs speed to try, or undefined when we've hit the ceiling. */
export function nextTtsSpeed(current: number): number | undefined {
  const next = Math.round((current + TTS_SPEED_STEP) * 100) / 100;
  return next <= MAX_TTS_SPEED + 1e-9 ? next : undefined;
}
