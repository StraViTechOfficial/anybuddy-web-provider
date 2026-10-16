import { NextResponse, type NextRequest } from "next/server";

// Location (the address the Buddy works from, as in the register API) → map point for update-register-profile step 1
// (services need it). The browser can't call the US Census geocoder itself (no CORS), so this forwards only
// street/city/state/ZIP. Signed-in only (middleware).
// Uses the free keyless US Census geocoder (US addresses, no autocomplete); swap for Google Geocoding to use one
// geocoder across apps.
//
// Census matching is fuzzy: "Bostom 02458" can come back as a different street in Boston 02215. A match counts only
// when its ZIP equals what the Buddy typed (postal city names vary: Newton or Chestnut Hill), or its city matches and
// the ZIP shares the first 3 digits (Census ZIPs drift by a neighbour: 02458 vs 02459; another area's ZIP is caught).
// On a miss we ask again without one field, so the reply names the field that is wrong ({ field, message }).
const CENSUS = "https://geocoding.geo.census.gov/geocoder/locations/address";

type Match = { x: number; y: number; city: string; zip: string };

async function find(q: Record<string, string>): Promise<Match | null> {
  const url = new URL(CENSUS);
  for (const [k, v] of Object.entries(q)) url.searchParams.set(k, v.slice(0, 100));
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  const m = (await res.json())?.result?.addressMatches?.[0];
  const c = m?.coordinates;
  if (typeof c?.x !== "number" || typeof c?.y !== "number") return null;
  return { x: c.x, y: c.y, city: m.addressComponents?.city ?? "", zip: m.addressComponents?.zip ?? "" };
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const near = (a: string, b: string) => a.slice(0, 3) === b.slice(0, 3);
const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
const wrong = (field: string, message: string) => NextResponse.json({ field, message }, { status: 422 });

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const [street, city, state, zip] = ["street", "city", "state", "zip"].map((k) => p.get(k) ?? "");
  try {
    const hit = await find({ street, city, state, zip });
    if (hit && (hit.zip === zip || (same(hit.city, city) && near(hit.zip, zip)))) return NextResponse.json({ latitude: hit.y, longitude: hit.x });
    if (hit && same(hit.city, city)) return wrong("zip", `The ZIP code for this address is ${hit.zip}.`);

    const noZip = await find({ street, city, state });
    if (noZip && same(noZip.city, city)) return wrong("zip", `The ZIP code for this address is ${noZip.zip}.`);
    const noCity = await find({ street, state, zip });
    if (noCity) return wrong("city", `This address is in ${title(noCity.city)}.`);
    if (hit) return wrong("city", `We found this street in ${title(hit.city)}, ZIP ${hit.zip}. Check the city and ZIP code.`);
    return wrong("street", `We couldn't find this street in ${city}. Check the building number and street name.`);
  } catch {
    return NextResponse.json({ message: "We can't check addresses right now. Try again in a moment." }, { status: 502 });
  }
}
