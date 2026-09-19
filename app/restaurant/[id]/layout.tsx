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

function cleanDescription(value: string | null, fallback: string) {
  const text = (value || fallback).replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
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
    const image = profileRow.cover_image_url || profileRow.logo_image_url || undefined;

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
        ...(image ? { images: [{ url: image, alt: `${row.name} on DineUp` }] } : {}),
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title,
        description,
        ...(image ? { images: [image] } : {}),
      },
      robots: { index: true, follow: true },
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
        const sameAs = [profileRow.website_url, profileRow.instagram_url].filter(Boolean);
        const image = [profileRow.cover_image_url, profileRow.logo_image_url].filter(Boolean);
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
            const parts = value.split(/\s*-\s*/).map((part) => part.trim());
            if (parts.length !== 2) return null;
            return {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: dayMap[day],
              opens: parts[0],
              closes: parts[1],
            };
          })
          .filter(Boolean);

        schema = {
          "@context": "https://schema.org",
          "@type": "Restaurant",
          name: row.name,
          url: `https://dineupindia.com/restaurant/${row.id}`,
          description: cleanDescription(
            profileRow.description,
            `${row.name} is a ${row.category || "restaurant"} in ${row.city}.`
          ),
          ...(row.category ? { servesCuisine: row.category } : {}),
          ...(profileRow.cuisine_tags?.length ? { knowsAbout: profileRow.cuisine_tags } : {}),
          ...(image.length ? { image } : {}),
          ...(profileRow.phone ? { telephone: profileRow.phone } : {}),
          ...(profileRow.price_range ? { priceRange: profileRow.price_range } : {}),
          address: {
            "@type": "PostalAddress",
            streetAddress: row.address || undefined,
            addressLocality: row.city,
            addressCountry: "IN",
          },
          ...(profileRow.menu_url ? { hasMenu: profileRow.menu_url } : {}),
          ...(sameAs.length ? { sameAs } : {}),
          ...(profileRow.google_maps_url ? { hasMap: profileRow.google_maps_url } : {}),
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
      {children}
    </>
  );
}
