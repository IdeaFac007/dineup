import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://dineupindia.com";
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/marketplace`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/restaurant/signup`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/restaurant/login`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
