/**
 * Words Santa must never say as a "name": profanity, slurs-adjacent insults and obvious non-names.
 * Matched against whole words of the lowercased name (and the name with separators removed).
 * Phase 2 adds Claude moderation for free text; this list is the cheap first gate. Extend freely.
 */
export const BLOCKED_NAME_WORDS: ReadonlySet<string> = new Set([
  // English profanity / insults
  "fuck", "fucker", "fucking", "shit", "shitty", "bitch", "bastard", "asshole", "ass", "arse", "dick", "dickhead",
  "cock", "cunt", "pussy", "twat", "wanker", "prick", "slut", "whore", "hoe", "fag", "faggot", "retard", "nazi",
  "hitler", "porn", "sex", "sexy", "penis", "vagina", "boobs", "tits", "poop", "pee", "fart", "butt", "idiot",
  "stupid", "dumb", "loser", "moron", "ugly", "fatso", "kill", "killer", "murder", "die", "dead", "satan", "devil",
  "rape", "rapist", "pedo", "nigger", "nigga", "kkk",
  // French profanity / insults
  "merde", "putain", "pute", "salope", "connard", "connasse", "con", "conne", "enculé", "encule", "bite", "chier",
  "nique", "niquer", "batard", "bâtard", "crisse", "tabarnak", "tabarnac", "câlisse", "calisse", "ostie", "hostie",
  "idiot", "débile", "debile", "nul", "moche",
  // Non-names / test input
  "test", "testing", "asdf", "qwerty", "admin", "null", "undefined", "none", "nobody", "anonymous",
]);
