"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IoCheckmarkCircle,
  IoCloseOutline,
  IoLocateOutline,
  IoLocationOutline,
  IoMapOutline,
  IoPersonOutline,
  IoSearchOutline,
} from "react-icons/io5";

import type { ExpertPlace } from "@/app/types/expert";

const EKARI = {
  forest: "#233F39",
  text: "#111827",
  subtext: "#6B7280",
  hair: "#E5E7EB",
  soft: "#F8FAFC",
};

type GooglePrediction = {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
};

type GoogleMapsWindow = Window &
  typeof globalThis & {
    google?: any;
  };

function loadGoogleMaps(apiKey: string): Promise<any> {
  const browserWindow = window as GoogleMapsWindow;

  if (browserWindow.google?.maps?.places) {
    return Promise.resolve(browserWindow.google);
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-ekari-google-maps="true"]'
    );

    if (existing) {
      const timer = window.setInterval(() => {
        if (browserWindow.google?.maps?.places) {
          window.clearInterval(timer);
          resolve(browserWindow.google);
        }
      }, 100);

      window.setTimeout(() => {
        window.clearInterval(timer);
        reject(new Error("Google Maps took too long to load."));
      }, 15000);

      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.dataset.ekariGoogleMaps = "true";

    script.onload = () => {
      if (browserWindow.google?.maps?.places) {
        resolve(browserWindow.google);
      } else {
        reject(new Error("Google Maps did not initialize correctly."));
      }
    };

    script.onerror = () => {
      reject(new Error("Could not load Google Maps."));
    };

    document.head.appendChild(script);
  });
}

function getComponent(
  components: any[] | undefined,
  type: string,
  short = false
): string {
  const match = components?.find((component) =>
    Array.isArray(component.types) && component.types.includes(type)
  );

  if (!match) return "";
  return String(short ? match.short_name || "" : match.long_name || "");
}

function timezoneFromCoordinates(
  latitude: number,
  longitude: number
): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    void latitude;
    void longitude;
    return null;
  }
}

function placeFromGoogleResult(result: any): ExpertPlace {
  const latitude = result.geometry?.location?.lat?.();
  const longitude = result.geometry?.location?.lng?.();

  const city =
    getComponent(result.address_components, "locality") ||
    getComponent(result.address_components, "postal_town") ||
    getComponent(result.address_components, "administrative_area_level_2");

  const region =
    getComponent(result.address_components, "administrative_area_level_1") ||
    getComponent(result.address_components, "administrative_area_level_2");

  const country = getComponent(result.address_components, "country");
  const countryCode = getComponent(result.address_components, "country", true);

  return {
    placeId: result.place_id || null,
    label: String(result.formatted_address || result.name || "").trim(),
    countryCode: countryCode.toUpperCase(),
    country,
    region,
    city,
    locality:
      getComponent(result.address_components, "sublocality") ||
      getComponent(result.address_components, "neighborhood"),
    coordinates:
      typeof latitude === "number" && typeof longitude === "number"
        ? {
            latitude,
            longitude,
            geohash: null,
          }
        : null,
    timezone:
      typeof latitude === "number" && typeof longitude === "number"
        ? timezoneFromCoordinates(latitude, longitude)
        : null,
  };
}

export default function GlobalLocationPicker({
  value,
  profileLocation,
  onChange,
}: {
  value: ExpertPlace;
  profileLocation?: ExpertPlace | null;
  onChange: (place: ExpertPlace) => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  const [mode, setMode] = useState<"search" | "map" | null>(null);
  const [queryText, setQueryText] = useState("");
  const [predictions, setPredictions] = useState<GooglePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleReady, setGoogleReady] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);
  const placesRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!apiKey) return;

    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then((google) => {
        if (cancelled) return;

        autocompleteRef.current = new google.maps.places.AutocompleteService();
        placesRef.current = new google.maps.places.PlacesService(
          document.createElement("div")
        );
        geocoderRef.current = new google.maps.Geocoder();
        setGoogleReady(true);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("GOOGLE_MAPS_LOAD_FAILED", loadError);
        setError(
          "Location search is unavailable. Confirm NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and enable Places API."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  const selectGooglePlace = useCallback(
    async (placeId: string) => {
      if (!placesRef.current) return;

      setLoading(true);
      setError(null);

      placesRef.current.getDetails(
        {
          placeId,
          fields: [
            "place_id",
            "name",
            "formatted_address",
            "address_components",
            "geometry",
          ],
        },
        (result: any, status: string) => {
          setLoading(false);

          const google = (window as GoogleMapsWindow).google;
          if (
            !result ||
            status !== google?.maps?.places?.PlacesServiceStatus?.OK
          ) {
            setError("Could not load that location. Try another search.");
            return;
          }

          const nextPlace = placeFromGoogleResult(result);
          onChange(nextPlace);
          setQueryText(nextPlace.label);
          setPredictions([]);
          setMode(null);
        }
      );
    },
    [onChange]
  );

  useEffect(() => {
    if (!queryText.trim() || !autocompleteRef.current || mode !== "search") {
      setPredictions([]);
      return;
    }

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      autocompleteRef.current.getPlacePredictions(
        {
          input: queryText.trim(),
          types: ["geocode"],
        },
        (results: GooglePrediction[] | null, status: string) => {
          const google = (window as GoogleMapsWindow).google;

          if (
            status === google?.maps?.places?.PlacesServiceStatus?.OK &&
            Array.isArray(results)
          ) {
            setPredictions(results.slice(0, 6));
          } else {
            setPredictions([]);
          }
        }
      );
    }, 250);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [mode, queryText]);

  const reverseGeocode = useCallback(
    async (latitude: number, longitude: number): Promise<ExpertPlace> => {
      const google = (window as GoogleMapsWindow).google;

      if (!google || !geocoderRef.current) {
        return {
          placeId: null,
          label: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          countryCode: "",
          country: "",
          region: "",
          city: "",
          locality: "",
          coordinates: { latitude, longitude, geohash: null },
          timezone: timezoneFromCoordinates(latitude, longitude),
        };
      }

      return new Promise((resolve) => {
        geocoderRef.current.geocode(
          { location: { lat: latitude, lng: longitude } },
          (results: any[] | null, status: string) => {
            if (status === "OK" && results?.[0]) {
              resolve(placeFromGoogleResult(results[0]));
              return;
            }

            resolve({
              placeId: null,
              label: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
              countryCode: "",
              country: "",
              region: "",
              city: "",
              locality: "",
              coordinates: { latitude, longitude, geohash: null },
              timezone: timezoneFromCoordinates(latitude, longitude),
            });
          }
        );
      });
    },
    []
  );

  const useCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Your browser does not support location access.");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const place = await reverseGeocode(
          position.coords.latitude,
          position.coords.longitude
        );

        onChange(place);
        setLoading(false);
      },
      (locationError) => {
        console.error("CURRENT_LOCATION_FAILED", locationError);
        setLoading(false);
        setError(
          locationError.code === locationError.PERMISSION_DENIED
            ? "Location permission was denied. You can search or pick the location on the map."
            : "Could not detect your current location."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );
  }, [onChange, reverseGeocode]);

  useEffect(() => {
    if (mode !== "map" || !googleReady || !mapContainerRef.current) return;

    const google = (window as GoogleMapsWindow).google;
    if (!google) return;

    const center = value.coordinates ||
      profileLocation?.coordinates || {
        latitude: 0,
        longitude: 20,
      };

    const map = new google.maps.Map(mapContainerRef.current, {
      center: {
        lat: center.latitude,
        lng: center.longitude,
      },
      zoom: value.coordinates || profileLocation?.coordinates ? 12 : 2,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    const marker = new google.maps.Marker({
      map,
      position: {
        lat: center.latitude,
        lng: center.longitude,
      },
      draggable: true,
    });

    mapRef.current = map;
    markerRef.current = marker;

    const updateFromPoint = async (lat: number, lng: number) => {
      marker.setPosition({ lat, lng });
      const place = await reverseGeocode(lat, lng);
      onChange(place);
    };

    marker.addListener("dragend", () => {
      const position = marker.getPosition();
      if (!position) return;
      void updateFromPoint(position.lat(), position.lng());
    });

    map.addListener("click", (event: any) => {
      if (!event.latLng) return;
      void updateFromPoint(event.latLng.lat(), event.latLng.lng());
    });
  }, [googleReady, mode, onChange, profileLocation?.coordinates, reverseGeocode, value.coordinates]);

  const locationDetails = useMemo(
    () =>
      [value.city, value.region, value.country]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .filter((part, index, all) => all.indexOf(part) === index)
        .join(", "),
    [value.city, value.country, value.region]
  );

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          disabled={!profileLocation?.label}
          onClick={() => {
            if (profileLocation?.label) {
              onChange(profileLocation);
              setError(null);
            }
          }}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: EKARI.hair, color: EKARI.text }}
        >
          <IoPersonOutline size={17} />
          Profile location
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={useCurrentLocation}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-black transition disabled:opacity-50"
          style={{ borderColor: EKARI.hair, color: EKARI.text }}
        >
          <IoLocateOutline size={17} />
          {loading ? "Locating…" : "Current GPS"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "search" ? null : "search");
            setQueryText(value.label || "");
            setError(null);
          }}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-black transition"
          style={{
            borderColor: mode === "search" ? EKARI.forest : EKARI.hair,
            backgroundColor:
              mode === "search" ? "rgba(35,63,57,0.06)" : "#FFFFFF",
            color: EKARI.text,
          }}
        >
          <IoSearchOutline size={17} />
          Search location
        </button>

        <button
          type="button"
          disabled={!apiKey}
          onClick={() => {
            setMode(mode === "map" ? null : "map");
            setError(null);
          }}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            borderColor: mode === "map" ? EKARI.forest : EKARI.hair,
            backgroundColor:
              mode === "map" ? "rgba(35,63,57,0.06)" : "#FFFFFF",
            color: EKARI.text,
          }}
        >
          <IoMapOutline size={17} />
          Pick on map
        </button>
      </div>

      {!apiKey ? (
        <p className="mt-2 text-xs font-semibold text-amber-700">
          Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable location search and map selection.
        </p>
      ) : null}

      {mode === "search" ? (
        <div className="relative mt-4">
          <IoSearchOutline
            size={18}
            className="pointer-events-none absolute left-4 top-6 -translate-y-1/2"
            color={EKARI.subtext}
          />

          <input
            autoFocus
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            placeholder="Search a town, region or country"
            className="h-12 w-full rounded-2xl border bg-white pl-11 pr-11 text-sm outline-none"
            style={{ borderColor: EKARI.hair }}
          />

          {queryText ? (
            <button
              type="button"
              onClick={() => {
                setQueryText("");
                setPredictions([]);
              }}
              className="absolute right-3 top-2 grid h-8 w-8 place-items-center rounded-full hover:bg-slate-100"
              aria-label="Clear location search"
            >
              <IoCloseOutline size={18} />
            </button>
          ) : null}

          {predictions.length > 0 ? (
            <div
              className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border bg-white shadow-xl"
              style={{ borderColor: EKARI.hair }}
            >
              {predictions.map((prediction) => (
                <button
                  key={prediction.place_id}
                  type="button"
                  onClick={() => void selectGooglePlace(prediction.place_id)}
                  className="flex w-full items-start gap-3 border-b px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
                  style={{ borderColor: EKARI.hair }}
                >
                  <IoLocationOutline
                    size={18}
                    color={EKARI.forest}
                    className="mt-0.5 shrink-0"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black" style={{ color: EKARI.text }}>
                      {prediction.structured_formatting?.main_text || prediction.description}
                    </span>
                    {prediction.structured_formatting?.secondary_text ? (
                      <span className="mt-0.5 block text-xs" style={{ color: EKARI.subtext }}>
                        {prediction.structured_formatting.secondary_text}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "map" ? (
        <div className="mt-4 overflow-hidden rounded-2xl border" style={{ borderColor: EKARI.hair }}>
          <div ref={mapContainerRef} className="h-[360px] w-full bg-slate-100" />
          <div className="border-t px-4 py-3 text-xs" style={{ borderColor: EKARI.hair, color: EKARI.subtext }}>
            Tap the map or drag the marker to choose the expert’s primary service location.
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          {error}
        </div>
      ) : null}

      {value.label ? (
        <div
          className="mt-4 flex items-start gap-3 rounded-2xl border p-4"
          style={{
            borderColor: "rgba(35,63,57,0.22)",
            backgroundColor: "rgba(35,63,57,0.05)",
          }}
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white">
            <IoCheckmarkCircle size={22} color={EKARI.forest} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-black" style={{ color: EKARI.text }}>
              {value.label}
            </div>

            {locationDetails && locationDetails !== value.label ? (
              <div className="mt-1 text-xs" style={{ color: EKARI.subtext }}>
                {locationDetails}
              </div>
            ) : null}

            {value.coordinates ? (
              <div className="mt-1 text-[11px] font-semibold" style={{ color: EKARI.subtext }}>
                {value.coordinates.latitude.toFixed(5)}, {value.coordinates.longitude.toFixed(5)}
                {value.timezone ? ` • ${value.timezone}` : ""}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div
          className="mt-4 rounded-2xl border border-dashed px-4 py-7 text-center text-sm"
          style={{ borderColor: EKARI.hair, color: EKARI.subtext }}
        >
          Select the expert’s primary location using profile location, GPS, search or map.
        </div>
      )}
    </div>
  );
}
