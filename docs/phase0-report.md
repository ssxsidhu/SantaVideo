# Phase 0 — Provider benchmark report

**Status (2026-11-09): research, cost model, voice design and benchmark harness done. The video samples are blocked on two approvals (paid vendor + master footage approach). See "Decisions needed".**

All prices below were read from vendor pages on 2026-11-09 (sources in `config/vendor-rates.json`). Vendors disagree with themselves in places (noted). The **measured** latency and quality columns stay empty until the benchmark run.

---

## 1. Lip-sync shortlist

We need **video-to-video lip-sync**: keep our fixed Santa footage and redraw only the mouth to new audio. That is what makes the name splice invisible: frames before and after the slot are untouched master frames.

| | **Sync.so lipsync-2 / 2-pro** | **LatentSync** (via fal) | **Kling LipSync** (via fal) |
|---|---|---|---|
| Cost / s of output | $0.05 / $0.083 (Creator); $0.04 / $0.067 on Scale ($249/mo) | $0.20 flat up to 40 s, then $0.005/s | $0.014/s, rounded up to 5 s |
| 4.5 s name clip | $0.225 / $0.375 | $0.20 | $0.07 |
| 60 s custom | $3.00 / $5.00 | $0.30 | $0.84 (6 chunks) |
| Latency, 3 s / 60 s | *to measure* | *to measure* | fal lists "~12 min" → **likely fails the 5-min rare-name target** |
| Input limits | Creator 5 min, Growth 10, Scale 30; splits internally into 30–40 s chunks | none stated | video **2–10 s**, 720–1920 px; audio ≤ 60 s |
| Concurrency | Creator 10, Growth 20, Scale 50 (direct). Via fal: 2 → up to 40 as spend grows | fal: 2 → 40 | fal: 2 → 40 |
| Commercial use | No explicit output-ownership clause found; API terms forbid competing use | fal model badge "Commercial use"; open-source model (license to verify before self-hosting) | fal badge "Commercial use" |
| **Data / children** | ⚠️ ToS gives Sync a *perpetual, irrevocable licence* to user content to "develop and improve" services, and the privacy policy says personal data trains models. Terms also forbid "solicit[ing] personal information from anyone under 18". **Production use needs an enterprise/no-training agreement in writing.** Via fal it is a "Partner" model, so data still goes to Sync. | ✅ Best. Runs on fal's own infra (not a partner model): fal API terms say they will **not train on client content**. I/O history kept 90 days by default (opt out with `X-Fal-Store-IO: 0`), CDN files ≥ 7 days (deletable via API). Self-hostable later for full control. | ⚠️ Partner model: data goes to Kuaishou. Acceptable for public library names; avoid for rare names and custom scripts (children's data). |
| Expected quality | Market leader for mouth realism at 1080p | Known for softer mouth region on HD faces, so it **must** be checked at 1080p | Good, but chunk seams on long scripts |

**Ruled out without spending:** HeyGen API ($3–7.20/min, avatar regenerated from scratch), Tavus ($0.80–1/min but needs replica training on a real person; built for conversational video), D-ID. These all re-render the whole person, so the splice can't be seamless, and they cost 10–50× more per second. Sync **sync-3** ($0.133/s) is priced out: negative margin on Large packages (cost table §4).

## 2. Santa voice (ElevenLabs)

- The connected account is on **Creator** (≈328k characters left this cycle), so the samples cost nothing extra.
- Cost: $0.08 per 1k chars (API page) up to $0.18 (effective Creator subscription rate). The model uses $0.18 to stay conservative. A 1,100-char custom script costs ≈ $0.20. The whole name library (6,500 names × 75 chars × 1.3 takes) ≈ $115.
- Models: Multilingual v2 (supports fr-FR and fr-CA) and v3 (more expressive). Both cost the same.
- **6 voice previews designed** (3 EN Santa, 3 FR Père Noël) in `benchmark/out/voices/`. Not yet saved to the voice library: **pick one per language.**
- Not yet verified: whether pronunciation dictionaries / phoneme tags work on Multilingual v2. The respelling override table (already in the spec) works with every model regardless, so it stays the primary mechanism.

## 3. Unit economics (estimate, from `npm run bench:costs`)

Full tables: [phase0-cost-model.md](phase0-cost-model.md). Headline at 5,000 instant videos delivered for the season:

| | Sync lipsync-2 | Sync lipsync-2-pro | LatentSync | Kling |
|---|---|---|---|---|
| Name library, EN + FR (one-off) | $2,015 | $3,280 | $1,804 | $706 |
| Rare-name render | $0.24 | $0.39 | $0.21 | $0.08 |
| Instant $5.99: cost / margin | $0.90 / **85%** | $1.16 / 81% | $0.85 / 86% | $0.62 / 90% |
| Custom $12.99, full lip-sync | $4.83 / **63%** | $7.32 / 44% | $1.45 / 89% | $2.13 / 84% |
| Custom, personalized-only lip-sync | $2.58 / **80%** | $3.58 / 72% | $1.28 / 90% | $1.50 / 88% |
| Business Small / Std / Large (all slots used) | 71% / 54% / 33% | 55% / 28% / −7% | 74% / 59% / 40% | 88% / 82% / 75% |

### What the numbers say

1. **The library is a fixed cost, not a per-video cost.** With lipsync-2 the full library ($2,015) pays for itself after **~370 instant sales**. Each video after that costs ≈ $0.02 in rendering plus the Stripe fee. The business-package margins above spread the library across every child, which makes Large look thin. Counted at marginal cost, Large earns ≈ $375 (94%).
2. **Library size is the biggest cost lever.** Name frequency is long-tailed. Pre-rendering the top ~1,000 names per language instead of 4,000 + 2,500 cuts the library to ~$620 with lipsync-2, while the tail renders on demand (and joins the library). I suggest sizing it by measured coverage % in Phase 1.
3. **Custom: lip-sync only the personalized sentences.** The script template is locked, so its fixed sentences can be rendered once per language. Only the ~30 s of personalized sentences then need lip-sync per order. That lifts the lipsync-2 margin from 63% → 80% and roughly halves render time. The cost is an extra splice per slot, the same technique as the name splice.
4. **Business-referred Custom upgrades** still clear 43% with lipsync-2 after the 20% revenue share, but go **negative with sync-3**. That confirms sync-3 is out.
5. Stripe fees are modelled at the US card rate (2.9% + $0.30). UK/EU/AED cards add ~1.5% for international cards and 1% for currency conversion. Adaptive Pricing passes the conversion fee to the customer.

## 4. Master Santa footage (needed before any sample)

Lip-sync needs a base video of our Santa. Two options:

- **A. AI-generated (fast, cheap):** generate an original Santa still (workshop, fireplace, video-call framing) with an image model, then animate a talking master from it with a talking-avatar model (e.g. Kling AI Avatar v2 Pro on fal, $0.115/s ≈ $7 per 60 s master), driven by the ElevenLabs master audio. After that, everything uses the cheap video-to-video lip-sync. Risk: AI hands and eyes, and keeping the look consistent between EN and FR (one still image for both fixes most of that).
- **B. Filmed actor:** most realistic, but needs casting, costume, set, a likeness release and editing time. Hard to fit before Nov 20.

**Recommendation: A for launch.** B can replace it next season without changing the pipeline.

## 5. Sample plan and test budget (on fal, one key)

| Item | Est. cost |
|---|---|
| Santa still, 4–6 candidates | ~$0.20 |
| EN + FR test masters, ~20 s each (talking-avatar) | ~$4.60 |
| 3 instant samples (common EN "Emma", rare EN "Oluwaseun", FR "Léa") × 4 variants (lipsync-2, 2-pro, LatentSync, Kling) | ~$2.60 |
| 1 × 60 s custom sample per provider (lipsync-2, 2-pro, LatentSync, Kling chunked*) | ~$9.15 |

\* The runner doesn't split Kling's 10 s input cap yet, so it would reject a 60 s job. I'll add chunking before the run, or drop Kling from the custom test, since it already fails the latency target.
| **Total** | **≈ $16.50** (under the $20 cap; `bench:run` enforces the cap) |

## 6. Decision (2026-11-11)

**Sync lipsync-2-pro via fal is locked** for the instant name slot (and custom personalized lines), with LatentSync as the fallback. Name-switch test on master v2 (Emma, Bo, Maximiliano, Siobhan; ~$1.24): 2-pro kept beard texture and teeth; lipsync-2 smeared the beard. Cost ≈ $0.17 per name clip, paid once per name (lazy library). Compositing rules from the test are in CLAUDE.md (voice-stem swap before music, clear color tags, mouth-only mask).

### Earlier provisional recommendation (superseded)

**Sync lipsync-2** for instant (library + rare names) and custom (personalized-only), with **LatentSync** as the fallback.

- lipsync-2 has the best expected quality at an 80–85% margin, and its Creator-plan concurrency of 10 covers launch load.
- Before live mode we need written confirmation from Sync of a **no-training / data-deletion agreement**, because rare names and custom scripts carry children's data.
- If Sync won't sign that, or LatentSync looks comparable at 1080p, switch to LatentSync. It has the best data terms, a ~90% margin, and can be self-hosted later.
- Kling is cheapest but fails the latency target and has data-jurisdiction concerns. At most it suits the batch library pre-render.

The final pick happens after you watch the samples. Don't sign up for anything yet.

## 6b. Owner feedback (2026-11-09)

- **Vendor data risk:** owner points out that a first name alone, with no surname, email or location, can't be linked to any identity. Agreed. Sync's training clause drops from blocker to nice-to-have. Rule kept: no emails, order IDs or other identifiers in vendor requests or file names.
- **Quality first:** quality can win over margin (package prices can go up if needed), so lipsync-2-pro stays in contention.
- **Master footage:** AI-generated (option A) confirmed.
- **Library:** instead of pre-rendering all 6,500 names, build it lazily. See CLAUDE.md decisions log.

## 7. Decisions needed (checkpoint)

1. **Approve fal.ai as a paid vendor for the benchmark and a ≈ $17 test budget.** Then put `FAL_KEY` in `.env`.
2. **Master footage:** option A (AI-generated, recommended) or B (actor)? If A, image + talking-avatar generation also runs on fal and is included in the budget above.
3. **Voice pick:** listen to `benchmark/out/voices/en-{A,B,C}_*.mp3` and `fr-{A,B,C}_*.mp3`. I'll save the chosen two and can tweak the descriptions (age, accent, warmth) and regenerate.
4. **Sync data terms:** OK to email Sync now about an enterprise no-training agreement in parallel? I can draft the email for you to send.
5. **Owner code:** `benchmark/src/slotFit.ts` → `fitGreetingToSlot()` (policy for fitting greeting audio into the name slot). Needed before the splice samples.

## 8. Phase 0 close-out (2026-11-11, owner closed the checkpoint)

**Built:** cost model (`npm run bench:costs`), fal adapters and scripts for stills, talking-avatar masters, Kling openings, assembly, lip-sync name tests and inpainting (`benchmark/src/*`), plus the EN master and name-switch prototype.

**Decisions:** lip-sync = Sync lipsync-2-pro via fal; talking master = OmniHuman 1.5; voice = ElevenLabs "Mr. Claus"; launch master = the earlier single take (see CLAUDE.md). FR deferred by the owner.

**Spend:** fal test spend ≈ $43 (owner approved going past the $20 cap step by step); Higgsfield credits used up; ElevenLabs within plan.

**Learned the hard way:**
- Never chain renders from generated frames; every take starts from a clean still.
- Talking takes need a start image with open, camera-facing eyes; eyes can't be fixed afterwards.
- OmniHuman's camera drifts; check framing at every join before cutting.
- Name swap: swap on the voice stem before music, clear Sync's color tags, paste back only the mouth.

**Open:** FR voice and master; slot-fit rule (`slotFit.ts`, owner TODO); end-card font licence; better master later (owner's Kling zoom-in idea).
