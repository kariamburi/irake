// app/components/FilterModal.tsx
"use client";

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    IoChevronDown,
    IoChevronUp,
    IoInformationCircleOutline,
    IoLocationOutline,
    IoRefresh,
    IoFilter,
    IoClose,
} from "react-icons/io5";
import clsx from "clsx";
import { EKARI } from "../constants/constants";
import { type MarketType } from "@/utils/market_master_catalog";
import {
    collection,
    onSnapshot,
    orderBy,
    query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CurrencyCode } from "@/app/components/ProductCard";
import { createPortal } from "react-dom";

/* -------------------- Types & utils -------------------- */

export type Filters = {
    type: MarketType | null;
    category: string | null;
    /** filter by item name (e.g. "Tomato seedlings") */
    name?: string | null;
    minPrice?: number;
    maxPrice?: number;
    county?: string | null;
    town?: string | null;
    locationText?: string | null;
    radiusKm?: number | null;
    center?: { latitude: number; longitude: number } | null;
    currency?: CurrencyCode | null; // 👈 NEW
};

type MarketTypeDoc = {
    id: MarketType;
    label: string;
    order?: number;
    active?: boolean;
};

type MarketCategoryDoc = {
    id: string;
    typeId: MarketType;
    name: string;
    order?: number;
    active?: boolean;
};

type MarketItemDoc = {
    id: string;
    type: MarketType;
    category: string;
    name: string;
    nameLower?: string;
    categoryLower?: string;
    active?: boolean;
};

export const toLower = (s?: string | null) => (s ? s.toLowerCase() : "");
const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n));

/* direct-name types (same idea as SellModal) */
const DIRECT_NAME_TYPES: MarketType[] = ["product", "animal", "lease", "tree"];
const norm = (s?: string | null) => (s || "").trim().toLowerCase();

/* Nairobi CBD default */
const NAIROBI = { latitude: -1.286389, longitude: 36.817223 };

/* -------------------- Google Maps loader -------------------- */
function loadGoogleMaps(apiKey?: string): Promise<typeof google | null> {
    if (typeof window === "undefined") return Promise.resolve(null);
    // already loaded
    if ((window as any).google?.maps) return Promise.resolve((window as any).google);

    return new Promise((resolve, reject) => {
        if (!apiKey) {
            console.warn(
                "Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — Map will not render."
            );
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
    const h =
        sinDLat * sinDLat +
        Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
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
    const markerRef =
        useRef<google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null>(
            null
        );
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    useEffect(() => {
        let alive = true;
        (async () => {
            const g = await loadGoogleMaps(apiKey);
            if (!alive || !g || !mapDivRef.current) return;

            const initialLatLng = center
                ? { lat: center.latitude, lng: center.longitude }
                : { lat: NAIROBI.latitude, lng: NAIROBI.longitude };

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

                mapRef.current.addListener("click", (e: google.maps.MapMouseEvent) => {
                    if (!e.latLng) return;
                    onChangeCenter({
                        latitude: e.latLng.lat(),
                        longitude: e.latLng.lng(),
                    });
                });
            }

            if (searchRef.current) {
                const ac = new g.maps.places.Autocomplete(searchRef.current, {
                    fields: ["geometry", "name", "formatted_address"],
                    types: ["geocode"],
                });
                ac.addListener("place_changed", () => {
                    const place = ac.getPlace();
                    const loc = place?.geometry?.location;
                    if (!loc) return;
                    onChangeCenter({
                        latitude: loc.lat(),
                        longitude: loc.lng(),
                    });
                });
            }
        })();

        return () => {
            alive = false;
        };
    }, [apiKey]);

    useEffect(() => {
        const g = (window as any).google as typeof google | undefined;
        if (!g || !mapRef.current || !center) return;

        const latlng = new g.maps.LatLng(center.latitude, center.longitude);
        mapRef.current.setCenter(latlng);

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
            (markerRef.current as google.maps.Marker).addListener(
                "dragend",
                (ev: any) => {
                    const pos = (ev as unknown as google.maps.MapMouseEvent).latLng;
                    if (!pos) return;
                    onChangeCenter({
                        latitude: pos.lat(),
                        longitude: pos.lng(),
                    });
                }
            );
        }

        const meters = Math.max(0, Number(radiusKm) || 0) * 1000;

        if (!circleRef.current) {
            circleRef.current = new g.maps.Circle({
                map: mapRef.current!,
                center: latlng,
                radius: meters,
                strokeOpacity: 0.9,
                strokeWeight: 2,
                strokeColor: "#10B981",
                fillOpacity: 0.15,
                fillColor: "#10B981",
            });
        } else {
            circleRef.current.setCenter(latlng);
            circleRef.current.setRadius(meters);
        }

        if (meters > 0) {
            const b = circleRef.current.getBounds();
            if (b) mapRef.current.fitBounds(b, 48);
        }
    }, [center?.latitude, center?.longitude, radiusKm]);

    return (
        <div>
            <div className="relative">
                <input
                    ref={searchRef}
                    placeholder="Search address or place"
                    className="h-11 w-full rounded-xl border px-3 outline-none"
                    style={{ borderColor: EKARI.hair, color: EKARI.text }}
                />
            </div>

            <div
                ref={mapDivRef}
                style={{
                    height: 220,
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
    /* ------- Firestore-backed catalog (types, categories, items) ------- */
    const [typeDocs, setTypeDocs] = useState<MarketTypeDoc[]>([]);
    const [categoryDocs, setCategoryDocs] = useState<MarketCategoryDoc[]>([]);
    const [itemDocs, setItemDocs] = useState<MarketItemDoc[]>([]);
    // Smooth open animation like ConfirmModal
    const [sheetVisible, setSheetVisible] = useState(false);

    useEffect(() => {
        if (open) {
            const id = requestAnimationFrame(() => setSheetVisible(true));
            return () => cancelAnimationFrame(id);
        } else {
            setSheetVisible(false);
        }
    }, [open]);

    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    useEffect(() => {
        const ref = collection(db, "market_types");
        const q = query(ref, orderBy("order", "asc"));
        const unsub = onSnapshot(q, (snap) => {
            const rows: MarketTypeDoc[] = [];
            snap.forEach((d) => rows.push(d.data() as MarketTypeDoc));
            setTypeDocs(rows);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const ref = collection(db, "market_categories");
        const q = query(ref, orderBy("order", "asc"));
        const unsub = onSnapshot(q, (snap) => {
            const rows: MarketCategoryDoc[] = [];
            snap.forEach((d) => rows.push(d.data() as MarketCategoryDoc));
            setCategoryDocs(rows);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const ref = collection(db, "market_items");
        const q = query(ref, orderBy("nameLower", "asc"));
        const unsub = onSnapshot(q, (snap) => {
            const rows: MarketItemDoc[] = [];
            snap.forEach((d) => rows.push(d.data() as MarketItemDoc));
            setItemDocs(rows);
        });
        return () => unsub();
    }, []);

    /* ------- Derived catalog helpers (from Firestore) ------- */

    const typeOptions: MarketType[] = useMemo(() => {
        const activeSorted = [...typeDocs]
            .filter((t) => t.active !== false)
            .sort((a, b) =>
                (a.label || a.id).localeCompare(b.label || b.id, undefined, {
                    sensitivity: "base",
                })
            );
        if (activeSorted.length) {
            return activeSorted.map((t) => t.id as MarketType);
        }
        // fallback if Firestore empty
        return [
            "product",
            "animal",
            "tree",
            "lease",
            "service",
            "arableLand",
        ] as MarketType[];
    }, [typeDocs]);

    const categoriesByType = useMemo(() => {
        const map: Record<MarketType, MarketCategoryDoc[]> = {
            product: [],
            animal: [],
            tree: [],
            lease: [],
            service: [],
            arableLand: [],
        };
        for (const c of categoryDocs) {
            if (!c.typeId || !map[c.typeId]) continue;
            if (c.active === false) continue;
            map[c.typeId].push(c);
        }
        (Object.keys(map) as MarketType[]).forEach((t) => {
            map[t] = map[t].sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
            );
        });
        return map;
    }, [categoryDocs]);

    const itemsByType = useMemo(() => {
        const map: Record<MarketType, MarketItemDoc[]> = {
            product: [],
            animal: [],
            tree: [],
            lease: [],
            service: [],
            arableLand: [],
        };
        for (const i of itemDocs) {
            if (!i.type || !map[i.type]) continue;
            if (i.active === false) continue;
            map[i.type].push(i);
        }
        (Object.keys(map) as MarketType[]).forEach((t) => {
            map[t] = map[t].sort((a, b) =>
                (a.name || "").localeCompare(b.name || "", undefined, {
                    sensitivity: "base",
                })
            );
        });
        return map;
    }, [itemDocs]);

    const findCatalogRow = useCallback(
        (type: MarketType, name: string) => {
            const list = itemsByType[type] || [];
            const target = norm(name);
            return list.find((r) => norm(r.name) === target);
        },
        [itemsByType]
    );

    /* ---------------- State for current filter ---------------- */

    const [typeSel, setTypeSel] = useState<Filters["type"]>(
        initial.type || null
    );
    const [category, setCategory] = useState<Filters["category"]>(
        initial.category || null
    );
    const [name, setName] = useState<string>(initial.name || "");

    const [minPrice, setMinPrice] = useState<string>(
        initial.minPrice ? String(initial.minPrice) : ""
    );
    const [maxPrice, setMaxPrice] = useState<string>(
        initial.maxPrice ? String(initial.maxPrice) : ""
    );

    const [currency, setCurrency] = useState<CurrencyCode | null>(
        initial.currency ?? null
    );

    const [locCounty, setLocCounty] = useState<string>(initial.county || "");
    const [locTown, setLocTown] = useState<string>(initial.town || "");
    const [locText, setLocText] = useState<string>(initial.locationText || "");

    const [radiusKm, setRadiusKm] = useState<string>(
        typeof initial.radiusKm === "number" && !isNaN(initial.radiusKm)
            ? String(initial.radiusKm)
            : "10"
    );

    const [center, setCenter] = useState<{
        latitude: number;
        longitude: number;
    } | null>(initial.center || { ...NAIROBI });

    const [locOpen, setLocOpen] = useState<boolean>(
        Boolean(
            initial.county ||
            initial.town ||
            initial.locationText ||
            initial.radiusKm ||
            initial.center
        )
    );

    const categoriesForType = useMemo(
        () =>
            typeSel
                ? (categoriesByType[typeSel] || []).map((c) => c.name)
                : [],
        [typeSel, categoriesByType]
    );

    const allNamesForType = useMemo(() => {
        if (!typeSel) return [];
        const list = itemsByType[typeSel] || [];
        return Array.from(
            new Set(
                list
                    .map((r) => r.name?.trim())
                    .filter(Boolean) as string[]
            )
        ).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: "base" })
        );
    }, [typeSel, itemsByType]);

    const nameSuggestions = useMemo(() => {
        if (!typeSel || !DIRECT_NAME_TYPES.includes(typeSel)) return [];
        if (!allNamesForType.length) return [];
        const q = norm(name);
        if (!q) return allNamesForType.slice(0, 40);
        return allNamesForType
            .filter((n) => n.toLowerCase().includes(q))
            .slice(0, 40);
    }, [typeSel, name, allNamesForType]);

    // Reset when modal opens
    useEffect(() => {
        if (open) {
            setTypeSel(initial.type || null);
            setCategory(initial.category || null);
            setName(initial.name || "");
            setMinPrice(initial.minPrice ? String(initial.minPrice) : "");
            setMaxPrice(initial.maxPrice ? String(initial.maxPrice) : "");
            setCurrency(initial.currency ?? null);
            setLocCounty(initial.county || "");
            setLocTown(initial.town || "");
            setLocText(initial.locationText || "");
            setRadiusKm(
                typeof initial.radiusKm === "number" && !isNaN(initial.radiusKm)
                    ? String(initial.radiusKm)
                    : "10"
            );
            setCenter(initial.center || { ...NAIROBI });
            setLocOpen(
                Boolean(
                    initial.county ||
                    initial.town ||
                    initial.locationText ||
                    initial.radiusKm ||
                    initial.center
                )
            );
        }
    }, [open, initial]);

    // Auto category when name changes (for product/animal/lease/tree)
    useEffect(() => {
        if (!typeSel || !DIRECT_NAME_TYPES.includes(typeSel)) return;
        if (!name.trim()) return;

        const row = findCatalogRow(typeSel, name);
        const fallbackCategory =
            categoriesByType[typeSel]?.[0]?.name || null;
        setCategory(row?.category || fallbackCategory || null);
    }, [typeSel, name, findCatalogRow, categoriesByType]);

    const locSummary = useMemo(() => {
        const bits: string[] = [];
        if (locTown) bits.push(locTown);
        if (locCounty) bits.push(locCounty);
        const r = radiusKm ? clamp(Number(radiusKm) || 0, 0, 500) : 0;
        if (r && center) bits.push(`${r} km`);
        return bits.join(" • ") || "Off";
    }, [locTown, locCounty, radiusKm, center]);

    const clearAll = useCallback(() => {
        // Reset local UI state
        setTypeSel(null);
        setCategory(null);
        setName("");
        setMinPrice("");
        setMaxPrice("");
        setCurrency(null);
        setLocCounty("");
        setLocTown("");
        setLocText("");
        setRadiusKm("10");          // UI default when user opens location later
        setCenter({ ...NAIROBI });  // UI default only
        setLocOpen(false);

        // Tell parent: NO filters active at all
        onApply({
            type: null,
            category: null,
            name: null,
            minPrice: undefined,
            maxPrice: undefined,
            county: null,
            town: null,
            locationText: null,
            radiusKm: null,  // 👈 no radius filter
            center: null,    // 👈 no location filter
            currency: null,  // 👈 clear currency filter too
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
            name: name.trim() ? name.trim() : null,
            minPrice: minPrice ? Number(minPrice) : undefined,
            maxPrice: maxPrice ? Number(maxPrice) : undefined,
            county: locCounty || null,
            town: locTown || null,
            locationText: locText || null,
            radiusKm: km ?? null,
            center: center || null,
            currency: currency ?? null,
        });
        onClose();
    }, [
        typeSel,
        category,
        name,
        minPrice,
        maxPrice,
        locCounty,
        locTown,
        locText,
        radiusKm,
        center,
        currency,
        onApply,
        onClose,
    ]);

    if (!mounted || !open) return null;



    const chipActive = "bg-emerald-800 text-white border-emerald-800";
    const chipIdle = "bg-gray-50 text-gray-900 border-gray-200";
    const parsedRadius = radiusKm
        ? clamp(Number(radiusKm) || 0, 0, 500)
        : 10;

    const priceCurrencyLabel = currency || "KES";

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop – faded + blurred like ConfirmModal */}
            <button
                type="button"
                className={clsx(
                    "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200",
                    sheetVisible ? "opacity-100" : "opacity-0"
                )}
                onClick={onClose}
                aria-label="Close filters"
            />

            {/* Centered modal card – slide + fade in */}
            <div
                className={clsx(
                    "relative w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-4 shadow-xl transition-all duration-200 transform",
                    "max-h-[90vh] flex flex-col", // so body can scroll inside
                    sheetVisible
                        ? "translate-y-0 opacity-100"
                        : "translate-y-4 opacity-0"
                )}
                role="dialog"
                aria-modal="true"
            >
                {/* grab handle (optional, can remove now if you want) */}
                <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-gray-300" />

                {/* Header */}
                <div className="mb-1 flex items-center justify-between">
                    <div
                        className="text-base font-black"
                        style={{ color: EKARI.text }}
                    >
                        Filters
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={clearAll}
                            className="hidden sm:inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold hover:bg-gray-50"
                            style={{
                                borderColor: EKARI.hair,
                                color: EKARI.text,
                            }}
                        >
                            <IoRefresh size={14} />
                            Clear
                        </button>
                        <button
                            onClick={onClose}
                            className="grid h-9 w-9 place-items-center rounded-full hover:bg-gray-50"
                            aria-label="Close"
                        >
                            <IoClose size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto pr-1 mt-2 space-y-3">
                    {/* Type */}
                    <div>
                        <div className="text-[12px] font-extrabold text-gray-500">
                            Type
                        </div>
                        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                            {[null, ...typeOptions].map((t, i) => {
                                const active = (t || null) === typeSel;
                                return (
                                    <button
                                        key={`${t || "all"}-${i}`}
                                        onClick={() => {
                                            setTypeSel(t || null);
                                            setCategory(null);
                                            setName("");
                                        }}
                                        className={clsx(
                                            "px-3 py-2 rounded-full border text-[12px] font-bold shrink-0",
                                            active ? chipActive : chipIdle
                                        )}
                                    >
                                        {t
                                            ? t[0].toUpperCase() + t.slice(1)
                                            : "All"}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Item name + autosuggest */}
                    {typeSel && DIRECT_NAME_TYPES.includes(typeSel) && (
                        <div>
                            <div className="text-[12px] font-extrabold text-gray-500">
                                Item name
                            </div>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={
                                    typeSel === "product"
                                        ? "e.g. Maize grain, Tomatoes, Milk"
                                        : typeSel === "animal"
                                            ? "e.g. Dairy cow, Kienyeji chicken"
                                            : typeSel === "lease"
                                                ? "e.g. Tractor hire, Land lease"
                                                : "e.g. Grevillea, Eucalyptus"
                                }
                                className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 outline-none"
                            />
                            {category && (
                                <div className="mt-1 text-[11px] text-gray-500">
                                    Matching category:{" "}
                                    <span className="font-semibold text-gray-800">
                                        {category}
                                    </span>
                                </div>
                            )}
                            {nameSuggestions.length > 0 && (
                                <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-1">
                                    {nameSuggestions.map((n) => (
                                        <button
                                            key={n}
                                            type="button"
                                            onClick={() => setName(n)}
                                            className={`w-full text-left text-sm px-3 py-1.5 rounded-lg hover:bg-white ${norm(n) === norm(name)
                                                ? "font-semibold text-emerald-800"
                                                : "text-gray-800"
                                                }`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Category chips for non-direct-name types */}
                    {!!typeSel && !DIRECT_NAME_TYPES.includes(typeSel) && (
                        <div>
                            <div className="text-[12px] font-extrabold text-gray-500">
                                Category
                            </div>
                            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
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

                    {/* Currency + Price */}
                    <div className="space-y-2">
                        {/* Currency selector */}
                        <div>
                            <div className="text-[12px] font-extrabold text-gray-500">
                                Currency
                            </div>
                            <div className="mt-2 flex gap-2">
                                {[
                                    { label: "Any", value: null },
                                    { label: "KES", value: "KES" as CurrencyCode },
                                    { label: "USD", value: "USD" as CurrencyCode },
                                ].map((opt) => {
                                    const active = currency === opt.value;
                                    return (
                                        <button
                                            key={opt.label}
                                            type="button"
                                            onClick={() => setCurrency(opt.value)}
                                            className={clsx(
                                                "px-3 py-1.5 rounded-full border text-[12px] font-bold",
                                                active ? chipActive : chipIdle
                                            )}
                                        >
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Min / Max price */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-[12px] font-extrabold text-gray-500">
                                    Min price ({priceCurrencyLabel})
                                </div>
                                <input
                                    value={minPrice}
                                    onChange={(e) => setMinPrice(e.target.value)}
                                    inputMode="numeric"
                                    placeholder="e.g. 100"
                                    className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 outline-none"
                                />
                            </div>
                            <div>
                                <div className="text-[12px] font-extrabold text-gray-500">
                                    Max price ({priceCurrencyLabel})
                                </div>
                                <input
                                    value={maxPrice}
                                    onChange={(e) => setMaxPrice(e.target.value)}
                                    inputMode="numeric"
                                    placeholder="e.g. 10,000"
                                    className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Location (collapsible) */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <button
                            onClick={() => setLocOpen((v) => !v)}
                            className="w-full flex items-center justify-between px-3 py-3 bg-slate-50"
                            aria-expanded={locOpen}
                        >
                            <div className="flex items-center gap-2 flex-1">
                                <IoLocationOutline className="text-gray-900" size={16} />
                                <div
                                    className="text-[12px] font-black"
                                    style={{ color: EKARI.text }}
                                >
                                    Location
                                </div>
                                <div
                                    className="ml-2 text-[12px] truncate"
                                    style={{ color: EKARI.dim }}
                                >
                                    {locSummary}
                                </div>
                            </div>
                            {locOpen ? (
                                <IoChevronUp className="text-gray-500" />
                            ) : (
                                <IoChevronDown className="text-gray-500" />
                            )}
                        </button>

                        {locOpen && (
                            <div className="p-3 space-y-3">
                                {/* Radius */}
                                <div>
                                    <div className="flex items-center justify-between">
                                        <div className="text-[12px] font-extrabold text-gray-500">
                                            Radius (km)
                                        </div>
                                        <div
                                            className="text-[12px] font-black"
                                            style={{ color: EKARI.text }}
                                        >
                                            {parsedRadius || 0} km
                                        </div>
                                    </div>

                                    <input
                                        type="range"
                                        min={0}
                                        max={500}
                                        step={1}
                                        value={parsedRadius}
                                        onChange={(e) =>
                                            setRadiusKm(String(e.target.value))
                                        }
                                        className="mt-3 w-full accent-emerald-700"
                                    />
                                    <div
                                        className="flex justify-between text-[11px]"
                                        style={{ color: EKARI.dim }}
                                    >
                                        <span>0</span>
                                        <span>250</span>
                                        <span>500</span>
                                    </div>
                                </div>

                                {/* Center map */}
                                <MapPicker
                                    center={center}
                                    radiusKm={parsedRadius || 0}
                                    onChangeCenter={(c) => setCenter(c)}
                                />

                                {!!radiusKm && !center && (
                                    <div
                                        className="mt-3 flex items-start gap-2 rounded-lg border px-3 py-2"
                                        style={{
                                            borderColor: "#FDE68A",
                                            backgroundColor: "#FEF3C7",
                                        }}
                                    >
                                        <IoInformationCircleOutline
                                            className="mt-0.5"
                                            style={{ color: "#92400E" }}
                                        />
                                        <div
                                            className="text-sm font-semibold"
                                            style={{ color: "#92400E" }}
                                        >
                                            Pick a center by searching or clicking the map to
                                            apply radius filtering.
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer actions */}
                <div className="mt-3 mb-1 flex items-center justify-between gap-3">
                    <button
                        onClick={clearAll}
                        className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-gray-50 text-sm font-semibold"
                        style={{
                            borderColor: EKARI.hair,
                            color: EKARI.text,
                        }}
                    >
                        <IoRefresh />
                        Clear
                    </button>
                    <button
                        onClick={apply}
                        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-white font-black text-sm hover:opacity-90"
                        style={{ backgroundColor: EKARI.gold }}
                    >
                        <IoFilter />
                        Apply filters
                    </button>
                </div>
            </div>
        </div>
        ,
        document.body
    );
}
