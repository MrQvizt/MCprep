"use client";

import Link from "next/link";

export function ErrorContent({ reset, digest }: { reset: () => void; digest?: string }) {
  return (
    <section className="bg-ink text-white" aria-labelledby="err-title">
      <div className="container-site py-24 sm:py-32">
        <p className="eyebrow text-fog">Something went wrong</p>
        <h1 id="err-title" className="mt-6 display-lg max-w-3xl text-balance">
          We couldn&apos;t load this page.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-white/75">
          Please try again in a moment. If it keeps happening, message us on WhatsApp or Instagram and we&apos;ll help you directly.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-12 items-center justify-center bg-white px-6 text-xs font-semibold uppercase tracking-[0.14em] text-ink hover:bg-mist"
          >
            Try again
          </button>
          <Link href="/" className="inline-flex h-12 items-center justify-center border border-white/40 px-6 text-xs font-semibold uppercase tracking-[0.14em] hover:border-white">
            Back to home
          </Link>
        </div>
        {digest && <p className="mt-10 text-xs text-fog">Reference: {digest}</p>}
      </div>
    </section>
  );
}
