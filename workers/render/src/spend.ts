import { eq, getDb, sql, vendorSpend } from "@santa/db";
import { StageError } from "./errors";

/** Daily vendor cap for the render pipeline (USD). Phase 1 test default is low on purpose. */
function dailyCapUsd(): number {
  const raw = Number(process.env.RENDER_DAILY_USD_CAP ?? 5);
  return Number.isFinite(raw) && raw >= 0 ? raw : 5;
}

export async function spentTodayUsd(): Promise<number> {
  const [row] = await getDb()
    .select({ total: sql<string>`coalesce(sum(${vendorSpend.usd}), 0)` })
    .from(vendorSpend)
    .where(eq(vendorSpend.day, sql`(now() at time zone 'utc')::date`));
  return Number(row?.total ?? 0);
}

/** Throws before a vendor call that would push today's spend over the cap (kill switch for runaway renders). */
export async function assertWithinCap(estimateUsd: number): Promise<void> {
  if (process.env.RENDER_PAUSED === "1") throw new StageError("spend_cap", "Rendering is paused (RENDER_PAUSED=1)", false);
  const spent = await spentTodayUsd();
  const cap = dailyCapUsd();
  if (spent + estimateUsd > cap) {
    throw new StageError("spend_cap", `Daily render cap reached: $${spent.toFixed(2)} spent, cap $${cap}`, false);
  }
}

export async function recordSpend(vendor: string, usd: number, units: string): Promise<void> {
  await getDb().insert(vendorSpend).values({ vendor, usd: usd.toFixed(4), units });
}

