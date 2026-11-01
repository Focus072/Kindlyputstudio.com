import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

// Home screen app ("Add to Home Screen"). No start_url on purpose: the saved
// icon opens whatever page it was saved from (a room, My rooms, or the admin).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: "KPS",
    description: `Photo and video delivery rooms by ${brand.name}.`,
    display: "standalone",
    background_color: "#DEE0E4",
    theme_color: "#1D2B32",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
