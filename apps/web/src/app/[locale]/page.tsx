import { notFound } from "next/navigation";
import { getMessages, isLocale } from "@santa/core/i18n";
import { NameForm } from "@/components/NameForm";

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getMessages(locale);
  const steps = [t.steps.one, t.steps.two, t.steps.three];

  return (
    <main>
      <section className="mx-auto grid max-w-5xl gap-8 px-4 pb-12 pt-4 sm:px-6 md:grid-cols-[1.15fr_1fr] md:items-center md:gap-10 md:pt-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{t.hero.eyebrow}</p>
          <h1 className="mt-3 font-display text-4xl leading-[1.05] text-cream sm:text-5xl">{t.hero.title}</h1>
          <p className="mt-4 max-w-md text-base text-cream-dim sm:text-lg">{t.hero.subtitle}</p>
          <figure className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-pine shadow-2xl shadow-black/50">
            <video
              src="/api/sample/en.mp4"
              poster="/api/sample/en.jpg"
              controls
              playsInline
              preload="none"
              className="aspect-video w-full bg-pine"
            />
            <figcaption className="px-4 py-2 text-xs text-cream-dim">{t.hero.sampleCaption}</figcaption>
          </figure>
        </div>
        <NameForm locale={locale} t={t.form} />
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h2 className="font-display text-3xl text-cream">{t.steps.title}</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-white/10 bg-pine/60 p-5">
              <span className="font-display text-3xl text-gold">{i + 1}</span>
              <h3 className="mt-2 font-semibold text-cream">{step.title}</h3>
              <p className="mt-1 text-sm text-cream-dim">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h2 className="font-display text-3xl text-cream">{t.faq.title}</h2>
        <div className="mt-6 divide-y divide-white/10 rounded-2xl border border-white/10 bg-pine/60">
          {t.faq.items.map((item) => (
            <details key={item.q} className="group px-5 py-4">
              <summary className="cursor-pointer list-none font-semibold text-cream marker:hidden">
                <span className="mr-2 inline-block text-gold transition group-open:rotate-90">›</span>
                {item.q}
              </summary>
              <p className="mt-2 text-sm text-cream-dim">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
