"use client";

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    collection,
    doc,
    serverTimestamp,
    setDoc,
    getFirestore,
    onSnapshot,
    orderBy,
    query,
    getDocs,
    where,
} from "firebase/firestore";
import {
    getStorage,
    ref as sRef,
    uploadBytes,
    getDownloadURL,
} from "firebase/storage";
import { getAuth } from "firebase/auth";
// We only keep the type from your local catalog file
import type { MarketType } from "@/utils/market_master_catalog";
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
import { createPortal } from "react-dom";
import clsx from "clsx";
import { ConfirmModal } from "./ConfirmModal";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db } from "@/lib/firebase";
import { ListingLimitDialogSimple } from "./ListingLimitDialog";

/* ================= Theme ================= */
const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
};


type UIConfirmState = {
    open: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string | null;
    onConfirm?: () => void;
};

function useConfirmUI() {
    const [state, setState] = React.useState<UIConfirmState>({
        open: false,
        title: "Notice",
        message: "",
        confirmText: "OK",
        cancelText: null,
    });

    const close = React.useCallback(() => {
        setState((s) => ({ ...s, open: false, onConfirm: undefined }));
    }, []);

    const alert = React.useCallback(
        (message: string, opts?: { title?: string; okText?: string }) => {
            setState({
                open: true,
                title: opts?.title ?? "Notice",
                message,
                confirmText: opts?.okText ?? "OK",
                cancelText: null,
                onConfirm: close,
            });
        },
        [close]
    );

    const confirm = React.useCallback(
        (
            message: string,
            onConfirm: () => void,
            opts?: { title?: string; confirmText?: string; cancelText?: string }
        ) => {
            setState({
                open: true,
                title: opts?.title ?? "Are you sure?",
                message,
                confirmText: opts?.confirmText ?? "Yes, continue",
                cancelText: opts?.cancelText ?? "Cancel",
                onConfirm: () => {
                    close();
                    onConfirm();
                },
            });
        },
        [close]
    );

    const modal = (
        <ConfirmModal
            open={state.open}
            title={state.title}
            message={state.message}
            confirmText={state.confirmText}
            cancelText={state.cancelText}
            onCancel={close}
            onConfirm={state.onConfirm ?? close}
        />
    );

    return { alert, confirm, modal, close };
}

const DIRECT_NAME_TYPES: MarketType[] = ["product", "animal", "lease", "tree", "arableLand"];
const ARABLE_LAND_TYPE = "arableLand";
type VerificationStatus = "none" | "pending" | "approved" | "rejected";
/* ===== Types for Firestore catalog ===== */
type CurrencyCode = "KES" | "USD";

const USD = (n: number) =>
    "USD " + (n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

function formatPriceForReview(raw: string, currency: CurrencyCode): string {
    const n = Number(String(raw).replace(/[^\d.]/g, "")) || 0;
    if (!n) return "-";
    return currency === "USD" ? USD(n) : KES(n);
}
type MarketTypeDoc = {
    id: MarketType;
    label: string;
    description?: string;
    iconName?: string;
    order?: number;
    active?: boolean;
};

type MarketCategoryDoc = {
    id: string;
    typeId: MarketType;
    name: string;
    description?: string;
    order?: number;
    active?: boolean;
};

type MarketItemDoc = {
    id: string;
    type: MarketType;
    category: string;
    description?: string;
    subCategory?: string | null;
    name: string;
    variety?: string | null;
    form?: string | null;
    useCase?: string | null;
    typicalPackSize?: string | number | null;
    unit?: string | null;
    grade?: string | null;
    extras?: Record<string, string>;
    active?: boolean;
};

type UseMarketCatalogResult = {
    types: MarketTypeDoc[];
    categories: MarketCategoryDoc[];
    items: MarketItemDoc[];
    loading: boolean;
    error?: string;
};
type BillingCycle = "monthly" | "yearly";

type PackageDoc = {
    id: string;
    name: string;
    target: string;
    priceMonthlyUsd: number;
    yearlyDiscountPct?: number;
    priceYearlyUsd: number;
    activeListingsLimit: number | null;
    recommended?: boolean;
    priorityRanking: boolean;
    topOfSearch: boolean;
    verifiedBadge: boolean;
    storefront: boolean;
    analyticsLevel: "none" | "basic" | "advanced";
    monthlyBoostCredits: number;
    weeklyFeaturedCredits: number;
    status: "active" | "disabled";
    features: string[];
    sortOrder: number;
};

type SellerSubscription = {
    packageId: string;
    billingCycle: BillingCycle;
    status: "active" | "trialing" | "expired" | "canceled";
    currentPeriodEnd?: any;
    credits?: {
        boostMonthKey?: string;
        featuredWeekKey?: string;
        boostCreditsRemaining?: number;
        featuredCreditsRemaining?: number;
    };
    boostCreditsRemaining?: number;
    featuredCreditsRemaining?: number;
};

function isSubActive(sub: SellerSubscription | null) {
    return sub?.status === "active";
}
/* ===== Hook: fetch catalog from Firestore ===== */
function sanitizeDescription(raw: unknown): string | null {
    let text = (raw ?? "").toString().trim();
    if (!text) return null;

    // 1) Remove emails
    text = text.replace(
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
        ""
    );

    // 2) Remove WhatsApp labels + following number chunk (best-effort)
    // e.g. "WhatsApp: +254712345678" / "wa 0712345678"
    text = text.replace(
        /\b(whatsapp|whats\s*app|wa)\b\s*[:\-]?\s*(\+?\d[\d\s\-().]{6,}\d)/gi,
        ""
    );

    // 3) Remove phone-like numbers (handles +254..., 254..., 07..., 01..., etc.)
    // This targets sequences that are likely contact numbers (7+ digits total).
    text = text.replace(
        /(?<!\w)(?:\+?\d{1,3}[\s\-().]?)?(?:\d[\s\-().]?){7,}\d(?!\w)/g,
        ""
    );

    // 4) Clean up extra spaces / punctuation leftovers
    text = text
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\s+([,.;:!?])/g, "$1")
        .replace(/([,.;:!?]){2,}/g, "$1")
        .trim();

    return text || null;
}


function useMarketCatalog(): UseMarketCatalogResult {
    const [types, setTypes] = useState<MarketTypeDoc[]>([]);
    const [categories, setCategories] = useState<MarketCategoryDoc[]>([]);
    const [items, setItems] = useState<MarketItemDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | undefined>();

    useEffect(() => {
        const db = getFirestore();
        const qTypes = query(
            collection(db, "market_types"),
            orderBy("order", "asc")
        );
        const unsub = onSnapshot(
            qTypes,
            (snap) => {
                const list: MarketTypeDoc[] = [];
                snap.forEach((d) => list.push(d.data() as MarketTypeDoc));
                setTypes(list.filter((t) => t.active !== false));
            },
            (err) => {
                console.error("market_types error", err);
                setError("Failed to load market types");
            }
        );
        return () => unsub();
    }, []);

    useEffect(() => {
        const db = getFirestore();
        const qCats = query(
            collection(db, "market_categories"),
            orderBy("order", "asc")
        );
        const unsub = onSnapshot(
            qCats,
            (snap) => {
                const list: MarketCategoryDoc[] = [];
                snap.forEach((d) => list.push(d.data() as MarketCategoryDoc));
                setCategories(list.filter((c) => c.active !== false));
            },
            (err) => {
                console.error("market_categories error", err);
                setError("Failed to load market categories");
            }
        );
        return () => unsub();
    }, []);

    useEffect(() => {
        const db = getFirestore();
        const qItems = query(
            collection(db, "market_items"),
            orderBy("nameLower", "asc")
        );
        const unsub = onSnapshot(
            qItems,
            (snap) => {
                const list: MarketItemDoc[] = [];
                snap.forEach((d) => list.push(d.data() as MarketItemDoc));
                setItems(list.filter((i) => i.active !== false));
                setLoading(false);
            },
            (err) => {
                console.error("market_items error", err);
                setError("Failed to load market items");
                setLoading(false);
            }
        );
        return () => unsub();
    }, []);

    return { types, categories, items, loading, error };
}
type SubDoc = SellerSubscription & {
    entitlements?: { activeListingsLimit?: number | null };
    activeListingsCount?: number; // mirror
};

function getActiveLimitForClient(sub: SubDoc | null) {
    const FREE_TIER_LIMIT = 3;

    const active = isSubActive(sub);

    if (!active) return FREE_TIER_LIMIT;

    // IMPORTANT: preserve null (null => unlimited)
    const limit = sub?.entitlements?.activeListingsLimit;

    // If it's explicitly null -> unlimited
    if (limit === null) return null;

    // If it's a valid number -> use it
    if (typeof limit === "number" && Number.isFinite(limit) && limit >= 0) return limit;

    // If missing/undefined/invalid -> safest default (pick what you prefer)
    // Option A: treat missing as 0 (no listings)
    return 0;

    // Option B (alternative): treat missing as FREE tier
    // return FREE_TIER_LIMIT;
}

function getRemainingSlots(sub: SubDoc | null) {
    const limit = getActiveLimitForClient(sub);

    const used = Number.isFinite((sub as any)?.activeListingsCount)
        ? Math.max(0, Number((sub as any).activeListingsCount))
        : 0;

    if (limit === null) {
        return { limit: null as null, used, remaining: null as null, reached: false };
    }

    const remaining = Math.max(0, limit - used);
    return { limit, used, remaining, reached: remaining <= 0 };
}


/* ===== Helpers from catalog (Firestore-based) ===== */

const norm = (s?: string | null) => (s || "").trim().toLowerCase();

/** All unique names for a given type (product/animal/lease/tree) */
function namesForTypeFromItems(t: MarketType, items: MarketItemDoc[]): string[] {
    return Array.from(
        new Set(
            items
                .filter((r) => r.type === t)
                .map((r) => r.name?.trim())
                .filter(Boolean) as string[]
        )
    ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/** Find the catalog row for (type, name) so we can pull category + useCase, etc */
function findCatalogRowFromItems(
    type: MarketType,
    name: string,
    items: MarketItemDoc[]
): MarketItemDoc | undefined {
    const n = norm(name);
    return items.find(
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
function usd(n: number) {
    return `USD ${n.toLocaleString("en-US")}`;
}
function kes(n: number) {
    return `KES ${Math.round(n).toLocaleString("en-KE")}`;
}

function tierPill(name: string) {
    const n = (name || "").toLowerCase();
    if (n.includes("silver")) return { bg: "#F3F4F6", fg: "#111827", ring: "#E5E7EB" };
    if (n.includes("gold")) return { bg: "#FFF7ED", fg: "#9A3412", ring: "#FED7AA" };
    if (n.includes("platinum")) return { bg: "#EEF2FF", fg: "#3730A3", ring: "#C7D2FE" };
    return { bg: "#F8FAFC", fg: "#0F172A", ring: "#E2E8F0" };
}
function pickAccent(name: string) {
    const n = (name || "").toLowerCase();
    if (n.includes("platinum")) return { accent: "#4F46E5", soft: "#EEF2FF", ring: "#C7D2FE" };
    if (n.includes("gold")) return { accent: EKARI.gold, soft: "#FFF7ED", ring: "#FED7AA" };
    if (n.includes("silver")) return { accent: "#64748B", soft: "#F1F5F9", ring: "#E2E8F0" };
    return { accent: EKARI.forest, soft: "#ECFDF5", ring: "#BBF7D0" };
}
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


function pruneUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
    const out: any = {};
    Object.keys(obj).forEach((k) => {
        if (obj[k] !== undefined) out[k] = obj[k];
    });
    return out;
}

function buildAuthorBadge(userProfile: any) {
    const v = userProfile?.verification ?? {};

    const statusRaw = String(v.status ?? "none").toLowerCase();
    const typeRaw = String(v.verificationType ?? "individual").toLowerCase();

    const status = (["approved", "pending", "rejected", "none"] as const).includes(
        statusRaw as any
    )
        ? (statusRaw as "approved" | "pending" | "rejected" | "none")
        : "none";

    const type = (["individual", "business", "company", "organization"] as const).includes(
        typeRaw as any
    )
        ? (typeRaw as "individual" | "business" | "company" | "organization")
        : "individual";

    const roleLabel = typeof v.roleLabel === "string" && v.roleLabel.trim()
        ? v.roleLabel.trim()
        : null;

    const orgName =
        (type === "business" || type === "company" || type === "organization") &&
            typeof v.organizationName === "string" &&
            v.organizationName.trim()
            ? v.organizationName.trim()
            : null;

    return pruneUndefined({
        verificationStatus: status,
        verificationType: type,
        verificationRoleLabel: roleLabel,
        verificationOrganizationName: orgName,
    });
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
    const ui = useConfirmUI();

    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const [mapType, setMapType] = React.useState<"roadmap" | "hybrid">("roadmap");
    const [locating, setLocating] = React.useState(false);

    const [text, setText] = React.useState(initialText || "");
    const [center, setCenter] = React.useState(initialCenter);

    // NEW: map + marker refs
    const mapDivRef = React.useRef<HTMLDivElement | null>(null);
    const mapRef = React.useRef<any>(null);
    const markerRef = React.useRef<any>(null);

    // ---------- Places autocomplete ----------
    // When center changes (marker drag / map click / programmatic),
    // look up a human-readable place and fill the input.
    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (!center) return;
            const g = await loadGoogleMaps(apiKey);
            if (!g) return;

            const geocoder = new g.maps.Geocoder();
            geocoder.geocode(
                {
                    location: {
                        lat: center.latitude,
                        lng: center.longitude,
                    },
                },
                (results, status) => {
                    if (cancelled) return;

                    if (status === "OK" && results && results[0]) {
                        const label =
                            results[0].formatted_address ??
                            `${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}`;

                        setText(label); // ✅ input will show this
                    } else {
                        const fallback = `${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}`;
                        setText(fallback);
                    }
                }
            );
        })();

        return () => {
            cancelled = true;
        };
    }, [center.latitude, center.longitude, apiKey]);


    // ---------- Map + draggable marker setup ----------
    useEffect(() => {
        if (!apiKey) return;
        let cancelled = false;

        (async () => {
            const g = await loadGoogleMaps(apiKey);
            if (cancelled || !g || !mapDivRef.current) return;

            if (!mapRef.current) {
                // create map
                mapRef.current = new g.maps.Map(mapDivRef.current, {
                    center: { lat: center.latitude, lng: center.longitude },
                    zoom: 14,
                    disableDefaultUI: true,
                    mapTypeControl: true,
                    streetViewControl: true,
                    zoomControl: true,
                    fullscreenControl: false,
                    mapTypeId: g.maps.MapTypeId.ROADMAP, // 👈 add
                });

                // create draggable marker at center
                markerRef.current = new g.maps.Marker({
                    position: { lat: center.latitude, lng: center.longitude },
                    map: mapRef.current,
                    draggable: true,
                });

                // clicking map moves marker
                g.maps.event.addListener(
                    mapRef.current,
                    "click",
                    (e: google.maps.MapMouseEvent) => {
                        const lat = e.latLng?.lat();
                        const lng = e.latLng?.lng();
                        if (lat == null || lng == null) return;
                        setCenter({ latitude: lat, longitude: lng });
                    }
                );

                // dragging marker updates center
                g.maps.event.addListener(
                    markerRef.current,
                    "dragend",
                    (e: google.maps.MapMouseEvent) => {
                        const lat = e.latLng?.lat();
                        const lng = e.latLng?.lng();
                        if (lat == null || lng == null) return;
                        setCenter({ latitude: lat, longitude: lng });
                    }
                );
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [apiKey, center.latitude, center.longitude]);

    // Keep map + marker in sync when `center` changes from outside (search, etc.)
    useEffect(() => {
        const map = mapRef.current;
        const marker = markerRef.current;
        if (!map || !marker) return;

        const pos = { lat: center.latitude, lng: center.longitude };
        marker.setPosition(pos);
        map.setCenter(pos);
    }, [center.latitude, center.longitude]);
    useEffect(() => {
        if (!apiKey) return;

        let alive = true;

        (async () => {
            const g = await loadGoogleMaps(apiKey);
            if (!alive || !g || !inputRef.current || !mapRef.current) return;

            // Make sure "places" library is loaded by loadGoogleMaps()
            if (!g.maps.places?.Autocomplete) {
                console.error("Google Maps Places library not loaded. Ensure libraries=places");
                return;
            }

            const ac = new g.maps.places.Autocomplete(inputRef.current, {
                fields: ["geometry", "name", "formatted_address"],
                types: ["geocode"],
            });

            ac.bindTo("bounds", mapRef.current);

            ac.addListener("place_changed", () => {
                const place = ac.getPlace();
                const loc = place?.geometry?.location;
                if (!loc) return;

                const lat = loc.lat();
                const lng = loc.lng();

                // Update center -> marker + map sync effect will kick in
                setCenter({ latitude: lat, longitude: lng });

                // Update the text to what user picked
                setText(place.formatted_address || place.name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
            });
        })();

        return () => {
            alive = false;
        };
    }, [apiKey]);
    const handleUseMyLocation = async () => {
        if (!navigator.geolocation) {
            ui.alert("Geolocation is not supported by your browser.");
            return;
        }

        setLocating(true);

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;

                setCenter({ latitude: lat, longitude: lng });

                try {
                    const g = await loadGoogleMaps(apiKey);
                    if (!g) return;

                    const geocoder = new g.maps.Geocoder();
                    geocoder.geocode(
                        { location: { lat, lng } },
                        (results, status) => {
                            if (status === "OK" && results && results[0]) {
                                setText(results[0].formatted_address);
                            } else {
                                setText(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
                            }
                        }
                    );
                } finally {
                    setLocating(false);
                }
            },
            (err) => {
                setLocating(false);
                if (err.code === err.PERMISSION_DENIED) {
                    ui.alert("Location permission denied.");
                } else {
                    ui.alert("Unable to retrieve your location.");
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        );
    };

    return (
        <div className="fixed inset-0 z-[60]">
            <button
                onClick={onCancel}
                className="absolute inset-0 bg-black/50"
                aria-label="Close"
            />
            <div className="absolute inset-x-0 bottom-0 bg-white border-t border-gray-200 rounded-t-2xl p-4 max-h-[95vh] overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                    <div className="text-base font-black text-gray-900">Add Location</div>
                    <button
                        onClick={onCancel}
                        className="w-10 h-10 grid place-items-center rounded-full hover:bg-gray-50"
                        aria-label="Close"
                    >
                        <IoClose size={20} />
                    </button>
                </div>

                <div
                    className="overflow-y-auto pr-1 space-y-3"
                    style={{ maxHeight: "80vh" }}
                >
                    <div className="flex justify-between items-center w-full gap-2">
                        <div className="relative flex-1">
                            <input
                                ref={inputRef}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Search address or place"
                                className="h-11 w-full rounded-xl border border-gray-200 px-3 outline-none"
                            />

                            <IoSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        </div>
                        <div className="flex">
                            <button
                                type="button"
                                onClick={handleUseMyLocation}
                                disabled={locating}
                                className="mt-2 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                                📍 {locating ? "Locating…" : "Use my GPS location"}
                            </button>
                        </div>
                    </div>
                    <div>
                        <div className="text-xs font-extrabold text-gray-500 mb-1">
                            Tap the map or drag marker
                        </div>

                        {/* MAP WITH DRAGGABLE MARKER */}
                        <div
                            ref={mapDivRef}
                            className="w-full rounded-xl overflow-hidden border border-gray-200"
                            style={{ height: 300 }}
                        />

                        <div className="mt-1 text-xs text-gray-500">
                            Selected: {center.latitude.toFixed(5)},{" "}
                            {center.longitude.toFixed(5)}
                        </div>
                    </div>
                </div>

                <div className="mt-3 mb-[60px] flex items-center justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="h-10 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 font-semibold"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            if (!text.trim()) {
                                ui.alert("Enter a place name or search an address.");
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
            {ui.modal}
        </div>
    );
}

/* ================= Land Polygon Picker Modal (for arable land) ================= */
function LandPolygonPickerModal({
    initialCenter,
    initialPolygon,
    onCancel,
    onUse,
}: {
    initialCenter: { latitude: number; longitude: number };
    initialPolygon: { lat: number; lng: number }[];
    onCancel: () => void;
    onUse: (payload: {
        text: string,
        center: { latitude: number; longitude: number };
        polygon: { lat: number; lng: number }[];
    }) => void;
}) {
    const ui = useConfirmUI();

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const mapDivRef = React.useRef<HTMLDivElement | null>(null);
    const mapRef = React.useRef<google.maps.Map | null>(null);
    const polygonRef = React.useRef<google.maps.Polygon | null>(null);
    const polylineRef = React.useRef<google.maps.Polyline | null>(null);

    const vertexMarkersRef = React.useRef<google.maps.Marker[]>([]);
    const centerMarkerRef = React.useRef<google.maps.Marker | null>(null); // 👈 center marker
    const searchInputRef = React.useRef<HTMLInputElement | null>(null);

    const [points, setPoints] = React.useState<{ lat: number; lng: number }[]>(
        initialPolygon || []
    );
    const [mapType, setMapType] = React.useState<"roadmap" | "hybrid">("hybrid");
    const [centerPos, setCenterPos] = React.useState<{ lat: number; lng: number }>({
        lat: initialCenter.latitude,
        lng: initialCenter.longitude,
    });

    const [centerLabel, setCenterLabel] = React.useState<string>("");

    // Keep a ref of points for map listeners
    const pointsRef = React.useRef(points);
    React.useEffect(() => {
        pointsRef.current = points;
    }, [points]);

    // Drawing is OFF by default
    const [drawEnabled, setDrawEnabled] = React.useState(false);
    const drawEnabledRef = React.useRef(false);
    React.useEffect(() => {
        drawEnabledRef.current = drawEnabled;
    }, [drawEnabled]);

    // manual lat/lng + google link
    const [latInput, setLatInput] = React.useState("");
    const [lngInput, setLngInput] = React.useState("");
    const [gmapsUrl, setGmapsUrl] = React.useState("");
    const [showAdvanced, setShowAdvanced] = React.useState(false);
    const [locating, setLocating] = React.useState(false);

    const initialCenterRef = React.useRef(initialCenter);

    // helper: go to lat/lng on map, optionally drop a boundary point
    const panToLatLng = React.useCallback(
        (lat: number, lng: number, addPoint: boolean = true) => {
            if (!mapRef.current) return;
            const pos = { lat, lng };

            mapRef.current.panTo(pos);
            mapRef.current.setZoom(17);

            // 👇 update center marker
            if (centerMarkerRef.current) {
                centerMarkerRef.current.setPosition(pos);
                centerMarkerRef.current.setMap(mapRef.current);
            }

            // 👇 save center + inputs
            setCenterPos(pos);
            setLatInput(lat.toFixed(6));
            setLngInput(lng.toFixed(6));

            if (addPoint && drawEnabledRef.current) {
                setPoints((prev) => [...prev, pos]);
            }
        },
        []
    );


    // Init map + click to add points + smooth mousemove rubber band
    React.useEffect(() => {
        let alive = true;
        (async () => {
            const g = await loadGoogleMaps(apiKey);
            if (!alive || !g || !mapDivRef.current) return;

            if (!mapRef.current) {
                const centerPos = {
                    lat: initialCenter.latitude,
                    lng: initialCenter.longitude,
                };

                mapRef.current = new g.maps.Map(mapDivRef.current!, {
                    center: centerPos,
                    zoom: 13,
                    disableDefaultUI: true,
                    mapTypeControl: true,
                    // zoomControl: true,
                    fullscreenControl: false,
                    mapTypeId: g.maps.MapTypeId.HYBRID,
                    draggableCursor: "grab",
                    draggingCursor: "grabbing",
                });

                // 👇 create center marker at initial center
                // 👇 create draggable center marker at initial center
                centerMarkerRef.current = new g.maps.Marker({
                    position: centerPos,
                    map: mapRef.current,
                    clickable: true,
                    draggable: true,
                });

                // When marker is dragged, recenter map + update inputs (no polygon point)
                g.maps.event.addListener(centerMarkerRef.current, "dragend", () => {
                    const pos = centerMarkerRef.current!.getPosition();
                    if (!pos || !mapRef.current) return;

                    const lat = pos.lat();
                    const lng = pos.lng();

                    // center map there
                    mapRef.current.panTo({ lat, lng });

                    // update manual coord inputs so user can see the exact numbers
                    setLatInput(lat.toFixed(6));
                    setLngInput(lng.toFixed(6));
                });


                // CLICK: add vertex when in DRAW mode
                mapRef.current.addListener(
                    "click",
                    (e: google.maps.MapMouseEvent) => {
                        if (!e.latLng || !drawEnabledRef.current) return;
                        const lat = e.latLng.lat();
                        const lng = e.latLng.lng();
                        setPoints((prev) => [...prev, { lat, lng }]);
                    }
                );

                // MOUSEMOVE rubber-band segment in DRAW mode
                mapRef.current.addListener(
                    "mousemove",
                    (e: google.maps.MapMouseEvent) => {
                        if (!e.latLng) return;
                        if (!drawEnabledRef.current) return;
                        if (!polylineRef.current) return;
                        const current = pointsRef.current;
                        if (!current.length) return;

                        const tempPath = [
                            ...current,
                            { lat: e.latLng.lat(), lng: e.latLng.lng() },
                        ];
                        polylineRef.current.setPath(tempPath);
                    }
                );

                // When mouse leaves map, revert polyline to real points
                mapRef.current.addListener("mouseout", () => {
                    if (!polylineRef.current) return;
                    const current = pointsRef.current;
                    polylineRef.current.setPath(current);
                });
            }
        })();
        return () => {
            alive = false;
        };
    }, [apiKey, initialCenter.latitude, initialCenter.longitude]);

    // Update cursors when DRAW/MOVE changes
    React.useEffect(() => {
        const g = (window as any).google as typeof google | undefined;
        if (!g || !mapRef.current) return;

        if (drawEnabled) {
            mapRef.current.setOptions({
                draggableCursor: "crosshair",
                draggingCursor: "crosshair",
            });
        } else {
            mapRef.current.setOptions({
                draggableCursor: "grab",
                draggingCursor: "grabbing",
            });
        }
    }, [drawEnabled]);

    // Google Places Autocomplete for search input
    React.useEffect(() => {
        let alive = true;
        (async () => {
            const g = await loadGoogleMaps(apiKey);
            if (!alive || !g || !searchInputRef.current || !mapRef.current) return;

            const ac = new g.maps.places.Autocomplete(searchInputRef.current, {
                fields: ["geometry", "name", "formatted_address"],
                types: ["geocode"],
            });

            ac.bindTo("bounds", mapRef.current);

            ac.addListener("place_changed", () => {
                const place = ac.getPlace();
                const loc = place?.geometry?.location;
                if (!loc) return;

                const pos = { lat: loc.lat(), lng: loc.lng() };

                mapRef.current!.panTo(pos);
                mapRef.current!.setZoom(16);

                // 👇 move center marker to searched place
                if (centerMarkerRef.current) {
                    centerMarkerRef.current.setPosition(pos);
                    centerMarkerRef.current.setMap(mapRef.current!);
                }
                // 👇 update center + inputs
                setCenterPos(pos);
                setLatInput(pos.lat.toFixed(6));
                setLngInput(pos.lng.toFixed(6));
            });
        })();
        return () => {
            alive = false;
        };
    }, [apiKey]);

    // React to mapType changes (MAP / SAT)
    React.useEffect(() => {
        const g = (window as any).google as typeof google | undefined;
        if (!g || !mapRef.current) return;

        mapRef.current.setMapTypeId(
            mapType === "hybrid" ? g.maps.MapTypeId.HYBRID : g.maps.MapTypeId.ROADMAP
        );
    }, [mapType]);

    // Update polyline + polygon + vertex markers when points change
    React.useEffect(() => {
        const g = (window as any).google as typeof google | undefined;
        if (!g || !mapRef.current) return;

        // Polyline for drawing path
        if (!polylineRef.current) {
            polylineRef.current = new g.maps.Polyline({
                map: mapRef.current,
                path: points,
                strokeColor: "#10B981",
                strokeOpacity: 0.9,
                strokeWeight: 2,
                clickable: false,
            });
        } else {
            polylineRef.current.setPath(points);
        }
        polylineRef.current.setMap(points.length > 0 ? mapRef.current : null);

        // Polygon fill when we have 3+ points
        if (!polygonRef.current) {
            polygonRef.current = new g.maps.Polygon({
                paths: points,
                strokeColor: "#10B981",
                strokeOpacity: 0.9,
                strokeWeight: 2,
                fillColor: "#10B981",
                fillOpacity: 0.18,
                clickable: false,
            });
        } else {
            polygonRef.current.setPath(points);
        }
        polygonRef.current.setMap(points.length >= 3 ? mapRef.current : null);

        // Vertex markers
        vertexMarkersRef.current.forEach((m) => m.setMap(null));
        vertexMarkersRef.current = [];

        if (points.length > 0) {
            points.forEach((p) => {
                const marker = new g.maps.Marker({
                    position: p,
                    map: mapRef.current!,
                    clickable: false,
                    icon: {
                        path: g.maps.SymbolPath.CIRCLE,
                        fillColor: "#10B981",
                        fillOpacity: 1,
                        strokeColor: "#ECFDF5",
                        strokeWeight: 2,
                        scale: 4,
                    },
                });
                vertexMarkersRef.current.push(marker);
            });
        }
    }, [points]);
    const handleUseMyLocation = () => {
        if (!navigator.geolocation) {
            ui.alert("Geolocation is not supported by your browser.");
            return;
        }

        setLocating(true);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;

                // Pan + move marker + update inputs (+ add polygon point if draw is ON)
                panToLatLng(lat, lng, true);

                setLocating(false);
            },
            (err) => {
                setLocating(false);

                if (err.code === err.PERMISSION_DENIED) {
                    ui.alert("Location permission denied.");
                } else if (err.code === err.TIMEOUT) {
                    ui.alert("Location request timed out. Try again.");
                } else {
                    ui.alert("Unable to retrieve your location.");
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        );
    };

    function handleUse() {
        if (points.length < 3) {
            ui.alert("Click at least three points on the map to outline the land.");
            return;
        }
        const sum = points.reduce(
            (acc, p) => {
                acc.lat += p.lat;
                acc.lng += p.lng;
                return acc;
            },
            { lat: 0, lng: 0 }
        );
        const centerLat = sum.lat / points.length;
        const centerLng = sum.lng / points.length;

        onUse({
            text: centerLabel,
            center: { latitude: centerLat, longitude: centerLng },
            polygon: points,
        });
    }

    // Map controls
    const handleZoomIn = () => {
        if (!mapRef.current) return;
        const cur = mapRef.current.getZoom() ?? 13;
        mapRef.current.setZoom(cur + 1);
    };

    const handleZoomOut = () => {
        if (!mapRef.current) return;
        const cur = mapRef.current.getZoom() ?? 13;
        mapRef.current.setZoom(cur - 1);
    };

    const handleRecenter = () => {
        if (!mapRef.current) return;
        const c = initialCenterRef.current;
        const pos = { lat: c.latitude, lng: c.longitude };

        mapRef.current.setCenter(pos);
        mapRef.current.setZoom(13);

        // 👇 reset center marker to initial center
        if (centerMarkerRef.current) {
            centerMarkerRef.current.setPosition(pos);
            centerMarkerRef.current.setMap(mapRef.current);
        }
        setCenterPos(pos);
        setLatInput(pos.lat.toFixed(6));
        setLngInput(pos.lng.toFixed(6));
    };

    const handleFitPolygon = () => {
        const g = (window as any).google as typeof google | undefined;
        if (!g || !mapRef.current || points.length < 1) return;

        const bounds = new g.maps.LatLngBounds();
        points.forEach((p) =>
            bounds.extend(new g.maps.LatLng(p.lat, p.lng))
        );
        mapRef.current.fitBounds(bounds, 32);
    };

    const toggleMapType = () => {
        setMapType((prev) => (prev === "roadmap" ? "hybrid" : "roadmap"));
    };

    // Parse Google Maps URL for lat/lng
    function parseLatLngFromGoogleUrl(url: string): { lat: number; lng: number } | null {
        if (!url) return null;
        try {
            const qMatch = url.match(/[?&]q=(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)/);
            if (qMatch) {
                const lat = parseFloat(qMatch[1]);
                const lng = parseFloat(qMatch[3]);
                if (isFinite(lat) && isFinite(lng)) return { lat, lng };
            }
            const atMatch = url.match(/@(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)/);
            if (atMatch) {
                const lat = parseFloat(atMatch[1]);
                const lng = parseFloat(atMatch[3]);
                if (isFinite(lat) && isFinite(lng)) return { lat, lng };
            }
            return null;
        } catch {
            return null;
        }
    }

    const handleGoToCoords = () => {
        const lat = parseFloat(latInput);
        const lng = parseFloat(lngInput);
        if (!isFinite(lat) || !isFinite(lng)) {
            ui.alert("Enter valid numeric latitude and longitude.");
            return;
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            ui.alert("Latitude must be between -90 and 90, longitude between -180 and 180.");
            return;
        }
        panToLatLng(lat, lng, true);
    };

    const handleUseGmapsUrl = () => {
        const parsed = parseLatLngFromGoogleUrl(gmapsUrl.trim());
        if (!parsed) {
            ui.alert("Could not find coordinates in that Google Maps link.");
            return;
        }
        panToLatLng(parsed.lat, parsed.lng, true);
    };
    React.useEffect(() => {
        let cancelled = false;

        (async () => {
            const g = await loadGoogleMaps(apiKey);
            if (!g) return;

            const geocoder = new g.maps.Geocoder();
            geocoder.geocode(
                { location: { lat: centerPos.lat, lng: centerPos.lng } },
                (results, status) => {
                    if (cancelled) return;

                    if (status === "OK" && results && results[0]) {
                        const label =
                            results[0].formatted_address ??
                            `${centerPos.lat.toFixed(5)}, ${centerPos.lng.toFixed(5)}`;
                        setCenterLabel(label);
                    } else {
                        setCenterLabel(
                            `${centerPos.lat.toFixed(5)}, ${centerPos.lng.toFixed(5)}`
                        );
                    }
                }
            );
        })();

        return () => {
            cancelled = true;
        };
    }, [apiKey, centerPos.lat, centerPos.lng]);

    return (
        <div className="fixed inset-0 z-[60]">
            {/* Backdrop */}
            <button
                onClick={onCancel}
                className="absolute inset-0 bg-black/50"
                aria-label="Close"
            />

            {/* Fullscreen map */}
            <div className="absolute inset-0">
                <div className="relative w-full h-full">
                    {/* Map */}
                    <div ref={mapDivRef} className="absolute inset-0" />

                    {/* ===== TOP BAR ===== */}
                    <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-3">
                        {/* Left: title + description + search */}
                        <div className="px-3 py-2 rounded-2xl bg-white/95 shadow-md border border-gray-200 max-w-[60%]">
                            <div className="text-[13px] font-black text-gray-900">
                                Draw land area
                            </div>
                            <p className="text-[11px] text-gray-600">
                                {drawEnabled
                                    ? "DRAW is ON: Click on the map to add points around the land boundary."
                                    : "DRAW is OFF: Drag the map to explore. Turn ON draw mode to start adding points."}
                            </p>
                            {/* Search input aligned at top with other controls */}
                            <div className="mt-2">
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Search address, town, landmark…"
                                    className="w-full rounded-full bg-white px-3 py-1.5 text-[11px] outline-none shadow border border-gray-200 placeholder:text-gray-400"
                                />
                            </div>
                        </div>

                        {/* Right: draw mode + advanced + close */}
                        <div className="flex flex-col items-end gap-2">
                            {/* Draw mode pill */}
                            <button
                                type="button"
                                onClick={() => setDrawEnabled((prev) => !prev)}
                                className="inline-flex items-center gap-2 rounded-full bg-white/95 shadow-md border border-gray-200 px-3 py-1.5"
                            >
                                <span
                                    className={`text-[11px] font-semibold ${drawEnabled ? "text-emerald-700" : "text-gray-700"
                                        }`}
                                >
                                    {drawEnabled ? "Draw mode: ON" : "Draw mode: OFF"}
                                </span>
                                <span
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${drawEnabled ? "bg-emerald-500" : "bg-gray-300"
                                        }`}
                                    role="switch"
                                    aria-checked={drawEnabled}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${drawEnabled ? "translate-x-4" : "translate-x-0.5"
                                            }`}
                                    />
                                </span>
                            </button>

                            {/* Advanced toggle */}
                            <button
                                type="button"
                                onClick={() => setShowAdvanced((s) => !s)}
                                className="px-3 py-1.5 rounded-full bg-white/95 shadow-md border border-gray-200 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                            >
                                {showAdvanced ? "Hide advanced" : "Advanced (GPS/coords/link)"}
                            </button>

                            {/* Close */}
                            <button
                                onClick={onCancel}
                                className="w-10 h-10 grid place-items-center rounded-full bg-white/95 shadow-md border border-gray-200 hover:bg-gray-50"
                                aria-label="Close"
                            >
                                <IoClose size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Advanced floating panel */}
                    {showAdvanced && (
                        <div className="z-30 absolute top-24 right-3 md:right-4 w-80 max-w-[90vw] bg-gray-100 rounded-2xl shadow-xl border border-gray-200 p-3 text-xs">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-semibold text-gray-700">
                                        Advanced location tools
                                    </span>
                                    <span className="text-[10px] text-gray-500">
                                        Enter exact coordinates or a Google Maps link.
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAdvanced(false)}
                                    className="w-7 h-7 grid place-items-center rounded-full hover:bg-gray-100 text-gray-500"
                                    aria-label="Close advanced panel"
                                >
                                    <IoClose size={14} />
                                </button>
                            </div>

                            <div className="space-y-3">
                                {/* Lat / Lng row */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                                            Latitude
                                        </label>
                                        <input
                                            value={latInput}
                                            onChange={(e) => setLatInput(e.target.value)}
                                            placeholder="-1.286389"
                                            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                                            Longitude
                                        </label>
                                        <input
                                            value={lngInput}
                                            onChange={(e) => setLngInput(e.target.value)}
                                            placeholder="36.817223"
                                            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleGoToCoords}
                                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-[11px] font-semibold hover:bg-gray-50"
                                    >
                                        Go to coords
                                    </button>
                                </div>

                                <div className="h-px bg-gray-100" />

                                {/* Google Maps link */}
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                                        Google Maps link
                                    </label>
                                    <input
                                        value={gmapsUrl}
                                        onChange={(e) => setGmapsUrl(e.target.value)}
                                        placeholder="Paste Google Maps location link"
                                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                                    />
                                    <div className="flex justify-end mt-1">
                                        <button
                                            type="button"
                                            onClick={handleUseGmapsUrl}
                                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-[11px] font-semibold hover:bg-gray-50"
                                        >
                                            Use link location
                                        </button>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleUseMyLocation}
                                        disabled={locating}
                                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-[11px] font-semibold hover:bg-gray-50 disabled:opacity-50"
                                        title="Use your current GPS location"
                                    >
                                        📍 {locating ? "Locating…" : "Use my GPS location"}
                                    </button>
                                </div>

                            </div>
                        </div>
                    )}

                    {/* Right-side controls */}
                    <div className="absolute bottom-24 right-3 flex flex-col gap-2 items-end">
                        <button
                            type="button"
                            onClick={handleZoomIn}
                            className="w-9 h-9 rounded-full bg-white shadow-md border border-gray-200 grid place-items-center text-gray-700 hover:bg-gray-50 text-lg leading-none"
                            title="Zoom in"
                        >
                            +
                        </button>
                        <button
                            type="button"
                            onClick={handleZoomOut}
                            className="w-9 h-9 rounded-full bg-white shadow-md border border-gray-200 grid place-items-center text-gray-700 hover:bg-gray-50 text-lg leading-none"
                            title="Zoom out"
                        >
                            –
                        </button>
                        <button
                            type="button"
                            onClick={handleFitPolygon}
                            className="w-9 h-9 rounded-full bg-white shadow-md border border-gray-200 grid place-items-center text-[9px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            title="Fit to drawn area"
                            disabled={points.length === 0}
                        >
                            FIT
                        </button>
                        <button
                            type="button"
                            onClick={handleRecenter}
                            className="w-9 h-9 rounded-full bg-white shadow-md border border-gray-200 grid place-items-center text-[9px] font-bold text-gray-700 hover:bg-gray-50"
                            title="Recenter"
                        >
                            CEN
                        </button>
                        <button
                            type="button"
                            onClick={toggleMapType}
                            className="w-9 h-9 rounded-full bg-white shadow-md border border-gray-200 grid place-items-center text-[9px] font-bold text-gray-700 hover:bg-gray-50"
                            title="Toggle satellite"
                        >
                            {mapType === "roadmap" ? "SAT" : "MAP"}
                        </button>
                    </div>

                    {/* Bottom-left: points + undo/clear */}
                    <div className="absolute bottom-24 left-3 flex items-center gap-3 bg-white/90 rounded-full px-3 py-1 shadow-md border border-gray-200 text-[11px]">
                        <span className="font-semibold text-gray-700">
                            Points: {points.length}
                        </span>
                        <div className="flex gap-1">
                            <button
                                type="button"
                                onClick={() =>
                                    setPoints((prev) => prev.slice(0, prev.length - 1))
                                }
                                className="px-2 py-0.5 rounded-full border border-gray-200 text-[11px] font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={points.length === 0}
                            >
                                Undo
                            </button>
                            <button
                                type="button"
                                onClick={() => setPoints([])}
                                className="px-2 py-0.5 rounded-full border border-gray-200 text-[11px] font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={points.length === 0}
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    {/* Bottom overlay actions */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3">
                        <button
                            onClick={onCancel}
                            className="h-10 px-4 rounded-xl border border-gray-200 bg-white/95 text-sm font-semibold hover:bg-gray-50 shadow-md"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleUse}
                            className="h-10 px-5 rounded-xl text-sm text-white font-black shadow-md hover:opacity-90"
                            style={{ backgroundColor: EKARI.gold }}
                        >
                            Use this area
                        </button>
                    </div>
                </div>
            </div>
            {ui.modal}
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
    const { types, categories, items, loading: catalogLoading } = useMarketCatalog();
    // 👇 avoid SSR mismatch when using document.body
    // Smooth open animation like ConfirmModal
    const [sheetVisible, setSheetVisible] = useState(false);
    const [requireVerifiedToPostProduct, setRequireVerifiedToPostProduct] = useState(true);
    const [billing, setBilling] = useState<BillingCycle>("monthly");
    const [limitOpen, setLimitOpen] = React.useState(false);
    const [limitMsg, setLimitMsg] = React.useState("");
    // subscription + packages
    const [checkingSub, setCheckingSub] = useState(true);
    const [sub, setSub] = useState<SellerSubscription | null>(null);
    const [packages, setPackages] = useState<PackageDoc[]>([]);

    // flow states
    type ModalStep = "form" | "plan";
    const [modalStep, setModalStep] = useState<ModalStep>("form");


    const [publishing, setPublishing] = useState(false);

    // draft tracking
    const [draftListingId, setDraftListingId] = useState<string | null>(null);
    const [draftBase, setDraftBase] = useState<any>(null);
    const ui = useConfirmUI();

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
    // ==== NEW: verification status for current user ====
    const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("none");
    const [verificationLoading, setVerificationLoading] = useState<boolean>(true);
    const [profile, setProfile] = useState<any>([]);
    // Currency preference (KES / USD)
    const [currency, setCurrency] = useState<CurrencyCode>("KES");
    const [effectiveRate, setEffectiveRate] = useState<number>(130);

    useEffect(() => {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
            setVerificationStatus("none");
            setVerificationLoading(false);
            return;
        }

        const db = getFirestore();
        const userRef = doc(db, "users", user.uid);

        const unsub = onSnapshot(userRef, (snap) => {
            const data = snap.data() as any | undefined;
            const status =
                (data?.verification?.status as VerificationStatus) ?? "none";
            setProfile(data)
            setVerificationStatus(status);
            setVerificationLoading(false);
            const pref = data?.preferredCurrency;
            if (pref === "KES" || pref === "USD") {
                setCurrency(pref);
            }
        });

        return () => unsub();
    }, []);
    const savePreferredCurrency = useCallback(async (next: CurrencyCode) => {
        try {
            const auth = getAuth();
            const user = auth.currentUser;
            if (!user) return; // not signed in yet, just keep local state

            const db = getFirestore();
            const userRef = doc(db, "users", user.uid);
            await setDoc(
                userRef,
                { preferredCurrency: next },
                { merge: true }
            );
        } catch (e) {
            console.error("Failed to save preferred currency", e);
        }
    }, []);
    const handleSetCurrency = useCallback(
        (next: CurrencyCode) => {
            setCurrency(next);
            savePreferredCurrency(next);
        },
        [savePreferredCurrency]
    );
    useEffect(() => {
        const db = getFirestore();
        const ref = doc(db, "adminSettings", "finance");

        const unsub = onSnapshot(
            ref,
            (snap) => {
                const data = (snap.data() as any) || {};
                // default true (safer)
                setRequireVerifiedToPostProduct(
                    typeof data.requireVerifiedToPostProduct === "boolean"
                        ? data.requireVerifiedToPostProduct
                        : true
                );
                setEffectiveRate(data.usdToKesRate);
            },
            (err) => {
                console.error("Failed to load market gate setting", err);
                setRequireVerifiedToPostProduct(true);
                // setMarketGateLoaded(true);
            }
        );

        return () => unsub();
    }, []);
    const displayPriceText = (priceUsdMajor: number) => {
        if (currency === "USD") return usd(priceUsdMajor);
        return kes(priceUsdMajor * effectiveRate);
    };

    const canPublish =
        !requireVerifiedToPostProduct || verificationStatus === "approved";
    const slots = useMemo(() => getRemainingSlots(sub as any), [sub]);


    // -------- subscription snapshot --------
    useEffect(() => {
        const auth = getAuth(app);
        if (!auth.currentUser) return;

        const uid = auth.currentUser.uid;
        const ref = doc(db, "sellerSubscriptions", uid);

        const unsub = onSnapshot(
            ref,
            (snap) => {
                setSub(snap.exists() ? (snap.data() as any) : null);
                // console.log(snap.data() as any);
                setCheckingSub(false);
            },
            () => {
                setSub(null);
                setCheckingSub(false);
            }
        );

        return () => unsub();
    }, []);

    // -------- load packages ONLY if NO active subscription --------
    useEffect(() => {
        if (checkingSub) return;

        if (isSubActive(sub)) {
            setPackages([]);
            return;
        }

        (async () => {
            const qy = query(
                collection(db, "packages"),
                where("status", "==", "active"),
                orderBy("sortOrder", "asc")
            );
            const snap = await getDocs(qy);
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PackageDoc[];
            setPackages(list);
        })();
    }, [checkingSub, sub]);

    // Build type options from Firestore with a fallback order
    const fallbackTypes: MarketType[] = ["product", "animal", "tree", "lease", "service"];
    const TYPE_OPTIONS: MarketType[] = useMemo(() => {
        if (!types.length) return fallbackTypes;
        const ids = types.map((t) => t.id);
        // ensure we still include all known types even if missing in DB
        const merged = Array.from(new Set([...ids, ...fallbackTypes]));
        return merged as MarketType[];
    }, [types]);

    // Steps: 0 Type, 1 Name (or Category+Item), 2 Pack+Unit, 3 Price/Rate, 4 Photos+Location+Review
    const [step, setStep] = useState<number>(0);

    type PhotoItem = { blob: Blob; url: string; name: string };
    const [photos, setPhotos] = useState<PhotoItem[]>([]);

    // Step 0
    const [typeSel, setTypeSel] = useState<MarketType>("product");

    // Step 1: categories for current type from Firestore
    const categoriesForType = useMemo(
        () =>
            categories
                .filter((c) => c.typeId === typeSel)
                .map((c) => c.name),
        [categories, typeSel]
    );
    const [category, setCategory] = useState<string>("");
    const [description, setDescription] = useState<string>("");

    // Keep category initialized (mainly for service path)
    useEffect(() => {
        const first = categoriesForType[0] || "";
        setCategory((prev) => (prev ? prev : first));
    }, [categoriesForType]);

    // Name + use-case tips
    const [name, setName] = useState<string>("");
    const [useCaseTip, setUseCaseTip] = useState<string>("");

    // All names for this type (for autosuggest for product/animal/lease/tree)
    const allNamesForType = useMemo(
        () => namesForTypeFromItems(typeSel, items),
        [typeSel, items]
    );

    // Current catalog row for the selected (type, name)
    const currentItem = useMemo(
        () => (name ? findCatalogRowFromItems(typeSel, name, items) : undefined),
        [typeSel, name, items]
    );

    // Name suggestions filtered by input
    const nameSuggestions = useMemo(() => {
        if (!DIRECT_NAME_TYPES.includes(typeSel)) return [];
        if (!allNamesForType.length) return [];

        const q = norm(name);
        if (!q) {
            // initial: show top chunk
            return allNamesForType.slice(0, 6000);
        }
        return allNamesForType
            .filter((n) => n.toLowerCase().includes(q))
            .slice(0, 6000);
    }, [typeSel, allNamesForType, name]);

    // For service (old path), we now use Firestore items
    const catalogItems = useMemo(() => {
        if (!category) return [];

        const list = items.filter(
            (it) => it.type === typeSel && norm(it.category) === norm(category)
        );

        const pieces = list.flatMap((it) => {
            if (!it.name) return [];
            // split on comma, trim each part
            return it.name
                .split(",")
                .map((p) => p.trim())
                .filter(Boolean);
        });

        // Unique values, optionally sorted
        return Array.from(new Set(pieces)).sort();
    }, [items, typeSel, category]);

    // Skip pack/unit step for lease/service (same as before)


    // Step 2
    const [unit, setUnit] = useState<string>("");
    const [pack, setPack] = useState<string>("");

    // Auto pack + unit when name changes (now from Firestore item)
    useEffect(() => {
        if (!name || !currentItem) return;
        if (currentItem.typicalPackSize != null) {
            setPack(String(currentItem.typicalPackSize));
        }
        if (currentItem.unit) {
            const first = currentItem.unit.split(" ")[0];
            setUnit(first || currentItem.unit);
        }
    }, [name, currentItem]);

    // Step 3
    const [price, setPrice] = useState<string>("");
    const [rate, setRate] = useState<string>("");
    const [billingUnit, setBillingUnit] = useState<string>("");

    // Step 4 (Location)
    const [placeText, setPlaceText] = useState<string>("");
    const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    // NEW: polygon state for arable land
    const [landPolygon, setLandPolygon] = useState<{ lat: number; lng: number }[]>([]);
    const [landCenter, setLandCenter] = useState<{ latitude: number; longitude: number } | null>(null);

    // Nested location modal
    const [locModalOpen, setLocModalOpen] = useState(false);
    const [candidateText, setCandidateText] = useState<string>("");
    const [candidateCenter, setCandidateCenter] = useState<{ latitude: number; longitude: number } | null>(null);
    const [polygonModalOpen, setPolygonModalOpen] = useState(false);
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
            // NEW reset polygon state
            setLandPolygon([]);
            setLandCenter(null);
            setPolygonModalOpen(false);

            setDraftListingId(null);
            setDraftBase(null);
        }
    }, [open]);

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

        const row = currentItem;
        const fallbackCategory = categoriesForType[0] || "";

        if (row?.category || fallbackCategory) {
            setCategory(row?.category || fallbackCategory);
        }


        if (typeSel === "tree") {
            setUseCaseTip(row?.useCase || "");
        } else {
            setUseCaseTip("");
        }
    }, [name, typeSel, currentItem, categoriesForType]);

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

    // Unit suggestions parsed from Firestore item.unit
    const unitsitems = useMemo(() => {
        if (!currentItem?.unit) return [];
        return Array.from(
            new Set(
                currentItem.unit
                    .split(/[\/,]/)
                    .flatMap((chunk) =>
                        chunk
                            .split(" ")
                            .map((s) => s.trim())
                            .filter(Boolean)
                    )
            )
        );
    }, [currentItem]);

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

        if (step === 4) {
            if (photos.length === 0) return false;

            // NEW: arable land uses polygon instead of point
            if (typeSel === ARABLE_LAND_TYPE) {
                return landPolygon.length >= 3; // at least 3 points for a polygon
            }

            return !!placeText.trim() && !!coords;
        }

        return false;
    }, [step, typeSel, category, name, price, rate, billingUnit, photos.length, placeText, coords, landPolygon.length]);

    const onNext = useCallback(() => {
        if (!canNext) {
            if (step === 1 && !name.trim()) ui.alert("Please pick or type the item name.");
            if (step === 3) {
                if (typeSel === "lease" || typeSel === "service") {
                    if (!rate.trim() || !billingUnit.trim()) {
                        ui.alert("Provide a rate and billing unit (e.g., per hour / per acre).");
                    }
                } else {
                    ui.alert("Please enter a valid numeric price.");
                }
            }
            if (step === 4) {
                if (photos.length === 0) return ui.alert("Please add a photo.");

                if (typeSel === ARABLE_LAND_TYPE) {
                    if (landPolygon.length < 3) {
                        return ui.alert("Tap at least three points on the map to outline the land.");
                    }
                    return;
                }

                if (!placeText.trim()) return ui.alert("Add a place (e.g., Westlands, Nairobi).");
                if (!coords) return ui.alert("Open “Add location” and pick a point or search an address.");
            }
            return;
        }


        // ✅ skip step 2 when going forward for lease/service
        if (step === 1 && (typeSel === "lease" || typeSel === "service")) {
            setStep(3);
            return;
        }



        if (step < 4) setStep(step + 1);
    }, [step, canNext, typeSel, name, rate, billingUnit, photos.length, placeText, coords, landPolygon.length]);

    const onBack = useCallback(() => {
        // ✅ If we're on Plan step, go back to the form (last step)
        if (modalStep === "plan") {
            setModalStep("form");
            setStep(4); // or whatever your last form step index is
            return;
        }

        // ✅ normal form back logic
        if (step <= 0) return;

        // from step 3 go back to step 1 (because step 2 is skipped)
        if (step === 3 && (typeSel === "lease" || typeSel === "service")) {
            setStep(1);
            return;
        }

        setStep(step - 1);
    }, [modalStep, step, typeSel]);



    const createDraftListing = useCallback(async (): Promise<{ id: string; base: any }> => {
        if (!photos.length) throw new Error("Please add at least one photo.");
        if (!name.trim()) throw new Error("Please choose what you’re selling.");
        if (!category) throw new Error("Pick a category.");

        // If you want: allow drafts even if not verified, comment out this block.
        if (requireVerifiedToPostProduct && verificationStatus !== "approved") {
            throw new Error("Your account must be verified before you can post on ekariMarket.");
        }

        if (typeSel === "lease" || typeSel === "service") {
            if (!rate.trim() || !billingUnit.trim()) throw new Error("Provide a rate and billing unit.");
        } else {
            const nPrice = Number(String(price).replace(/[^\d.]/g, "")) || 0;
            if (nPrice <= 0) throw new Error("Please enter a valid numeric price.");
        }

        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) throw new Error("Please sign in to sell.");

        const _db = getFirestore();
        const storage = getStorage();

        const matchCountyFromText = (globalThis as any).matchCountyFromText as Function | undefined;
        const guessTownFromText = (globalThis as any).guessTownFromText as Function | undefined;
        const toLower = (globalThis as any).toLower as Function | undefined;
        const buildAuthorBadge = (globalThis as any).buildAuthorBadge as Function | undefined;

        const countyFromText = matchCountyFromText ? (matchCountyFromText(placeText) || "") : "";
        const townFromText = guessTownFromText ? (guessTownFromText(placeText, countyFromText) || "") : "";

        const place: any = {
            text: placeText,
            textLower: toLower ? toLower(placeText) : String(placeText || "").toLowerCase(),
            ...(countyFromText && {
                county: countyFromText,
                countyLower: toLower ? toLower(countyFromText) : String(countyFromText).toLowerCase(),
            }),
            ...(townFromText && {
                town: townFromText,
                townLower: toLower ? toLower(townFromText) : String(townFromText).toLowerCase(),
            }),
        };

        if (!coords) throw new Error("Please add a location and pick coordinates.");

        const prodRef = doc(collection(_db, "marketListings"));
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
                : Number(String(price).replace(/[^\d.]/g, "")) || 0;

        const badge = buildAuthorBadge ? buildAuthorBadge(profile) : undefined;
        const cleanDescription = sanitizeDescription(description);
        const base: any = {
            name: name.trim(),
            price: nPrice,
            currency,
            category,
            description: cleanDescription,
            imageUrl: urls[0],
            imageUrls: urls,
            ownerId: user.uid,
            collectionType: "marketListing",
            seller: {
                id: user.uid,
                verified: verificationStatus === "approved",
                name: `${profile?.firstName ?? ""} ${profile?.surname ?? ""}`.trim() || null,
                handle: profile?.handle ?? null,
                photoURL: profile?.photoURL ?? null,
            },
            ...(badge ? { authorBadge: badge } : {}),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            type: typeSel,
            nameLower: name.trim().toLowerCase(),
            categoryLower: category.toLowerCase(),
            place,
            location: coords,
            status: "draft",
            sold: false,
        };

        if (typeSel === ARABLE_LAND_TYPE && landPolygon.length >= 3) base.landPolygon = landPolygon;
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
        return { id: docId, base };
    }, [
        photos,
        name,
        category,
        typeSel,
        rate,
        billingUnit,
        price,
        unit,
        pack,
        coords,
        landPolygon,
        placeText,
        useCaseTip,
        currency,
        profile,
        verificationStatus,
        requireVerifiedToPostProduct,
    ]);
    // ===========================
    // ✅ PUBLISH + CHECKOUT HANDLERS
    // ===========================
    const handlePublish = useCallback(
        async (listingId: string, createdBase?: any) => {
            try {
                setPublishing(true);

                const functions = getFunctions(app, "us-central1");
                const publishMarketListing = httpsCallable(functions, "publishMarketListing");
                await publishMarketListing({ listingId });

                // if we have base, we can update UI immediately
                const base = createdBase ?? draftBase;
                if (base) onCreated({ id: listingId, ...base } as Product);

                onClose?.();
            } catch (e: any) {
                const msg =
                    e?.message ||
                    e?.details ||
                    "Failed to publish listing. Please try again.";
                ui.alert(String(msg));
            } finally {
                setPublishing(false);
            }
        },
        [draftBase, onClose, onCreated, ui]
    );

    const handleChooseFree = useCallback(async () => {
        if (!draftListingId) return ui.alert("Missing draft listing id.");
        // Cloud function enforces FREE limit (3) + verification gate
        await handlePublish(draftListingId);
    }, [draftListingId, handlePublish, ui]);

    const handleChoosePaid = useCallback(
        async (packageId: string) => {
            if (!draftListingId) return ui.alert("Missing draft listing id.");

            try {
                setPublishing(true);

                // store pending publish intent (web)
                localStorage.setItem("pendingPublishListingId", draftListingId);

                const functions = getFunctions(app, "us-central1");
                const createPackageCheckout = httpsCallable(functions, "createPackageCheckout");

                const res = await createPackageCheckout({
                    packageId,
                    billingCycle: billing,
                    currency,
                    source: "web",
                });

                const url = (res.data as any)?.checkoutUrl;
                if (!url) throw new Error("No checkout URL returned.");

                window.location.href = url;
            } catch (e: any) {
                ui.alert(e?.message || "Failed to start checkout.");
                setPublishing(false);
            }
        },
        [draftListingId, billing, currency, ui]
    );

    // After payment: if subscription becomes active, auto-publish pending draft
    useEffect(() => {
        if (checkingSub) return;

        const pendingId =
            typeof window !== "undefined" ? localStorage.getItem("pendingPublishListingId") : null;

        if (!pendingId) return;

        if (isSubActive(sub)) {
            localStorage.removeItem("pendingPublishListingId");
            handlePublish(pendingId);
        }
    }, [checkingSub, sub, handlePublish]);
    // Upload -> Firestore create (unchanged except using same category/name)

    // ===========================
    // ✅ FINISH BUTTON: DRAFT -> (ACTIVE SUB? publish : go plan step)
    // ===========================
    const onFinish = useCallback(async () => {
        if (!canPublish) {
            ui.alert(
                verificationStatus === "pending"
                    ? "Your verification is still under review. You’ll be able to sell once it is approved."
                    : "To sell on ekariMarket, please verify your account first from the Verification page in your profile."
            );
            return;
        }

        setSaving(true);
        try {
            const { id, base } = await createDraftListing();
            setDraftListingId(id);
            setDraftBase(base);

            // If user already has active subscription -> publish immediately
            if (isSubActive(sub)) {
                await handlePublish(id, base);
                return;
            }

            // No active subscription -> show plan selection (includes Free)
            setModalStep("plan");
        } catch (e: any) {
            setPublishing(false);
            const msg = e?.message || "Failed to publish.";
            const code = e?.code || "";

            // limit reached
            if (code === "failed-precondition" && String(msg).toLowerCase().includes("limit")) {
                // when you catch the error:
                setLimitMsg(msg);
                setLimitOpen(true);
                return;
            }
            ui.alert(e?.message || "Failed to save draft. Please try again.");
        } finally {
            setSaving(false);
        }
    }, [canPublish, verificationStatus, ui, createDraftListing, sub, handlePublish]);

    if (!mounted || !open) return null;

    // ===========================
    // UI: PLAN STEP
    // ===========================
    // ===========================
    // UI: PLAN STEP (PREMIUM)
    // ===========================
    const PlanStep = (
        <div className="space-y-5">
            {/* header card */}
            <div
                className="rounded-3xl border bg-white p-4 shadow-[0_18px_55px_rgba(15,23,42,0.06)]"
                style={{
                    borderColor: EKARI.hair,
                    background:
                        "radial-gradient(900px circle at 12% 10%, rgba(199,146,87,0.16), transparent 55%), radial-gradient(900px circle at 88% 30%, rgba(35,63,57,0.14), transparent 55%), #FFFFFF",
                }}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: EKARI.forest }}>
                            Plan
                        </div>
                        <div className="mt-1 text-base font-black" style={{ color: EKARI.text }}>
                            Choose a plan
                        </div>
                        <div className="mt-1 text-xs leading-snug" style={{ color: EKARI.dim }}>
                            Free plan allows up to <span className="font-extrabold" style={{ color: EKARI.text }}>3 active listings</span>.
                            Paid plans unlock more listings + perks.
                        </div>
                    </div>

                    <div
                        className="shrink-0 rounded-2xl border px-3 py-2 text-[11px] font-extrabold"
                        style={{ borderColor: EKARI.hair, color: EKARI.dim, background: "#fff" }}
                    >
                        Secure checkout
                    </div>
                </div>
            </div>

            {/* toggles row */}
            <div className="grid gap-3 sm:grid-cols-2">
                {/* billing toggle */}
                <div
                    className="rounded-3xl border bg-white p-3"
                    style={{ borderColor: EKARI.hair, boxShadow: "0 10px 25px rgba(15,23,42,0.05)" }}
                >
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: EKARI.dim }}>
                                Billing cycle
                            </div>
                            <div className="mt-0.5 text-xs" style={{ color: EKARI.text }}>
                                Pick monthly or yearly
                            </div>
                        </div>

                        <div className="inline-flex items-center gap-1 rounded-2xl border bg-white p-1" style={{ borderColor: EKARI.hair }}>
                            <button
                                type="button"
                                onClick={() => setBilling("monthly")}
                                className="h-9 rounded-xl px-3 text-xs font-extrabold transition"
                                style={{
                                    background: billing === "monthly" ? EKARI.forest : "transparent",
                                    color: billing === "monthly" ? "#fff" : EKARI.text,
                                }}
                            >
                                Monthly
                            </button>
                            <button
                                type="button"
                                onClick={() => setBilling("yearly")}
                                className="h-9 rounded-xl px-3 text-xs font-extrabold transition"
                                style={{
                                    background: billing === "yearly" ? EKARI.forest : "transparent",
                                    color: billing === "yearly" ? "#fff" : EKARI.text,
                                }}
                            >
                                Yearly
                            </button>
                        </div>
                    </div>
                </div>

                {/* currency toggle (checkout currency only) */}
                <div
                    className="rounded-3xl border bg-white p-3"
                    style={{ borderColor: EKARI.hair, boxShadow: "0 10px 25px rgba(15,23,42,0.05)" }}
                >
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: EKARI.dim }}>
                                Pay in
                            </div>
                            <div className="mt-0.5 text-xs" style={{ color: EKARI.text }}>
                                Choose checkout currency
                            </div>
                        </div>

                        <div className="inline-flex items-center gap-1 rounded-2xl border bg-white p-1" style={{ borderColor: EKARI.hair }}>
                            <button
                                type="button"
                                onClick={() => handleSetCurrency("KES")}
                                className="h-9 rounded-xl px-3 text-xs font-extrabold transition"
                                style={{
                                    background: currency === "KES" ? EKARI.forest : "transparent",
                                    color: currency === "KES" ? "#fff" : EKARI.text,
                                }}
                            >
                                KES
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSetCurrency("USD")}
                                className="h-9 rounded-xl px-3 text-xs font-extrabold transition"
                                style={{
                                    background: currency === "USD" ? EKARI.forest : "transparent",
                                    color: currency === "USD" ? "#fff" : EKARI.text,
                                }}
                            >
                                USD
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* free plan */}
            <div
                className="rounded-3xl border bg-white p-4 shadow-[0_18px_55px_rgba(15,23,42,0.06)]"
                style={{ borderColor: EKARI.hair }}
            >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span
                                className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold border"
                                style={{ background: "#F8FAFC", color: EKARI.text, borderColor: "#E2E8F0" }}
                            >
                                Free
                            </span>
                            <span className="text-xs font-extrabold" style={{ color: EKARI.text }}>
                                Up to 3 active listings
                            </span>
                        </div>
                        <div className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                            Start publishing immediately. Upgrade anytime.
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleChooseFree}
                        disabled={publishing || saving || !draftListingId}
                        className="h-11 rounded-2xl px-5 text-sm font-black text-white disabled:opacity-60"
                        style={{
                            background: EKARI.gold,
                            boxShadow: "0 16px 35px rgba(199,146,87,0.25)",
                        }}
                    >
                        {publishing ? "Publishing…" : "Continue with Free"}
                    </button>
                </div>
            </div>

            {/* paid packages */}
            <div className="space-y-3">
                {packages.length === 0 ? (
                    <div className="text-xs" style={{ color: EKARI.dim }}>
                        {checkingSub ? "Loading plans…" : "No paid plans available right now."}
                    </div>
                ) : (
                    packages.map((p) => {
                        const priceUsd =
                            billing === "yearly" ? Number(p.priceYearlyUsd || 0) : Number(p.priceMonthlyUsd || 0);

                        const subtitle =
                            p.activeListingsLimit == null ? "Unlimited listings" : `${p.activeListingsLimit} active listings`;

                        // ✅ package color accents like in dashboard
                        const t = tierPill(p.name);
                        const a = pickAccent(p.name);
                        const priceUsdMajor =
                            billing === "yearly"
                                ? Number(p.priceYearlyUsd || 0)
                                : Number(p.priceMonthlyUsd || 0);
                        const perks = [
                            p.topOfSearch ? "Top of search" : null,
                            p.priorityRanking ? "Priority ranking" : null,
                            p.storefront ? "Storefront" : null,
                            p.monthlyBoostCredits > 0 ? `${p.monthlyBoostCredits} boosts/mo` : null,
                            p.weeklyFeaturedCredits > 0 ? `${p.weeklyFeaturedCredits} featured/wk` : null,
                        ].filter(Boolean) as string[];

                        return (
                            <div key={p.id} className="relative">
                                {/* glow */}
                                <div
                                    className="pointer-events-none absolute -inset-0.5 rounded-[22px] opacity-40 blur-2xl"
                                    style={{
                                        background: `radial-gradient(70% 70% at 20% 10%, ${a.accent}22 0%, transparent 65%)`,
                                    }}
                                />

                                <div
                                    className={clsx(
                                        "relative rounded-3xl border bg-white p-4 transition-all",
                                        "hover:-translate-y-0.5 hover:shadow-[0_18px_55px_rgba(15,23,42,0.12)]"
                                    )}
                                    style={{
                                        borderColor: p.recommended ? a.ring : EKARI.hair,
                                        boxShadow: p.recommended ? "0 16px 40px rgba(15,23,42,0.08)" : "0 10px 25px rgba(15,23,42,0.06)",
                                    }}
                                >
                                    {/* top ribbons */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span
                                                    className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold border"
                                                    style={{ background: t.bg, color: t.fg, borderColor: t.ring }}
                                                >
                                                    {p.name}
                                                </span>

                                                {p.recommended && (
                                                    <span
                                                        className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold border"
                                                        style={{ background: a.soft, color: a.accent, borderColor: a.ring }}
                                                    >
                                                        Most popular
                                                    </span>
                                                )}
                                            </div>

                                            <div className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                                                {subtitle}
                                            </div>

                                            {/* perks pills */}
                                            {perks.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {perks.slice(0, 5).map((x, i) => (
                                                        <span
                                                            key={i}
                                                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border"
                                                            style={{ borderColor: EKARI.hair, color: EKARI.text, background: "#fff" }}
                                                        >
                                                            {x}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="shrink-0 text-right">
                                            <div className="text-[11px] font-semibold" style={{ color: EKARI.dim }}>
                                                {billing === "yearly" ? "per year" : "per month"}
                                            </div>
                                            <div className="mt-1 text-lg font-black" style={{ color: EKARI.text }}>
                                                {displayPriceText(priceUsdMajor)}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleChoosePaid(p.id)}
                                                disabled={publishing || saving || !draftListingId}
                                                className="mt-2 h-11 w-full rounded-2xl px-5 text-sm font-black text-white disabled:opacity-60"
                                                style={{
                                                    background: a.accent,
                                                    boxShadow: "0 16px 35px rgba(15,23,42,0.10)",
                                                }}
                                            >
                                                {publishing ? "Opening checkout…" : "Choose plan"}
                                            </button>
                                        </div>
                                    </div>

                                    {/* feature list */}
                                    {Array.isArray(p.features) && p.features.length > 0 && (
                                        <div className="mt-4">
                                            <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: EKARI.dim }}>
                                                Includes
                                            </div>
                                            <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                {p.features.slice(0, 8).map((f, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                                                        <span
                                                            className="mt-1 h-5 w-5 shrink-0 rounded-full border flex items-center justify-center"
                                                            style={{ borderColor: a.ring, background: a.soft }}
                                                            aria-hidden="true"
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                                                <path
                                                                    d="M20 6L9 17l-5-5"
                                                                    stroke={a.accent}
                                                                    strokeWidth="2.5"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                />
                                                            </svg>
                                                        </span>
                                                        <span className="min-w-0 leading-snug">{f}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* footer */}
            <div className="text-[11px]" style={{ color: EKARI.dim }}>
                You can change your plan anytime from your profile. After payment, we’ll publish your draft automatically.
            </div>
        </div>
    );

    // ===========================
    // UI: FORM STEP (your existing UI)
    // NOTE: I kept the structure, but not re-pasted your entire 0-4 UI again.
    // If you want, I can paste the full form UI exactly as you had it (it’s huge),
    // but logic-wise, this wrapper works as-is.
    // ===========================
    const FormStep = (
        <div className="text-sm text-gray-700">
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
                    {step === 2 && "Quantity & Unit"}
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
                                        {nameSuggestions.map((n: any) => (
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
                                {/* Service: Category + Item flow using Firestore categories/items */}
                                <label className="text-xs font-extrabold text-gray-500">
                                    Category
                                </label>
                                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                                    {categoriesForType.map((c: any) => {
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
                                        (catalogItems[0] &&
                                            `e.g. ${catalogItems[0]}`) ||
                                        "Type or pick from catalog"
                                    }
                                    className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-3 outline-none"
                                />
                                {catalogItems.length > 0 && (
                                    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                                        {catalogItems.slice(0, 600).map((it) => (
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
                                Quantity
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
                                Unit of measure
                            </label>
                            <input
                                value={unit}
                                onChange={(e) => setUnit(e.target.value)}
                                placeholder={
                                    currentItem?.unit ??
                                    "kg / bag / carton / head"
                                }
                                className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-3 outline-none"
                            />
                            {unitsitems.length > 0 && (
                                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                                    {unitsitems.slice(0, 50).map((u) => (
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
                                        Rate ({currency})
                                    </label>
                                    <div className="flex items-center text-[11px] gap-1">
                                        <span className="text-gray-500 font-semibold">Currency</span>
                                        <button
                                            type="button"
                                            onClick={() => handleSetCurrency("KES")}
                                            className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${currency === "KES"
                                                ? "bg-emerald-700 text-white border-emerald-800"
                                                : "bg-white text-gray-700 border-gray-200"
                                                }`}
                                        >
                                            KES
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSetCurrency("USD")}
                                            className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${currency === "USD"
                                                ? "bg-emerald-700 text-white border-emerald-800"
                                                : "bg-white text-gray-700 border-gray-200"
                                                }`}
                                        >
                                            USD
                                        </button>
                                    </div>
                                </div>
                                <input
                                    value={rate}
                                    onChange={(e) => setRate(e.target.value)}
                                    placeholder={currency === "KES" ? "e.g. 1500" : "e.g. 10"}
                                    inputMode="numeric"
                                    className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-3 outline-none"
                                />


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
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-extrabold text-gray-500">
                                        Price ({currency})
                                    </label>
                                    <div className="flex items-center text-[11px] gap-1">
                                        <span className="text-gray-500 font-semibold">Currency</span>
                                        <button
                                            type="button"
                                            onClick={() => handleSetCurrency("KES")}
                                            className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${currency === "KES"
                                                ? "bg-emerald-700 text-white border-emerald-800"
                                                : "bg-white text-gray-700 border-gray-200"
                                                }`}
                                        >
                                            KES
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSetCurrency("USD")}
                                            className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${currency === "USD"
                                                ? "bg-emerald-700 text-white border-emerald-800"
                                                : "bg-white text-gray-700 border-gray-200"
                                                }`}
                                        >
                                            USD
                                        </button>
                                    </div>
                                </div>
                                <input
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    placeholder={currency === "KES" ? "e.g. 250" : "e.g. 5"}
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
                        {/* Location */}
                        <div>
                            <label className="text-xs font-extrabold text-gray-500">
                                {typeSel === ARABLE_LAND_TYPE ? "Where is the land?" : "Where is the product?"}
                            </label>

                            <div className="mt-2 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                                {typeSel === ARABLE_LAND_TYPE ? (
                                    // NEW: polygon button for arable land
                                    <button
                                        onClick={() => {
                                            setPolygonModalOpen(true);
                                        }}
                                        className="h-11 px-3 rounded-xl border border-gray-200 hover:bg-gray-50 inline-flex items-center gap-2"
                                    >
                                        <IoMap size={18} />
                                        <span className="font-semibold">Draw land area on map</span>
                                    </button>
                                ) : (
                                    // Existing point location picker for other types
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
                                )}
                            </div>

                            {/* Info for normal point location */}
                            {typeSel !== ARABLE_LAND_TYPE && (
                                <>
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
                                </>
                            )}

                            {/* NEW: info for polygon */}
                            {typeSel === ARABLE_LAND_TYPE && (
                                <div className="mt-1 text-xs text-gray-600 space-y-1">
                                    <div>
                                        <span className="font-bold text-gray-500">Points:</span>{" "}
                                        {landPolygon.length > 0 ? `${landPolygon.length} vertices set` : "No polygon drawn yet"}
                                    </div>
                                    {landCenter && (
                                        <div className="text-xs text-gray-500">
                                            Approx. center: {landCenter.latitude.toFixed(4)}, {landCenter.longitude.toFixed(4)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {/* Description */}
                        <div>
                            <label className="text-xs font-extrabold text-gray-500">
                                Description
                            </label>

                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Add details buyers should know: quality, condition, delivery, availability, etc."
                                rows={4}
                                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 outline-none resize-none"
                            />

                            <div className="mt-1 text-[11px] text-gray-500 flex justify-between">
                                <span>{(description ?? "").length}/800</span>
                            </div>
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
                                <div>
                                    <span className="font-bold text-gray-500">Description:</span>{" "}
                                    {description ? (
                                        <span className="text-gray-800">
                                            {description.length > 80 ? description.slice(0, 80) + "…" : description}
                                        </span>
                                    ) : (
                                        "-"
                                    )}
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
                                        {rate ? `${formatPriceForReview(rate, currency)} (${billingUnit || "-"})` : "-"}
                                    </div>
                                ) : (
                                    <div>
                                        <span className="font-bold text-gray-500">Price:</span>{" "}
                                        {formatPriceForReview(price, currency)}
                                    </div>
                                )}
                                <div>
                                    <span className="font-bold text-gray-500">Photos:</span>{" "}
                                    {photos.length}/5
                                </div>
                                <div>
                                    <span className="font-bold text-gray-500">Location:</span>{" "}
                                    {typeSel === ARABLE_LAND_TYPE ? (placeText || "Arable land parcel") : (placeText || "-")}
                                </div>

                                {typeSel === ARABLE_LAND_TYPE ? (
                                    <>
                                        <div>
                                            <span className="font-bold text-gray-500">Polygon points:</span>{" "}
                                            {landPolygon.length > 0 ? landPolygon.length : "-"}
                                        </div>
                                        <div>
                                            <span className="font-bold text-gray-500">Center:</span>{" "}
                                            {landCenter
                                                ? `${landCenter.latitude.toFixed(4)}, ${landCenter.longitude.toFixed(4)}`
                                                : "-"}
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <span className="font-bold text-gray-500">Coords:</span>{" "}
                                        {coords
                                            ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
                                            : "-"}
                                    </div>
                                )}

                            </div>
                        </div>
                        {/* ==== NEW: Account verification gate ==== */}
                        {requireVerifiedToPostProduct ? (
                            <div className="border border-amber-200 rounded-xl p-3 bg-amber-50 flex items-start gap-3">
                                <div className="mt-0.5 h-2 w-2 rounded-full bg-amber-500" />
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <div className="font-black text-sm text-gray-900">
                                            Account verification required
                                        </div>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${verificationStatus === "approved"
                                            ? "bg-emerald-100 text-emerald-800"
                                            : verificationStatus === "pending"
                                                ? "bg-amber-100 text-amber-800"
                                                : verificationStatus === "rejected"
                                                    ? "bg-red-100 text-red-700"
                                                    : "bg-gray-100 text-gray-600"
                                            }`}>
                                            {verificationLoading
                                                ? "Checking..."
                                                : verificationStatus === "approved"
                                                    ? "Verified"
                                                    : verificationStatus === "pending"
                                                        ? "Pending review"
                                                        : verificationStatus === "rejected"
                                                            ? "Rejected"
                                                            : "Not verified"}
                                        </span>
                                    </div>

                                    {verificationStatus === "approved" ? (
                                        <p className="text-xs text-gray-600">
                                            Your account is verified. You can publish this listing.
                                        </p>
                                    ) : (
                                        <>
                                            <p className="text-xs text-gray-600">
                                                To sell on ekariMarket, please verify your account first. This helps keep buyers safe and builds trust.
                                            </p>
                                            <a
                                                href="/account/verification"
                                                className="inline-flex mt-1 text-xs font-bold text-emerald-800 underline"
                                            >
                                                Go to verification page
                                            </a>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="border border-emerald-200 rounded-xl p-3 bg-emerald-50 flex items-start gap-3">
                                <div className="mt-0.5 h-2 w-2 rounded-full bg-emerald-600" />
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <div className="font-black text-sm text-gray-900">
                                            Verification is optional
                                        </div>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${verificationStatus === "approved"
                                            ? "bg-emerald-100 text-emerald-800"
                                            : "bg-white text-gray-700 border border-emerald-200"
                                            }`}>
                                            {verificationLoading ? "Checking..." : verificationStatus === "approved" ? "Verified" : "Not verified"}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-600">
                                        You can publish even without verification. Verified sellers may get more buyer trust and better visibility.
                                    </p>
                                    {verificationStatus !== "approved" && (
                                        <a
                                            href="/account/verification"
                                            className="inline-flex mt-1 text-xs font-bold text-emerald-800 underline"
                                        >
                                            Verify anyway
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}



                    </div>
                )}

            </div>
        </div>
    );

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop – faded + blurred like ConfirmModal */}
            <button
                type="button"
                className={clsx(
                    "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200",
                    sheetVisible ? "opacity-100" : "opacity-0"
                )}
                onClick={() => !saving && onClose()}
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


                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <div className="text-base font-black text-gray-900">
                        Sell on ekariMarket
                        {catalogLoading && (
                            <span className="ml-2 text-[11px] font-semibold text-gray-400">(loading catalog…)</span>
                        )}
                    </div>
                    <button
                        onClick={() => !saving && !publishing && onClose()}
                        disabled={saving || publishing}
                        className="w-10 h-10 grid place-items-center rounded-full hover:bg-gray-50 disabled:opacity-50"
                        aria-label="Close"
                    >
                        <IoClose size={20} />
                    </button>
                </div>

                {/* Stepper label */}
                <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="font-bold text-gray-800">
                        {modalStep === "form" ? "Listing details" : "Choose package"}
                    </div>
                    {draftListingId && (
                        <div className="text-[11px] text-gray-500">
                            Draft: <span className="font-mono">{draftListingId}</span>
                        </div>
                    )}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto pr-1 mt-2">
                    {modalStep === "form" ? FormStep : PlanStep}
                </div>


                {/* Footer nav */}
                <div className="mt-3 mb-4 flex items-center justify-between gap-3">
                    <button
                        onClick={onBack}
                        disabled={(modalStep === "form" && step === 0) || saving || publishing}
                        className={clsx(
                            "h-11 px-4 rounded-xl border font-bold inline-flex items-center gap-2 disabled:opacity-60",
                            (modalStep === "form" && step === 0) ? "text-gray-400 border-gray-200" : "text-gray-800 border-gray-200 hover:bg-gray-50"
                        )}
                    >
                        <IoChevronBack />
                        Back
                    </button>

                    {modalStep === "form" ? (
                        step < 4 ? (
                            <button
                                onClick={onNext}
                                disabled={!canNext || saving || publishing}
                                className="h-11 px-5 rounded-xl font-black inline-flex items-center gap-2 text-white disabled:opacity-60"
                                style={{ backgroundColor: canNext ? EKARI.gold : "#9CA3AF" }}
                            >
                                Next
                                <IoChevronForward />
                            </button>
                        ) : (<>
                            {slots.limit !== null ? (
                                <div className="text-[11px] text-gray-500">
                                    Active listings: {slots.used}/{slots.limit} • {slots.remaining} slots left
                                </div>
                            ) : (
                                <div className="text-[11px] text-gray-500">
                                    Active listings: {slots.used} • Unlimited plan
                                </div>
                            )}
                            <button
                                onClick={onFinish}
                                disabled={saving || publishing || !canPublish}
                                className="h-11 px-5 rounded-xl text-white font-black inline-flex items-center gap-2 disabled:opacity-60 hover:opacity-90"
                                style={{ backgroundColor: canPublish ? EKARI.gold : "#9CA3AF" }}
                            >
                                {saving ? (
                                    <span>Saving…</span>
                                ) : (
                                    <>
                                        <IoCheckmarkDone />
                                        {isSubActive(sub) ? "Publish" : "Continue"}
                                    </>
                                )}
                            </button>

                        </>)
                    ) : (
                        <button
                            onClick={() => {
                                // On plan step, right button can just close or do nothing
                                ui.alert("Pick a plan above (Free or Paid) to continue.");
                            }}
                            className="h-11 px-5 rounded-xl font-black inline-flex items-center gap-2 text-white"
                            style={{ backgroundColor: EKARI.gold }}
                        >
                            Select a plan above
                        </button>
                    )}
                </div>

            </div>
            <ListingLimitDialogSimple
                open={limitOpen}
                message={limitMsg}
                onClose={() => setLimitOpen(false)}
                onUpgrade={() => setModalStep("plan")}
            />
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
            {/* NEW: Polygon picker for arable land */}
            {
                polygonModalOpen && (
                    <LandPolygonPickerModal
                        initialCenter={
                            landCenter ||
                            coords || {
                                latitude: -1.286389,
                                longitude: 36.817223,
                            }
                        }
                        initialPolygon={landPolygon}
                        onCancel={() => setPolygonModalOpen(false)}
                        onUse={({ text, center, polygon }) => {
                            setPlaceText(text);
                            setLandCenter(center);
                            setCoords(center); // keep using coords for search / existing logic
                            setLandPolygon(polygon);
                            setPolygonModalOpen(false);
                        }}
                    />
                )
            }
            {ui.modal}

        </div >,
        document.body
    );
}
