import type { MetadataRoute } from "next";
import { createClient } from "../lib/supabase/server";

export const revalidate = 3600;

function citySlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://dineupindia.com";
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/marketplace`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/refund-policy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.4 },
  ];

  try {
    const supabase = await createClient();
    const [{ data: restaurants, error: restaurantError }, { data: cityRows, error: cityError }] = await Promise.all([
      supabase.from("restaurants").select("id,city").eq("is_active", true),
      supabase.from("restaurants").select("city").eq("is_active", true),
    ]);

    if (restaurantError) {
      console.error("Sitemap restaurant query failed:", restaurantError);
      return staticRoutes;
    }

    const restaurantRoutes: MetadataRoute.Sitemap = (restaurants || [])
      .map((restaurant) => Number(restaurant.id))
      .filter((id) => Number.isInteger(id) && id > 0)
      .map((id) => ({
        url: `${base}/restaurant/${id}`,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));

    const citySlugs = Array.from(new Set(
      (cityRows || [])
        .map((row) => citySlug(String(row.city || "")))
        .filter(Boolean)
    ));
    const cityRoutes: MetadataRoute.Sitemap = citySlugs.map((slug) => ({
      url: `${base}/city/${slug}`,
      changeFrequency: "daily" as const,
      priority: 0.75,
    }));

    if (cityError) console.error("Sitemap city query failed:", cityError);
    return [...staticRoutes, ...cityRoutes, ...restaurantRoutes];
  } catch (error) {
    console.error("Sitemap generation failed:", error);
    return staticRoutes;
  }
}
