import { en, type Messages } from "./en";
import { fr } from "./fr";

export const LOCALES = ["en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export type { Messages };

const catalogs: Record<Locale, Messages> = { en, fr };

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (LOCALES as readonly string[]).includes(value);
}

export function getMessages(locale: Locale): Messages {
  return catalogs[locale];
}

/** Fills {placeholders}. Unknown placeholders are left visible so a missing value is caught in review. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** Picks a locale from an Accept-Language header ("fr-CA,fr;q=0.9,en;q=0.8" -> "fr"). */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? 1);
      return { lang: tag.toLowerCase().split("-")[0], q: Number.isFinite(q) ? q : 0 };
    })
    .sort((a, b) => b.q - a.q);
  return ranked.map((r) => r.lang).find((l): l is Locale => isLocale(l)) ?? DEFAULT_LOCALE;
}
