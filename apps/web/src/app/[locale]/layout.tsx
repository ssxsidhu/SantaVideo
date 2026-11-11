import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { LOCALES, format, getMessages, isLocale } from "@santa/core/i18n";
import "../globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

interface Props {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getMessages(locale);
  return {
    title: t.meta.title,
    description: t.meta.description,
    // Private pages (preview, watch) also set noindex; the landing page is public.
    alternates: { languages: { en: "/en", fr: "/fr" } },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getMessages(locale);
  const otherLocale = locale === "en" ? "fr" : "en";

  return (
    <html lang={locale} className={`${fraunces.variable} ${inter.variable}`}>
      <body className="font-sans">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <a href={`/${locale}`} className="font-display text-lg tracking-tight text-cream">
            {t.nav.brand}
          </a>
          <a href={`/${otherLocale}`} hrefLang={otherLocale} className="text-sm text-cream-dim underline-offset-4 hover:underline">
            {t.nav.switchLanguage}
          </a>
        </header>
        {children}
        <footer className="mx-auto max-w-5xl px-4 py-10 text-xs text-cream-dim sm:px-6">
          {format(t.footer.copyright, { year: new Date().getFullYear() })}
        </footer>
      </body>
    </html>
  );
}
