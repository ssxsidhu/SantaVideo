import { sql } from "drizzle-orm";
import { date, index, integer, numeric, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Personal data lives only in: orders.email_enc (encrypted), videos.child_name.
 * Both are cleared by the data-deletion job (Phase 4): inputs 30 days after delivery, videos after Jan 31, 2027.
 * Nothing else (logs, errors, storage keys, vendor requests) may hold a name or email.
 */

export const orderStatus = pgEnum("order_status", ["pending", "paid", "refunded", "expired"]);
export const videoStatus = pgEnum("video_status", ["awaiting_payment", "queued", "rendering", "ready", "failed"]);
export const clipStatus = pgEnum("clip_status", ["rendering", "ready", "failed"]);
export const videoLanguage = pgEnum("video_language", ["en", "fr"]);
export const siteLocale = pgEnum("site_locale", ["en", "fr"]);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: orderStatus("status").notNull().default("pending"),
  product: text("product").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull(),
  locale: siteLocale("locale").notNull(),
  /** Token for the pre-payment preview page (/preview/{token}); carries no personal data. */
  previewToken: text("preview_token").notNull().unique(),
  stripeSessionId: text("stripe_session_id").unique(),
  /** AES-256-GCM ciphertext (packages/core crypto); set from Stripe Checkout after payment. */
  emailEnc: text("email_enc"),
  consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});

export const videos = pgTable(
  "videos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id),
    /** Unguessable token for the private watch page (/w/{token}). */
    watchToken: text("watch_token").notNull().unique(),
    childName: text("child_name"),
    nameKey: text("name_key"),
    language: videoLanguage("language").notNull(),
    status: videoStatus("status").notNull().default("awaiting_payment"),
    nameClipId: uuid("name_clip_id").references(() => nameClips.id),
    finalKey: text("final_key"),
    /** Short machine code only (e.g. "lipsync_failed"), never vendor text that could echo input. */
    errorCode: text("error_code"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
  },
  (t) => [index("videos_order_idx").on(t.orderId), index("videos_status_idx").on(t.status)],
);

/** The name library: one lip-synced greeting per (name, language, voice, master, model). No customer data. */
export const nameClips = pgTable(
  "name_clips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cacheKey: text("cache_key").notNull(),
    nameKey: text("name_key").notNull(),
    language: videoLanguage("language").notNull(),
    voiceId: text("voice_id").notNull(),
    masterVersion: text("master_version").notNull(),
    lipsyncModel: text("lipsync_model").notNull(),
    status: clipStatus("status").notNull().default("rendering"),
    clipKey: text("clip_key"),
    audioKey: text("audio_key"),
    /** "order" = rendered on first order; "library" = public name list warm-up. */
    source: text("source").notNull(),
    costUsd: numeric("cost_usd", { precision: 10, scale: 4 }),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readyAt: timestamp("ready_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("name_clips_cache_key_uq").on(t.cacheKey), index("name_clips_name_idx").on(t.nameKey, t.language)],
);

/** Owner-editable respellings for TTS ("Siobhan" -> "Shiv-awn"). */
export const namePronunciations = pgTable(
  "name_pronunciations",
  {
    nameKey: text("name_key").notNull(),
    language: videoLanguage("language").notNull(),
    respelling: text("respelling").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("name_pronunciations_uq").on(t.nameKey, t.language)],
);

/** Every Stripe event we accepted, so redelivered webhooks are processed once. */
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Vendor spend per call, for the daily cap and the admin spend view. */
export const vendorSpend = pgTable(
  "vendor_spend",
  {
    id: serial("id").primaryKey(),
    day: date("day").notNull().default(sql`(now() at time zone 'utc')::date`),
    vendor: text("vendor").notNull(),
    usd: numeric("usd", { precision: 10, scale: 4 }).notNull(),
    units: text("units"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("vendor_spend_day_idx").on(t.day, t.vendor)],
);
