import type { Metadata } from "next";
import Link from "next/link";
import { findValidReset } from "@/lib/customer-accounts";
import { CUSTOMER_PASSWORD_MIN_LENGTH } from "@/lib/passwords";
import { ResetPasswordForm } from "../account-forms";
import { AuthShell } from "../account-ui";

export const metadata: Metadata = {
  title: { absolute: "Choose a new password | MC PREPS" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({ searchParams }: PageProps<"/account/reset-password">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token.slice(0, 100) : "";
  const reset = await findValidReset(token).catch(() => null);

  if (!reset) {
    return (
      <AuthShell eyebrow="Your account" title="This link has expired" image="/images/menu/mexican-beef-bowl.webp">
        <p className="text-base leading-relaxed text-ink/70">
          Reset links work once and only for a limited time. Ask for a new one and use it straight away.
        </p>
        <Link
          href="/account/forgot-password"
          className="mt-8 inline-flex h-12 w-full items-center justify-center bg-ink px-6 text-xs font-semibold uppercase tracking-[0.16em] text-white hover:bg-charcoal"
        >
          Send me a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Your account"
      title="Choose a new password"
      intro={<>For <strong className="text-ink">{reset.account.email}</strong>. You&apos;ll be signed in straight after, and signed out everywhere else.</>}
      image="/images/menu/mexican-beef-bowl.webp"
    >
      <ResetPasswordForm token={token} minPassword={CUSTOMER_PASSWORD_MIN_LENGTH} />
    </AuthShell>
  );
}
