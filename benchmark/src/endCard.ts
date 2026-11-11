/** Shared end-card helpers for the assembly prototypes. */

// Prototype font (ships with Windows). Replace with an OFL-licensed font before launch.
export const END_CARD_FONT = "C\\:/Windows/Fonts/Gabriola.ttf";

/** Escapes text for ffmpeg drawtext inside a filtergraph (no shell involved). */
export function escapeDrawtext(text: string): string {
  return text.replace(/\\/g, "\\\\\\\\").replace(/'/g, "\u2019").replace(/:/g, "\\:").replace(/,/g, "\\,").replace(/%/g, "\\%");
}

/** Allows only letters (incl. accents), spaces, hyphens and apostrophes; names are validated upstream too. */
export function validateDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!/^[\p{L}][\p{L}\p{M}' -]{0,29}$/u.test(trimmed)) throw new Error("Invalid display name for end card");
  return trimmed;
}

/** drawtext + fade filters that turn a (blurred) plate into the end card. */
export function endCardFilter(seconds: number, name?: string): string {
  const title = escapeDrawtext(name ? `Merry Christmas, ${name}!` : "Merry Christmas!");
  const signature = escapeDrawtext("Love, Santa");
  const fadeIn = (start: number) => `alpha='if(lt(t,${start}),0,min(1,(t-${start})/0.8))'`;
  return (
    `boxblur=18:2,eq=brightness=-0.12,` +
    `drawtext=fontfile='${END_CARD_FONT}':text='${title}':fontsize=120:fontcolor=white:x=(w-text_w)/2:y=(h/2)-110:shadowcolor=black@0.5:shadowx=3:shadowy=3:${fadeIn(0.4)},` +
    `drawtext=fontfile='${END_CARD_FONT}':text='${signature}':fontsize=72:fontcolor=0xF5E6C8:x=(w-text_w)/2:y=(h/2)+40:shadowcolor=black@0.5:shadowx=2:shadowy=2:${fadeIn(1.4)},` +
    `fade=t=in:st=0:d=0.6,fade=t=out:st=${seconds - 1}:d=1`
  );
}
