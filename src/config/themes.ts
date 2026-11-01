/**
 * Room theme presets. Each room picks one preset and can override its accent
 * color. The accent drives the glow, buttons, play icons, and highlights.
 */
export type ThemePreset = {
  id: string;
  label: string;
  description: string;
  background: string;
  surface: string;
  foreground: string;
  muted: string;
  border: string;
  accent: string;
  /** Strength of the glow on the left side, 0 to 1. */
  glow: number;
};

export const themes = {
  studio: {
    id: "studio",
    label: "Studio (KPS)",
    description: "Kindly Put Studio ink with a cool steel glow. The house style.",
    background: "#0F181D",
    surface: "#1D2B32",
    foreground: "#E1E2E5",
    muted: "#8FA0A8",
    border: "rgba(207,216,216,0.10)",
    accent: "#B6C3C8",
    glow: 0.4,
  },
  midnight: {
    id: "midnight",
    label: "Midnight glow",
    description: "Deep navy room with a bright blue glow from the left.",
    background: "#070B16",
    surface: "#0E1424",
    foreground: "#F3F5FA",
    muted: "#8A93A8",
    border: "rgba(255,255,255,0.08)",
    accent: "#5B8CFF",
    glow: 0.55,
  },
  ember: {
    id: "ember",
    label: "Ember",
    description: "Warm charcoal room with an orange glow for high energy shoots.",
    background: "#0D0906",
    surface: "#18110B",
    foreground: "#FFF6EC",
    muted: "#A8968A",
    border: "rgba(255,255,255,0.08)",
    accent: "#FF8A1F",
    glow: 0.6,
  },
} satisfies Record<string, ThemePreset>;

export type ThemeId = keyof typeof themes;
export const DEFAULT_THEME: ThemeId = "studio";

export const themeList: ThemePreset[] = Object.values(themes);

export function getTheme(id: string | null | undefined): ThemePreset {
  return (themes as Record<string, ThemePreset>)[id ?? ""] ?? themes[DEFAULT_THEME];
}

export function isHex(v: string | null | undefined): v is string {
  return !!v && /^#[0-9a-fA-F]{6}$/.test(v);
}

/** Dark text on light accents (like KPS steel), white text on strong ones. */
export function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.32 ? "#1D2B32" : "#FFFFFF";
}

/** CSS variables for a room's root element. */
export function themeVars(preset: string, accentOverride?: string | null) {
  const t = getTheme(preset);
  const accent = isHex(accentOverride) ? accentOverride : t.accent;
  return {
    "--room-bg": t.background,
    "--room-surface": t.surface,
    "--room-fg": t.foreground,
    "--room-muted": t.muted,
    "--room-border": t.border,
    "--room-accent": accent,
    "--room-accent-fg": readableOn(accent),
    "--room-glow": String(t.glow),
  } as React.CSSProperties;
}
