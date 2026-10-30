"use client";

import { Flame, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { pad2, useOfferCountdown } from "./use-offer-countdown";

interface Personal {
  windowMinutes: number;
  startedAt: string | null;
  endsAt: string;
  serverNow: string;
}

export interface PackageOfferLineProps {
  /** e.g. "First week" or "First 4 weeks" (shown in red) */
  lead: string;
  /** e.g. "€30" */
  price: string;
  /** Normal price, struck through, e.g. "€52.50" */
  was: string;
  /** e.g. "New customers" */
  audience: string;
  /** Visitor's personal deadline ("order within 2 hours"), if the offer has one. */
  personal: Personal | null;
  featured?: boolean;
}

const windowLabel = (minutes: number) =>
  minutes % 60 === 0 ? `${minutes / 60} hour${minutes === 60 ? "" : "s"}` : `${minutes} minutes`;

function Line({ lead, price, was, audience, personal, featured, timer }: PackageOfferLineProps & { timer?: React.ReactNode }) {
  const red = featured ? "text-red-600" : "text-red-500";
  return (
    <div className={cn("mt-5 flex items-start gap-2 border-t pt-4 text-sm", featured ? "border-ink/15" : "border-white/15")}>
      <Flame className={cn("mt-0.5 size-4 shrink-0", red)} aria-hidden="true" />
      <div>
        <p>
          <span className={cn("font-bold uppercase tracking-wide", red)}>{lead}</span> <span className="font-bold">{price}</span>{" "}
          <span className="text-current/60 line-through">{was}</span>
        </p>
        <p className="text-xs text-current/60">
          {audience}
          {personal ? ` · order within ${windowLabel(personal.windowMinutes)}` : ""}
        </p>
        {timer}
      </div>
    </div>
  );
}

/** Offer line with the visitor's live countdown; gone once their window ends. */
function PersonalOfferLine(props: PackageOfferLineProps & { personal: Personal }) {
  const { remaining, hours, minutes, seconds } = useOfferCountdown({
    windowMinutes: props.personal.windowMinutes,
    endsAt: props.personal.endsAt,
    startedAt: props.personal.startedAt,
    serverNow: props.personal.serverNow,
    autoStart: false, // the offer bar / homepage panel starts the window
  });
  if (remaining <= 0) return null;
  return (
    <Line
      {...props}
      timer={
        <span
          role="timer"
          aria-label={`${hours} hours ${minutes} minutes left`}
          className="mt-2 inline-flex items-center gap-1.5 bg-red-600 px-2 py-1 text-xs font-bold tabular text-white"
        >
          <Timer className="size-3.5" aria-hidden="true" />
          Ends in {hours}:{pad2(minutes)}:{pad2(seconds)}
        </span>
      }
    />
  );
}

/** "🔥 FIRST WEEK €30 ~~€52.50~~" on a package card (+ live countdown for personal-deadline offers). */
export function PackageOfferLine(props: PackageOfferLineProps) {
  return props.personal ? <PersonalOfferLine {...props} personal={props.personal} /> : <Line {...props} />;
}
