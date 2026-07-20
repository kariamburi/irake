"use client";

import {
    weatherCounties,
} from "@/app/constants/weatherCounties";

import type {
    SelectedWeatherLocation,
} from "@/app/hooks/useWeatherLocation";

interface WeatherLocationPickerProps {
    permissionState:
    | "idle"
    | "requesting"
    | "granted"
    | "denied"
    | "unavailable";

    error?: string | null;

    onRequestLocation: () => void;

    onSelectLocation: (
        location: SelectedWeatherLocation
    ) => void;
}

export default function WeatherLocationPicker({
    permissionState,
    error,
    onRequestLocation,
    onSelectLocation,
}: WeatherLocationPickerProps) {
    const handleCountySelection = (
        value: string
    ) => {
        const selected =
            weatherCounties.find(
                (county) =>
                    county.county === value
            );

        if (!selected) {
            return;
        }

        onSelectLocation({
            latitude: selected.latitude,
            longitude: selected.longitude,
            locationName: selected.name,
            source: "county",
        });
    };

    return (
        <section className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
            <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                    Weather for your farm
                </h2>

                <p className="mt-1 text-sm leading-6 text-gray-600">
                    Ekarihub needs your location to
                    show weather conditions near your
                    farm.
                </p>
            </div>

            <button
                type="button"
                onClick={onRequestLocation}
                disabled={
                    permissionState ===
                    "requesting"
                }
                className="w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {permissionState ===
                    "requesting"
                    ? "Detecting location..."
                    : "Use my current location"}
            </button>

            {error && (
                <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    {error}
                </div>
            )}

            <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />

                <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Or select county
                </span>

                <div className="h-px flex-1 bg-gray-200" />
            </div>

            <label
                htmlFor="weather-county"
                className="mb-2 block text-sm font-medium text-gray-700"
            >
                County or nearest town
            </label>

            <select
                id="weather-county"
                defaultValue=""
                onChange={(event) =>
                    handleCountySelection(
                        event.target.value
                    )
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            >
                <option value="" disabled>
                    Select your location
                </option>

                {weatherCounties.map(
                    (county) => (
                        <option
                            key={`${county.county}-${county.name}`}
                            value={county.county}
                        >
                            {county.county} —{" "}
                            {county.name}
                        </option>
                    )
                )}
            </select>
        </section>
    );
}