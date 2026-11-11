# MyVideoFromSanta — project guide

Personalized AI Santa videos for parents (Instant $5.99 / Custom $12.99) and branded Santa campaigns for kids' businesses ($99 / $199 / $399).
Launch before Black Friday (Nov 27, 2026), sell until Dec 24. Full brief: [docs/brief.md](docs/brief.md) (owner's build prompt, phases 0–5 with CHECKPOINTs).

## Current phase

**Phase 1 — website + instant video flow** (started 2026-11-11). Phase 0 closed by the owner on 2026-11-11: findings in [docs/phase0-report.md](docs/phase0-report.md).

## Working agreements (from the owner — always follow)

- Ask before: choosing a paid vendor, spending > $20 on API calls in testing, changing pricing or anything in the privacy section.
- Stop at every CHECKPOINT. At each phase end report: what was built, how to try it, costs measured, open questions.
- Tests required for: payment webhooks, quota counting, revenue-share math, data-deletion jobs, moderation.
- Prices live in `config/pricing.json`, never hard-coded.
- No personal data (child name, parent email) in URLs, query strings, analytics events or logs. Ever.
- Every user-facing string through i18n (EN + FR), including emails and Santa scripts.

## Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-11-09 | Video-to-video lip-sync (re-sync mouth on our own master footage), not avatar-generation APIs (HeyGen/Tavus/D-ID) | Frames outside the name slot stay identical to the master, so the splice is seamless; 10–50x cheaper per second |
| 2026-11-09 | Benchmark all lip-sync candidates through fal.ai | One key/bill, no subscriptions; fal hosts Sync lipsync-2/2-pro, LatentSync, Kling |
| 2026-11-09 | Name slot has a FIXED duration; greeting audio is fitted to it before lip-sync (`benchmark/src/slotFit.ts`) | Any length mismatch shows as a head-position jump at the cut |
| 2026-11-09 | Pre-rendered library uses only public name lists | Library renders send zero customer data to vendors; only rare names + custom scripts do |
| 2026-11-09 | Master Santa footage is AI-generated (original still image → talking-avatar master), one look shared by EN and FR | Owner decision |
| 2026-11-09 | Vendor data risk downgraded: we only ever send a first name (and for Custom, a script) with no surname, email, order ID or location, so vendors can't link it to a person. Hygiene rule: never put customer email/order IDs in vendor requests, file names or metadata | Owner decision; Sync's no-training agreement becomes nice-to-have, not a blocker |
| 2026-11-09 | Quality wins over margin when choosing the lip-sync model; package prices can be raised if needed (owner approves any price change) | Owner decision |
| proposed | Name library is built lazily: small seed pre-render, then render-on-first-order and cache forever, plus a revenue-funded background warm-up before the Dec peak | Avoids ~$2k upfront spend before demand is proven |
| 2026-11-11 | **Master v3 built** (`bench:assemble-take --talk-shot=…v5-single… --reading=3.4 --open-xfade=0.24 --insert=…v3-take…:25.9:24.7:1.2 --out=master-en-v3`): old reading shot (3.4 s) → 0.24 s dissolve → one OmniHuman 720p take from `letter-eyes-open_1920x1080.png` (eyes open, holding the letter; made on fal nano-banana-pro edit for $0.15 because Higgsfield was out of credits) → 1.2 s borrowed from the earlier take where Santa looks down at the letter on "let me check my list" (same audio, framing checked) → end card. 49.6 s, −15.8 LUFS, name slot 7.094–9.381 s. Render $6.73; fal test spend ≈ $42 | Owner: reuse earlier footage instead of new renders; check camera distance at every join before cutting |
| 2026-11-11 | **Launch master (EN) = the earlier single take** `benchmark/out/masters/master-en-v3-take__omnihuman-720p.mp4` (one OmniHuman 720p take from the eyes-closed letter photo, Mr. Claus voice, track `benchmark/out/audio/master-en-v3/master-en-v3.wav`, name slot 5.134–7.420 s). Accepted as-is: slightly squinty eyes read as an old Santa. Improve after first orders. Owner's idea for later: regenerate a Kling opening that zooms in to the framing where v2's close-up talking shot starts, then cut to a close-up talking take | Owner decision: stop spending on the master, build the product |
| 2026-11-11 | Eye-fix test on the earlier single take (2–9 s) with fal Wan VACE 14B inpainting (`npm run bench:inpaint`, eye-box mask + open-eyes reference, $0.88): eyes barely changed, still squinting. Not used. Squinty eyes have to be prevented at render time (start image with open, camera-facing eyes), not fixed afterwards | Test result; fal test spend ≈ $43 |
| 2026-11-11 | **Lip-sync provider locked: Sync lipsync-2-pro via fal** (`fal-ai/sync-lipsync/v2`, `model: "lipsync-2-pro"`, ~$0.0835/s ≈ $0.17 per 2 s name clip). Fallback: LatentSync (fal) | Owner decision after the name-switch test: cleanest beard and teeth; lipsync-2 smeared the beard |
| 2026-11-10 | Santa look = owner's Higgsfield reference (gold glasses, log cabin, fireplace, tree). Master still generated 16:9 with head inside the central 9:16 strip so the social cut is a center crop | Owner decision; one master serves both formats |
| 2026-11-10 | **Master still locked: candidate #3** (Higgsfield Nano Banana 2.1, 2K, 8 credits). Files in `benchmark/assets/master/`: source 2752x1536, 1920x1080 (16:9 master), 1080x1920 (9:16 center crop) | Owner pick: cleanest closed mouth, best vertical crop |
| 2026-11-10 | **Talking master model: OmniHuman v1.5 (fal, 1080p, $0.16/s)** over Kling Avatar Pro | Owner: much more natural. Native 25 fps matches Sync's per-frame billing. Constraint: < 30 s per render at 1080p, so the master is built from parts chained at pauses (see docs/video-storyboard.md) |
| 2026-11-10 | Final video opens slowly (silent establishing shot, then Santa notices the camera); slower TTS pacing with longer pauses than the test master | Owner feedback on the 25 s test master |
| 2026-11-10 | **English master v1 built** (89.3 s): Kling O3 slow open (letter reading, 720p upscaled) → OmniHuman parts A/B/C chained from each part's last *kept* frame (not the padded end) → 4-frame crossfades in silence → end card. Name slot at 19.492–22.122 s (`benchmark/out/masters/master-en.final-manifest.json`). Music: ElevenLabs original. FR deferred | Owner: English only for now; opening = reading a child's letter; end card shows child's name |
| 2026-11-10 | Higgsfield used for one-off creative assets (stills); fal/Sync stay the pipeline vendors (API, per-second billing, concurrency) | Higgsfield ≈ $0.10/2K image with existing credits; not built for automated per-order rendering |
| 2026-11-10 | fal.ai approved for the master still (`npm run bench:still`, ~$0.60 for 4 candidates) | Owner decision |
| 2026-11-10 | EN voice = ElevenLabs library voice "Jerry B" (`MDLAMJ0jxkpYkjXbmG4t`) for now; "Mr. Claus" (`uDsPstFWFBUXjIBimV7s`) is the runner-up. Voice id goes into every render cache key, so a per-business voice choice can be added later without rework | Owner decision. Library voices can be withdrawn by their creator, so keep a fallback |
| 2026-11-10 | **Master v1 (89 s) rejected.** Problems: visible cut at the Kling→OmniHuman handoff, late/flat surprise, and identity drift that compounds when each part starts from the previous part's last frame | Owner review. Never chain renders from generated frames; every shot starts from a clean still |
| 2026-11-10 | **Master v2 plan: one model (OmniHuman 1.5), one continuous 720p take (~43 s, under fal's 60 s limit at 720p), upscaled to 1080p; ~45 s video incl. end card.** Starts from the letter-reading still; "Oh! Ho ho ho!" moved to the opening reaction. One spoken name slot only; the name also appears on a Nice List insert and the end card (ffmpeg, free per name) | Owner decision. Seedance 2.5 / Hailuo / Gemini Omni can't reliably lip-sync 40 s of our own voice track |
| 2026-11-10 | **Master v2 built as two OmniHuman 720p shots** (`npm run bench:assemble-take`): 3.2 s silent reading shot (from the letter still) → hard cut on the look-up → 42 s talking take from a new camera-facing close-up still (`santa-closeup_1920x1080.png`) → 5 s end card. 49.6 s, −16 LUFS. Name slot 7.134–9.421 s (`master-en-v2.final-manifest.json`). Nice List insert still to do | The single take from the letter still gave squinty eyes and no eye contact: the start image had closed eyes. Talking shots must start from open, camera-facing eyes. fal test spend now ≈ $34; owner said this is the last render for now |
| 2026-11-10 | **Name-switch test passed** (`npm run bench:names`, then `bench:assemble-take --slot-clip/--slot-audio/--slot-start`): Emma, Bo, Maximiliano, Siobhan on master v2, Sync lipsync-2 vs 2-pro, ~$1.24. Findings: 2-pro keeps beard texture and teeth; lipsync-2 smears the beard (one green lip artifact). Sync returned 2.04 s of the 2.32 s slot (cut at end of speech). Long names need a faster TTS read (Maximiliano at speed 1.05). Swap must happen on the voice stem before the music mix. Pixels outside the mouth shift slightly inside the slot (diff 1.7 vs 0.75 baseline) → production should composite only the mouth region back | Led to locking lipsync-2-pro (2026-11-11) |
| 2026-11-10 | Name-swap compositing fixed (owner noticed the frame color change in the slot): (1) clear Sync's bt709 color tags before overlay (`setparams`), otherwise swscale shifts the clip warmer; (2) `--mouth-mask=cx,cy,rx,ry` pastes back only a feathered oval around the mouth (master v2: `960,540,300,230`). Result: pixels outside the mouth match the master within encode noise. The mask belongs in each master's manifest next to the name slot | Owner feedback |
| 2026-11-10 | EN voice switched to **"Mr. Claus"** (`uDsPstFWFBUXjIBimV7s`) for master v2; Jerry B is now the fallback | Owner decision |
| 2026-11-11 | **Payments via Stripe Managed Payments** (Stripe = merchant of record, tax code `txcd_10402100`); **sales tax added on top** of the listed price. Webhook checks `amount_subtotal`, not `amount_total` | Owner decision: Stripe handles tax filing, fraud and disputes in 80+ countries |
| 2026-11-11 | Media storage on Cloudflare R2 (`myvideofromsanta-media`, private, 1-hour signed links) | Owner's domain is already on Cloudflare; no egress fees |
| pending | FR Père Noël voice | Candidates: designed fr-A/B/C, library "Santa – Gentle and Heartwarming" (Quebec, `s6w9aeDifUqNIV5QeIBE`) |

## Repository layout (Phase 0)

```
config/                 pricing.json, vendor-rates.json (with sources), cost-assumptions.json
benchmark/
  providers.json        fal endpoint + input per lip-sync provider
  cases.example.json    benchmark cases (copy to cases.json once assets exist)
  src/config.ts         typed config loader + validation
  src/costModel.ts      unit economics (tested in costModel.test.ts)
  src/report.ts         writes docs/phase0-cost-model.md
  src/falProvider.ts    fal queue adapter (upload, run, timing)
  src/run.ts            benchmark runner with spend guard
  src/splice.ts         ffmpeg name-slot fit + splice prototype
  src/slotFit.ts        policy for fitting greeting audio into the slot
  out/                  (gitignored) voices, videos, results
docs/                   phase reports, generated cost model
```

Phase 1 (npm workspaces): `apps/web` (Next.js 16 App Router + Tailwind 4, EN/FR under /en and /fr), `workers/render` (BullMQ worker: TTS → slot fit → Sync → ffmpeg), `packages/core` (pricing, names, tokens, crypto, cache keys, storage, i18n, masters), `packages/db` (Drizzle schema + migrations). Master settings (slot, mouth mask, voice) live in `config/masters.json`. Planned: `infra/` (Docker Compose; nginx on the VPS, not Caddy, because the box is shared).

## Server (shared VPS, `ssh reality-check`)

Postgres 16 + Redis 7 run on the shared realitycheck-prod VPS from `~/santavideo` (= `infra/docker-compose.server.yml` + a server-only `.env` with generated passwords, mode 600). Ports are loopback-only: Postgres `127.0.0.1:5433`, Redis `127.0.0.1:6380` (AOF on, `noeviction` for BullMQ). Containers are memory-capped (256 MB / 128 MB) because other live apps share the box (nginx owns 80/443; don't touch other containers). Videos go to R2, not the server disk (~8 GB free).

Dev from a PC: keep this tunnel open, then the local `.env` URLs point at `127.0.0.1:5433` / `:6380`:

```bash
ssh -N -L 5433:127.0.0.1:5433 -L 6380:127.0.0.1:6380 reality-check
```

Update the stack: `scp infra/docker-compose.server.yml reality-check:santavideo/docker-compose.yml && ssh reality-check 'cd ~/santavideo && docker compose up -d'`.

## How to run

Requirements: Node ≥ 22, ffmpeg/ffprobe on PATH, the SSH tunnel above for the database and queue. No Docker needed locally.

```bash
npm install
npm test                  # vitest
npm run typecheck
npm run master:prepare    # once per master version: upscaled body, slot clip, end-card plate -> .data/masters/
npm run dev               # site on http://localhost:3000 (EN /en, FR /fr)
npm run stripe:listen     # forwards Stripe test webhooks to the site (needs the Stripe CLI)
npm run worker            # render worker (TTS -> Sync lipsync-2-pro -> ffmpeg); spends money on new names
npm run sample -- Emma    # landing-page sample video (public name)
npm run db:generate       # after editing packages/db/src/schema.ts
npm run db:migrate        # apply migrations (tunnel open)
npm run bench:costs       # regenerate docs/phase0-cost-model.md from config/*.json
npm run bench:run -- benchmark/cases.json            # dry run: prints spend estimate
npm run bench:run -- benchmark/cases.json --confirm  # calls providers (needs FAL_KEY)
npm run bench:splice -- fit greeting.mp3 4.5 fitted.wav
npm run bench:splice -- splice master.mp4 clip.mp4 6.0 out.mp4
```

## Environment variables

See `.env.example`. Phase 0 needs only `FAL_KEY` (and `BENCH_BUDGET_USD`, default 20). The ElevenLabs account is currently reached through the ElevenLabs MCP connector; the pipeline will use `ELEVENLABS_API_KEY`.

## Name splice (how instant videos work)

1. Master performance has a fixed-length name slot with a natural pause before and after.
2. Greeting audio ("Ho ho ho! Hello, Emma! …") is generated with the same ElevenLabs voice as the master, then fitted to slot length.
3. The master's slot segment + fitted audio → lip-sync provider → clip with only the mouth changed.
4. ffmpeg replaces the slot with the clip (40 ms audio fades at the joins), adds optional end card + music.

## To be written in later phases

How to add a language · how to add names / pronunciations · how to re-render · runbook for common failures.
