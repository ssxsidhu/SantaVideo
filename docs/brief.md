# Build prompt: MyVideoFromSanta (myvideofromsanta.com)



You are building **MyVideoFromSanta** (myvideofromsanta.com): a web app that sells personalized AI video messages from Santa to parents, and branded "Santa campaigns" to small businesses that serve kids. We launch before **Black Friday (Nov 27, 2026)** and sell until **Dec 24**, so ship a working MVP fast and polish after. I'm a full-stack developer (TypeScript, React, Python, ffmpeg, VPS ops). Work in phases, stop at each **CHECKPOINT** for my review, and keep a `CLAUDE.md` in the repo with decisions, architecture and how to run everything.

## 1. Product

### Who buys
1. **Parents and grandparents (B2C)**: UK, Canada, US first; UAE as a small test.
2. **Businesses that serve kids (B2B)**: daycares, dance/swim/martial-arts studios, kids' sports clubs, family and pediatric dentists, realtors and similar. They buy a campaign and share **one branded link** with their families. **The business never shares any child or parent data with us.**

### Languages
- English and French (Quebec / France) at launch. Every user-facing string goes through i18n, including emails and Santa's scripts.
- One English Santa voice and one French Père Noël voice. Each stays the same in every video.

### Products and pricing (all prices in a config file, not hard-coded)
| Product | Price (USD base) | What it is |
|---|---|---|
| **Instant video** | $5.99 | Parent types the child's first name. The video plays **instantly** from a pre-rendered name library. |
| **Custom video** | $12.99 | Fully personalized script from a short, chat-style set of questions. Delivered by email and on a watch page, target under 5 minutes. |
| **Business: Small** | $99 | Up to 60 children |
| **Business: Standard** | $199 | Up to 200 children |
| **Business: Large** | $399 | Up to 600 children |

- **Local currency:** show and charge in local currency (USD, CAD, GBP, EUR, AED) via Stripe. Use Stripe's multi-currency prices or Adaptive Pricing, whichever is simpler and reliable.
- **Business campaigns** are counted by **videos created (children)**, not families, and end Dec 31.
- **Revenue share:** when a parent from a business's page upgrades to a Custom video, the business earns **20%**. Track it per campaign and show it in their dashboard. Payouts are manual for now, so just track and export.
- **Scheduled delivery:** any purchase can be sent at a chosen date and time, for example **7:00am on Christmas morning** in the recipient's time zone.

### Key user flows

**A. Parent: Instant video**
1. Landing page → enter child's first name → pick a language.
2. Show a short watermarked preview (first ~4 s, or a still frame with the name). Then Stripe Checkout.
3. After payment, the full video plays immediately on a private watch page (unguessable URL), with download and share buttons. A confirmation email is sent with the link.
4. Upsell on the watch page: "Make it extra special: Santa mentions Emma's proudest moment, her wish and more — $12.99 (pay the difference)."

**B. Parent: Custom video**
1. Chat-style flow, one question at a time, feeling like "Tell Santa about Emma", not a form:
   - first name
   - age
   - something they're proud of this year
   - something they're working on
   - their Christmas wish
   - an optional question for Santa
   - pet or sibling name, optional
2. Every question except the first name has a **"Surprise me"** option that uses a warm generic line.
3. Show an **audio-only preview** of Santa's greeting (cheap to make). Then pay, then render.
4. The watch page shows a cozy "The elves are wrapping your video…" progress state. Email when ready.

**C. Business campaign**
1. Business landing page (separate from the parent landing), explaining that families get a free instant Santa video with the business's thank-you, and that no data sharing is needed.
2. The business owner self-serves:
   - pick a package
   - upload a logo
   - write a one-line thank-you, e.g. "Merry Christmas from your friends at Bright Smiles Dental!"
   - pay via Stripe
3. They get:
   - a branded page `myvideofromsanta.com/c/{slug}` (no personal data in any URL, ever)
   - a QR code (PNG/SVG)
   - a ready-to-paste newsletter blurb and WhatsApp message in English and French
   - a dashboard showing videos used / remaining and revenue-share earnings
4. Families open the link, type the first name, and get the **instant video for free**, with a branded end card (logo + thank-you line). The page also offers the Custom upgrade.
5. When the quota is used up, the page shows a friendly "All of this campaign's videos have been delivered" message, and the business dashboard offers a top-up.

**D. Admin panel (me only)**
- Orders, campaigns, render jobs (status / retry / failures), refunds, vendor spend per day, name-library coverage, a moderation log, and a manual "regenerate" button.

## 2. How the videos are made

### Master Santa
- One fixed Santa character and set: a cozy North Pole workshop with a fireplace and lights. Santa looks into the camera like a video call. The look must be original. Do not imitate any brand's Santa or a competitor's style.
- One master performance per language, ~45–60 s, landscape 16:9 at 1080p for TV and tablet viewing. Also produce a 9:16 cut for sharing on social.

### Instant video = name library + splice
- The master has a **"name moment"**, e.g. "Ho ho ho! Hello, ___! The elves have been telling me all about you…"
- For each name, generate a short lip-synced clip of Santa saying the **whole greeting sentence**, not just the name. Generate it from the same start and end frame or pose as the master so it cuts in seamlessly; crossfade audio. Natural prosody matters: an audible "voice change" on the name is a known complaint with competitors.
- **Name lists:**
  - top ~2,000 first names per market and language, built from public official baby-name statistics (UK ONS, US SSA, Canadian provincial data, Quebec data for French)
  - deduplicate across markets
  - keep a **pronunciation override table** (phonetic respelling per name) I can edit in admin
- **Rare names:** queue an on-demand render. Show the progress state, then email when ready (target under 5 min). Each new name is added to the library.
- Final assembly with **ffmpeg**: master segments + name clip + optional business end card + music bed. Cache the final video per (name, language, campaign end-card) where sensible, so repeat names are free.

### Custom video = script → voice → lip-sync
1. **Script:** the Claude API fills a **locked Santa template** (structure fixed; only the personalized slots vary).
2. **Rules the script must follow:**
   - warm, encouraging, age-appropriate
   - never scary, shaming or "naughty list" threats
   - never promises a specific gift (say "I'll see what the elves can do!")
   - no brand names, no medical, religious or political content
   - 60–90 s spoken
3. **Moderation:** run every free-text input through moderation (Claude classification plus a blocklist) **before** generating. Reject anything inappropriate, sexual, violent or abusive, or anything that tries to make Santa say something off-template, and ask the parent to rephrase. Validate names too (block profanity and non-names).
4. **Voice:** ElevenLabs text-to-speech with the fixed Santa voice for that language.
5. **Lip-sync:** the chosen lip-sync API onto the master Santa footage. Assemble with ffmpeg.

## 3. Phase 0 (do this first): provider benchmark — CHECKPOINT

Before building the pipeline, **research current options and run a small benchmark** so pricing rests on real numbers. Don't trust memory: check current docs and pricing pages.

1. **Shortlist 2–3 lip-sync / talking-avatar API providers** that can drive a *fixed* character from supplied audio. For each, record:
   - cost per second of output
   - latency for a 3 s clip and a 60 s clip
   - quality of mouth sync and the look of the name splice
   - API limits and concurrency
   - commercial-use terms, including whether children's data may be sent
2. **Design the Santa voice** in ElevenLabs, English and French. Note its cost per character.
3. **Produce:**
   - 3 sample instant videos (common name, rare name, French name)
   - 1 sample custom video per provider
4. **Output a table:**
   - cost per instant video (amortized across the library)
   - cost per rare-name render
   - cost per custom video
   - the cost of pre-rendering the full name library per language
   - gross margin at the prices above
5. **Recommend one provider. STOP for my approval.**

## 4. Tech stack (adjust only with a stated reason)

### Core stack
- **App:** Next.js (App Router, TypeScript), Tailwind. Server actions or route handlers for the API.
- **Database:** PostgreSQL with Prisma or Drizzle.
- **Queue and workers:** Redis + BullMQ. Separate worker processes for TTS, lip-sync, ffmpeg assembly and the name-library pre-render. Retries with backoff, and a dead-letter queue visible in admin.
- **Storage and delivery:** S3-compatible object storage, preferably **Cloudflare R2** for low egress cost. Videos served via signed or unguessable URLs through a CDN.
- **Payments:** Stripe Checkout + webhooks (idempotent). Promo codes on. Handle refunds in admin.
- **Email:** Resend. Templates in English and French: order confirmation, video ready, scheduled delivery, business campaign welcome and quota alerts.

### AI services
- Claude API for scripts and moderation.
- ElevenLabs for TTS.
- The lip-sync provider chosen in Phase 0.

### Deploy and ops
- **Deploy:** Docker Compose on my VPS: app, workers, Postgres, Redis, Caddy with automatic HTTPS. Health checks, log rotation, nightly Postgres backup.
- **Analytics:** Plausible or similar privacy-friendly analytics, plus Meta Pixel and TikTok Pixel, loaded **only after cookie consent** (UK/EU).
- **Secrets** in `.env` (provide `.env.example`). Never commit keys.

## 5. Privacy and safety (non-negotiable)
- Collect the **child's first name only**: never a surname, school or address. No photo upload in v1.
- **Parent/guardian consent** checkbox ("I'm the parent/guardian or have their permission") before generating.
- **Data deletion:**
  - auto-delete free-text inputs and scripts **30 days** after delivery
  - keep the rendered video until Jan 31, 2027, then delete it
  - a "delete my data" link in every email
- **No personal data in URLs, query strings, analytics events or logs.**
- Draft a **Privacy Policy, Terms, and Refund Policy** (EN/FR) covering PIPEDA/Quebec Law 25, UK GDPR/GDPR, COPPA-style care for children's data, and the use of AI-generated video. Mark them clearly **"DRAFT — needs legal review"**.
- Rate limiting on all public endpoints, bot protection on checkout and free business-campaign pages, and per-campaign abuse caps.
- **Cost guardrails:** daily spend caps per vendor with alerts to my email, and a kill switch in admin that pauses rendering.

## 6. Design
- Warm, cozy, premium Christmas feel, not cheesy. Mobile-first: most traffic will come from Instagram and TikTok ads on phones.
- Fast: landing page LCP under 2 s on mobile.
- The landing page hero is a sample video. Show a "How it works" section in 3 steps and an FAQ: "Is it really personalized?", "Is my child's data safe?", "When will I get it?".
- Business landing page: a clear ROI pitch, the three packages, a sample branded video, and "No data sharing required" called out prominently.

## 7. Build order and checkpoints
1. **Phase 0:** provider benchmark and samples → **CHECKPOINT**
2. **Phase 1:**
   - master Santa footage plus the splice pipeline for EN and FR
   - pre-render the top 200 names per language as a test
   - one-off instant video flow end to end in Stripe test mode
   → **CHECKPOINT** (I watch the videos)
3. **Phase 2:** custom video flow (chat questions, moderation, script, TTS, lip-sync, email) → **CHECKPOINT**
4. **Phase 3:** business campaigns (self-serve purchase, branded page, end card, QR code, dashboard, quota, revenue-share tracking) → **CHECKPOINT**
5. **Phase 4:**
   - admin panel, scheduled delivery, legal pages, cookie consent, pixels, cost guardrails
   - full name-library pre-render
   - load test: 500 concurrent instant plays, 50 queued custom renders
   → **CHECKPOINT**
6. **Phase 5:** production deploy on my VPS, Stripe live mode, domain/DNS/email (SPF/DKIM/DMARC for Resend), smoke test in both languages → **launch**

**Target:** Phases 0–2 live by **Nov 20**, everything by **Nov 25**.

## 8. Working agreements
- Ask me before:
  - choosing a paid vendor
  - spending more than $20 on API calls in testing
  - changing pricing or anything in the privacy section
- Write tests for payment webhooks, quota counting, revenue-share math, data-deletion jobs and moderation.
- Keep `CLAUDE.md` updated with: architecture, env vars, how to add a language, how to add names or pronunciations, how to re-render, and a runbook for common failures.
- When you finish each phase, give me: what was built, how to try it, the costs measured so far, and any open questions.