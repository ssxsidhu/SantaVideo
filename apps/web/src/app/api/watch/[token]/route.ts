import { NextResponse } from "next/server";
import { isUrlToken } from "@santa/core";
import { findWatch } from "@/server/orders";

export const runtime = "nodejs";

/** Polled by the watch page. Returns status only; the page already has the name from the server render. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isUrlToken(token)) return NextResponse.json({ status: "notFound" }, { status: 404 });
  const video = await findWatch(token);
  if (!video) return NextResponse.json({ status: "notFound" }, { status: 404 });
  return NextResponse.json({ status: video.status }, { headers: { "Cache-Control": "no-store" } });
}
