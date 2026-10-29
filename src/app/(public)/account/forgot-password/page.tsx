import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "../account-forms";
import { AuthShell } from "../account-ui";

export const metadata: Metadata = {
  title: { absolute: "Reset your password | MC PREPS" },
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Your account"
      title="Forgot your password?"
      intro="Enter the email you signed up with and we'll send you a link to choose a new one."
      image="/images/menu/mexican-beef-bowl.webp"
      footer={
        <>
          Remembered it?{" "}
          <Link href="/account/sign-in" className="font-semibold text-ink underline underline-offset-4">
            Back to sign in
          </Link>
          . No email after a few minutes? Check your spam folder or message us.
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
