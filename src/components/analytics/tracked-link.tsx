"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { AnalyticsEventName, AnalyticsParams } from "@/lib/analytics/events";
import { useTrack } from "./analytics-provider";

/** Link that records an analytics event on click (internal or external). */
export function TrackedLink({
  href,
  event,
  params,
  children,
  external,
  ...rest
}: {
  href: string;
  event: AnalyticsEventName;
  params?: AnalyticsParams;
  children: React.ReactNode;
  external?: boolean;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const track = useTrack();
  const isExternal = external ?? /^(https?:|mailto:|tel:)/.test(href);
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    track(event, params);
    rest.onClick?.(e);
  };
  if (isExternal) {
    const newTab = /^https?:/.test(href);
    return (
      <a href={href} {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...rest} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} {...rest} onClick={onClick}>
      {children}
    </Link>
  );
}

/** Fires an event once when mounted (e.g. view_pricing, view_meal). */
export function TrackOnMount({ event, params }: { event: AnalyticsEventName; params?: AnalyticsParams }) {
  const track = useTrack();
  const key = JSON.stringify(params ?? {});
  useEffect(() => {
    track(event, JSON.parse(key) as AnalyticsParams);
  }, [event, key, track]);
  return null;
}
