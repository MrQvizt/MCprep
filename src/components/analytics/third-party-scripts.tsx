"use client";

import Script from "next/script";
import { useAnalytics } from "./analytics-provider";

/**
 * Google Analytics 4 / Google Tag Manager / Google Ads / Meta Pixel.
 * Nothing loads until the visitor has given the matching consent.
 */
export function ThirdPartyScripts() {
  const { config, consent } = useAnalytics();
  if (!consent) return null;
  const analytics = consent.analytics;
  const marketing = consent.marketing;
  const gtagId = config.ga4Id || (marketing ? config.googleAdsId : "");

  return (
    <>
      {analytics && config.gtmId && (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(config.gtmId)});`}
        </Script>
      )}
      {(analytics || marketing) && gtagId && !config.gtmId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gtagId)}`} strategy="afterInteractive" />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
gtag('consent','default',{analytics_storage:${JSON.stringify(analytics ? "granted" : "denied")},ad_storage:${JSON.stringify(marketing ? "granted" : "denied")},ad_user_data:${JSON.stringify(marketing ? "granted" : "denied")},ad_personalization:${JSON.stringify(marketing ? "granted" : "denied")}});
gtag('js',new Date());
${analytics && config.ga4Id ? `gtag('config',${JSON.stringify(config.ga4Id)},{anonymize_ip:true});` : ""}
${marketing && config.googleAdsId ? `gtag('config',${JSON.stringify(config.googleAdsId)});` : ""}`}
          </Script>
        </>
      )}
      {marketing && config.metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(config.metaPixelId)});fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}
