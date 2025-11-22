"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    collection,
    doc,
    serverTimestamp,
    setDoc,
    getFirestore,
} from "firebase/firestore";
import {
    getStorage,
    ref as sRef,
    uploadBytes,
    getDownloadURL,
} from "firebase/storage";
import { getAuth } from "firebase/auth";
import {
    TYPE_OPTIONS,
    CATEGORY_OPTIONS_BY_TYPE,
    productsFor,
    unitsFor,
    defaultPackFor,
    type MarketType,
    MARKET_CATALOG,            // 👈 NEW: pull full catalog so we can map name → category + useCase
} from "@/utils/market_master_catalog";
import type { Product } from "./ProductCard";

import {
    IoClose,
    IoChevronBack,
    IoChevronForward,
    IoCheckmarkDone,
    IoImagesOutline,
    IoMap,
    IoSearch,
} from "react-icons/io5";

/* ================= Theme ================= */
const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
};

const DIRECT_NAME_TYPES: MarketType[] = ["product", "animal", "lease", "tree"];

/* ===== Helpers from catalog ===== */

const norm = (s?: string | null) => (s || "").trim().toLowerCase();

/** All unique names for a given type (product/animal/lease/tree) */
function namesForType(t: MarketType): string[] {
    return Array.from(
        new Set(
            MARKET_CATALOG
                .filter((r) => r.type === t)
                .map((r) => r.name?.trim())
                .filter(Boolean) as string[]
        )
    ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/** Find the catalog row for (type, name) so we can pull category + useCase, etc */
function findCatalogRow(type: MarketType, name: string) {
    const n = norm(name);
    return MARKET_CATALOG.find(
        (r) => r.type === type && norm(r.name) === n
    );
}

/* ============ Other helpers (unchanged) ============ */

const toLower = (s?: string | null) => (s ? s.toLowerCase() : "");

/* Kenya counties list + relaxed match */
const KENYA_COUNTIES = [
    "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa", "Homa Bay", "Isiolo",
    "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale",
    "Laikipia", "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a",
    "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu", "Siaya", "Taita-Taveta",
    "Tana River", "Tharaka-Nithi", "Trans Nzoia", "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
];

const COUNTY_REGEXES = KENYA_COUNTIES.map((c) => {
    const pat = c.replace(/[\-\s]/g, "[\\-\\s]?").replace(/’|'/g, "['’]?");
    return { name: c, re: new RegExp(`\\b${pat}\\b`, "i") };
});

/** Read an ImageBitmap or HTMLImage for drawing onto canvas */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
    if ("createImageBitmap" in window) {
        try {
            return await createImageBitmap(file);
        } catch {
            // fall back
        }
    }
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    img.src = URL.createObjectURL(file);
    await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = (e) => rej(e);
    });
    return img;
}

/**
 * High-quality client compression
 */
async function compressImage(
    file: File,
    opts: {
        maxSide?: number;
        targetBytes?: number;
        initialQuality?: number;
        minQuality?: number;
        mime?: string;
    } = {}
): Promise<{ blob: Blob; url: string; width: number; height: number; name: string }> {
    const {
        maxSide = 1600,
        targetBytes = 550 * 1024,
        initialQuality = 0.82,
        minQuality = 0.6,
        mime = "image/webp",
    } = opts;

    if (
        file.size <= targetBytes &&
        (file.type === "image/webp" || file.type === "image/jpeg" || file.type === "image/png")
    ) {
        const url = URL.createObjectURL(file);
        return {
            blob: file,
            url,
            width: 0,
            height: 0,
            name: file.name.replace(/\.[^.]+$/, "") + ".webp",
        };
    }

    const bmp = await loadBitmap(file);
    const srcW = "width" in bmp ? bmp.width : (bmp as any).naturalWidth;
    const srcH = "height" in bmp ? bmp.height : (bmp as any).naturalHeight;

    const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = dstW;
    canvas.height = dstH;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Canvas 2D unavailable");

    (ctx as any).imageSmoothingEnabled = true;
    (ctx as any).imageSmoothingQuality = "high";
    ctx.drawImage(bmp as any, 0, 0, dstW, dstH);

    let q = initialQuality;
    let out: Blob | null = await new Promise((res) => canvas.toBlob(res, mime, q));
    if (!out) throw new Error("toBlob failed");

    while (out.size > targetBytes && q > minQuality) {
        q = Math.max(minQuality, q - 0.06);
        out = await new Promise((res) => canvas.toBlob(res, mime, q));
        if (!out) throw new Error("toBlob failed");
    }

    const url = URL.createObjectURL(out);
    return {
        blob: out,
        url,
        width: dstW,
        height: dstH,
        name: file.name.replace(/\.[^.]+$/, "") + ".webp",
    };
}

function matchCountyFromText(text: string | undefined | null): string | undefined {
    if (!text) return undefined;
    for (const { name, re } of COUNTY_REGEXES) {
        if (re.test(text)) return name;
    }
    return undefined;
}

function guessTownFromText(text: string | undefined | null, county?: string): string | undefined {
    if (!text) return undefined;
    const first = text.split(",")[0]?.trim();
    if (!first) return undefined;
    if (county && COUNTY_REGEXES.find((c) => c.name === county)?.re.test(first)) return undefined;
    return first;
}

const KES = (n: number) =>
    "KSh " + (n || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 });


/* ================= Google Maps loader ================= */
async function loadGoogleMaps(apiKey?: string): Promise<typeof google | null> {
    if (typeof window === "undefined") return null;
    if ((window as any).google?.maps) return (window as any).google;

    return new Promise((resolve, reject) => {
        if (!apiKey) {
            console.warn("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — map will not render.");
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

/* ================= Reusable in-file MapPicker ================= */
function MapPicker({
    center,
    radiusKm,
    onChangeCenter,
    height = 300,
}: {
    center: { latitude: number; longitude: number } | null;
    radiusKm: number;
    onChangeCenter: (c: { latitude: number; longitude: number }) => void;
    height?: number;
}) {
    const mapDivRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<google.maps.Map | null>(null);
    const circleRef = useRef<google.maps.Circle | null>(null);
    const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null>(null);
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    useEffect(() => {
        let alive = true;
        (async () => {
            const g = await loadGoogleMaps(apiKey);
            if (!alive || !g || !mapDivRef.current) return;

            const fallback = { latitude: -1.286389, longitude: 36.817223 }; // Nairobi CBD
            const init = center ?? fallback;

            if (!mapRef.current) {
                mapRef.current = new g.maps.Map(mapDivRef.current, {
                    center: { lat: init.latitude, lng: init.longitude },
                    zoom: center ? 12 : 11,
                    disableDefaultUI: true,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                });

                mapRef.current.addListener("click", (e: google.maps.MapMouseEvent) => {
                    if (!e.latLng) return;
                    onChangeCenter({ latitude: e.latLng.lat(), longitude: e.latLng.lng() });
                });
            }
        })();
        return () => {
            alive = false;
        };
    }, [apiKey]); // init once

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
            (markerRef.current as google.maps.Marker).addListener("dragend", (ev: any) => {
                const pos = (ev as unknown as google.maps.MapMouseEvent).latLng;
                if (!pos) return;
                onChangeCenter({ latitude: pos.lat(), longitude: pos.lng() });
            });
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
    }, [center?.latitude, center?.longitude, radiusKm]);

    return (
        <div
            ref={mapDivRef}
            style={{
                height,
                borderRadius: 12,
                overflow: "hidden",
                border: `1px solid ${EKARI.hair}`,
            }}
        />
    );
}

/* ================= Location Picker Modal (Places + Map) ================= */
function LocationPickerModal({
    initialText,
    initialCenter,
    onCancel,
    onUse,
}: {
    initialText: string;
    initialCenter: { latitude: number; longitude: number };
    onCancel: () => void;
    onUse: (text: string, center: { latitude: number; longitude: number }) => void;
}) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const [text, setText] = React.useState(initialText || "");
    const [center, setCenter] = React.useState(initialCenter);

    useEffect(() => {
        let alive = true;
        (async () => {
            const g = await loadGoogleMaps(apiKey);
            if (!alive || !g || !inputRef.current) return;

            const ac = new g.maps.places.Autocomplete(inputRef.current, {
                fields: ["geometry", "name", "formatted_address"],
                types: ["geocode"],
            });
            ac.addListener("place_changed", () => {
                const place = ac.getPlace();
                const loc = place?.geometry?.location;
                const label =
                    place?.formatted_address || place?.name || inputRef.current?.value || "";
                setText(label);
                if (loc) {
                    setCenter({ latitude: loc.lat(), longitude: loc.lng() });
                }
            });
        })();
        return () => {
            alive = false;
        };
    }, [apiKey]);

    return (
        <div className="fixed inset-0 z-[60]">
            <button onClick={onCancel} className="absolute inset-0 bg-black/50" aria-label="Close" />
            <div className="absolute inset-x-0 bottom-0 bg-white border-t border-gray-200 rounded-t-2xl p-4 max-h-[85vh] overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                    <div className="text-base font-black text-gray-900">Add Location</div>
                    <button onClick={onCancel} className="w-10 h-10 grid place-items-center rounded-full hover:bg-gray-50" aria-label="Close">
                        <IoClose size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto pr-1 space-y-3" style={{ maxHeight: "60vh" }}>
                    <div className="relative">
                        <input
                            ref={inputRef}
                            defaultValue={initialText}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Search address or place"
                            className="h-11 w-full rounded-xl border border-gray-200 px-3 outline-none"
                        />
                        <IoSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>

                    <div>
                        <div className="text-xs font-extrabold text-gray-500 mb-1">Tap the map or drag marker</div>
                        <MapPicker center={center} radiusKm={0} onChangeCenter={setCenter} height={300} />
                        <div className="mt-1 text-xs text-gray-500">
                            Selected: {center.latitude.toFixed(5)}, {center.longitude.toFixed(5)}
                        </div>
                    </div>
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="h-10 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 font-semibold"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            if (!text.trim()) {
                                alert("Enter a place name or search an address.");
                                return;
                            }
                            onUse(text.trim(), center);
                        }}
                        className="h-10 px-5 rounded-xl text-white font-black hover:opacity-90"
                        style={{ backgroundColor: EKARI.gold }}
                    >
                        Use this location
                    </button>
                </div>
            </div>
        </div>
    );
}
export default function SellModal({
    open,
    onClose,
    onCreated,
}: {
    open: boolean;
    onClose: () => void;
    onCreated: (p: Product) => void;
}) {
    // Steps: 0 Type, 1 Name (or Category+Item), 2 Pack+Unit, 3 Price/Rate, 4 Photos+Location+Review
    const [step, setStep] = useState<number>(0);

    type PhotoItem = { blob: Blob; url: string; name: string };
    const [photos, setPhotos] = useState<PhotoItem[]>([]);

    // Step 0
    const [typeSel, setTypeSel] = useState<MarketType>("product");

    // Step 1
    const categoriesForType = useMemo(
        () => CATEGORY_OPTIONS_BY_TYPE[typeSel] || [],
        [typeSel]
    );
    const [category, setCategory] = useState<string>(categoriesForType[0] || "");

    // Name + use-case tips
    const [name, setName] = useState<string>("");
    const [useCaseTip, setUseCaseTip] = useState<string>("");

    // All names for this type (for autosuggest for product/animal/lease/tree)
    const allNamesForType = useMemo(
        () => namesForType(typeSel),
        [typeSel]
    );

    // Name suggestions filtered by input
    const nameSuggestions = useMemo(() => {
        if (!DIRECT_NAME_TYPES.includes(typeSel)) return [];
        if (!allNamesForType.length) return [];

        const q = norm(name);
        if (!q) {
            // initial: show top chunk
            return allNamesForType.slice(0, 40);
        }
        return allNamesForType
            .filter((n) => n.toLowerCase().includes(q))
            .slice(0, 40);
    }, [typeSel, allNamesForType, name]);

    // For service (old path), we still use category → productsFor(category)
    const productNames = useMemo(
        () => (category ? productsFor(typeSel, category) : []),
        [typeSel, category]
    );

    // Skip pack/unit step for lease/service (same as before)
    useEffect(() => {
        if (step === 2 && (typeSel === "lease" || typeSel === "service")) {
            setStep(3);
        }
    }, [step, typeSel]);

    // Step 2
    const [unit, setUnit] = useState<string>("");
    const [pack, setPack] = useState<string>("");

    // Step 3
    const [price, setPrice] = useState<string>("");
    const [rate, setRate] = useState<string>("");
    const [billingUnit, setBillingUnit] = useState<string>("");

    // Step 4 (Location)
    const [placeText, setPlaceText] = useState<string>("");
    const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

    // Nested location modal
    const [locModalOpen, setLocModalOpen] = useState(false);
    const [candidateText, setCandidateText] = useState<string>("");
    const [candidateCenter, setCandidateCenter] = useState<{ latitude: number; longitude: number } | null>(null);

    const [saving, setSaving] = useState(false);

    // Reset when modal closes
    useEffect(() => {
        if (!open) {
            setStep(0);
            setTypeSel("product");
            setCategory("");
            setName("");
            setUseCaseTip("");
            setUnit("");
            setPack("");
            setPrice("");
            setRate("");
            setBillingUnit("");
            setSaving(false);
            setPhotos([]);
            setPlaceText("");
            setCoords(null);
            setLocModalOpen(false);
            setCandidateText("");
            setCandidateCenter(null);
        }
    }, [open]);

    // Keep category initialized (mainly for service path)
    useEffect(() => {
        const first = categoriesForType[0] || "";
        setCategory((prev) => (prev ? prev : first));
    }, [categoriesForType]);

    // Auto pack + unit when name changes (unchanged logic)
    useEffect(() => {
        if (!name) return;
        const d: any = defaultPackFor(name);
        if (d) {
            setPack(String(d.size ?? ""));
            try {
                setUnit(d.unit.split(" ")[0] ?? "");
            } catch {
                setUnit(d.unit || "");
            }
        } else {
            const u: any = unitsFor(name);
            try {
                setUnit((Array.isArray(u) ? u[0] : u).split(" ")[0] || "");
            } catch {
                setUnit((Array.isArray(u) ? u[0] : u) || "");
            }
        }
    }, [name]);

    // NEW: When name changes for product/animal/lease/tree, auto-pick category and tree use-case tip
    useEffect(() => {
        if (!name.trim()) {
            setUseCaseTip("");
            return;
        }
        if (!DIRECT_NAME_TYPES.includes(typeSel)) {
            setUseCaseTip("");
            return;
        }

        const row = findCatalogRow(typeSel, name);
        const fallbackCategory = CATEGORY_OPTIONS_BY_TYPE[typeSel]?.[0] || "";

        if (row?.category || fallbackCategory) {
            setCategory(row?.category || fallbackCategory);
        }

        if (typeSel === "tree") {
            setUseCaseTip(row?.useCase || "");
        } else {
            setUseCaseTip("");
        }
    }, [name, typeSel]);

    // file picker
    const onPickFiles = useCallback(
        async (files: FileList | null) => {
            if (!files) return;
            const incoming = Array.from(files).filter((f) => f.type.startsWith("image/"));
            if (!incoming.length) return;

            const room = Math.max(0, 5 - photos.length);
            const slice = incoming.slice(0, room);

            const compressed = await Promise.all(
                slice.map((f) =>
                    compressImage(f, {
                        maxSide: 1600,
                        targetBytes: 550 * 1024,
                        initialQuality: 0.82,
                        minQuality: 0.6,
                        mime: "image/webp",
                    })
                )
            );

            setPhotos((prev) => [...prev, ...compressed]);
        },
        [photos.length]
    );

    const removeImg = useCallback((idx: number) => {
        setPhotos((prev) => {
            const next = [...prev];
            URL.revokeObjectURL(next[idx]?.url);
            next.splice(idx, 1);
            return next;
        });
    }, []);

    const unitsitems = useMemo(() => {
        const rawunits = unitsFor(name) ?? [];
        const out: string[] = [];
        const asArray = Array.isArray(rawunits) ? rawunits : [rawunits];

        for (const entry of asArray) {
            if (Array.isArray(entry)) {
                for (const v of entry) {
                    const t = String(v)
                        .split(" ")
                        .map((s) => s.trim())
                        .filter(Boolean);
                    out.push(...t);
                }
            } else if (typeof entry === "string") {
                const t = entry
                    .split(" ")
                    .map((s) => s.trim())
                    .filter(Boolean);
                out.push(...t);
            } else if (entry != null) {
                out.push(String(entry).trim());
            }
        }
        return Array.from(new Set(out));
    }, [name]);

    function firstString(v: unknown): string | undefined {
        if (typeof v === "string") return v;
        if (Array.isArray(v)) return v.find((x) => typeof x === "string") as string | undefined;
        return undefined;
    }

    // kept for service path
    const catalogItems = useMemo(() => {
        const raw = productsFor(typeSel, category) ?? [];
        const arr: any[] = Array.isArray(raw) ? raw : [raw];
        const out: string[] = [];
        for (const entry of arr) {
            if (Array.isArray(entry)) {
                for (const v of entry) {
                    const t = String(v)
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                    out.push(...t);
                }
            } else if (typeof entry === "string") {
                const t = entry
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                out.push(...t);
            } else if (entry != null) {
                out.push(String(entry).trim());
            }
        }
        return Array.from(new Set(out));
    }, [typeSel, category]);

    const canNext = useMemo(() => {
        if (step === 0) return !!typeSel;
        if (step === 1) return !!category && !!name.trim();
        if (step === 2) return true;
        if (step === 3) {
            if (typeSel === "lease" || typeSel === "service") {
                return !!rate.trim() && !!billingUnit.trim();
            } else {
                const n = Number(String(price).replace(/[^\d.]/g, ""));
                return !!n && n > 0;
            }
        }
        if (step === 4) return photos.length > 0 && !!placeText.trim() && !!coords;
        return false;
    }, [step, typeSel, category, name, price, rate, billingUnit, photos.length, placeText, coords]);

    const onNext = useCallback(() => {
        if (!canNext) {
            if (step === 1 && !name.trim()) alert("Please pick or type the item name.");
            if (step === 3) {
                if (typeSel === "lease" || typeSel === "service") {
                    if (!rate.trim() || !billingUnit.trim()) {
                        alert("Provide a rate and billing unit (e.g., per hour / per acre).");
                    }
                } else {
                    alert("Please enter a valid numeric price.");
                }
            }
            if (step === 4) {
                if (photos.length === 0) return alert("Please add a photo.");
                if (!placeText.trim()) return alert("Add a place (e.g., Westlands, Nairobi).");
                if (!coords) return alert("Open “Add location” and pick a point or search an address.");
            }
            return;
        }
        if (step < 4) setStep(step + 1);
    }, [step, canNext, typeSel, name, rate, billingUnit, photos.length, placeText, coords]);

    const onBack = useCallback(() => {
        if (step > 0) setStep(step - 1);
    }, [step]);

    // Upload -> Firestore create (unchanged except using same category/name)
    const createProduct = useCallback(async () => {
        if (!photos.length) return alert("Please add at least one photo.");
        if (!name.trim()) return alert("Please choose what you’re selling.");
        if (!category) return alert("Pick a category.");

        if (typeSel === "lease" || typeSel === "service") {
            if (!rate.trim() || !billingUnit.trim()) {
                return alert("Provide a rate and billing unit.");
            }
        } else {
            const nPrice = Number(String(price).replace(/[^\d.]/g, ""));
            if (!nPrice || nPrice <= 0) {
                return alert("Please enter a valid numeric price.");
            }
        }

        try {
            setSaving(true);
            const auth = getAuth();
            const user = auth.currentUser;
            if (!user) {
                setSaving(false);
                return alert("Please sign in to sell.");
            }

            const db = getFirestore();
            const storage = getStorage();

            const countyFromText = matchCountyFromText(placeText) || "";
            const townFromText = guessTownFromText(placeText, countyFromText) || "";

            const place: {
                text: string;
                textLower: string;
                county?: string;
                countyLower?: string;
                town?: string;
                townLower?: string;
            } = {
                text: placeText,
                textLower: toLower(placeText),
                ...(countyFromText && {
                    county: countyFromText,
                    countyLower: toLower(countyFromText),
                }),
                ...(townFromText && {
                    town: townFromText,
                    townLower: toLower(townFromText),
                }),
            };

            if (!coords) {
                setSaving(false);
                return alert("Please add a location and pick coordinates.");
            }

            const prodRef = doc(collection(db, "marketListings"));
            const docId = prodRef.id;

            const toUpload = photos.slice(0, 5);
            const urls = await Promise.all(
                toUpload.map(async (p, i) => {
                    const path = `products/${user.uid}/${docId}/images/${i}.webp`;
                    const ref = sRef(storage, path);
                    await uploadBytes(ref, p.blob, {
                        contentType: "image/webp",
                        cacheControl: "public,max-age=31536000,immutable",
                    });
                    return await getDownloadURL(ref);
                })
            );

            const nPrice =
                typeSel === "lease" || typeSel === "service"
                    ? 0
                    : Number(String(price).replace(/[^\d.]/g, ""));

            const base: any = {
                name: name.trim(),
                price: nPrice,
                category,
                imageUrl: urls[0],
                imageUrls: urls,
                sellerId: user.uid,
                createdAt: serverTimestamp(),
                type: typeSel,
                nameLower: name.trim().toLowerCase(),
                categoryLower: category.toLowerCase(),
                place,
                location: coords,
                status: "active",
                sold: false,
            };
            if (unit?.trim()) base.unit = unit.trim();
            if (pack?.toString().trim()) base.typicalPackSize = pack;
            if (typeSel === "lease" || typeSel === "service") {
                base.rate = rate.trim();
                base.billingUnit = billingUnit.trim();
            }

            if (typeSel === "tree") {
                const uc = useCaseTip.trim();
                if (uc) {
                    base.useCase = uc;
                    base.useCaseLower = uc.toLowerCase();
                }
            }
            await setDoc(prodRef, base);
            onCreated({ id: docId, ...base } as Product);
            setSaving(false);
            onClose();
        } catch (e: any) {
            console.error(e);
            setSaving(false);
            alert(e?.message || "Failed to post. Please try again.");
        }
    }, [photos, name, category, typeSel, rate, billingUnit, price, unit, pack, coords, placeText, useCaseTip, onCreated, onClose]);

    if (!open) return null;

    return (
        <div aria-label="Sell sheet" className="fixed inset-0 z-50">
            {/* backdrop */}
            <button
                onClick={() => !saving && onClose()}
                className="absolute inset-0 bg-black/40"
                aria-label="Close"
            />

            {/* sheet */}
            <div
                className="absolute inset-x-0 bottom-0 bg-white border-t border-gray-200 rounded-t-2xl p-4 h-[80vh] flex flex-col"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <div className="text-base font-black text-gray-900">Sell on Ekari Market</div>
                    <button
                        onClick={() => !saving && onClose()}
                        disabled={saving}
                        className="w-10 h-10 grid place-items-center rounded-full hover:bg-gray-50 disabled:opacity-50"
                        aria-label="Close"
                    >
                        <IoClose size={20} />
                    </button>
                </div>

                {/* Stepper */}
                <div className="flex items-center gap-2 mb-2">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${i <= step ? "bg-emerald-700" : "bg-gray-200"}`}
                        />
                    ))}
                    <div className="ml-2 font-bold text-gray-800">
                        {step === 0 && "Type"}
                        {step === 1 &&
                            (DIRECT_NAME_TYPES.includes(typeSel)
                                ? "Item"
                                : "Category & Item")}
                        {step === 2 && "Pack & Unit"}
                        {step === 3 &&
                            (typeSel === "lease" || typeSel === "service"
                                ? "Rate & Billing"
                                : "Price")}
                        {step === 4 && "Photos & Location • Review"}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto pr-1 mt-2">
                    {/* Step 0: Type */}
                    {step === 0 && (
                        <div>
                            <label className="text-xs font-extrabold text-gray-500">
                                What are you selling?
                            </label>
                            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                                {TYPE_OPTIONS.map((t) => {
                                    const active = t === typeSel;
                                    return (
                                        <button
                                            key={t}
                                            onClick={() => {
                                                setTypeSel(t);
                                                setName("");
                                                setUseCaseTip("");
                                            }}
                                            className={`shrink-0 px-3 py-2 rounded-full border text-sm font-bold ${active
                                                ? "bg-emerald-800 text-white border-emerald-800"
                                                : "bg-gray-50 text-gray-900 border-gray-200"
                                                }`}
                                        >
                                            {t.charAt(0).toUpperCase() + t.slice(1)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Step 1: Name-first (product/animal/lease/tree) OR old Category+Item (service) */}
                    {step === 1 && (
                        <div>
                            {DIRECT_NAME_TYPES.includes(typeSel) ? (
                                <>
                                    <label className="text-xs font-extrabold text-gray-500">
                                        What exactly are you selling?
                                    </label>
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
                                        className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-3 outline-none"
                                    />

                                    {/* Auto category hint (for all DIRECT_NAME_TYPES) */}
                                    {category && (
                                        <div className="mt-1 text-xs text-gray-500">
                                            We’ll list this under{" "}
                                            <span className="font-semibold text-gray-800">
                                                {category}
                                            </span>{" "}
                                            so buyers can find it easily.
                                        </div>
                                    )}

                                    {/* 🌱 Tree use-case chip right under the name */}
                                    {typeSel === "tree" && useCaseTip && (
                                        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1">
                                            <span className="text-[11px] font-black text-emerald-900">
                                                Use-case
                                            </span>
                                            <span className="text-[11px] text-emerald-800 truncate max-w-[220px]">
                                                {useCaseTip}
                                            </span>
                                        </div>
                                    )}

                                    {/* Autosuggest list for names */}
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
                                </>
                            ) : (
                                <>
                                    {/* Service: keep old Category + Item flow */}
                                    <label className="text-xs font-extrabold text-gray-500">
                                        Category
                                    </label>
                                    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                                        {categoriesForType.map((c) => {
                                            const active = c === category;
                                            return (
                                                <button
                                                    key={c}
                                                    onClick={() => setCategory(c)}
                                                    className={`shrink-0 px-3 py-2 rounded-full border text-sm font-bold ${active
                                                        ? "bg-emerald-800 text-white border-emerald-800"
                                                        : "bg-gray-50 text-gray-900 border-gray-200"
                                                        }`}
                                                >
                                                    {c}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <label className="block mt-3 text-xs font-extrabold text-gray-500">
                                        Item
                                    </label>
                                    <input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder={
                                            (productsFor(typeSel, category)[0] &&
                                                `e.g. ${productsFor(typeSel, category)[0]}`) ||
                                            "Type or pick from catalog"
                                        }
                                        className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-3 outline-none"
                                    />
                                    {catalogItems.length > 0 && (
                                        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                                            {catalogItems.slice(0, 60).map((it) => (
                                                <button
                                                    key={it}
                                                    onClick={() => setName(it)}
                                                    className="shrink-0 px-3 py-2 rounded-full border text-sm font-bold bg-gray-50 text-gray-900 border-gray-200"
                                                >
                                                    {it}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}


                    {/* Step 2: Pack & Unit (products only; still hidden for lease/service) */}
                    {step === 2 && typeSel !== "lease" && typeSel !== "service" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-extrabold text-gray-500">
                                    Typical pack size
                                </label>
                                <input
                                    value={String(pack || "")}
                                    onChange={(e) => setPack(e.target.value)}
                                    placeholder="e.g. 50"
                                    inputMode="numeric"
                                    className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-3 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-extrabold text-gray-500">
                                    Unit
                                </label>
                                <input
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value)}
                                    placeholder={
                                        firstString(unitsFor(name)) ??
                                        "kg / bag / carton / head"
                                    }
                                    className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-3 outline-none"
                                />
                                {unitsitems.length > 0 && (
                                    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                                        {unitsitems.slice(0, 20).map((u) => (
                                            <button
                                                key={u}
                                                onClick={() => setUnit(u)}
                                                className="shrink-0 px-3 py-2 rounded-full border text-sm font-bold bg-gray-50 text-gray-900 border-gray-200"
                                            >
                                                {u}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Price or Rate/Billing */}
                    {step === 3 && (
                        <>
                            {typeSel === "lease" || typeSel === "service" ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-extrabold text-gray-500">
                                            Rate
                                        </label>
                                        <input
                                            value={rate}
                                            onChange={(e) => setRate(e.target.value)}
                                            placeholder="e.g. 1500"
                                            inputMode="numeric"
                                            className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-3 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-extrabold text-gray-500">
                                            Billing unit
                                        </label>
                                        <input
                                            value={billingUnit}
                                            onChange={(e) => setBillingUnit(e.target.value)}
                                            placeholder="e.g. per hour / per acre / per visit"
                                            className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-3 outline-none"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="text-xs font-extrabold text-gray-500">
                                        Price (KES)
                                    </label>
                                    <input
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        placeholder="e.g. 250"
                                        inputMode="numeric"
                                        className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-3 outline-none"
                                    />
                                </div>
                            )}
                        </>
                    )}

                    {/* Step 4: Photos + Location + Review */}
                    {step === 4 && (
                        <div className="space-y-4">
                            {/* Photos */}
                            <div>
                                <label className="text-xs font-extrabold text-gray-500">Photos</label>
                                <div className="mt-2 flex items-center gap-3">
                                    {photos.length < 5 && (
                                        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                                            <IoImagesOutline size={18} className="text-gray-600" />
                                            <span className="text-sm font-semibold text-gray-800">
                                                Choose images (max 5)
                                            </span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                hidden
                                                onChange={(e) => onPickFiles(e.target.files)}
                                            />
                                        </label>
                                    )}
                                    <div className="text-xs text-gray-500">{photos.length}/5 selected</div>
                                </div>

                                {photos.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-3">
                                        {photos.map((p, idx) => (
                                            <div key={p.url} className="relative w-24 h-24">
                                                <img
                                                    src={p.url}
                                                    alt=""
                                                    className="w-full h-full object-cover rounded-xl border border-gray-200"
                                                />
                                                <button
                                                    onClick={() => removeImg(idx)}
                                                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 grid place-items-center"
                                                    aria-label="Remove"
                                                >
                                                    <IoClose size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Location */}
                            <div>
                                <label className="text-xs font-extrabold text-gray-500">
                                    Where is the product?
                                </label>

                                <div className="mt-2 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                                    <button
                                        onClick={() => {
                                            setCandidateText(placeText || "");
                                            setCandidateCenter(
                                                coords || {
                                                    latitude: -1.286389,
                                                    longitude: 36.817223, // Nairobi default
                                                }
                                            );
                                            setLocModalOpen(true);
                                        }}
                                        className="h-11 px-3 rounded-xl border border-gray-200 hover:bg-gray-50 inline-flex items-center gap-2"
                                    >
                                        <IoMap size={18} />
                                        <span className="font-semibold">Add location</span>
                                    </button>
                                </div>

                                {!!coords && (
                                    <div className="mt-1 text-xs text-gray-500">
                                        Coords: {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
                                    </div>
                                )}

                                {!!placeText && (
                                    <div className="mt-1 text-xs text-gray-600">
                                        Place: {placeText}
                                    </div>
                                )}
                            </div>

                            {/* Review */}
                            <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                                <div className="font-black text-gray-900 mb-1">Review</div>
                                <div className="space-y-1 text-sm">
                                    <div>
                                        <span className="font-bold text-gray-500">Type:</span> {typeSel}
                                    </div>
                                    <div>
                                        <span className="font-bold text-gray-500">Category:</span>{" "}
                                        {category || "-"}
                                    </div>
                                    <div>
                                        <span className="font-bold text-gray-500">Item:</span>{" "}
                                        {name || "-"}
                                    </div>
                                    {typeSel === "tree" && useCaseTip && (
                                        <div>
                                            <span className="font-bold text-gray-500">Use-case tips:</span>{" "}
                                            {useCaseTip}
                                        </div>
                                    )}
                                    <div>
                                        <span className="font-bold text-gray-500">Pack/Unit:</span>{" "}
                                        {pack || "-"} {unit || ""}
                                    </div>
                                    {typeSel === "lease" || typeSel === "service" ? (
                                        <div>
                                            <span className="font-bold text-gray-500">Rate:</span>{" "}
                                            {rate || "-"} ({billingUnit || "-"})
                                        </div>
                                    ) : (
                                        <div>
                                            <span className="font-bold text-gray-500">Price:</span>{" "}
                                            {price
                                                ? KES(Number(price.replace(/[^\d]/g, "")) || 0)
                                                : "-"}
                                        </div>
                                    )}
                                    <div>
                                        <span className="font-bold text-gray-500">Photos:</span>{" "}
                                        {photos.length}/5
                                    </div>
                                    <div>
                                        <span className="font-bold text-gray-500">Location:</span>{" "}
                                        {placeText || "-"}
                                    </div>
                                    <div>
                                        <span className="font-bold text-gray-500">Coords:</span>{" "}
                                        {coords
                                            ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
                                            : "-"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer nav */}
                <div className="mt-3 mb-4 flex items-center justify-between gap-3">
                    <button
                        onClick={onBack}
                        disabled={step === 0 || saving}
                        className={`h-11 px-4 rounded-xl border font-bold inline-flex items-center gap-2 ${step === 0
                            ? "text-gray-400 border-gray-200"
                            : "text-gray-800 border-gray-200 hover:bg-gray-50"
                            } disabled:opacity-60`}
                    >
                        <IoChevronBack />
                        Back
                    </button>

                    {step < 4 ? (
                        <button
                            onClick={onNext}
                            disabled={!canNext || saving}
                            className="h-11 px-5 rounded-xl font-black inline-flex items-center gap-2 text-white disabled:opacity-60"
                            style={{ backgroundColor: canNext ? EKARI.gold : "#9CA3AF" }}
                        >
                            Next
                            <IoChevronForward />
                        </button>
                    ) : (
                        <button
                            onClick={createProduct}
                            disabled={saving}
                            className="h-11 px-5 rounded-xl text-white font-black inline-flex items-center gap-2 disabled:opacity-60 hover:opacity-90"
                            style={{ backgroundColor: EKARI.gold }}
                        >
                            {saving ? (
                                <span>Saving…</span>
                            ) : (
                                <>
                                    <IoCheckmarkDone />
                                    Finish
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Nested Location Picker */}
            {locModalOpen && (
                <LocationPickerModal
                    initialText={candidateText}
                    initialCenter={
                        candidateCenter || {
                            latitude: -1.286389,
                            longitude: 36.817223,
                        }
                    }
                    onCancel={() => setLocModalOpen(false)}
                    onUse={(text, center) => {
                        setPlaceText(text);
                        setCoords(center);
                        setLocModalOpen(false);
                    }}
                />
            )}
        </div>
    );
}
