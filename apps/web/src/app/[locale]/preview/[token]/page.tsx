import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatPrice, getProductPrice, isUrlToken } from "@santa/core";
import { format, getMessages, isLocale } from "@santa/core/i18n";
import { PayButton } from "@/components/PayButton";
import { findPreview } from "@/server/orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PreviewPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  if (!isLocale(locale) || !isUrlToken(token)) notFound();
  const t = getMessages(locale);
  const order = await findPreview(token);

  if (!order || order.status === "expired" || order.status === "refunded") {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <p className="text-cream-dim">{t.preview.expired}</p>
        <a href={`/${locale}`} className="mt-4 inline-block text-gold underline underline-offset-4">
          {t.preview.changeName}
        </a>
      </main>
    );
  }

  const price = formatPrice(getProductPrice("instant"), locale === "fr" ? "fr-CA" : "en-US");
  const name = order.childName;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-4 sm:px-6">
      <h1 className="font-display text-3xl leading-tight text-cream sm:text-4xl">{format(t.preview.title, { name })}</h1>
      {/* eslint-disable-next-line @next/next/no-img-element -- generated per order, private, not optimizable */}
      <img
        src={`/api/preview/${token}`}
        alt=""
        width={1280}
        height={720}
        className="mt-6 aspect-video w-full rounded-2xl border border-white/10 bg-pine object-cover shadow-2xl shadow-black/50"
      />
      <p className="mt-5 text-cream-dim">{format(t.preview.body, { name })}</p>
      <div className="mt-6 max-w-md">
        {order.status === "paid" ? (
          <a
            href={`/${locale}/w/${order.watchToken}`}
            className="block w-full rounded-xl bg-cranberry px-5 py-3.5 text-center font-semibold text-white"
          >
            {t.watch.ready}
          </a>
        ) : (
          <PayButton
            previewToken={token}
            label={format(t.preview.pay, { price })}
            busyLabel={t.preview.paying}
            errorLabel={t.form.errors.generic}
          />
        )}
        <p className="text-xs text-cream-dim">{t.preview.secure}</p>
        <a href={`/${locale}`} className="mt-4 inline-block text-sm text-gold underline underline-offset-4">
          {t.preview.changeName}
        </a>
      </div>
    </main>
  );
}
