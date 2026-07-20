"use client";

import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import type { WeatherResponse } from "@/app/types/weather";

interface WeatherCoordinates {
    latitude: number;
    longitude: number;
    locationName?: string;
}

interface StoredWeather {
    data: WeatherResponse;
    savedAt: number;
    latitude: number;
    longitude: number;
}

interface UseWeatherResult {
    weather: WeatherResponse | null;
    loading: boolean;
    error: string | null;
    isOfflineData: boolean;
    lastUpdated: Date | null;
    refreshWeather: () => Promise<void>;
}

const WEATHER_STORAGE_KEY =
    "ekarihub_weather_cache";

/*
 * Prevent repeated automatic requests for the same
 * location during a short period.
 */
const MIN_AUTO_REFRESH_INTERVAL =
    15 * 60 * 1000; // 15 minutes

/*
 * Allow cached weather for offline use for up to
 * 24 hours.
 */
const MAX_OFFLINE_CACHE_AGE =
    24 * 60 * 60 * 1000;

function coordinatesMatch(
    stored: StoredWeather,
    latitude: number,
    longitude: number
): boolean {
    return (
        Math.abs(
            stored.latitude - latitude
        ) < 0.001 &&
        Math.abs(
            stored.longitude - longitude
        ) < 0.001
    );
}

function getWeatherDate(
    weatherData: WeatherResponse
): Date {
    /*
     * Use fetched_at when available.
     * Otherwise use the current time.
     */
    const fetchedAt =
        weatherData.fetched_at;

    if (fetchedAt) {
        const parsedDate =
            new Date(fetchedAt);

        if (
            !Number.isNaN(
                parsedDate.getTime()
            )
        ) {
            return parsedDate;
        }
    }

    return new Date();
}

export function useWeather(
    coordinates: WeatherCoordinates | null
): UseWeatherResult {
    const latitude =
        coordinates?.latitude ?? null;

    const longitude =
        coordinates?.longitude ?? null;

    const locationName =
        coordinates?.locationName ?? "";

    const [weather, setWeather] =
        useState<WeatherResponse | null>(
            null
        );

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState<string | null>(null);

    const [
        isOfflineData,
        setIsOfflineData,
    ] = useState(false);

    const [
        lastUpdated,
        setLastUpdated,
    ] = useState<Date | null>(null);

    /*
     * Tracks the last successful request without
     * causing component re-renders.
     */
    const lastFetchTimeRef =
        useRef<number>(0);

    /*
     * Prevent two identical requests from running
     * at the same time.
     */
    const activeRequestRef =
        useRef<string | null>(null);

    const readStoredWeather =
        useCallback(
            (): StoredWeather | null => {
                if (
                    typeof window ===
                    "undefined"
                ) {
                    return null;
                }

                try {
                    const storedValue =
                        window.localStorage.getItem(
                            WEATHER_STORAGE_KEY
                        );

                    if (!storedValue) {
                        return null;
                    }

                    const stored =
                        JSON.parse(
                            storedValue
                        ) as StoredWeather;

                    if (
                        !stored ||
                        !stored.data ||
                        typeof stored.savedAt !==
                        "number"
                    ) {
                        return null;
                    }

                    return stored;
                } catch (
                storageError
                ) {
                    console.error(
                        "Failed to read weather cache:",
                        storageError
                    );

                    return null;
                }
            },
            []
        );

    const storeWeather =
        useCallback(
            (
                weatherData: WeatherResponse,
                savedLatitude: number,
                savedLongitude: number
            ) => {
                if (
                    typeof window ===
                    "undefined"
                ) {
                    return;
                }

                const storedWeather: StoredWeather =
                {
                    data: weatherData,
                    savedAt:
                        Date.now(),
                    latitude:
                        savedLatitude,
                    longitude:
                        savedLongitude,
                };

                try {
                    window.localStorage.setItem(
                        WEATHER_STORAGE_KEY,
                        JSON.stringify(
                            storedWeather
                        )
                    );
                } catch (
                storageError
                ) {
                    console.error(
                        "Failed to save weather cache:",
                        storageError
                    );
                }
            },
            []
        );

    const loadCachedWeather =
        useCallback(
            (
                expectedLatitude?:
                    number | null,
                expectedLongitude?:
                    number | null,
                offline = false
            ): boolean => {
                const stored =
                    readStoredWeather();

                if (!stored) {
                    return false;
                }

                const cacheAge =
                    Date.now() -
                    stored.savedAt;

                if (
                    cacheAge >
                    MAX_OFFLINE_CACHE_AGE
                ) {
                    return false;
                }

                /*
                 * When coordinates are provided,
                 * only display cache belonging to
                 * approximately the same location.
                 */
                if (
                    expectedLatitude !==
                    null &&
                    expectedLatitude !==
                    undefined &&
                    expectedLongitude !==
                    null &&
                    expectedLongitude !==
                    undefined &&
                    !coordinatesMatch(
                        stored,
                        expectedLatitude,
                        expectedLongitude
                    )
                ) {
                    return false;
                }

                setWeather(stored.data);
                setLastUpdated(
                    new Date(
                        stored.savedAt
                    )
                );
                setIsOfflineData(
                    offline
                );

                return true;
            },
            [readStoredWeather]
        );

    const fetchWeather =
        useCallback(
            async (
                forceRefresh = false
            ): Promise<void> => {
                if (
                    latitude === null ||
                    longitude === null
                ) {
                    return;
                }

                const requestKey =
                    `${latitude.toFixed(
                        4
                    )},${longitude.toFixed(
                        4
                    )}`;

                /*
                 * Ignore duplicate requests that
                 * are already running.
                 */
                if (
                    activeRequestRef.current ===
                    requestKey
                ) {
                    return;
                }

                /*
                 * Automatic refreshes are limited
                 * to once every 15 minutes.
                 *
                 * Manual refresh bypasses this.
                 */
                const timeSinceLastFetch =
                    Date.now() -
                    lastFetchTimeRef.current;

                if (
                    !forceRefresh &&
                    lastFetchTimeRef.current >
                    0 &&
                    timeSinceLastFetch <
                    MIN_AUTO_REFRESH_INTERVAL
                ) {
                    return;
                }

                activeRequestRef.current =
                    requestKey;

                setLoading(true);
                setError(null);

                const parameters =
                    new URLSearchParams({
                        lat: latitude.toString(),
                        lon: longitude.toString(),
                    });

                if (locationName) {
                    parameters.set(
                        "location",
                        locationName
                    );
                }

                try {
                    const response =
                        await fetch(
                            `/api/weather?${parameters.toString()}`,
                            {
                                method:
                                    "GET",

                                headers: {
                                    Accept:
                                        "application/json",
                                },

                                /*
                                 * The API route already
                                 * manages server caching.
                                 */
                                cache:
                                    forceRefresh
                                        ? "no-store"
                                        : "default",
                            }
                        );

                    const result =
                        await response.json();

                    if (!response.ok) {
                        throw new Error(
                            result.message ||
                            "Unable to load weather information."
                        );
                    }

                    const weatherData =
                        result as WeatherResponse;

                    const fetchedDate =
                        getWeatherDate(
                            weatherData
                        );

                    setWeather(
                        weatherData
                    );

                    setLastUpdated(
                        fetchedDate
                    );

                    setIsOfflineData(
                        false
                    );

                    lastFetchTimeRef.current =
                        Date.now();

                    storeWeather(
                        weatherData,
                        latitude,
                        longitude
                    );
                } catch (
                fetchError
                ) {
                    console.error(
                        "Weather request failed:",
                        fetchError
                    );

                    const cachedDataAvailable =
                        loadCachedWeather(
                            latitude,
                            longitude,
                            true
                        );

                    if (
                        cachedDataAvailable
                    ) {
                        setError(
                            "Unable to reach the weather service. Showing the last saved forecast."
                        );
                    } else {
                        setError(
                            fetchError instanceof
                                Error
                                ? fetchError.message
                                : "Unable to load weather information."
                        );
                    }
                } finally {
                    activeRequestRef.current =
                        null;

                    setLoading(false);
                }
            },
            [
                latitude,
                longitude,
                locationName,
                loadCachedWeather,
                storeWeather,
            ]
        );

    /*
     * Fetch only when the actual coordinate values
     * change, not whenever the coordinates object
     * gets recreated.
     */
    useEffect(() => {
        if (
            latitude === null ||
            longitude === null
        ) {
            loadCachedWeather(
                null,
                null,
                false
            );

            return;
        }

        /*
         * Show saved data immediately while fresh
         * weather loads in the background.
         */
        const cached =
            readStoredWeather();

        if (
            cached &&
            coordinatesMatch(
                cached,
                latitude,
                longitude
            )
        ) {
            loadCachedWeather(
                latitude,
                longitude,
                false
            );

            const cacheAge =
                Date.now() -
                cached.savedAt;

            /*
             * Do not request weather again when the
             * browser cache is still fresh.
             */
            if (
                cacheAge <
                MIN_AUTO_REFRESH_INTERVAL
            ) {
                lastFetchTimeRef.current =
                    cached.savedAt;

                return;
            }
        }

        void fetchWeather(false);
    }, [
        latitude,
        longitude,
        locationName,
        fetchWeather,
        loadCachedWeather,
        readStoredWeather,
    ]);

    /*
     * Manual refresh always bypasses the
     * 15-minute automatic refresh restriction.
     */
    const refreshWeather =
        useCallback(async () => {
            await fetchWeather(true);
        }, [fetchWeather]);

    return {
        weather,
        loading,
        error,
        isOfflineData,
        lastUpdated,
        refreshWeather,
    };
}