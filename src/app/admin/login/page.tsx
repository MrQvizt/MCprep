import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/authz";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: { absolute: "Admin sign in | MC PREPS" },
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (await getCurrentAdmin()) redirect("/admin");
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <div className="grid min-h-dvh place-items-center bg-ink px-4 py-12 text-white">
      <div className="w-full max-w-sm">
        <p className="font-display text-2xl font-black uppercase tracking-[0.14em]">MC PREPS</p>
        <h1 className="mt-8 font-display text-3xl font-extrabold uppercase">Admin sign in</h1>
        <p className="mt-2 text-sm text-fog">Manage orders, meals, prices, promotions and content.</p>
        <div className="light mt-8 rounded-xl bg-paper p-6 text-ink shadow-2xl">
          <LoginForm next={next} />
        </div>
        <p className="mt-6 text-xs text-fog">
          Admin accounts are created with <code className="text-white">npm run admin:create</code>. See the README.
        </p>
      </div>
    </div>
  );
}
