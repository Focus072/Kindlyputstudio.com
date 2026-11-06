"use client";

import { useEffect, useState, type CSSProperties } from "react";

/**
 * While the on-screen keyboard is open on a phone, returns a style that fits a
 * fixed full-screen layer to the part of the screen still visible, so a bottom
 * sheet's message box sits right above the keyboard instead of behind it.
 * Returns undefined when the keyboard is closed (and on desktop).
 */
export function useVisibleViewport(active: boolean): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties | undefined>(undefined);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!active || !vv) return;
    const update = () => {
      const covered = window.innerHeight - vv.height;
      // Ignore small changes such as the browser's own toolbar sliding away.
      if (covered < 120) setStyle(undefined);
      else setStyle({ top: vv.offsetTop, height: vv.height, bottom: "auto" });
    };
    // The keyboard is never open yet when the sheet first appears, so wait for it.
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setStyle(undefined);
    };
  }, [active]);

  return active ? style : undefined;
}
