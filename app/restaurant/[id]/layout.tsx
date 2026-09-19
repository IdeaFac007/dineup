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
      .select("description,cover_image_url,logo_image_url")
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

export default function RestaurantProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
