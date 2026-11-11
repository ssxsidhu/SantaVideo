"use client";

import { useEffect, useState } from "react";
import type { Messages } from "@santa/core/i18n";

type Status = "awaiting_payment" | "queued" | "rendering" | "ready" | "failed" | "notFound";

interface Props {
  token: string;
  initialStatus: Status;
  t: Messages["watch"];
}

const POLL_MS = 3000;

export function WatchClient({ token, initialStatus, t }: Props) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (status === "ready" || status === "failed" || status === "notFound") return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/watch/${token}`, { cache: "no-store" });
        const data = (await response.json()) as { status: Status };
        if (!cancelled) setStatus(data.status);
      } catch {
        // Keep polling; a blip shouldn't break the page.
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [status, token]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  if (status === "ready") {
    return (
      <div>
        <video
          src={`/api/media/${token}`}
          controls
          autoPlay
          playsInline
          className="aspect-video w-full rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/50"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={`/api/media/${token}?download=1`} className="rounded-xl bg-cranberry px-5 py-3 font-semibold text-white hover:bg-cranberry-dark">
            {t.download}
          </a>
          <button type="button" onClick={copyLink} className="rounded-xl border border-white/20 px-5 py-3 font-semibold text-cream hover:border-gold">
            {copied ? t.copied : t.share}
          </button>
        </div>
        <p className="mt-3 text-xs text-cream-dim">{t.privateNote}</p>
      </div>
    );
  }

  if (status === "failed" || status === "notFound") {
    return <p className="rounded-2xl border border-white/10 bg-pine/60 p-6 text-cream-dim">{status === "failed" ? t.failed : t.notFound}</p>;
  }

  const heading = status === "awaiting_payment" ? t.confirming : t.rendering;
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl border border-white/10 bg-pine/70 p-6 text-center">
      <div aria-hidden className="h-10 w-10 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
      <p role="status" className="mt-5 font-display text-2xl text-cream">
        {heading}
      </p>
      {status !== "awaiting_payment" && <p className="mt-2 max-w-md text-sm text-cream-dim">{t.renderingBody}</p>}
    </div>
  );
}
