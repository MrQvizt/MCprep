import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentCustomer, safeNext } from "@/lib/customer-auth";
import { SignInForm } from "../account-forms";
import { AuthShell, authParams, authQuery } from "../account-ui";

export const metadata: Metadata = {
  title: { absolute: "Sign in | MC PREPS" },
  robots: { index: false, follow: false },
};

export default async function SignInPage({ searchParams }: PageProps<"/account/sign-in">) {
  const params = authParams(await searchParams);
  if (await getCurrentCustomer()) redirect(safeNext(params.next));
  return (
    <AuthShell
      eyebrow="Your account"
      title="Welcome back"
      intro={params.claimRef ? <>Sign in to save order <strong className="text-ink">{params.claimRef}</strong> to your account.</> : "Sign in to see your orders and order again in seconds."}
      footer={
        <>
          New here?{" "}
          <Link href={`/account/sign-up${authQuery(params)}`} className="font-semibold text-ink underline underline-offset-4">
            Create an account
          </Link>{" "}
          — it takes 30 seconds. You can also order without one.
        </>
      }
    >
      <SignInForm {...params} />
    </AuthShell>
  );
}
