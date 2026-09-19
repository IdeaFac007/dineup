import type { MetadataRoute } from "next";
import { createClient } from "../lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://dineupindia.com";
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/marketplace`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/restaurant/signup`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/restaurant/login`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/refund-policy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.4 },
  ];

  try {
    const supabase = await createClient();
    const { data: restaurants, error } = await supabase
      .from("restaurants")
      .select("id")
      .eq("is_active", true);

    if (error) {
      console.error("Sitemap restaurant query failed:", error);
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

    return [...staticRoutes, ...restaurantRoutes];
  } catch (error) {
    console.error("Sitemap generation failed:", error);
    return staticRoutes;
  }
}
