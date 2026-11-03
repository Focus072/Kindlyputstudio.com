"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/** Room links are private, so reports only ever see "/r/[room]". */
function scrub(url: string) {
  return url.replace(/\/r\/[^/?#]+/, "/r/[room]");
}

/** Vercel Web Analytics and Speed Insights. They stay silent until turned on in the Vercel project. */
export function Telemetry() {
  return (
    <>
      <Analytics beforeSend={(event) => ({ ...event, url: scrub(event.url) })} />
      <SpeedInsights beforeSend={(data) => ({ ...data, url: scrub(data.url) })} />
    </>
  );
}
