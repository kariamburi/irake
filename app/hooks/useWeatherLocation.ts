"use client";

import {
    useCallback,
    useEffect,
    useState,
} from "react";

export interface SelectedWeatherLocation {
    latitude: number;
    longitude: number;
    locationName?: string;
    source: "gps" | "county";
}

export type LocationPermissionState =
    | "idle"
    | "requesting"
    | "granted"
    | "denied"
    | "unavailable";

interface StoredWeatherLocation {
    location: SelectedWeatherLocation;
    savedAt: number;
}

interface UseWeatherLocationResult {
    location: SelectedWeatherLocation | null;
    permissionState: LocationPermissionState;
    error: string | null;
    initialized: boolean;
    requestLocation: () => void;
    selectManualLocation: (
        location: SelectedWeatherLocation
    ) => void;
    clearLocation: () => void;
}

const WEATHER_LOCATION_STORAGE_KEY =
    "ekarihub_weather_location";

export function useWeatherLocation(): UseWeatherLocationResult {
    const [location, setLocation] =
        useState<SelectedWeatherLocation | null>(
            null
        );

    const [
        permissionState,
        setPermissionState,
    ] =
        useState<LocationPermissionState>(
            "idle"
        );

    const [error, setError] =
        useState<string | null>(null);

    const [initialized, setInitialized] =
        useState(false);

    const saveLocation = useCallback(
        (
            selectedLocation: SelectedWeatherLocation
        ) => {
            if (typeof window === "undefined") {
                return;
            }

            const storedLocation: StoredWeatherLocation =
            {
                location: selectedLocation,
                savedAt: Date.now(),
            };

            try {
                window.localStorage.setItem(
                    WEATHER_LOCATION_STORAGE_KEY,
                    JSON.stringify(storedLocation)
                );
            } catch (storageError) {
                console.error(
                    "Failed to save weather location:",
                    storageError
                );
            }
        },
        []
    );

    const loadSavedLocation =
        useCallback(() => {
            if (typeof window === "undefined") {
                setInitialized(true);
                return;
            }

            try {
                const storedValue =
                    window.localStorage.getItem(
                        WEATHER_LOCATION_STORAGE_KEY
                    );

                if (!storedValue) {
                    setInitialized(true);
                    return;
                }

                const storedLocation =
                    JSON.parse(
                        storedValue
                    ) as StoredWeatherLocation;

                if (
                    !storedLocation.location ||
                    !Number.isFinite(
                        storedLocation.location
                            .latitude
                    ) ||
                    !Number.isFinite(
                        storedLocation.location
                            .longitude
                    )
                ) {
                    window.localStorage.removeItem(
                        WEATHER_LOCATION_STORAGE_KEY
                    );

                    setInitialized(true);
                    return;
                }

                setLocation(
                    storedLocation.location
                );

                setPermissionState("granted");
            } catch (storageError) {
                console.error(
                    "Failed to load saved weather location:",
                    storageError
                );

                window.localStorage.removeItem(
                    WEATHER_LOCATION_STORAGE_KEY
                );
            } finally {
                setInitialized(true);
            }
        }, []);

    useEffect(() => {
        loadSavedLocation();
    }, [loadSavedLocation]);

    const requestLocation =
        useCallback(() => {
            setError(null);

            if (
                typeof navigator === "undefined" ||
                !navigator.geolocation
            ) {
                setPermissionState(
                    "unavailable"
                );

                setError(
                    "Location services are not supported by this browser. Select your county instead."
                );

                return;
            }

            setPermissionState(
                "requesting"
            );

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const selectedLocation: SelectedWeatherLocation =
                    {
                        latitude:
                            position.coords.latitude,

                        longitude:
                            position.coords.longitude,

                        locationName:
                            "Current location",

                        source: "gps",
                    };

                    setLocation(
                        selectedLocation
                    );

                    setPermissionState(
                        "granted"
                    );

                    setError(null);

                    saveLocation(
                        selectedLocation
                    );
                },

                (locationError) => {
                    console.error(
                        "Browser location error:",
                        locationError
                    );

                    if (
                        locationError.code ===
                        locationError.PERMISSION_DENIED
                    ) {
                        setPermissionState(
                            "denied"
                        );

                        setError(
                            "Location permission was denied. Select your county to continue."
                        );

                        return;
                    }

                    if (
                        locationError.code ===
                        locationError.TIMEOUT
                    ) {
                        setPermissionState(
                            "unavailable"
                        );

                        setError(
                            "Location detection took too long. Try again or select your county."
                        );

                        return;
                    }

                    setPermissionState(
                        "unavailable"
                    );

                    setError(
                        "We could not detect your location. Select your county instead."
                    );
                },

                {
                    enableHighAccuracy: false,
                    timeout: 10000,
                    maximumAge:
                        30 * 60 * 1000,
                }
            );
        }, [saveLocation]);

    const selectManualLocation =
        useCallback(
            (
                selectedLocation: SelectedWeatherLocation
            ) => {
                setLocation(
                    selectedLocation
                );

                setPermissionState(
                    "granted"
                );

                setError(null);

                saveLocation(
                    selectedLocation
                );
            },
            [saveLocation]
        );

    const clearLocation =
        useCallback(() => {
            setLocation(null);
            setPermissionState("idle");
            setError(null);

            if (typeof window !== "undefined") {
                window.localStorage.removeItem(
                    WEATHER_LOCATION_STORAGE_KEY
                );
            }
        }, []);

    return {
        location,
        permissionState,
        error,
        initialized,
        requestLocation,
        selectManualLocation,
        clearLocation,
    };
}