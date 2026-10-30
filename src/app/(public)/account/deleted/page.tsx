import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "../account-ui";

export const metadata: Metadata = {
  title: { absolute: "Account deleted | MC PREPS" },
  robots: { index: false, follow: false },
};

export default function AccountDeletedPage() {
  return (
    <AuthShell eyebrow="Your account" title="Your account is deleted" image="/images/dishes/biscoff-cheesecake.webp">
      <p className="text-base leading-relaxed text-ink/70">
        Your login and saved details are gone. Orders you placed stay with us for our records. You can still order any time, with or
        without an account.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <Link
          href="/order"
          className="inline-flex h-12 items-center justify-center bg-ink px-6 text-xs font-semibold uppercase tracking-[0.16em] text-white hover:bg-charcoal"
        >
          Build your package
        </Link>
        <Link href="/" className="text-center text-sm text-ink/70 underline underline-offset-4 hover:text-ink">
          Back to the homepage
        </Link>
      </div>
    </AuthShell>
  );
}
