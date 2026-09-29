import { NextResponse, type NextRequest } from "next/server";

// Location (complete address, contract SPA register) → map point for update-register-profile step 1 (services need it). The browser can't call the
// US Census geocoder itself (no CORS), so this forwards only street/city/state/ZIP. Signed-in only (middleware).
// ponytail: free keyless US Census geocoder (US addresses, no autocomplete); swap for Google Geocoding if the lead
// prefers one geocoder across apps.
const CENSUS = "https://geocoding.geo.census.gov/geocoder/locations/address";
const NOT_FOUND = "We couldn't find that address. Check the street and ZIP.";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const url = new URL(CENSUS);
  for (const k of ["street", "city", "state", "zip"]) url.searchParams.set(k, (q.get(k) ?? "").slice(0, 100));
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const hit = (await res.json())?.result?.addressMatches?.[0]?.coordinates;
    if (typeof hit?.x !== "number" || typeof hit?.y !== "number") return NextResponse.json({ message: NOT_FOUND }, { status: 404 });
    return NextResponse.json({ latitude: hit.y, longitude: hit.x });
  } catch {
    return NextResponse.json({ message: "We can't check addresses right now. Try again in a moment." }, { status: 502 });
  }
}
