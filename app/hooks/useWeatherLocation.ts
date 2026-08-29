"use client";

import {
    useCallback,
    useEffect,
    useRef,
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

const SAME_TAB_EVENT =
    "ekarihub-weather-location-change";

type Subscriber = (
    location: SelectedWeatherLocation | null
) => void;

const subscribers =
    new Set<Subscriber>();

let sharedLocation:
    SelectedWeatherLocation | null | undefined =
    undefined;

function broadcast(
    nextLocation:
        SelectedWeatherLocation | null
) {
    sharedLocation =
        nextLocation;

    subscribers.forEach(
        (subscriber) => {
            subscriber(
                nextLocation
            );
        }
    );
}

function isStoredWeatherLocation(
    value: unknown
): value is StoredWeatherLocation {
    if (
        typeof value !== "object" ||
        value === null
    ) {
        return false;
    }

    const stored =
        value as StoredWeatherLocation;

    return (
        !!stored.location &&
        Number.isFinite(
            stored.location.latitude
        ) &&
        Number.isFinite(
            stored.location.longitude
        )
    );
}

export function useWeatherLocation():
    UseWeatherLocationResult {
    const [location, setLocation] =
        useState<
            SelectedWeatherLocation | null
        >(
            sharedLocation ??
            null
        );

    const [
        permissionState,
        setPermissionState,
    ] =
        useState<LocationPermissionState>(
            sharedLocation
                ? "granted"
                : "idle"
        );

    const [error, setError] =
        useState<string | null>(
            null
        );

    const [initialized, setInitialized] =
        useState(
            sharedLocation !==
            undefined
        );

    const mountedRef =
        useRef(true);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current =
                false;
        };
    }, []);

    useEffect(() => {
        const subscriber:
            Subscriber =
            (
                nextLocation
            ) => {
                if (
                    !mountedRef.current
                ) {
                    return;
                }

                setLocation(
                    nextLocation
                );

                setPermissionState(
                    nextLocation
                        ? "granted"
                        : "idle"
                );

                setError(null);
                setInitialized(true);
            };

        subscribers.add(
            subscriber
        );

        if (
            sharedLocation !==
            undefined
        ) {
            subscriber(
                sharedLocation
            );
        }

        return () => {
            subscribers.delete(
                subscriber
            );
        };
    }, []);

    const saveLocation =
        useCallback(
            (
                selectedLocation:
                    SelectedWeatherLocation
            ) => {
                if (
                    typeof window ===
                    "undefined"
                ) {
                    return;
                }

                const storedLocation:
                    StoredWeatherLocation =
                {
                    location:
                        selectedLocation,
                    savedAt:
                        Date.now(),
                };

                try {
                    window.localStorage.setItem(
                        WEATHER_LOCATION_STORAGE_KEY,
                        JSON.stringify(
                            storedLocation
                        )
                    );

                    window.dispatchEvent(
                        new CustomEvent(
                            SAME_TAB_EVENT,
                            {
                                detail:
                                    selectedLocation,
                            }
                        )
                    );
                } catch (
                storageError
                ) {
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
            if (
                typeof window ===
                "undefined"
            ) {
                setInitialized(true);
                return;
            }

            try {
                const storedValue =
                    window.localStorage.getItem(
                        WEATHER_LOCATION_STORAGE_KEY
                    );

                if (!storedValue) {
                    if (
                        sharedLocation ===
                        undefined
                    ) {
                        broadcast(
                            null
                        );
                    }

                    return;
                }

                const parsed =
                    JSON.parse(
                        storedValue
                    ) as unknown;

                if (
                    !isStoredWeatherLocation(
                        parsed
                    )
                ) {
                    window.localStorage.removeItem(
                        WEATHER_LOCATION_STORAGE_KEY
                    );

                    if (
                        sharedLocation ===
                        undefined
                    ) {
                        broadcast(
                            null
                        );
                    }

                    return;
                }

                broadcast(
                    parsed.location
                );

                setPermissionState(
                    "granted"
                );
            } catch (
            storageError
            ) {
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

    useEffect(() => {
        if (
            typeof window ===
            "undefined"
        ) {
            return;
        }

        const handleStorage =
            (
                event:
                    StorageEvent
            ) => {
                if (
                    event.key !==
                    WEATHER_LOCATION_STORAGE_KEY
                ) {
                    return;
                }

                if (
                    !event.newValue
                ) {
                    broadcast(
                        null
                    );
                    return;
                }

                try {
                    const parsed =
                        JSON.parse(
                            event.newValue
                        ) as unknown;

                    if (
                        isStoredWeatherLocation(
                            parsed
                        )
                    ) {
                        broadcast(
                            parsed.location
                        );
                    }
                } catch (
                storageError
                ) {
                    console.error(
                        "Failed to sync weather location:",
                        storageError
                    );
                }
            };

        const handleSameTab =
            (
                event: Event
            ) => {
                const customEvent =
                    event as CustomEvent<
                        SelectedWeatherLocation | null
                    >;

                broadcast(
                    customEvent.detail ??
                    null
                );
            };

        window.addEventListener(
            "storage",
            handleStorage
        );

        window.addEventListener(
            SAME_TAB_EVENT,
            handleSameTab
        );

        return () => {
            window.removeEventListener(
                "storage",
                handleStorage
            );

            window.removeEventListener(
                SAME_TAB_EVENT,
                handleSameTab
            );
        };
    }, []);

    const requestLocation =
        useCallback(() => {
            setError(null);

            if (
                typeof navigator ===
                "undefined" ||
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

            navigator.geolocation
                .getCurrentPosition(
                    (position) => {
                        const selectedLocation:
                            SelectedWeatherLocation =
                        {
                            latitude:
                                position.coords.latitude,

                            longitude:
                                position.coords.longitude,

                            locationName:
                                "Current location",

                            source:
                                "gps",
                        };

                        broadcast(
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

                    (
                        locationError
                    ) => {
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
                        enableHighAccuracy:
                            false,

                        timeout:
                            10000,

                        maximumAge:
                            30 *
                            60 *
                            1000,
                    }
                );
        }, [saveLocation]);

    const selectManualLocation =
        useCallback(
            (
                selectedLocation:
                    SelectedWeatherLocation
            ) => {
                broadcast(
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
            broadcast(
                null
            );

            setPermissionState(
                "idle"
            );

            setError(null);

            if (
                typeof window !==
                "undefined"
            ) {
                window.localStorage.removeItem(
                    WEATHER_LOCATION_STORAGE_KEY
                );

                window.dispatchEvent(
                    new CustomEvent(
                        SAME_TAB_EVENT,
                        {
                            detail:
                                null,
                        }
                    )
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
