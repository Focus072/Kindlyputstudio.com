/**
 * Kindly Put Studio brand settings (from the KPS Brand System 01 kit).
 *
 * To change the logo, replace the files in /public/brand/ (keep the names) or
 * point the paths below at new files. Colors and fonts update everywhere.
 */
export const brand = {
  name: "Kindly Put Studio",
  /** Public address used for copied client links and share previews. */
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kindlyputstudio.com").replace(/\/$/, ""),
  shortName: "KPS",
  legalName: "Kindly Put Studio",
  tagline: "Kindly put. Boldly seen.",
  city: "Bakersfield, CA",
  deliveredBy: "Kindly Put Studio",
  /** Shown as the small tag in the top right corner of every room. */
  poweredByLabel: "Kindly Put Studio",
  website: "https://kindlyputstudio.com",
  logo: {
    /** Full logo (camera mark + wordmark) for light backgrounds. */
    full: "/brand/kps-logo-ink.png",
    /** Full logo for dark backgrounds. */
    fullOnDark: "/brand/kps-logo-white.png",
    /** Camera mark only, for small spaces. */
    mark: "/brand/kps-mark-ink.png",
    markOnDark: "/brand/kps-mark-white.png",
  },
  colors: {
    ink: "#1D2B32", // contrast
    slate: "#4F6671", // primary
    steel: "#B6C3C8", // accent
    mist: "#CFD8D8", // secondary
    cloud: "#E1E2E5", // light backgrounds
    /** Main accent in the admin: buttons, links, focus rings. */
    primary: "#4F6671",
    /** Approve and decline states across all rooms. */
    approve: "#22C55E",
    decline: "#F97362",
  },
} as const;

export type Brand = typeof brand;
