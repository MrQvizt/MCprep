import type { CutoffConfig } from "@/lib/order-cutoff";
import type { SettingsOf } from "@/lib/settings/schema";

/** Weekly ordering deadline from the collection & delivery settings. */
export function cutoffConfig(f: Pick<SettingsOf<"fulfillment">, "weeklyCutoffEnabled" | "weeklyCutoffDay" | "weeklyCutoffTime">): CutoffConfig {
  return { enabled: f.weeklyCutoffEnabled, weekday: f.weeklyCutoffDay, time: f.weeklyCutoffTime };
}
