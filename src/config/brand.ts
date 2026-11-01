/**
 * Kindly Put brand settings.
 *
 * When your logo and brand colors are ready:
 *   1. Drop the logo file in /public/brand/ (SVG or PNG works best).
 *   2. Set `logo` below to its path, for example "/brand/kindly-put-logo.svg".
 *   3. Swap the hex values in `colors`.
 * Every room and admin page picks the change up automatically.
 */
export const brand = {
  name: "Kindly Put",
  legalName: "Kindly Put Agency",
  city: "Bakersfield, CA",
  deliveredBy: "Kindly Put",
  /** Path under /public, or null to show the wordmark text instead. */
  logo: null as string | null,
  /** Shown as the small tag in the top right corner of every room. */
  poweredByLabel: "Kindly Put Rooms",
  website: "https://kindlyput.com",
  colors: {
    /** Main brand accent: buttons, links, focus rings in the admin. */
    primary: "#5B8CFF",
    /** Approve state across all rooms. */
    approve: "#22C55E",
    /** Decline / changes requested state across all rooms. */
    decline: "#F97362",
  },
} as const;

export type Brand = typeof brand;
