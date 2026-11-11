import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isUrlToken } from "@santa/core";
import { format, getMessages, isLocale } from "@santa/core/i18n";
import { WatchClient } from "@/components/WatchClient";
import { findWatch } from "@/server/orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function WatchPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  if (!isLocale(locale) || !isUrlToken(token)) notFound();
  const t = getMessages(locale);
  const video = await findWatch(token);
  const name = video?.childName ?? "";

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-4 sm:px-6">
      <h1 className="font-display text-3xl text-cream sm:text-4xl">{video?.status === "ready" ? t.watch.ready : t.watch.title}</h1>
      <div className="mt-6">
        <WatchClient token={token} initialStatus={video?.status ?? "notFound"} t={t.watch} />
      </div>
      {video && name && (
        <aside className="mt-10 rounded-2xl border border-gold/30 bg-pine/60 p-5">
          <h2 className="font-display text-xl text-gold">{t.watch.upsellTitle}</h2>
          <p className="mt-1 text-sm text-cream-dim">{format(t.watch.upsellBody, { name })}</p>
        </aside>
      )}
    </main>
  );
}
