import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get("place_id")?.trim() || "";
  const token = request.nextUrl.searchParams.get("session_token")?.trim() || "";
  const key = process.env.GOOGLE_MAPS_API_KEY || "";

  if (!key) return NextResponse.json({ error: "Google Places API key is not configured." }, { status: 503 });
  if (!placeId) return NextResponse.json({ error: "Missing place_id." }, { status: 400 });

  const response = await fetch(
    "https://places.googleapis.com/v1/places/" + encodeURIComponent(placeId),
    {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "id,displayName,formattedAddress,addressComponents,nationalPhoneNumber,internationalPhoneNumber,websiteUri,googleMapsUri,primaryType",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) return NextResponse.json({ error: "Unable to load Google place details." }, { status: response.status });

  const place = await response.json();
  const components = Array.isArray(place.addressComponents) ? place.addressComponents : [];
  const findComponent = (types: string[]) => {
    const component = components.find((item: any) => Array.isArray(item?.types) && item.types.some((type: string) => types.includes(type)));
    return component?.longText || "";
  };

  const city = findComponent(["locality", "postal_town", "administrative_area_level_2"]) || findComponent(["administrative_area_level_1"]);
  const rawType = place.primaryType || "";
  const categoryMap: Record<string, string> = {
    indian_restaurant: "North Indian",
    chinese_restaurant: "Chinese",
    cafe: "Cafe",
    bakery: "Bakery",
    fast_food_restaurant: "Fast Food",
    dessert_restaurant: "Desserts",
    fine_dining_restaurant: "Fine Dining",
  };

  return NextResponse.json({
    id: place.id || placeId,
    name: place.displayName?.text || "",
    address: place.formattedAddress || "",
    city,
    phone: place.internationalPhoneNumber || place.nationalPhoneNumber || "",
    website: place.websiteUri || "",
    googleMapsUrl: place.googleMapsUri || "",
    category: categoryMap[rawType] || "Other",
  });
}
