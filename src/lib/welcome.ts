import type { PoolHealth } from "./agent";

export function huntCadence(freq?: string) {
  return freq === "weekly" ? "weekly" : freq === "twice_daily" ? "twice a day" : "daily";
}

/** First-login banner: don't claim a hunt scored listings when the pool is empty or the feed is off. */
export function onboardingWelcome(kind: PoolHealth["kind"], matchCount: number, freq?: string) {
  const cadence = huntCadence(freq);
  if (kind !== "ok") {
    return {
      title: "You're set up. The hunt is waiting on listings.",
      body: "Your search profile is saved. We'll score jobs as soon as the feed has listings — the banner below explains why nothing showed up yet.",
    };
  }
  if (!matchCount) {
    return {
      title: "Your first hunt is done.",
      body: `Nothing in the current pool cleared your match bar. We'll keep hunting ${cadence} from here.`,
    };
  }
  return {
    title: "Your first hunt is done.",
    body: `The agent scored every opportunity it found against your profile. It will keep hunting ${cadence} from here.`,
  };
}
