import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCustomer } from "@/lib/customer-auth";
import { CUSTOMER_PASSWORD_MIN_LENGTH } from "@/lib/passwords";
import { ChangePasswordForm, DeleteAccountForm, ProfileForm } from "../account-forms";

export const metadata: Metadata = {
  title: { absolute: "Account settings | MC PREPS" },
  robots: { index: false, follow: false },
};

function Panel({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="light grid gap-6 bg-paper p-6 text-ink sm:p-8 lg:grid-cols-[16rem_1fr]">
      <div>
        <h2 className="font-display text-xl font-black uppercase tracking-wide">{title}</h2>
        {intro && <p className="mt-2 text-sm leading-relaxed text-ink/65">{intro}</p>}
      </div>
      <div className="max-w-lg">{children}</div>
    </section>
  );
}

export default async function AccountSettingsPage() {
  const customer = await requireCustomer("/account/settings");
  return (
    <div className="bg-ink">
      <section className="container-site pb-8 pt-10 sm:pt-14">
        <Link href="/account" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-fog hover:text-white">
          <ArrowLeft className="size-4" aria-hidden="true" /> Your account
        </Link>
        <h1 className="mt-6 display-lg">Settings</h1>
      </section>
      <div className="container-site space-y-4 pb-20">
        <Panel title="Your details" intro="Used to fill in your next order. Changing them here doesn't change orders you've already sent.">
          <ProfileForm name={customer.name} email={customer.email} phone={customer.phone ?? ""} />
        </Panel>
        <Panel title="Password">
          <ChangePasswordForm minPassword={CUSTOMER_PASSWORD_MIN_LENGTH} />
        </Panel>
        <Panel title="Delete account" intro="Removes your login and saved details.">
          <DeleteAccountForm />
        </Panel>
      </div>
    </div>
  );
}
