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

## Tests required (brief)

Payment webhook idempotency + signature check; name validation; render cache key; data-deletion job comes in Phase 4 but the schema supports it now.

## What I need from the owner

1. ~~Local Postgres + Redis~~ Done 2026-11-11: running on the shared VPS behind an SSH tunnel (see CLAUDE.md "Server").
2. **Stripe test keys** (`STRIPE_SECRET_KEY` test, webhook secret via Stripe CLI) — test mode only.
3. **Resend**: API key later; dev logs emails instead.
4. **Library spend**: each new name costs ≈ $0.17 (Sync pro) + TTS. Test orders in Phase 1 use ~10 names (≈ $2).
