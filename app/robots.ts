import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/checkout/ok", "/checkout/failed", "/checkout/pending"]
    },
    sitemap: "https://polianthes.shop/sitemap.xml",
    host: "https://polianthes.shop"
  };
}
