import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("input")?.trim() || "";
  const city = request.nextUrl.searchParams.get("city")?.trim() || "";
  const token = request.nextUrl.searchParams.get("session_token")?.trim() || "";
  const key = process.env.GOOGLE_MAPS_API_KEY || "";

  if (!key) return NextResponse.json({ suggestions: [] });
  if (input.length < 3) return NextResponse.json({ suggestions: [] });

  const body: Record<string, unknown> = {
    input: [input, city].filter(Boolean).join(", "),
    includedRegionCodes: ["in"],
    includedPrimaryTypes: ["restaurant"],
  };
  if (token) body.sessionToken = token;

  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) return NextResponse.json({ suggestions: [] });

  const data = await response.json();
  const suggestions = Array.isArray(data.suggestions)
    ? data.suggestions
        .map((item: any) => item?.placePrediction)
        .filter((item: any) => item?.placeId && item?.text?.text)
        .slice(0, 5)
        .map((item: any) => ({ place_id: item.placeId, description: item.text.text }))
    : [];

  return NextResponse.json({ suggestions });
}
