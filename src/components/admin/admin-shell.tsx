"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CornerDownRight,
  ExternalLink,
  FileText,
  HelpCircle,
  History,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  Newspaper,
  Quote,
  Rocket,
  Search,
  Settings,
  Shield,
  Tags,
  Timer,
  TrendingUp,
  Truck,
  UserCircle,
  Users,
  Utensils,
  X,
  type LucideIcon,
} from "lucide-react";
import { InstagramIcon } from "@/components/shared/icons";
import { cn } from "@/lib/utils";
import type { AdminNavGroup } from "./nav-config";

const ICONS: Record<string, LucideIcon | typeof InstagramIcon> = {
  "layout-dashboard": LayoutDashboard,
  rocket: Rocket,
  inbox: Inbox,
  users: Users,
  "trending-up": TrendingUp,
  utensils: Utensils,
  tags: Tags,
  timer: Timer,
  megaphone: Megaphone,
  "file-text": FileText,
  image: ImageIcon,
  instagram: InstagramIcon,
  "help-circle": HelpCircle,
  quote: Quote,
  newspaper: Newspaper,
  search: Search,
  "corner-down-right": CornerDownRight,
  "map-pin": MapPin,
  activity: Activity,
  truck: Truck,
  settings: Settings,
  shield: Shield,
  history: History,
  "user-circle": UserCircle,
};

function NavList({ groups, pathname, badges }: { groups: AdminNavGroup[]; pathname: string; badges: Record<string, number> }) {
  return (
    <nav aria-label="Admin" className="space-y-6">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="px-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/40">{group.title}</p>
          <ul className="mt-2 space-y-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon] ?? FileText;
              const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const badge = badges[item.href];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white",
                      active && "bg-white/10 text-white",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {badge ? (
                      <span className="rounded-full bg-white px-1.5 py-0.5 text-[0.65rem] font-bold text-ink tabular">{badge}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({
  groups,
  admin,
  badges = {},
  signOutAction,
  children,
}: {
  groups: AdminNavGroup[];
  admin: { name: string; email: string; roleLabel: string };
  badges?: Record<string, number>;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Menu is "open" only for the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean) => setOpenOn(v ? pathname : null);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/admin" className="font-display text-base font-black uppercase tracking-[0.14em] text-white">
          MC PREPS <span className="ml-1 text-[0.6rem] font-semibold tracking-[0.2em] text-white/50">Admin</span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-6">
        <NavList groups={groups} pathname={pathname} badges={badges} />
      </div>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-medium text-white">{admin.name}</p>
        <p className="truncate text-xs text-white/50">
          {admin.email} · {admin.roleLabel}
        </p>
        <div className="mt-3 flex gap-2">
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-white/15 px-2 py-1.5 text-xs text-white/80 hover:text-white"
          >
            <ExternalLink className="size-3.5" /> View site
          </a>
          <form action={signOutAction} className="flex-1">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-white/15 px-2 py-1.5 text-xs text-white/80 hover:text-white"
            >
              <LogOut className="size-3.5" /> Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-mist/60 text-ink">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-sidebar lg:block">{sidebar}</aside>
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-ink px-4 text-white lg:hidden">
        <Link href="/admin" className="font-display text-sm font-black uppercase tracking-[0.14em]">
          MC PREPS Admin
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open admin menu"
          aria-expanded={open}
          className="inline-grid size-10 place-items-center"
        >
          <Menu className="size-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-sidebar shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 inline-grid size-10 place-items-center text-white"
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
