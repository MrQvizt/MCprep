import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentCustomer, safeNext } from "@/lib/customer-auth";
import { db } from "@/lib/db";
import { verifyConfirmationToken } from "@/lib/orders/service";
import { CUSTOMER_PASSWORD_MIN_LENGTH } from "@/lib/passwords";
import { SignUpForm } from "../account-forms";
import { AuthShell, authParams, authQuery } from "../account-ui";

export const metadata: Metadata = {
  title: { absolute: "Create your account | MC PREPS" },
  robots: { index: false, follow: false },
};

export default async function SignUpPage({ searchParams }: PageProps<"/account/sign-up">) {
  const params = authParams(await searchParams);
  if (await getCurrentCustomer()) redirect(safeNext(params.next));

  // Coming from an order confirmation: fill in what they already told us (needs the private token).
  let defaults: { name?: string; email?: string; phone?: string } | undefined;
  if (params.claimRef && params.claimToken) {
    const order = await db.order
      .findUnique({
        where: { reference: params.claimRef },
        select: { id: true, idempotencyKey: true, accountId: true, customerName: true, customerEmail: true, customerPhone: true },
      })
      .catch(() => null);
    if (order && !order.accountId && verifyConfirmationToken(order, params.claimToken)) {
      defaults = { name: order.customerName, email: order.customerEmail, phone: order.customerPhone };
    }
  }

  return (
    <AuthShell
      eyebrow="Create your account"
      title={defaults ? "Save your order" : "Order faster"}
      image="/images/menu/chicken-poke-bowl.webp"
      intro={
        defaults ? (
          <>
            Pick a password and order <strong className="text-ink">{params.claimRef}</strong> is saved to your new account — so next time it&apos;s two taps.
          </>
        ) : (
          "Save your details once, track every order and re-order your favourite package in two taps."
        )
      }
      footer={
        <>
          Already have an account?{" "}
          <Link href={`/account/sign-in${authQuery(params)}`} className="font-semibold text-ink underline underline-offset-4">
            Sign in
          </Link>
          . By creating an account you agree to our{" "}
          <Link href="/privacy-policy" className="underline underline-offset-4">
            privacy policy
          </Link>
          .
        </>
      }
    >
      <SignUpForm {...params} defaults={defaults} minPassword={CUSTOMER_PASSWORD_MIN_LENGTH} />
    </AuthShell>
  );
}
