import { fetchOpenMeteoWeather } from "@/lib/weather/openMeteo";
import { reverseGeocode } from "@/lib/weather/reverseGeocode";
import {
    createWeatherCacheKey,
    getCachedWeather,
    setCachedWeather,
} from "@/lib/weather/weatherCache";
import {
    NextRequest,
    NextResponse,
} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface WeatherLocationDetails {
    name: string;
    address: string | null;
    latitude: number;
    longitude: number;
}

function parseCoordinate(
    value: string | null,
    minimum: number,
    maximum: number
): number | null {
    if (
        value === null ||
        value.trim() === ""
    ) {
        return null;
    }

    const parsedValue = Number(value);

    if (
        !Number.isFinite(parsedValue) ||
        parsedValue < minimum ||
        parsedValue > maximum
    ) {
        return null;
    }

    return parsedValue;
}

function getWeatherLocationName(
    weather: unknown,
    fallback?: string
): string {
    if (
        weather &&
        typeof weather === "object"
    ) {
        const weatherObject =
            weather as {
                location?: unknown;
            };

        if (
            typeof weatherObject.location ===
            "string" &&
            weatherObject.location.trim()
        ) {
            return weatherObject.location.trim();
        }
    }

    return fallback || "Current location";
}

function addLocationDetails<T>(
    weather: T,
    locationDetails: WeatherLocationDetails
): T & {
    locationDetails: WeatherLocationDetails;
} {
    return Object.assign(
        {},
        weather,
        {
            locationDetails,
        }
    ) as T & {
        locationDetails: WeatherLocationDetails;
    };
}

export async function GET(
    request: NextRequest
) {
    const latitude = parseCoordinate(
        request.nextUrl.searchParams.get(
            "lat"
        ),
        -90,
        90
    );

    const longitude = parseCoordinate(
        request.nextUrl.searchParams.get(
            "lon"
        ),
        -180,
        180
    );

    const locationName =
        request.nextUrl.searchParams
            .get("location")
            ?.trim() || undefined;

    if (
        latitude === null ||
        longitude === null
    ) {
        return NextResponse.json(
            {
                error:
                    "INVALID_COORDINATES",

                message:
                    "Valid lat and lon query parameters are required.",
            },
            {
                status: 400,
            }
        );
    }

    const cacheKey =
        createWeatherCacheKey(
            latitude,
            longitude
        );

    const cachedWeather =
        getCachedWeather(cacheKey);

    if (cachedWeather) {
        return NextResponse.json(
            cachedWeather,
            {
                status: 200,

                headers: {
                    "Cache-Control":
                        "public, max-age=300, s-maxage=3600, stale-while-revalidate=600",

                    "X-Weather-Cache":
                        "HIT",
                },
            }
        );
    }

    try {
        const [
            weather,
            address,
        ] = await Promise.all([
            fetchOpenMeteoWeather({
                latitude,
                longitude,
                locationName,
            }),

            reverseGeocode(
                latitude,
                longitude
            ).catch((error) => {
                console.error(
                    "Reverse geocoding failed:",
                    error
                );

                return null;
            }),
        ]);

        /*
         * Preserve weather.location exactly as returned
         * by fetchOpenMeteoWeather.
         *
         * Add address and coordinates separately under
         * locationDetails.
         */
        const resolvedLocationName =
            getWeatherLocationName(
                weather,
                locationName
            );

        const weatherWithLocationDetails =
            addLocationDetails(
                weather,
                {
                    name:
                        resolvedLocationName,

                    address,

                    latitude,

                    longitude,
                }
            );

        setCachedWeather(
            cacheKey,
            weatherWithLocationDetails
        );

        return NextResponse.json(
            weatherWithLocationDetails,
            {
                status: 200,

                headers: {
                    "Cache-Control":
                        "public, max-age=300, s-maxage=3600, stale-while-revalidate=600",

                    "X-Weather-Cache":
                        "MISS",
                },
            }
        );
    } catch (error) {
        console.error(
            "Ekarihub weather error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "WEATHER_UNAVAILABLE",

                message:
                    "Weather information is temporarily unavailable. Please try again.",
            },
            {
                status: 503,
            }
        );
    }
}