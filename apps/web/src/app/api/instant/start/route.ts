import { NextResponse } from "next/server";
import { availableVideoLanguages, validateFirstName, type VideoLanguage } from "@santa/core";
import { isLocale } from "@santa/core/i18n";
import { repo } from "@/server/context";
import { createInstantOrder } from "@/server/orders";
import { allowRequest, clientKey } from "@/server/rateLimit";

export const runtime = "nodejs";

interface StartBody {
  name?: unknown;
  consent?: unknown;
  locale?: unknown;
  language?: unknown;
}

/** Step 1 of the instant flow: validate, store a pending order, return the preview page path (no name in it). */
export async function POST(request: Request) {
  if (!allowRequest(`start:${clientKey(request.headers)}`, 10, 60_000)) {
    return NextResponse.json({ error: "rateLimited" }, { status: 429 });
  }

  let body: StartBody;
  try {
    body = (await request.json()) as StartBody;
  } catch {
    return NextResponse.json({ error: "generic" }, { status: 400 });
  }

  const locale = typeof body.locale === "string" && isLocale(body.locale) ? body.locale : "en";
  if (body.consent !== true) return NextResponse.json({ error: "consent" }, { status: 400 });

  const name = validateFirstName(typeof body.name === "string" ? body.name : "");
  if (!name.ok) return NextResponse.json({ error: name.reason }, { status: 400 });

  const language = (typeof body.language === "string" ? body.language : "en") as VideoLanguage;
  if (!availableVideoLanguages().includes(language)) return NextResponse.json({ error: "generic" }, { status: 400 });

  repo(); // fail fast if config is missing
  try {
    const { previewToken } = await createInstantOrder({ displayName: name.displayName, nameKey: name.nameKey, language, locale });
    return NextResponse.json({ previewPath: `/${locale}/preview/${previewToken}` });
  } catch (error) {
    // Message only: never log the request body (it holds the child's name).
    console.error("instant/start failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}
