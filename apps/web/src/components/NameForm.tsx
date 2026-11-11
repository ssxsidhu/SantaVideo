"use client";

import { useState, type FormEvent } from "react";
import type { Locale, Messages } from "@santa/core/i18n";

type FormError = keyof Messages["form"]["errors"];

interface Props {
  locale: Locale;
  t: Messages["form"];
}

export function NameForm({ locale, t }: Props) {
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("empty");
    if (!consent) return setError("consent");
    setBusy(true);
    setError(null);
    try {
      // POST body only: the name never goes into a URL.
      const response = await fetch("/api/instant/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, consent, locale, language: "en" }),
      });
      const data = (await response.json()) as { previewPath?: string; error?: string };
      if (!response.ok || !data.previewPath) {
        setError(data.error && data.error in t.errors ? (data.error as FormError) : "generic");
        setBusy(false);
        return;
      }
      window.location.assign(data.previewPath);
    } catch {
      setError("generic");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-2xl border border-white/10 bg-pine/80 p-5 shadow-2xl shadow-black/40 backdrop-blur sm:p-6">
      <label htmlFor="child-name" className="block text-sm font-medium text-cream">
        {t.nameLabel}
      </label>
      <input
        id="child-name"
        name="childName"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.namePlaceholder}
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        maxLength={30}
        aria-invalid={error !== null && error !== "consent"}
        aria-describedby="name-help name-error"
        className="mt-2 w-full rounded-xl border border-white/15 bg-night/70 px-4 py-3 text-lg text-cream placeholder:text-cream-dim/50 focus:border-gold focus:outline-none"
      />
      <p id="name-help" className="mt-2 text-xs text-cream-dim">
        {t.nameHelp}
      </p>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-cream">{t.languageLabel}</legend>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full border border-gold/60 bg-gold/10 px-3 py-1 text-gold">{t.languageEn}</span>
          <span className="rounded-full border border-white/10 px-3 py-1 text-cream-dim/70">{t.languageFrSoon}</span>
        </div>
      </fieldset>

      <label className="mt-4 flex items-start gap-3 text-sm text-cream-dim">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-cranberry"
        />
        <span>{t.consent}</span>
      </label>

      <p id="name-error" role="alert" className="mt-3 min-h-5 text-sm text-[#f3a1a8]">
        {error ? t.errors[error] : ""}
      </p>

      <button
        type="submit"
        disabled={busy}
        className="mt-2 w-full rounded-xl bg-cranberry px-5 py-3.5 text-base font-semibold text-white transition hover:bg-cranberry-dark disabled:opacity-60"
      >
        {busy ? t.submitting : t.submit}
      </button>
    </form>
  );
}
