import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { NotFoundContent } from "@/components/public/not-found-content";

export const metadata: Metadata = {
  title: { absolute: "Page not found | MC PREPS Malta" },
  robots: { index: false, follow: true },
};

/** Used for URLs that match no route (rendered outside the public layout). */
export default function NotFound() {
  return (
    <div className="dark flex min-h-dvh flex-col bg-ink text-white">
      <header className="border-b border-white/10">
        <div className="container-site flex h-16 items-center justify-between lg:h-20">
          <Link href="/" aria-label="MC PREPS — home">
            <Wordmark className="text-lg text-white [--wordmark-ink:#080808]" />
          </Link>
          <Link href="/plans" className="inline-flex h-10 items-center bg-white px-5 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink hover:bg-mist">
            Order now
          </Link>
        </div>
      </header>
      <main id="main" className="flex-1">
        <NotFoundContent />
      </main>
    </div>
  );
}
