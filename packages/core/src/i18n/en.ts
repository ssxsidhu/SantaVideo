/**
 * English strings: the source of truth for the message shape. fr.ts must match it (enforced by the type).
 * Placeholders use {curly} names and are filled by `format()`.
 */
export const en = {
  meta: {
    title: "A personal video message from Santa | MyVideoFromSanta",
    description: "Santa says your child's name in a warm, personal video message. Ready in moments, from $5.99.",
  },
  nav: { brand: "MyVideoFromSanta", switchLanguage: "Français" },
  hero: {
    eyebrow: "Straight from the North Pole",
    title: "Santa says your child's name.",
    subtitle: "A warm, personal video message from Santa, ready in moments. Watch their face light up.",
    sampleCaption: "Sample video",
  },
  form: {
    nameLabel: "Your child's first name",
    namePlaceholder: "e.g. Emma",
    nameHelp: "First name only. We never ask for a surname, school or address.",
    languageLabel: "Santa speaks",
    languageEn: "English",
    languageFrSoon: "Français (coming soon)",
    consent: "I'm the parent or guardian of this child, or I have their permission.",
    submit: "See the preview",
    submitting: "Getting Santa ready…",
    errors: {
      empty: "Please type your child's first name.",
      tooLong: "That name is a little long for Santa. Please use 20 letters or fewer.",
      invalidCharacters: "Please use letters only (accents, hyphens and apostrophes are fine).",
      blocked: "Santa can't say that one. Please type your child's first name.",
      consent: "Please confirm you're the parent or guardian, or have their permission.",
      generic: "Something went wrong. Please try again.",
      rateLimited: "Too many tries. Please wait a minute and try again.",
    },
  },
  steps: {
    title: "How it works",
    one: { title: "Type their first name", body: "Just the first name. Nothing else about your child." },
    two: { title: "See the preview", body: "Check how Santa will greet them before you pay." },
    three: { title: "Watch together", body: "Your video plays right away on a private page. Download it or share it with family." },
  },
  faq: {
    title: "Questions parents ask",
    items: [
      {
        q: "Is it really personalized?",
        a: "Yes. Santa says your child's name out loud, and it appears on the Nice List card at the end. Every video is made for the name you type.",
      },
      {
        q: "Is my child's data safe?",
        a: "We only ask for a first name. It never appears in links or analytics, and we delete it after the season. Your video is on a private page only people with the link can open.",
      },
      {
        q: "When will I get it?",
        a: "Most names play within moments of paying. Rare names take Santa's elves a few extra minutes; we email you the moment it's ready.",
      },
    ],
  },
  preview: {
    title: "Here's how Santa will greet {name}",
    watermark: "PREVIEW",
    body: "Your full video is about 45 seconds: Santa looks up from his letter, greets {name} by name and finds them on the Nice List.",
    pay: "Get the full video · {price}",
    paying: "Opening secure checkout…",
    secure: "Secure payment with Stripe. You'll get the link by email too.",
    changeName: "Change the name",
    expired: "This preview has expired. Please start again.",
  },
  checkout: {
    /** Shown on the Stripe Checkout page. Never include the child's name here (Stripe is a vendor). */
    productName: "Personalized video message from Santa",
  },
  watch: {
    title: "A message from Santa",
    confirming: "Confirming your payment…",
    rendering: "The elves are wrapping your video…",
    renderingBody: "This usually takes a minute or two for new names. You can keep this page open, or come back to the link in your email.",
    ready: "Your video from Santa",
    download: "Download video",
    share: "Copy link",
    copied: "Link copied!",
    failed: "Santa's sleigh hit a snag making this video. We've been alerted and will email you as soon as it's fixed.",
    notFound: "We couldn't find this video. Please check the link in your email.",
    privateNote: "This page is private. Anyone with the link can watch, so share it only with family.",
    upsellTitle: "Make it extra special",
    upsellBody: "Santa mentions {name}'s proudest moment, their wish and more. Coming soon.",
  },
  footer: {
    privacy: "Privacy",
    terms: "Terms",
    refunds: "Refunds",
    copyright: "© {year} MyVideoFromSanta. An AI-generated video message.",
  },
  email: {
    videoReady: {
      subject: "Your video from Santa is ready",
      heading: "Ho ho ho! Your video is ready.",
      body: "Santa has recorded a message just for {name}. Watch it here:",
      button: "Watch the video",
      privacy: "This link is private. You can delete your data at any time:",
      deleteLink: "Delete my data",
    },
  },
  santa: {
    /** Spoken greeting that replaces the master's name slot. Keep it the same length class as the master line. */
    greeting: "Hello there, {name}!",
    endCardTitle: "Merry Christmas, {name}!",
    endCardTitleGeneric: "Merry Christmas!",
    endCardSignature: "Love, Santa",
  },
};

export type Messages = typeof en;
