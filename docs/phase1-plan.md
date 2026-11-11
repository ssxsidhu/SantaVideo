# Phase 1 plan — website + instant video, end to end (Stripe test mode)

Goal from the brief: a parent can land, type a first name, see a preview, pay (Stripe **test** mode), and watch their personalized Santa video on a private page, with a confirmation email. Checkpoint = owner watches real videos made by the pipeline.

Owner changes vs. the brief: EN only for video (FR video deferred; FR UI strings still ship), lazy name library (render on first order, cache forever) instead of pre-rendering 200 names up front.

## Structure (npm workspaces)

```
apps/web          Next.js App Router + Tailwind: landing, name entry, preview, checkout, watch page, i18n EN/FR
workers/render    BullMQ worker: greeting TTS → Sync lipsync-2-pro → assemble (code moved from benchmark/src)
packages/db       Drizzle schema + migrations (Postgres)
packages/core     shared: pricing config, name validation, render cache keys, storage adapter, i18n messages
infra/            docker-compose.server.yml (Postgres + Redis on the VPS)
```

## Data (first cut)

- `orders`: id, stripe_session_id (unique), status, product, currency, amount, email (encrypted at rest), locale, created_at
- `videos`: id, order_id, watch_token (random 32 bytes, unguessable), name_key, language, status, final_video_key, delivered_at
- `name_clips`: (name_key, language, voice_id, master_version) unique → clip_key, status. The library cache; no customer data.
- `render_jobs`: id, kind, status, attempts, last_error (no names/emails in errors), timestamps
- Webhook events table for idempotency (Stripe event id unique)

## Flow

1. Landing (`/`): hero sample video, 3 steps, FAQ. Name + consent checkbox.
2. `POST /api/instant/start`: validate name (letters only, blocklist), create pending order; **name goes in the DB, never the URL**; returns a Checkout session (Stripe test).
3. Preview before paying: a watermarked still of Santa's end card with the name (ffmpeg, instant, free) — no vendor call before payment.
4. Stripe webhook `checkout.session.completed` (idempotent, tested) → mark paid → look up `name_clips`:
   - hit → enqueue **assemble** only (seconds)
   - miss → enqueue **greeting TTS → lip-sync → assemble**; the new clip joins the library
5. Watch page `/w/{token}`: cozy "elves are wrapping" progress state → plays when ready; download + share; upsell placeholder.
6. Email (Resend) with the watch link + "delete my data" link. Dev: logged to console without personal data.

## Progress (2026-11-11)

- Done: npm workspaces; `packages/core` (pricing from config, name validation + blocklist, URL tokens, AES-GCM email encryption, clip/final cache keys, local-disk storage, EN/FR messages; 33 tests pass); `packages/db` (Drizzle schema, migration `0000_init` applied on the VPS).
- Launch master (`master-en-v3-take__omnihuman-720p.mp4`, 1248x704, 43.24 s audio): mouth sits at about x=985, y=415 in 1920x1080, so the starting mouth mask is `985,420,170,120`. Check it on the first lip-sync test.
- Next: Next.js site (landing, preview, watch page), Stripe Checkout + webhook (with tests), render worker (TTS → Sync pro → assemble). The worker needs `ELEVENLABS_API_KEY` in `.env`. The `slotFit.ts` policy is still the owner's TODO.

## Payments: Stripe Managed Payments (decided 2026-11-11)

Stripe is merchant of record: it collects and files sales tax/VAT, handles fraud and disputes, and checkout runs through Link ("Sold through Link"; the bank statement shows `LINK.COM*`). Product tax code `txcd_10402100` (downloaded video, permanent rights), set by `STRIPE_PRODUCT_TAX_CODE`; without it checkout opts out.

- **Tax is added on top** of the price (owner decision 2026-11-11, Stripe's default for USD). Tested 2026-11-11: Seattle buyer pays $5.99 + $0.63 = $6.62.
- The webhook checks `amount_subtotal` (price before tax and discounts) against the order. `amount_total` legitimately differs with tax and promotion codes. Adaptive Pricing keeps both in USD.
- Test mode worked with no extra activation.

### Go-live checklist (Phase 5)

1. Finish Stripe business verification (dashboard asks for it).
2. Activate Managed Payments in live mode and accept its terms: Dashboard → Settings → Managed Payments.
3. Set the public business name (checkout currently shows "SantaVideo sandbox"), support email and statement descriptor in Dashboard → Settings → Business / Public details.
4. Create a live webhook endpoint `https://<domain>/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`; copy its signing secret.
5. On the server `.env`: `STRIPE_SECRET_KEY=sk_live_…`, `STRIPE_WEBHOOK_SECRET=whsec_…` (live), `STRIPE_ALLOW_LIVE=1`, same `STRIPE_PRODUCT_TAX_CODE`.
6. One real $5.99 purchase on your own card, then refund it from the dashboard.

## Storage: Cloudflare R2 (2026-11-11)

Bucket `myvideofromsanta-media` (private). Site and worker use R2 automatically when the four `R2_*` variables are set; media links are 1-hour signed URLs. `R2_BUCKET` is the bucket name, not the endpoint URL. Earlier local files were copied up (6 files, sizes verified). The R2 token needs only "Object Read & Write" on this one bucket.

## Tests required (brief)

Payment webhook idempotency + signature check; name validation; render cache key; data-deletion job comes in Phase 4 but the schema supports it now.

## What I need from the owner

1. ~~Local Postgres + Redis~~ Done 2026-11-11: running on the shared VPS behind an SSH tunnel (see CLAUDE.md "Server").
2. **Stripe test keys** (`STRIPE_SECRET_KEY` test, webhook secret via Stripe CLI) — test mode only.
3. **Resend**: API key later; dev logs emails instead.
4. **Library spend**: each new name costs ≈ $0.17 (Sync pro) + TTS. Test orders in Phase 1 use ~10 names (≈ $2).
