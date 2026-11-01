import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

// Public marketing pages are open to search engines. Client rooms, accounts,
// and the admin are private and stay out of search results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/r/", "/account", "/login", "/auth/"] },
    sitemap: `${brand.siteUrl}/sitemap.xml`,
    host: brand.siteUrl,
  };
}
