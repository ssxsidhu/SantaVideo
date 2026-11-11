"use client";

import { useState } from "react";

interface Props {
  previewToken: string;
  label: string;
  busyLabel: string;
  errorLabel: string;
}

export function PayButton({ previewToken, label, busyLabel, errorLabel }: Props) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function pay() {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewToken }),
      });
      const data = (await response.json()) as { url?: string };
      if (!response.ok || !data.url) throw new Error("checkout");
      window.location.assign(data.url);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={pay}
        disabled={busy}
        className="w-full rounded-xl bg-cranberry px-5 py-3.5 text-base font-semibold text-white transition hover:bg-cranberry-dark disabled:opacity-60"
      >
        {busy ? busyLabel : label}
      </button>
      <p role="alert" className="mt-2 min-h-5 text-sm text-[#f3a1a8]">
        {failed ? errorLabel : ""}
      </p>
    </div>
  );
}
