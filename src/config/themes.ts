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
  midnight: {
    id: "midnight",
    label: "Midnight glow",
    description: "Deep navy room with a cool light glow from the left.",
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

export const themeList: ThemePreset[] = Object.values(themes);

export function getTheme(id: string | null | undefined): ThemePreset {
  return (themes as Record<string, ThemePreset>)[id ?? ""] ?? themes.midnight;
}

/** CSS variables for a room's root element. */
export function themeVars(preset: string, accentOverride?: string | null) {
  const t = getTheme(preset);
  const accent = isHex(accentOverride) ? accentOverride! : t.accent;
  return {
    "--room-bg": t.background,
    "--room-surface": t.surface,
    "--room-fg": t.foreground,
    "--room-muted": t.muted,
    "--room-border": t.border,
    "--room-accent": accent,
    "--room-glow": String(t.glow),
  } as React.CSSProperties;
}

export function isHex(v: string | null | undefined): v is string {
  return !!v && /^#[0-9a-fA-F]{6}$/.test(v);
}
