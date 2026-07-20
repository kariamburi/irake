import type { WeatherResponse } from "@/app/types/weather";

interface WeatherCacheEntry {
    data: WeatherResponse;
    expiresAt: number;
}

const weatherCache = new Map<
    string,
    WeatherCacheEntry
>();

export const WEATHER_CACHE_TTL =
    60 * 60 * 1000;

export function createWeatherCacheKey(
    latitude: number,
    longitude: number
): string {
    /*
     * Rounding allows nearby users to share the same
     * cached weather response.
     */
    return `${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
}

export function getCachedWeather(
    cacheKey: string
): WeatherResponse | null {
    const cacheEntry = weatherCache.get(cacheKey);

    if (!cacheEntry) {
        return null;
    }

    if (Date.now() >= cacheEntry.expiresAt) {
        weatherCache.delete(cacheKey);

        return null;
    }

    return {
        ...cacheEntry.data,
        cached: true,
    };
}

export function setCachedWeather(
    cacheKey: string,
    weather: WeatherResponse
): void {
    weatherCache.set(cacheKey, {
        data: weather,
        expiresAt:
            Date.now() + WEATHER_CACHE_TTL,
    });

    removeExpiredWeather();
}

function removeExpiredWeather(): void {
    const currentTime = Date.now();

    for (const [
        cacheKey,
        cacheEntry,
    ] of weatherCache.entries()) {
        if (
            currentTime >= cacheEntry.expiresAt
        ) {
            weatherCache.delete(cacheKey);
        }
    }
}