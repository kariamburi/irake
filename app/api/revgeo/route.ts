// app/api/revgeo/route.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Reverse geocode lat,lng -> { country, countryCode, county }
 * Uses OpenStreetMap Nominatim. For production, consider Google/Mapbox for stronger SLAs.
 * Be mindful of Nominatim usage policy (set a real contact in User-Agent).
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const lat = searchParams.get("lat");
        const lng = searchParams.get("lng");

        if (!lat || !lng) {
            return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
        }

        const url = new URL("https://nominatim.openstreetmap.org/reverse");
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("lat", lat);
        url.searchParams.set("lon", lng);
        url.searchParams.set("zoom", "10");        // admin-ish granularity
        url.searchParams.set("addressdetails", "1");

        const res = await fetch(url.toString(), {
            // Nominatim asks for a valid User-Agent with contact info
            headers: { "User-Agent": "ekarihub/1.0 (contact@your-domain.com)" },
            // Avoid caching geocode responses in Next edge
            cache: "no-store",
        });

        if (!res.ok) {
            return NextResponse.json({ error: "reverse geocoding failed" }, { status: 500 });
        }

        const data = await res.json();
        const a = (data?.address ?? {}) as Record<string, string | undefined>;

        const country = a.country ?? null;
        const countryCode = (a.country_code ?? "").toUpperCase() || null;

        // "county" equivalent varies per country; try a few fallbacks (Kenya often has 'county')
        const county =
            a.county ??
            a.state_district ??
            a.region ??
            a.state ??
            a.municipality ??
            null;

        return NextResponse.json({
            country,
            countryCode,
            county,
            raw: { address: a }, // useful for debugging/logs; omit later if you prefer
        });
    } catch (e) {
        return NextResponse.json({ error: "unexpected server error" }, { status: 500 });
    }
}
