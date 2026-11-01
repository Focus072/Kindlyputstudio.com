import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${brand.siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${brand.siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${brand.siteUrl}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
