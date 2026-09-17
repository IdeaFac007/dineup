import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/restaurant/dashboard/", "/restaurant/bid/", "/api/"] },
    sitemap: "https://dineupindia.com/sitemap.xml",
  };
}
