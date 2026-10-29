import type { AdminArea } from "@/lib/authz";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: string;
  area: AdminArea;
  exact?: boolean;
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: "layout-dashboard", area: "dashboard", exact: true },
      { href: "/admin/launch", label: "Launch checklist", icon: "rocket", area: "launch" },
    ],
  },
  {
    title: "Orders",
    items: [
      { href: "/admin/orders", label: "Orders", icon: "inbox", area: "orders" },
      { href: "/admin/customers", label: "Customers", icon: "users", area: "customers" },
      { href: "/admin/growth", label: "Growth & performance", icon: "trending-up", area: "growth" },
    ],
  },
  {
    title: "Menu & pricing",
    items: [
      { href: "/admin/meals", label: "Meals", icon: "utensils", area: "meals" },
      { href: "/admin/plans", label: "Plans & prices", icon: "tags", area: "plans" },
      { href: "/admin/promotions", label: "Promotions", icon: "timer", area: "promotions" },
      { href: "/admin/landing-pages", label: "Offer pages", icon: "megaphone", area: "promotions" },
    ],
  },
  {
    title: "Content",
    items: [
      { href: "/admin/content", label: "Homepage & pages", icon: "file-text", area: "content" },
      { href: "/admin/media", label: "Media library", icon: "image", area: "media" },
      { href: "/admin/gallery", label: "Instagram gallery", icon: "instagram", area: "gallery" },
      { href: "/admin/faqs", label: "FAQs", icon: "help-circle", area: "faqs" },
      { href: "/admin/testimonials", label: "Testimonials", icon: "quote", area: "testimonials" },
      { href: "/admin/blog", label: "Blog", icon: "newspaper", area: "blog" },
    ],
  },
  {
    title: "Google & SEO",
    items: [
      { href: "/admin/seo", label: "SEO & Google visibility", icon: "search", area: "seo" },
      { href: "/admin/redirects", label: "Redirects", icon: "corner-down-right", area: "redirects" },
      { href: "/admin/listings", label: "Google & listings", icon: "map-pin", area: "listings" },
      { href: "/admin/health", label: "Site health", icon: "activity", area: "health" },
    ],
  },
  {
    title: "Business",
    items: [
      { href: "/admin/delivery", label: "Delivery & collection", icon: "truck", area: "delivery" },
      { href: "/admin/settings", label: "Business settings", icon: "settings", area: "settings" },
      { href: "/admin/users", label: "Admin users", icon: "shield", area: "users" },
      { href: "/admin/audit", label: "Activity log", icon: "history", area: "audit" },
      { href: "/admin/account", label: "My account", icon: "user-circle", area: "account" },
    ],
  },
];
