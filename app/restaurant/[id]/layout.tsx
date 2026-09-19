import type { Metadata } from "next";
import { createClient } from "../../../lib/supabase/server";
import { safeGoogleMapsUrl } from "../../../lib/google-maps";

type RestaurantPageData = {
  id: number;
  name: string;
  city: string;
  category: string | null;
  address: string | null;
};

type ProfileData = {
  description: string | null;
  cover_image_url: string | null;
  logo_image_url: string | null;
  phone: string | null;
  website_url: string | null;
  menu_url: string | null;
  google_maps_url: string | null;
  instagram_url: string | null;
  price_range: string | null;
  cuisine_tags: string[] | null;
  opening_hours: Record<string, string> | null;
};

function safeExternalUrl(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return "";
  try {
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : "https://" + raw;
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}
function cleanDescription(value: string | null, fallback: string) {
  const candidate = (value || "").replace(/\s+/g, " ").trim();
  const fallbackText = fallback.replace(/\s+/g, " ").trim();
  const text = candidate || fallbackText;
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}
function normalizeOptionalText(value: string | null | undefined) {
  const clean = value?.replace(/\s+/g, " ").trim();
  return clean || "";
}
function normalizeSchemaTime(value: string) {
  const raw = value.trim().toUpperCase().replace(/\./g, "").replace(/\s+/g, " ");
  const match12 = raw.match(/^(\d{1,2})(?::([0-5]\d))?\s*(AM|PM)$/);
  if (match12) {
    let hour = Number(match12[1]);
    const minute = match12[2] || "00";
    if (hour < 1 || hour > 12) return "";
    if (match12[3] === "AM") {
      if (hour === 12) hour = 0;
    } else if (hour !== 12) {
      hour += 12;
    }
    return `${String(hour).padStart(2, "0")}:${minute}`;
  }
  const match24 = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match24 ? match24[0] : "";
}
function normalizeSchemaPhone(value: string | null | undefined) {
  const raw = value?.replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const hasPlus = raw.startsWith("+");
  if (raw.includes("+", 1)) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return "";
  return `${hasPlus ? "+" : ""}${digits}`;
}
function normalizeCuisineTags(value: string[] | null | undefined) {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const tag of value || []) {
    const clean = tag.trim();
    const key = clean.toLocaleLowerCase("en-IN");
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    tags.push(clean);
    if (tags.length === 12) break;
  }
  return tags;
}
function normalizeOpeningHours(value: Record<string, string> | null | undefined) {
  const normalized: Record<string, string> = {};
  for (const [day, hours] of Object.entries(value || {})) {
    const key = day.trim().toLowerCase();
    const clean = typeof hours === "string" ? hours.replace(/\s+/g, " ").trim() : "";
    if (!/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/.test(key) || !clean || normalized[key]) continue;
    normalized[key] = clean;
  }
  return normalized;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const restaurantId = Number(id);

  if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
    return {
      title: "Restaurant — DineUp",
      description: "Discover restaurants on DineUp.",
      robots: { index: false, follow: false },
    };
  }

  try {
    const supabase = await createClient();
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("id,name,city,category,address")
      .eq("id", restaurantId)
      .eq("is_active", true)
      .maybeSingle();

    if (!restaurant) {
      return {
        title: "Restaurant unavailable — DineUp",
        description: "This restaurant is not currently available on DineUp.",
        robots: { index: false, follow: false },
      };
    }

    const { data: profile } = await supabase
      .from("restaurant_profiles")
      .select("description,cover_image_url,logo_image_url,phone,website_url,menu_url,google_maps_url,instagram_url,price_range,cuisine_tags,opening_hours")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    const row = restaurant as RestaurantPageData;
    const profileRow = (profile || {}) as ProfileData;
    const restaurantName = row.name?.trim() || "Restaurant";
    const category = row.category?.trim() || "restaurant";
    const city = row.city?.trim() || "";
    const title = city ? `${restaurantName} — ${city} | DineUp` : `${restaurantName} | DineUp`;
    const description = cleanDescription(
      profileRow.description,
      city
        ? `${restaurantName} is a ${category} in ${city}. Discover the profile, menu, contact details and more on DineUp.`
        : `Discover ${restaurantName} on DineUp. View the profile, menu, contact details and more.`
    );
    const canonical = `https://dineupindia.com/restaurant/${row.id}`;
    const image = safeExternalUrl(profileRow.cover_image_url) || safeExternalUrl(profileRow.logo_image_url) || undefined;

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url: canonical,
        siteName: "DineUp",
        type: "website",
        locale: "en_IN",
        ...(image ? { images: [{ url: image, alt: `${restaurantName} on DineUp` }] } : {}),
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title,
        description,
        ...(image ? { images: [image] } : {}),
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-video-preview": -1,
          "max-snippet": -1,
        },
      },
    };
  } catch (error) {
    console.error("Restaurant metadata error:", error);
    return {
      title: "Restaurant — DineUp",
      description: "Discover restaurants on DineUp.",
      robots: { index: false, follow: false },
    };
  }
}

export default async function RestaurantProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const restaurantId = Number(id);
  let schema: Record<string, unknown> | null = null;
  let breadcrumbSchema: Record<string, unknown> | null = null;

  if (Number.isInteger(restaurantId) && restaurantId > 0) {
    try {
      const supabase = await createClient();
      const [{ data: restaurant }, { data: profile }] = await Promise.all([
        supabase
          .from("restaurants")
          .select("id,name,city,category,address")
          .eq("id", restaurantId)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("restaurant_profiles")
          .select("description,cover_image_url,logo_image_url,phone,website_url,menu_url,google_maps_url,instagram_url,price_range,cuisine_tags,opening_hours")
          .eq("restaurant_id", restaurantId)
          .maybeSingle(),
      ]);

      if (restaurant) {
        const row = restaurant as RestaurantPageData;
        const profileRow = (profile || {}) as ProfileData;
        const restaurantName = row.name?.trim() || "Restaurant";
        const category = row.category?.trim() || "Restaurant";
        const city = row.city?.trim() || "";
        const websiteUrl = safeExternalUrl(profileRow.website_url);
        const instagramUrl = safeExternalUrl(profileRow.instagram_url);
        const menuUrl = safeExternalUrl(profileRow.menu_url);
        const fallbackMapsContext = [row.address?.trim(), city].filter(Boolean).join(", ");
        const fallbackMapsQuery = fallbackMapsContext ? `${restaurantName}, ${fallbackMapsContext}` : "";
        const fallbackMapsUrl = fallbackMapsQuery
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackMapsQuery)}`
          : "https://www.google.com/maps";
        const mapsUrl = safeGoogleMapsUrl(profileRow.google_maps_url) || fallbackMapsUrl;
        const telephone = normalizeSchemaPhone(profileRow.phone);
        const priceRange = normalizeOptionalText(profileRow.price_range);
        const cuisineTags = normalizeCuisineTags(profileRow.cuisine_tags);
        const sameAs = Array.from(new Set([websiteUrl, instagramUrl].filter(Boolean)));
        const image = Array.from(new Set([profileRow.cover_image_url, profileRow.logo_image_url].map((value) => safeExternalUrl(value)).filter(Boolean)));
        const logoUrl = safeExternalUrl(profileRow.logo_image_url);
        const hours = normalizeOpeningHours(profileRow.opening_hours);
        const dayMap: Record<string, string> = {
          monday: "Monday",
          tuesday: "Tuesday",
          wednesday: "Wednesday",
          thursday: "Thursday",
          friday: "Friday",
          saturday: "Saturday",
          sunday: "Sunday",
        };
        const openingHoursSpecification = Object.entries(hours)
          .map(([day, value]) => [day.trim().toLowerCase(), value] as const)
          .filter(([day, value]) => dayMap[day] && typeof value === "string" && value.trim())
          .map(([day, value]) => {
            const parts = value.split(/\s*[–—-]\s*/).map((part) => normalizeSchemaTime(part));
            if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
            return {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: dayMap[day],
              opens: parts[0],
              closes: parts[1],
            };
          })
          .filter(Boolean);

        const canonicalUrl = `https://dineupindia.com/restaurant/${row.id}`;
        breadcrumbSchema = {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "@id": `${canonicalUrl}#breadcrumb`,
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "DineUp Marketplace",
              item: "https://dineupindia.com/marketplace",
            },
            ...(city
              ? [{
                  "@type": "ListItem",
                  position: 2,
                  name: city,
                }]
              : []),
            {
              "@type": "ListItem",
              position: city ? 3 : 2,
              name: restaurantName,
              item: canonicalUrl,
            },
          ],
        };

        schema = {
          "@context": "https://schema.org",
          "@type": "Restaurant",
          "@id": `${canonicalUrl}#restaurant`,
          name: restaurantName,
          url: canonicalUrl,
          mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
          description: cleanDescription(
            profileRow.description,
            city
              ? `${restaurantName} is a ${category.toLowerCase()} in ${city}.`
              : `Discover ${restaurantName} on DineUp.`
          ),
          ...(cuisineTags.length ? { servesCuisine: cuisineTags } : { servesCuisine: category }),
          ...(cuisineTags.length ? { knowsAbout: cuisineTags } : {}),
          ...(image.length ? { image } : {}),
          ...(logoUrl ? { logo: logoUrl } : {}),
          ...(telephone ? { telephone } : {}),
          ...(priceRange ? { priceRange } : {}),
          address: {
            "@type": "PostalAddress",
            streetAddress: normalizeOptionalText(row.address) || undefined,
            ...(city ? { addressLocality: city } : {}),
            addressCountry: "IN",
          },
          ...(menuUrl ? { hasMenu: menuUrl } : {}),
          ...(sameAs.length ? { sameAs } : {}),
          ...(mapsUrl ? { hasMap: mapsUrl } : {}),
          ...(openingHoursSpecification.length ? { openingHoursSpecification } : {}),
        };
      }
    } catch (error) {
      console.error("Restaurant schema error:", error);
    }
  }

  return (
    <>
      {schema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}
      {breadcrumbSchema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(breadcrumbSchema).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}
      {children}
    </>
  );
}
