"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    IoChevronDown,
    IoChevronUp,
    IoInformationCircleOutline,
    IoLocationOutline,
    IoRefresh,
    IoFilter,
    IoClose,
} from "react-icons/io5";
import { TYPE_OPTIONS, CATEGORY_OPTIONS_BY_TYPE, type MarketType } from "@/utils/market_master_catalog";
import clsx from "clsx";
import { EKARI } from "../constants/constants";

/* -------------------- Types & utils -------------------- */
export type Filters = {
    type: MarketType | null;
    category: string | null;
    minPrice?: number;
    maxPrice?: number;
    county?: string | null;
    town?: string | null;
    locationText?: string | null;
    radiusKm?: number | null;
    center?: { latitude: number; longitude: number } | null;
};

export const toLower = (s?: string | null) => (s ? s.toLowerCase() : "");
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/* Nairobi CBD default */
const NAIROBI = { latitude: -1.286389, longitude: 36.817223 };

/* -------------------- Google Maps loader -------------------- */
function loadGoogleMaps(apiKey?: string): Promise<typeof google | null> {
    if (typeof window === "undefined") return Promise.resolve(null);
    if ((window as any).google?.maps) return Promise.resolve((window as any).google);

    return new Promise((resolve, reject) => {
        if (!apiKey) {
            console.warn("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — Map will not render.");
            resolve(null);
            return;
        }
        const exist = document.getElementById("gmaps-sdk");
        if (exist) {
            const check = () => {
                if ((window as any).google?.maps) resolve((window as any).google);
                else setTimeout(check, 100);
            };
            check();
            return;
        }
        const script = document.createElement("script");
        script.id = "gmaps-sdk";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&v=weekly`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve((window as any).google || null);
        script.onerror = (e) => reject(e);
        document.head.appendChild(script);
    });
}

/** Great-circle distance (Haversine), result in km */
export function distanceKm(
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number }
) {
    const R = 6371; // km
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* -------------------- Interactive Map Picker -------------------- */
function MapPicker({
    center,
    radiusKm,
    onChangeCenter,
    style,
}: {
    center: { latitude: number; longitude: number } | null;
    radiusKm: number;
    onChangeCenter: (c: { latitude: number; longitude: number }) => void;
    style?: React.CSSProperties;
}) {
    const mapDivRef = useRef<HTMLDivElement | null>(null);
    const searchRef = useRef<HTMLInputElement | null>(null);
    const mapRef = useRef<google.maps.Map | null>(null);
    const circleRef = useRef<google.maps.Circle | null>(null);
    const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null>(null);
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    // initialize map + autocomplete
    useEffect(() => {
        let alive = true;
        (async () => {
            const g = await loadGoogleMaps(apiKey);
            if (!alive || !g || !mapDivRef.current) return;

            // Default fallback (Nairobi CBD) if no center yet
            const initialLatLng = center
                ? { lat: center.latitude, lng: center.longitude }
                : { lat: NAIROBI.latitude, lng: NAIROBI.longitude };

            // map
            if (!mapRef.current) {
                mapRef.current = new g.maps.Map(mapDivRef.current, {
                    center: initialLatLng,
                    zoom: center ? 12 : 11,
                    disableDefaultUI: true,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                    zoomControl: true,
                });

                // Click to place/move marker + update center
                mapRef.current.addListener("click", (e: google.maps.MapMouseEvent) => {
                    if (!e.latLng) return;
                    const next = { latitude: e.latLng.lat(), longitude: e.latLng.lng() };
                    onChangeCenter(next);
                });
            }

            // Places Autocomplete
            if (searchRef.current) {
                const ac = new g.maps.places.Autocomplete(searchRef.current, {
                    fields: ["geometry", "name", "formatted_address"],
                    types: ["geocode"],
                });
                ac.addListener("place_changed", () => {
                    const place = ac.getPlace();
                    const loc = place?.geometry?.location;
                    if (!loc) return;
                    const next = { latitude: loc.lat(), longitude: loc.lng() };
                    onChangeCenter(next);
                });
            }
        })();

        return () => {
            alive = false;
        };
    }, [apiKey]); // init once

    // sync center & draw marker + circle
    useEffect(() => {
        const g = (window as any).google as typeof google | undefined;
        if (!g || !mapRef.current || !center) return;

        const latlng = new g.maps.LatLng(center.latitude, center.longitude);
        mapRef.current.setCenter(latlng);

        // Marker (draggable) - prefer AdvancedMarkerElement if available
        const { AdvancedMarkerElement } = (g.maps as any).marker || {};
        if (AdvancedMarkerElement) {
            if (markerRef.current) (markerRef.current as any).map = null;
            markerRef.current = new AdvancedMarkerElement({
                map: mapRef.current,
                position: latlng,
                gmpDraggable: true,
            });
            (markerRef.current as any).addListener("dragend", (ev: any) => {
                const pos = ev?.latLng;
                if (!pos) return;
                onChangeCenter({ latitude: pos.lat(), longitude: pos.lng() });
            });
        } else {
            if (markerRef.current && "setMap" in markerRef.current) {
                (markerRef.current as google.maps.Marker).setMap(null);
            }
            markerRef.current = new g.maps.Marker({
                map: mapRef.current,
                position: latlng,
                draggable: true,
            });
            (markerRef.current as google.maps.Marker).addListener("dragend", (ev: any) => {
                const pos = (ev as unknown as google.maps.MapMouseEvent).latLng;
                if (!pos) return;
                onChangeCenter({ latitude: pos.lat(), longitude: pos.lng() });
            });
        }

        // Circle in meters
        const meters = Math.max(0, Number(radiusKm) || 0) * 1000;

        if (!circleRef.current) {
            circleRef.current = new g.maps.Circle({
                map: mapRef.current!,
                center: latlng,
                radius: meters,
                strokeOpacity: 0.9,
                strokeWeight: 2,
                strokeColor: "#10B981", // EKARI emerald vibe
                fillOpacity: 0.15,
                fillColor: "#10B981",
            });
        } else {
            circleRef.current.setCenter(latlng);
            circleRef.current.setRadius(meters);
        }

        // Fit bounds when radius > 0
        if (meters > 0) {
            const b = circleRef.current.getBounds();
            if (b) mapRef.current.fitBounds(b, 48);
        }
    }, [center?.latitude, center?.longitude, radiusKm]);

    return (
        <div>
            {/* Search input (EKARI styling) */}
            <div className="relative">
                <input
                    ref={searchRef}
                    placeholder="Search address or place"
                    className="h-11 w-full rounded-xl border px-3 outline-none"
                    style={{ borderColor: EKARI.hair, color: EKARI.text }}
                />
                <IoLocationOutline className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>

            {/* Map */}
            <div
                ref={mapDivRef}
                style={{
                    height: 260,
                    borderRadius: 12,
                    marginTop: 8,
                    overflow: "hidden",
                    border: `1px solid ${EKARI.hair}`,
                    ...style,
                }}
            />
        </div>
    );
}

/* -------------------- Main Filter Modal -------------------- */
export default function FilterModal({
    open,
    onClose,
    initial,
    onApply,
}: {
    open: boolean;
    onClose: () => void;
    initial: Filters;
    onApply: (f: Filters) => void;
}) {
    const [typeSel, setTypeSel] = useState<Filters["type"]>(initial.type || null);
    const [category, setCategory] = useState<Filters["category"]>(initial.category || null);

    const [minPrice, setMinPrice] = useState<string>(initial.minPrice ? String(initial.minPrice) : "");
    const [maxPrice, setMaxPrice] = useState<string>(initial.maxPrice ? String(initial.maxPrice) : "");

    const [locCounty, setLocCounty] = useState<string>(initial.county || "");
    const [locTown, setLocTown] = useState<string>(initial.town || "");
    const [locText, setLocText] = useState<string>(initial.locationText || "");

    // Default radius: 10 km if none is provided
    const [radiusKm, setRadiusKm] = useState<string>(
        typeof initial.radiusKm === "number" && !isNaN(initial.radiusKm) ? String(initial.radiusKm) : "10"
    );

    // Start with Nairobi if no center was given
    const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(
        initial.center || { ...NAIROBI }
    );

    const [locOpen, setLocOpen] = useState<boolean>(
        Boolean(initial.county || initial.town || initial.locationText || initial.radiusKm || initial.center)
    );

    const categoriesForType = useMemo(
        () => (typeSel ? CATEGORY_OPTIONS_BY_TYPE[typeSel] || [] : []),
        [typeSel]
    );

    // Reset from incoming props when modal toggles open
    useEffect(() => {
        if (open) {
            setTypeSel(initial.type || null);
            setCategory(initial.category || null);
            setMinPrice(initial.minPrice ? String(initial.minPrice) : "");
            setMaxPrice(initial.maxPrice ? String(initial.maxPrice) : "");
            setLocCounty(initial.county || "");
            setLocTown(initial.town || "");
            setLocText(initial.locationText || "");
            setRadiusKm(
                typeof initial.radiusKm === "number" && !isNaN(initial.radiusKm) ? String(initial.radiusKm) : "10"
            );
            setCenter(initial.center || { ...NAIROBI });
            setLocOpen(Boolean(initial.county || initial.town || initial.locationText || initial.radiusKm || initial.center));
        }
    }, [open, initial]);

    const locSummary = useMemo(() => {
        const bits: string[] = [];
        if (locTown) bits.push(locTown);
        if (locCounty) bits.push(locCounty);
        const r = radiusKm ? clamp(Number(radiusKm) || 0, 0, 500) : 0;
        if (r && center) bits.push(`${r} km`);
        return bits.join(" • ") || "Off";
    }, [locTown, locCounty, radiusKm, center]);

    const clearAll = useCallback(() => {
        setTypeSel(null);
        setCategory(null);
        setMinPrice("");
        setMaxPrice("");

        // Reset location pieces
        setLocCounty("");
        setLocTown("");
        setLocText("");
        setRadiusKm("10"); // keep our default
        setCenter({ ...NAIROBI }); // default marker in Nairobi
        setLocOpen(false);

        onApply({
            type: null,
            category: null,
            minPrice: undefined,
            maxPrice: undefined,
            county: null,
            town: null,
            locationText: null,
            radiusKm: 10,
            center: { ...NAIROBI },
        });
    }, [onApply]);

    const apply = useCallback(() => {
        const km = radiusKm ? clamp(Number(radiusKm), 0, 500) : 0;
        if (km > 0 && !center) {
            alert("Pick a center by searching or clicking the map.");
            return;
        }
        onApply({
            type: typeSel,
            category,
            minPrice: minPrice ? Number(minPrice) : undefined,
            maxPrice: maxPrice ? Number(maxPrice) : undefined,
            county: locCounty || null,
            town: locTown || null,
            locationText: locText || null,
            radiusKm: km ?? null,
            center: center || null,
        });
    }, [typeSel, category, minPrice, maxPrice, locCounty, locTown, locText, radiusKm, center, onApply]);

    if (!open) return null;

    const chipActive = "bg-emerald-800 text-white border-emerald-800";
    const chipIdle = "bg-gray-50 text-gray-900 border-gray-200";
    const parsedRadius = radiusKm ? clamp(Number(radiusKm) || 0, 0, 500) : 10;

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="absolute inset-x-0 bottom-0 bg-white border-t border-gray-200 rounded-t-2xl p-4 max-h-[98vh] overflow-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <div className="text-base font-black" style={{ color: EKARI.text }}>
                        Filters
                    </div>
                    <button
                        onClick={() => clearAll()}
                        className="w-10 h-10 grid place-items-center rounded-full hover:bg-gray-50 disabled:opacity-50"
                        aria-label="Close"
                        title="Clear & close"
                    >
                        <IoClose size={20} />
                    </button>
                </div>

                {/* Type */}
                <div className="mt-2">
                    <div className="text-[12px] font-extrabold text-gray-500">Type</div>
                    <div className="mt-2 flex gap-2 overflow-x-auto">
                        {[null, ...TYPE_OPTIONS].map((t, i) => {
                            const active = (t || null) === typeSel;
                            return (
                                <button
                                    key={`${t || "all"}-${i}`}
                                    onClick={() => {
                                        setTypeSel(t || null);
                                        setCategory(null);
                                    }}
                                    className={clsx(
                                        "px-3 py-2 rounded-full border text-[12px] font-bold shrink-0",
                                        active ? chipActive : chipIdle
                                    )}
                                >
                                    {t ? t[0].toUpperCase() + t.slice(1) : "All"}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Category */}
                {!!typeSel && (
                    <div className="mt-3">
                        <div className="text-[12px] font-extrabold text-gray-500">Category</div>
                        <div className="mt-2 flex gap-2 overflow-x-auto">
                            {[null, ...(categoriesForType || [])].map((c, i) => {
                                const active = (c || null) === category;
                                return (
                                    <button
                                        key={`${c || "all"}-${i}`}
                                        onClick={() => setCategory(c || null)}
                                        className={clsx(
                                            "px-3 py-2 rounded-full border text-[12px] font-bold shrink-0",
                                            active ? chipActive : chipIdle
                                        )}
                                    >
                                        {c || "All"}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Price */}
                <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                        <div className="text-[12px] font-extrabold text-gray-500">Min price (KES)</div>
                        <input
                            value={minPrice}
                            onChange={(e) => setMinPrice(e.target.value)}
                            inputMode="numeric"
                            placeholder="e.g. 100"
                            className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 outline-none"
                        />
                    </div>
                    <div>
                        <div className="text-[12px] font-extrabold text-gray-500">Max price (KES)</div>
                        <input
                            value={maxPrice}
                            onChange={(e) => setMaxPrice(e.target.value)}
                            inputMode="numeric"
                            placeholder="e.g. 10,000"
                            className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 outline-none"
                        />
                    </div>
                </div>

                {/* Location (collapsible) */}
                <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden">
                    <button
                        onClick={() => setLocOpen((v) => !v)}
                        className="w-full flex items-center justify-between px-3 py-3"
                        style={{ backgroundColor: "#F8FAFC" }}
                        aria-expanded={locOpen}
                    >
                        <div className="flex items-center gap-2 flex-1">
                            <IoLocationOutline className="text-gray-900" size={16} />
                            <div className="text-[12px] font-black" style={{ color: EKARI.text }}>
                                Location
                            </div>
                            <div className="ml-2 text-[12px]" style={{ color: EKARI.dim }}>
                                {locSummary}
                            </div>
                        </div>
                        {locOpen ? <IoChevronUp className="text-gray-500" /> : <IoChevronDown className="text-gray-500" />}
                    </button>

                    {locOpen && (
                        <div className="p-3 space-y-3">
                            {/* Radius */}
                            <div>
                                <div className="flex items-center justify-between">
                                    <div className="text-[12px] font-extrabold text-gray-500">Radius (km)</div>
                                    <div className="text-[12px] font-black" style={{ color: EKARI.text }}>
                                        {parsedRadius || 0} km
                                    </div>
                                </div>

                                <input
                                    type="range"
                                    min={0}
                                    max={500}
                                    step={1}
                                    value={parsedRadius}
                                    onChange={(e) => setRadiusKm(String(e.target.value))}
                                    className="mt-3 w-full accent-emerald-700"
                                />
                                <div className="flex justify-between text-[11px]" style={{ color: EKARI.dim }}>
                                    <span>0</span>
                                    <span>250</span>
                                    <span>500</span>
                                </div>
                            </div>

                            {/* Interactive Picker: search + click/drag marker */}
                            <MapPicker center={center} radiusKm={parsedRadius || 0} onChangeCenter={(c) => setCenter(c)} />

                            {!!radiusKm && !center && (
                                <div
                                    className="mt-3 flex items-start gap-2 rounded-lg border px-3 py-2"
                                    style={{ borderColor: "#FDE68A", backgroundColor: "#FEF3C7" }}
                                >
                                    <IoInformationCircleOutline className="mt-0.5" style={{ color: "#92400E" }} />
                                    <div className="text-sm font-semibold" style={{ color: "#92400E" }}>
                                        Pick a center by searching or clicking the map to apply radius filtering.
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer actions */}
                <div className="mt-4 mb-4 flex items-center justify-between">
                    <button
                        onClick={clearAll}
                        className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-gray-50"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                    >
                        <IoRefresh />
                        Clear
                    </button>
                    <button
                        onClick={apply}
                        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-white font-black hover:opacity-90"
                        style={{ backgroundColor: EKARI.gold }}
                    >
                        <IoFilter />
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
}
