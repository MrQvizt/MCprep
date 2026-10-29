import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { siteUrl } from "@/lib/env";
import { getBrandAssets } from "@/lib/public-data";
import { getSettings } from "@/lib/settings";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, brand] = await Promise.all([getSettings(), getBrandAssets()]);
  const name = settings.business.tradingName;
  const icon = brand.favicon?.url ?? "/icon.svg";
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: `${name} Malta`, template: `%s | ${name} Malta` },
    description: settings.seo.defaultDescription,
    applicationName: name,
    icons: { icon: [{ url: icon }], apple: [{ url: brand.favicon?.url ?? "/icon.svg" }] },
    manifest: "/manifest.webmanifest",
    formatDetection: { telephone: false, email: false, address: false },
    verification: {
      google: settings.seo.googleSiteVerification || undefined,
      other: settings.seo.bingSiteVerification ? { "msvalidate.01": settings.seo.bingSiteVerification } : undefined,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#080808",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-MT" className="h-full" suppressHydrationWarning>
      <body className="min-h-full">
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
