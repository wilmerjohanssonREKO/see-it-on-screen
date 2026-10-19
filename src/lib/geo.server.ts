/**
 * Geocoding via OpenStreetMap Nominatim (free, low volume).
 * Server-only: called from save functions, never from the browser.
 * Nominatim policy: max 1 request/second and a descriptive User-Agent —
 * our saves are user-initiated and rare, so we stay well under the limit.
 */
export async function geocodePostalCode(
  postalCode: string,
  city: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const params = new URLSearchParams({
      format: "json",
      limit: "1",
      countrycodes: "se",
      postalcode: postalCode,
      city,
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": "REKO-UF/1.0 (vikarieförmedling för gymnasieskolor)" },
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = arr?.[0];
    if (!first) return null;
    const lat = Number.parseFloat(first.lat);
    const lng = Number.parseFloat(first.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
