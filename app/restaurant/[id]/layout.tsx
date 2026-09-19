import type { Metadata } from "next";
import { createClient } from "../../../lib/supabase/server";

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
  const text = (value || fallback).replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}
function normalizeSchemaTime(value: string) {
  const raw = value.trim().toUpperCase().replace(/\./g, "");
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
  const raw = value?.trim();
  if (!raw) return "";
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return "";
  return `${hasPlus ? "+" : ""}${digits}`;
}
function normalizeCuisineTags(value: string[] | null | undefined) {
  return Array.from(new Set((value || []).map((tag) => tag.trim()).filter(Boolean))).slice(0, 12);
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
    const title = `${row.name} — ${row.city} | DineUp`;
    const description = cleanDescription(
      profileRow.description,
      `${row.name} is a ${row.category || "restaurant"} in ${row.city}. Discover the profile, menu, contact details and more on DineUp.`
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
        ...(image ? { images: [{ url: image, alt: `${row.name} on DineUp` }] } : {}),
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
      robots: { index: true, follow: true },
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
        const websiteUrl = safeExternalUrl(profileRow.website_url);
        const instagramUrl = safeExternalUrl(profileRow.instagram_url);
        const menuUrl = safeExternalUrl(profileRow.menu_url);
        const mapsUrl = safeExternalUrl(profileRow.google_maps_url);
        const telephone = normalizeSchemaPhone(profileRow.phone);
        const cuisineTags = normalizeCuisineTags(profileRow.cuisine_tags);
        const sameAs = [websiteUrl, instagramUrl].filter(Boolean);
        const image = [profileRow.cover_image_url, profileRow.logo_image_url].map((value) => safeExternalUrl(value)).filter(Boolean);
        const logoUrl = safeExternalUrl(profileRow.logo_image_url);
        const addressText = row.address
          ? `${row.address}, ${row.city}, India`
          : `${row.city}, India`;
        const hours = profileRow.opening_hours || {};
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
          .filter(([day, value]) => dayMap[day] && typeof value === "string" && value.trim())
          .map(([day, value]) => {
            const parts = value.split(/\s*-\s*/).map((part) => normalizeSchemaTime(part));
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
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "DineUp Marketplace",
              item: "https://dineupindia.com/marketplace",
            },
            {
              "@type": "ListItem",
              position: 2,
              name: row.city,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: row.name,
              item: canonicalUrl,
            },
          ],
        };

        schema = {
          "@context": "https://schema.org",
          "@type": "Restaurant",
          inLanguage: "en-IN",
          name: row.name,
          url: canonicalUrl,
          mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
          description: cleanDescription(
            profileRow.description,
            `${row.name} is a ${row.category || "restaurant"} in ${row.city}.`
          ),
          ...(cuisineTags.length ? { servesCuisine: cuisineTags } : row.category ? { servesCuisine: row.category } : {}),
          ...(cuisineTags.length ? { knowsAbout: cuisineTags } : {}),
          ...(image.length ? { image } : {}),
          ...(logoUrl ? { logo: logoUrl } : {}),
          ...(telephone ? { telephone } : {}),
          ...(profileRow.price_range ? { priceRange: profileRow.price_range } : {}),
          address: {
            "@type": "PostalAddress",
            streetAddress: row.address || undefined,
            addressLocality: row.city,
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
