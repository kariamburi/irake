interface NominatimAddress {
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    village?: string;
    town?: string;
    city?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
}

interface NominatimResponse {
    display_name?: string;
    address?: NominatimAddress;
}

const addressCache = new Map<
    string,
    {
        address: string | null;
        expiresAt: number;
    }
>();

const ADDRESS_CACHE_DURATION =
    24 * 60 * 60 * 1000;

function createAddressCacheKey(
    latitude: number,
    longitude: number
) {
    /*
     * Three decimal places is roughly neighbourhood-level precision.
     * It also prevents unnecessary requests for tiny GPS changes.
     */
    return `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

function buildReadableAddress(
    data: NominatimResponse
): string | null {
    const address = data.address;

    if (!address) {
        return data.display_name || null;
    }

    const locality =
        address.neighbourhood ||
        address.suburb ||
        address.village ||
        address.town ||
        address.city ||
        address.municipality;

    const parts = [
        address.road,
        locality,
        address.county,
        address.state,
        address.country,
    ].filter(
        (
            value,
            index,
            values
        ): value is string =>
            Boolean(value) &&
            values.indexOf(value) === index
    );

    if (parts.length > 0) {
        return parts.join(", ");
    }

    return data.display_name || null;
}

export async function reverseGeocode(
    latitude: number,
    longitude: number
): Promise<string | null> {
    const cacheKey =
        createAddressCacheKey(
            latitude,
            longitude
        );

    const cached =
        addressCache.get(cacheKey);

    if (
        cached &&
        cached.expiresAt > Date.now()
    ) {
        return cached.address;
    }

    const url = new URL(
        "https://nominatim.openstreetmap.org/reverse"
    );

    url.searchParams.set(
        "lat",
        latitude.toString()
    );

    url.searchParams.set(
        "lon",
        longitude.toString()
    );

    url.searchParams.set(
        "format",
        "jsonv2"
    );

    url.searchParams.set(
        "addressdetails",
        "1"
    );

    url.searchParams.set(
        "zoom",
        "16"
    );

    try {
        const response = await fetch(
            url.toString(),
            {
                headers: {
                    Accept: "application/json",
                    "User-Agent":
                        "Ekarihub Weather/1.0",
                },

                next: {
                    revalidate: 86400,
                },
            }
        );

        if (!response.ok) {
            throw new Error(
                `Reverse geocoding failed with status ${response.status}`
            );
        }

        const data =
            (await response.json()) as NominatimResponse;

        const readableAddress =
            buildReadableAddress(data);

        addressCache.set(cacheKey, {
            address: readableAddress,
            expiresAt:
                Date.now() +
                ADDRESS_CACHE_DURATION,
        });

        return readableAddress;
    } catch (error) {
        console.error(
            "Reverse geocoding error:",
            error
        );

        addressCache.set(cacheKey, {
            address: null,
            expiresAt:
                Date.now() +
                60 * 60 * 1000,
        });

        return null;
    }
}