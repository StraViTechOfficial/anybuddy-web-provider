// Google Maps JS for v2 Your details: address suggestions, the address at "Use my location", the travel
// circle. Loaded from Google's own script with NEXT_PUBLIC_GOOGLE_MAPS_KEY (AnyBuddy-owned, site-restricted).
// Without the key the screens show plain address fields and a drawn circle.
// APIs used: Maps JavaScript, Places (New) and Geocoding, all on that key.
export const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

export type LatLng = { lat: number; lng: number };
/** `missing`: what the picked place lacks ("street" = no house number or no street; "zip"); the Buddy adds it. */
export type Address = { street: string; city: string; state: string; zip: string; missing: ("street" | "zip")[] } & LatLng;

// The slice of the Maps JS API we use (developers.google.com/maps/documentation/javascript).
type Part = { longText?: string | null; shortText?: string | null; long_name?: string; short_name?: string; types: string[] };
type Place = { fetchFields(o: { fields: string[] }): Promise<unknown>; addressComponents?: Part[]; location?: { lat(): number; lng(): number } };
type Places = {
  AutocompleteSessionToken: new () => object;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(r: { input: string; sessionToken: object; includedRegionCodes: string[] }):
      Promise<{ suggestions: { placePrediction: { text: { toString(): string }; toPlace(): Place } | null }[] }>;
  };
};
type Geocoding = { Geocoder: new () => { geocode(r: { location: LatLng }): Promise<{ results: { address_components: Part[] }[] }> } };
export type GMap = { fitBounds(b: unknown, pad?: number): void };
export type GCircle = { setRadius(m: number): void; setCenter(c: LatLng): void; getBounds(): unknown };
export type Maps = { Map: new (el: HTMLElement, o: object) => GMap; Circle: new (o: object) => GCircle };
declare global {
  interface Window { google?: { maps?: { importLibrary(name: string): Promise<unknown> } }; __abMaps?: () => void }
}

let boot: Promise<void> | null = null;
function load(): Promise<void> {
  boot ??= new Promise<void>((ok, fail) => {
    if (window.google?.maps?.importLibrary) return ok();
    window.__abMaps = () => ok();
    const el = document.createElement("script");
    el.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_KEY)}&v=weekly&loading=async&callback=__abMaps`;
    el.async = true;
    el.onerror = () => { boot = null; fail(new Error("Address suggestions didn't load. Enter your address below.")); };
    document.head.appendChild(el);
  });
  return boot;
}
export const library = async <T>(name: "places" | "geocoding" | "maps") => {
  await load();
  return (await window.google!.maps!.importLibrary(name)) as T;
};

/** Street, city, state code and ZIP from Places (New) or Geocoder parts, with what is missing. */
function toAddress(parts: Part[], at: LatLng): Address {
  const get = (t: string, short = false) => {
    const p = parts.find((x) => x.types.includes(t));
    return (short ? p?.shortText ?? p?.short_name : p?.longText ?? p?.long_name) ?? "";
  };
  const number = get("street_number"), route = get("route");
  const city = get("locality") || get("postal_town") || get("sublocality") || get("neighborhood");
  const zip = get("postal_code").slice(0, 5);
  const missing = [...(!number || !route ? ["street" as const] : []), ...(!/^\d{5}$/.test(zip) ? ["zip" as const] : [])];
  return { street: [number, route].filter(Boolean).join(" "), city, state: get("administrative_area_level_1", true), zip, missing, ...at };
}

let session: object | null = null;
/** Up to 5 US suggestions while typing; one billing session lasts until a suggestion is picked. */
export async function suggest(input: string) {
  const p = await library<Places>("places");
  session ??= new p.AutocompleteSessionToken();
  const { suggestions } = await p.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input, sessionToken: session, includedRegionCodes: ["us"] });
  return suggestions.flatMap((x) => (x.placePrediction ? [{ label: x.placePrediction.text.toString(), place: x.placePrediction }] : [])).slice(0, 5);
}
/** The picked suggestion's address and exact point. */
export async function details(prediction: { toPlace(): Place }) {
  const place = prediction.toPlace();
  await place.fetchFields({ fields: ["addressComponents", "location"] });
  session = null;
  const at = place.location && { lat: place.location.lat(), lng: place.location.lng() };
  return at ? toAddress(place.addressComponents ?? [], at) : null;
}
/** The street address at a point ("Use my location"); the point stays the device's own. */
export async function reverse(at: LatLng) {
  const g = await library<Geocoding>("geocoding");
  const { results } = await new g.Geocoder().geocode({ location: at });
  const all = results.map((r) => toAddress(r.address_components, at));
  return all.find((a) => !a.missing.length) ?? all[0] ?? null;
}
