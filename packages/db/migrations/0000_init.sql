CREATE TYPE "public"."clip_status" AS ENUM('rendering', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'refunded', 'expired');--> statement-breakpoint
CREATE TYPE "public"."site_locale" AS ENUM('en', 'fr');--> statement-breakpoint
CREATE TYPE "public"."video_language" AS ENUM('en', 'fr');--> statement-breakpoint
CREATE TYPE "public"."video_status" AS ENUM('awaiting_payment', 'queued', 'rendering', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "name_clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cache_key" text NOT NULL,
	"name_key" text NOT NULL,
	"language" "video_language" NOT NULL,
	"voice_id" text NOT NULL,
	"master_version" text NOT NULL,
	"lipsync_model" text NOT NULL,
	"status" "clip_status" DEFAULT 'rendering' NOT NULL,
	"clip_key" text,
	"audio_key" text,
	"source" text NOT NULL,
	"cost_usd" numeric(10, 4),
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "name_pronunciations" (
	"name_key" text NOT NULL,
	"language" "video_language" NOT NULL,
	"respelling" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"product" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"locale" "site_locale" NOT NULL,
	"preview_token" text NOT NULL,
	"stripe_session_id" text,
	"email_enc" text,
	"consent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "orders_preview_token_unique" UNIQUE("preview_token"),
	CONSTRAINT "orders_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_spend" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" date DEFAULT (now() at time zone 'utc')::date NOT NULL,
	"vendor" text NOT NULL,
	"usd" numeric(10, 4) NOT NULL,
	"units" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"watch_token" text NOT NULL,
	"child_name" text,
	"name_key" text,
	"language" "video_language" NOT NULL,
	"status" "video_status" DEFAULT 'awaiting_payment' NOT NULL,
	"name_clip_id" uuid,
	"final_key" text,
	"error_code" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone,
	"emailed_at" timestamp with time zone,
	CONSTRAINT "videos_watch_token_unique" UNIQUE("watch_token")
);
--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_name_clip_id_name_clips_id_fk" FOREIGN KEY ("name_clip_id") REFERENCES "public"."name_clips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "name_clips_cache_key_uq" ON "name_clips" USING btree ("cache_key");--> statement-breakpoint
CREATE INDEX "name_clips_name_idx" ON "name_clips" USING btree ("name_key","language");--> statement-breakpoint
CREATE UNIQUE INDEX "name_pronunciations_uq" ON "name_pronunciations" USING btree ("name_key","language");--> statement-breakpoint
CREATE INDEX "vendor_spend_day_idx" ON "vendor_spend" USING btree ("day","vendor");--> statement-breakpoint
CREATE INDEX "videos_order_idx" ON "videos" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "videos_status_idx" ON "videos" USING btree ("status");