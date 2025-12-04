"use client";

import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
    doc,
    getDoc,
    collection,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    setDoc,
    deleteDoc,
    where,
    runTransaction,
    getFirestore,
    Timestamp,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "@/lib/firebase";
import {
    IoArrowBack,
    IoChatbubbleEllipsesOutline,
    IoImageOutline,
    IoPricetagOutline,
    IoStar,
    IoStarOutline,
    IoTimeOutline,
    IoCheckmarkCircle,
    IoCloseCircle,
    IoTrashOutline,
    IoCreateOutline,
    IoClose,
    IoThumbsUp,
    IoThumbsUpOutline,
    IoCheckmark,
    IoExpandOutline,
    IoContractOutline,
    IoAdd,
    IoRemove,
    IoChevronBack,
    IoChevronForward,
    IoLocationOutline,
    IoCubeOutline,
    IoLeafOutline, // for tree use-case
} from "react-icons/io5";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import SellerReviewsSection from "@/app/components/SellerReviewsSection";

/* ================== Types ================== */
export type CurrencyCode = "KES" | "USD";
type Review = {
    id: string;
    userId: string;
    rating: number;
    text?: string | null;
    helpfulCount?: number;
    createdAt?: any;
    updatedAt?: any;
};

type ReviewerLite = {
    id: string;
    name: string;
    photoURL: string | null;
};

type ProductPlace = {
    text?: string;
    county?: string;
    town?: string;
};

type ProductLocation = {
    latitude: number;
    longitude: number;
};

type LandPoint = { lat: number; lng: number };

type ProductDoc = {
    id: string;
    name: string;
    currency?: CurrencyCode;
    price: number;
    category?: string;
    imageUrl?: string;
    imageUrls?: string[];
    sellerId: string;
    createdAt?: Timestamp | any;
    type?: string;
    unit?: string;
    typicalPackSize?: number | string;
    rate?: string;
    billingUnit?: string;
    nameLower?: string;
    categoryLower?: string;
    status?: "active" | "sold" | "reserved" | "hidden";
    sold?: boolean;
    place?: ProductPlace;
    location?: ProductLocation;
    coords?: ProductLocation; // in case some docs used coords instead of location
    useCase?: string;
    useCaseLower?: string;

    // 👇 NEW: arable land polygon
    landPolygon?: LandPoint[];
};

// ===== Theme =====
const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
};

const KES = (n: number) =>
    "KSh " + (n || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 });
const USD = (n: number) =>
    "USD " + (n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

function formatMoney(
    value: number | string | null | undefined,
    currency: CurrencyCode | undefined
): string {
    const n =
        typeof value === "string"
            ? Number(value || 0)
            : typeof value === "number"
                ? value
                : 0;

    const safeCurrency: CurrencyCode =
        currency === "USD" || currency === "KES" ? currency : "KES";

    if (!n || n <= 0) {
        return safeCurrency === "USD" ? "USD 0.00" : "KSh 0";
    }

    return safeCurrency === "USD" ? USD(n) : KES(n);
}
// Firestore helpers
const reviewDocRef = (dbi: any, listingId: string, reviewUserId: string) =>
    doc(dbi, "marketListings", String(listingId), "reviews", String(reviewUserId));
const voteRef = (dbi: any, listingId: string, reviewUserId: string, voterId: string) =>
    doc(dbi, "reviewVotes", `${listingId}_${reviewUserId}_${voterId}`);

/* ------------- Google Maps helpers ------------- */

const NAIROBI = { latitude: -1.286389, longitude: 36.817223 };

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
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&v=weekly`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve((window as any).google || null);
        script.onerror = (e) => reject(e);
        document.head.appendChild(script);
    });
}

/**
 * Read-only map preview (marker only)
 */
function MapPreview({
    center,
    height = 220,
}: {
    center: { latitude: number; longitude: number } | null;
    height?: number;
}) {
    const mapDivRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<google.maps.Map | null>(null);
    const markerRef = useRef<google.maps.Marker | null>(null);
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    const [mapType, setMapType] = useState<"roadmap" | "hybrid">("roadmap");
    const [mapReady, setMapReady] = useState(false);

    // Init map ONCE (or when center changes), not on mapType toggle
    useEffect(() => {
        let alive = true;

        (async () => {
            const g = await loadGoogleMaps(apiKey);
            if (!alive || !g || !mapDivRef.current) return;

            const fallback = NAIROBI;
            const init = center ?? fallback;

            if (!mapRef.current) {
                mapRef.current = new g.maps.Map(mapDivRef.current, {
                    center: { lat: init.latitude, lng: init.longitude },
                    zoom: center ? 13 : 11,
                    disableDefaultUI: true,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                    zoomControl: true,
                    mapTypeId: g.maps.MapTypeId.ROADMAP,
                });
                setMapReady(true);
            } else {
                mapRef.current.setCenter(
                    new g.maps.LatLng(init.latitude, init.longitude)
                );
            }
        })();

        return () => {
            alive = false;
        };
    }, [apiKey, center?.latitude, center?.longitude]);

    // Toggle SAT / MAP without recreating map
    useEffect(() => {
        const g = (window as any).google as typeof google | undefined;
        if (!g || !mapRef.current) return;

        mapRef.current.setMapTypeId(
            mapType === "hybrid"
                ? g.maps.MapTypeId.HYBRID
                : g.maps.MapTypeId.ROADMAP
        );
    }, [mapType]);

    // Add / update marker once map is ready
    useEffect(() => {
        const g = (window as any).google as typeof google | undefined;
        if (!g || !mapRef.current || !center || !mapReady) return;

        const latlng = new g.maps.LatLng(center.latitude, center.longitude);

        if (!markerRef.current) {
            markerRef.current = new g.maps.Marker({
                map: mapRef.current,
                position: latlng,
                draggable: false,
            });
        } else {
            markerRef.current.setPosition(latlng);
        }
    }, [center?.latitude, center?.longitude, mapReady]);

    return (
        <div
            className="relative mt-2"
            style={{
                borderRadius: 12,
                overflow: "hidden",
                border: `1px solid ${EKARI.hair}`,
            }}
        >
            <div
                ref={mapDivRef}
                style={{ height }}
            />

            {/* SAT / MAP toggle */}
            <button
                type="button"
                onClick={() =>
                    setMapType((prev) => (prev === "roadmap" ? "hybrid" : "roadmap"))
                }
                className="absolute top-2 right-2 z-10 w-10 h-10 rounded-full bg-white/90 border border-gray-200 text-[10px] font-bold flex items-center justify-center shadow-sm hover:bg-white"
                title="Toggle satellite view"
            >
                {mapType === "roadmap" ? "SAT" : "MAP"}
            </button>
        </div>
    );
}


/**
 * NEW: Read-only map preview for arable land polygon
 */
function MapPolygonPreview({
    center,
    polygon,
    height = 220,
}: {
    center: { latitude: number; longitude: number } | null;
    polygon: LandPoint[];
    height?: number;
}) {
    const mapDivRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<google.maps.Map | null>(null);
    const polygonRef = useRef<google.maps.Polygon | null>(null);
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    const [mapReady, setMapReady] = useState(false);
    const [mapType, setMapType] = useState<"roadmap" | "hybrid">("roadmap");

    // Init map
    useEffect(() => {
        let alive = true;
        (async () => {
            const g = await loadGoogleMaps(apiKey);
            if (!alive || !g || !mapDivRef.current) return;

            const fallback = NAIROBI;
            const init = center ?? fallback;

            if (!mapRef.current) {
                mapRef.current = new g.maps.Map(mapDivRef.current, {
                    center: { lat: init.latitude, lng: init.longitude },
                    zoom: 13,
                    disableDefaultUI: true,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                    zoomControl: true,
                    mapTypeId:
                        mapType === "hybrid"
                            ? g.maps.MapTypeId.HYBRID
                            : g.maps.MapTypeId.ROADMAP,
                });
            } else {
                mapRef.current.setCenter(
                    new g.maps.LatLng(init.latitude, init.longitude)
                );
            }

            setMapReady(true);
        })();
        return () => {
            alive = false;
        };
    }, [apiKey, center?.latitude, center?.longitude, mapType]);

    // Update map type when toggle changes
    useEffect(() => {
        const g = (window as any).google as typeof google | undefined;
        if (!g || !mapRef.current) return;
        mapRef.current.setMapTypeId(
            mapType === "hybrid"
                ? g.maps.MapTypeId.HYBRID
                : g.maps.MapTypeId.ROADMAP
        );
    }, [mapType]);

    // Draw / update polygon once map is ready
    useEffect(() => {
        const g = (window as any).google as typeof google | undefined;
        if (!g || !mapRef.current || !mapReady || !polygon?.length) return;

        if (!polygonRef.current) {
            polygonRef.current = new g.maps.Polygon({
                map: mapRef.current,
                paths: polygon,
                strokeColor: "#10B981",
                strokeOpacity: 0.9,
                strokeWeight: 2,
                fillColor: "#10B981",
                fillOpacity: 0.18,
            });
        } else {
            polygonRef.current.setPath(polygon);
        }

        const bounds = new g.maps.LatLngBounds();
        polygon.forEach((p) => bounds.extend(new g.maps.LatLng(p.lat, p.lng)));
        mapRef.current!.fitBounds(bounds);
    }, [polygon, mapReady]);

    return (
        <div
            className="relative mt-2"
            style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${EKARI.hair}` }}
        >
            <div
                ref={mapDivRef}
                style={{
                    height,
                }}
            />

            {/* SAT / MAP toggle */}
            <button
                type="button"
                onClick={() =>
                    setMapType((prev) => (prev === "roadmap" ? "hybrid" : "roadmap"))
                }
                className="absolute top-2 right-2 z-10 w-10 h-10 rounded-full bg-white/90 border border-gray-200 text-[10px] font-bold flex items-center justify-center shadow-sm hover:bg-white"
                title="Toggle satellite view"
            >
                {mapType === "roadmap" ? "SAT" : "MAP"}
            </button>
        </div>
    );
}


/* ================== Component ================== */

export default function ProductDetailsClient({
    params,
}: { params: { productid: string } }) {
    const router = useRouter();
    const { productid } = params;

    const auth = getAuth();
    const dbi = getFirestore();

    const [loading, setLoading] = useState(true);
    const [product, setProduct] = useState<ProductDoc | null>(null);
    const [seller, setSeller] = useState<any>(null);

    // gallery (page)
    const [active, setActive] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);
    const autoplayRef = useRef<NodeJS.Timeout | null>(null);
    const [isPaused, setIsPaused] = useState(false);
    const touchStartX = useRef<number | null>(null);
    const touchEndX = useRef<number | null>(null);
    const swipeThreshold = 50;

    // fullscreen gallery
    const [fsOpen, setFsOpen] = useState(false);
    const [fsIndex, setFsIndex] = useState(0);
    const [fsScale, setFsScale] = useState(1); // 1..4
    const [fsTx, setFsTx] = useState(0);
    const [fsTy, setFsTy] = useState(0);
    const drag = useRef<{ x: number; y: number; sx: number; sy: number } | null>(null);

    // reviews
    const [reviews, setReviews] = useState<Review[]>([]);
    const [avgRating, setAvgRating] = useState(0);
    const [reviewCount, setReviewCount] = useState(0);
    const [reviewers, setReviewers] = useState<Record<string, ReviewerLite>>({});
    const reviewersRef = useRef<Record<string, ReviewerLite>>({});
    const [myHelpful, setMyHelpful] = useState<Record<string, true>>({});

    useEffect(() => {
        reviewersRef.current = reviewers;
    }, [reviewers]);

    // ===== Load product & seller =====
    useEffect(() => {
        (async () => {
            try {
                const pRef = doc(dbi, "marketListings", productid);
                const pSnap = await getDoc(pRef);
                if (!pSnap.exists()) {
                    router.push("/market");
                    return;
                }
                const p = { id: pSnap.id, ...(pSnap.data() as any) } as ProductDoc;
                setProduct(p);

                if (p.sellerId) {
                    const uRef = doc(dbi, "users", p.sellerId);
                    const uSnap = await getDoc(uRef);
                    setSeller(
                        uSnap.exists()
                            ? { id: uSnap.id, ...(uSnap.data() as any) }
                            : { id: p.sellerId }
                    );
                }
            } finally {
                setLoading(false);
            }
        })();
    }, [dbi, productid, router]);

    // ===== Live reviews + cache reviewer meta =====
    useEffect(() => {
        const qRef = query(
            collection(db, "marketListings", productid, "reviews"),
            orderBy("createdAt", "desc")
        );
        const unsub = onSnapshot(qRef, async (snap) => {
            const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Review[];
            setReviews(rows);

            if (rows.length) {
                const total = rows.reduce((s, r) => s + (Number(r.rating) || 0), 0);
                setAvgRating(total / rows.length);
                setReviewCount(rows.length);
            } else {
                setAvgRating(0);
                setReviewCount(0);
            }

            const missing = rows
                .map((r) => r.userId)
                .filter((uid, i, a) => a.indexOf(uid) === i)
                .filter((uid) => !reviewersRef.current[uid]);

            if (missing.length) {
                const next: Record<string, ReviewerLite> = {};
                await Promise.all(
                    missing.map(async (uid) => {
                        try {
                            const us = await getDoc(doc(dbi, "users", uid));
                            const ud = us.data() || {};
                            const name =
                                (ud.firstName
                                    ? `${ud.firstName} ${ud.surname || ""}`.trim()
                                    : null) ||
                                ud.displayName ||
                                ud.handle ||
                                "User";
                            next[uid] = { id: uid, name, photoURL: ud.photoURL || null };
                        } catch {
                            next[uid] = { id: uid, name: "User", photoURL: null };
                        }
                    })
                );
                setReviewers((prev) => ({ ...prev, ...next }));
            }
        });
        return () => unsub();
    }, [dbi, productid]);

    // ===== My helpful votes =====
    useEffect(() => {
        const me = auth.currentUser;
        if (!me) return;

        const qVotes = query(
            collection(db, "reviewVotes"),
            where("userId", "==", me.uid),
            where("listingId", "==", productid)
        );

        const unsub = onSnapshot(qVotes, (snap) => {
            const map: Record<string, true> = {};
            snap.forEach((d) => {
                const rv = d.data() as any;
                if (rv?.reviewUserId) map[String(rv.reviewUserId)] = true;
            });
            setMyHelpful(map);
        });

        return () => unsub();
    }, [auth.currentUser, productid]);

    // ===== Gallery helpers (page) =====
    const images = useMemo(() => {
        if (!product) return [];
        const arr = product.imageUrls?.length
            ? product.imageUrls
            : product.imageUrl
                ? [product.imageUrl]
                : [];
        return (arr || []).filter(Boolean);
    }, [product]);

    const goTo = (i: number) => {
        if (scrollRef.current) {
            const w = scrollRef.current.clientWidth;
            scrollRef.current.scrollTo({ left: w * i, behavior: "smooth" });
        }
        setActive(i);
    };

    useEffect(() => {
        if (isPaused || images.length <= 1) return;
        autoplayRef.current = setInterval(() => {
            setActive((p) => {
                const n = p + 1 < images.length ? p + 1 : 0;
                goTo(n);
                return n;
            });
        }, 5000);
        return () => {
            if (autoplayRef.current) clearInterval(autoplayRef.current);
        };
    }, [isPaused, images.length]);

    const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        touchStartX.current = e.touches[0].clientX;
    };
    const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        touchEndX.current = e.touches[0].clientX;
    };
    const onTouchEnd = () => {
        if (!touchStartX.current || !touchEndX.current) return;
        const diff = touchStartX.current - touchEndX.current;
        if (Math.abs(diff) > swipeThreshold) {
            diff > 0
                ? goTo(active + 1 < images.length ? active + 1 : 0)
                : goTo(active > 0 ? active - 1 : images.length - 1);
        }
        touchStartX.current = touchEndX.current = null;
    };

    // ===== Fullscreen helpers =====
    const openFullscreen = (index: number) => {
        setFsIndex(index);
        setFsScale(1);
        setFsTx(0);
        setFsTy(0);
        setFsOpen(true);
    };
    const closeFullscreen = () => setFsOpen(false);
    const fsPrev = () => {
        const next = fsIndex > 0 ? fsIndex - 1 : images.length - 1;
        setFsIndex(next);
        setFsScale(1);
        setFsTx(0);
        setFsTy(0);
    };
    const fsNext = () => {
        const next = fsIndex + 1 < images.length ? fsIndex + 1 : 0;
        setFsIndex(next);
        setFsScale(1);
        setFsTx(0);
        setFsTy(0);
    };
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const zoomBy = (delta: number) => setFsScale((s) => clamp(s + delta, 1, 4));
    const onFsWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
        e.preventDefault();
        zoomBy(e.deltaY > 0 ? -0.2 : 0.2);
    };
    const onFsDouble = () => setFsScale((s) => (s > 1 ? 1 : 2));
    const onFsPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
        if (fsScale === 1) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { x: fsTx, y: fsTy, sx: e.clientX, sy: e.clientY };
    };
    const onFsPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
        if (!drag.current) return;
        const dx = e.clientX - drag.current.sx;
        const dy = e.clientY - drag.current.sy;
        const limit = 240 * (fsScale - 1);
        setFsTx(clamp(drag.current.x + dx, -limit, limit));
        setFsTy(clamp(drag.current.y + dy, -limit, limit));
    };
    const onFsPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        drag.current = null;
    };
    useEffect(() => {
        if (!fsOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeFullscreen();
            if (e.key === "ArrowLeft") fsPrev();
            if (e.key === "ArrowRight") fsNext();
            if (e.key === "+") zoomBy(0.2);
            if (e.key === "-") zoomBy(-0.2);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [fsOpen, fsIndex, images.length]);

    // ===== Review modal & actions =====
    const me = auth.currentUser;
    const myReview = useMemo(
        () => (me ? reviews.find((r) => r.userId === me.uid) : undefined),
        [reviews, me]
    );
    const [rvVisible, setRvVisible] = useState(false);
    const [rvStars, setRvStars] = useState(5);
    const [rvText, setRvText] = useState("");

    const openReview = () => {
        if (!me) return alert("Please sign in to leave a review.");
        if (me.uid === product?.sellerId) return alert("You can’t review your own listing.");
        if (myReview) {
            setRvStars(myReview.rating || 5);
            setRvText(myReview.text || "");
        } else {
            setRvStars(5);
            setRvText("");
        }
        setRvVisible(true);
    };

    const submitReview = async () => {
        const user = auth.currentUser;
        if (!user) return alert("Please sign in.");
        const rating = Math.max(1, Math.min(5, Math.round(rvStars || 5)));
        const text = rvText.trim() || null;
        try {
            const rRef = reviewDocRef(dbi, productid, user.uid);
            await setDoc(
                rRef,
                myReview
                    ? { rating, text, updatedAt: serverTimestamp() }
                    : {
                        userId: user.uid,
                        rating,
                        text,
                        helpfulCount: 0,
                        createdAt: serverTimestamp(),
                        updatedAt: null,
                    },
                { merge: !!myReview }
            );
            setRvVisible(false);
        } catch (e: any) {
            alert(e?.message || "Failed. Try again.");
        }
    };

    const deleteMyReview = async () => {
        if (!myReview || !me) return;
        try {
            await deleteDoc(reviewDocRef(dbi, productid, me.uid));
            setRvVisible(false);
        } catch (e: any) {
            alert(e?.message || "Failed. Try again.");
        }
    };

    async function markHelpful(listingId: string, reviewUserId: string, voterId: string) {
        const rRef = reviewDocRef(dbi, listingId, reviewUserId);
        const vRef = voteRef(dbi, listingId, reviewUserId, voterId);
        await runTransaction(dbi, async (tx) => {
            const vSnap = await tx.get(vRef);
            if (vSnap.exists()) return;
            const rSnap = await tx.get(rRef);
            if (!rSnap.exists()) return;
            const cur = rSnap.data() || {};
            const curCount = Number(cur.helpfulCount || 0);
            tx.set(vRef, {
                listingId: String(listingId),
                reviewUserId,
                userId: voterId,
                createdAt: serverTimestamp(),
            });
            tx.update(rRef, { helpfulCount: curCount + 1 });
        });
    }

    async function unmarkHelpful(listingId: string, reviewUserId: string, voterId: string) {
        const rRef = reviewDocRef(dbi, listingId, reviewUserId);
        const vRef = voteRef(dbi, listingId, reviewUserId, voterId);
        await runTransaction(dbi, async (tx) => {
            const vSnap = await tx.get(vRef);
            if (!vSnap.exists()) return;
            const rSnap = await tx.get(rRef);
            if (!rSnap.exists()) return;
            const cur = rSnap.data() || {};
            const curCount = Number(cur.helpfulCount || 0);
            tx.delete(vRef);
            tx.update(rRef, { helpfulCount: Math.max(0, curCount - 1) });
        });
    }

    const toggleHelpful = async (reviewUserId: string) => {
        const user = auth.currentUser;
        if (!user) return alert("Please log in first.");
        if (user.uid === reviewUserId) return; // extra safety

        try {
            if (myHelpful[reviewUserId]) {
                await unmarkHelpful(String(productid), reviewUserId, user.uid);
            } else {
                await markHelpful(String(productid), reviewUserId, user.uid);
            }
        } catch (e: any) {
            if (e?.code === "permission-denied") {
                console.warn("Voting not allowed (likely self-vote).");
                return;
            }
            alert(e?.message || "Failed. Try again.");
        }
    };

    // ===== Loading / missing =====
    if (loading)
        return (
            <div className="flex h-screen items-center justify-center text-gray-500">
                <BouncingBallLoader />
            </div>
        );

    if (!product)
        return (
            <div className="flex h-screen items-center justify-center text-gray-500">
                Product not found
            </div>
        );

    const isOwner = product.sellerId === auth.currentUser?.uid;
    const isSold = product.status === "sold" || product.sold;
    const isReserved = product.status === "reserved";
    const isTree = product.type === "tree";
    const isLand = product.type === "arableLand"; // 👈 NEW

    const created =
        product.createdAt?.toDate?.() instanceof Date
            ? (product.createdAt as Timestamp).toDate()
            : null;

    // ===== Location label + center from product (place + location) =====
    let locationLabel: string | null = null;
    let center: { latitude: number; longitude: number } | null = null;
    const landPolygon: LandPoint[] | undefined = product.landPolygon;

    if (product) {
        const place = (product.place || {}) as ProductPlace;
        const town = place.town || "";
        const county = place.county || "";
        const text = place.text || "";

        const bits = [town, county].filter(Boolean);
        locationLabel = bits.length ? bits.join(", ") : text || null;

        const rawLocation = (product.location || product.coords) as
            | ProductLocation
            | null
            | undefined;

        if (
            rawLocation &&
            typeof rawLocation.latitude === "number" &&
            typeof rawLocation.longitude === "number"
        ) {
            center = {
                latitude: rawLocation.latitude,
                longitude: rawLocation.longitude,
            };
        }
    }
    const makeThreadId = (a: string, b: string) => [a, b].sort().join("_");
    // message click
    const handleMessageClick = (seller: any) => {
        if (!auth.currentUser?.uid) {
            router.replace("/login");
            return;
        }
        if (auth.currentUser?.uid === seller.id) return;

        const peerId = seller.id;
        const peerName = seller.name || seller.handle || "";
        const peerPhotoURL = seller.photoURL || "";
        const peerHandle = seller.handle || "";

        const threadId = makeThreadId(auth.currentUser?.uid, peerId);
        const qs = new URLSearchParams();
        qs.set("peerId", peerId);
        if (peerName) qs.set("peerName", peerName);
        if (peerPhotoURL) qs.set("peerPhotoURL", peerPhotoURL);
        if (peerHandle) qs.set("peerHandle", peerHandle);

        router.push(`/messages/${encodeURIComponent(threadId)}?${qs.toString()}`);
    };

    // ===== Render =====
    return (
        <main className="min-h-screen pb-5 w-full">
            {/* Header (sticky) */}
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-[color:var(--hair,#E5E7EB)] flex items-center h-14 px-4">
                <button
                    onClick={() => router.back()}
                    className="w-10 h-10 rounded-full border border-[color:var(--hair,#E5E7EB)] grid place-items-center hover:bg-gray-50"
                >
                    <IoArrowBack className="text-[color:var(--text,#0F172A)]" size={20} />
                </button>
                <h1 className="ml-3 font-black text-lg text-[color:var(--text,#0F172A)]">
                    Product Details
                </h1>
            </div>

            {/* Carousel */}
            <div
                className="relative w-full max-w-4xl mx-auto mt-4 rounded-2xl overflow-hidden shadow-sm bg-gray-100"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {images.length ? (
                    <>
                        <div
                            ref={scrollRef}
                            className="flex overflow-x-hidden snap-x snap-mandatory h-72 md:h-96 scroll-smooth"
                            onScroll={(e) => {
                                const L = e.currentTarget.scrollLeft,
                                    W = e.currentTarget.clientWidth;
                                setActive(Math.round(L / W));
                            }}
                        >
                            {images.map((url: string, i: number) => (
                                <div
                                    key={i}
                                    className="flex-shrink-0 snap-center w-full h-full relative"
                                >
                                    <Image
                                        src={url}
                                        alt={`${product.name} ${i + 1}`}
                                        fill
                                        className="object-cover cursor-zoom-in"
                                        sizes="100vw"
                                        priority={i === 0}
                                        onClick={() => openFullscreen(i)}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* gradient fades */}
                        <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/15 to-transparent pointer-events-none" />
                        <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/15 to-transparent pointer-events-none" />

                        {/* nav arrows */}
                        {images.length > 1 && (
                            <>
                                <button
                                    onClick={() =>
                                        goTo(active > 0 ? active - 1 : images.length - 1)
                                    }
                                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/85 hover:bg-white rounded-full p-2 shadow-md transition"
                                    aria-label="Previous image"
                                >
                                    <IoChevronBack size={20} className="text-gray-700" />
                                </button>
                                <button
                                    onClick={() =>
                                        goTo(active + 1 < images.length ? active + 1 : 0)
                                    }
                                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/85 hover:bg-white rounded-full p-2 shadow-md transition"
                                    aria-label="Next image"
                                >
                                    <IoChevronForward size={20} className="text-gray-700" />
                                </button>
                            </>
                        )}

                        {/* dots + count */}
                        <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center gap-1">
                            <div className="flex gap-1">
                                {images.map((_: any, i: number) => (
                                    <button
                                        key={i}
                                        onClick={() => goTo(i)}
                                        className={`w-2.5 h-2.5 rounded-full ${i === active ? "bg-white" : "bg-white/60"
                                            }`}
                                    />
                                ))}
                            </div>
                            <div className="text-[11px] font-bold text-white/85 bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm">
                                {active + 1} / {images.length}
                            </div>
                        </div>

                        {/* fullscreen button */}
                        <button
                            onClick={() => openFullscreen(active)}
                            className="absolute top-3 right-3 bg-white/85 hover:bg-white rounded-full p-2 shadow-md"
                            aria-label="View fullscreen"
                            title="View fullscreen"
                        >
                            <IoExpandOutline size={18} className="text-gray-800" />
                        </button>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-72 text-gray-400">
                        <IoImageOutline size={40} />
                        <p>No image</p>
                    </div>
                )}
            </div>

            {/* Info card */}
            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm mt-4 p-5 border border-[color:var(--hair,#E5E7EB)]">
                <h2 className="font-black text-2xl text-[color:var(--text,#0F172A)]">
                    {product.name}
                </h2>
                <p className="text-[color:var(--dim,#6B7280)] text-sm">
                    {product.type} {product.unit && `• ${product.unit}`}
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                    {/* Category pill */}
                    {product.category && (
                        <span className="inline-flex items-center gap-1 border border-[color:var(--hair,#E5E7EB)] bg-[#FAFAFA] text-xs font-semibold rounded-full px-3 py-1">
                            <IoPricetagOutline size={14} />
                            {product.category}
                        </span>
                    )}

                    {/* Unit pill (pack + unit) */}
                    {product.unit && (
                        <span className="inline-flex items-center gap-1 border border-[color:var(--hair,#E5E7EB)] bg-[#F9FAFB] text-xs font-semibold rounded-full px-3 py-1">
                            <IoCubeOutline size={14} className="text-[color:var(--dim,#6B7280)]" />
                            <span>
                                {product.typicalPackSize ? `${product.typicalPackSize} ` : ""}
                                {product.unit}
                            </span>
                        </span>
                    )}

                    {/* 🌳 Tree use-case pill */}
                    {isTree && product.useCase && (
                        <span className="inline-flex items-center gap-1 border border-emerald-200 bg-emerald-50 text-xs font-semibold rounded-full px-3 py-1">
                            <IoLeafOutline size={14} className="text-emerald-600" />
                            <span className="text-emerald-700 truncate max-w-[180px]">
                                {product.useCase}
                            </span>
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <span
                        className="text-3xl font-black"
                        style={{ color: EKARI.forest }}
                    >
                        {product.type === "lease" || product.type === "service"
                            ? `${product.rate ? KES(Number(product.rate)) : "-"}${product.billingUnit ? ` / ${product.billingUnit}` : ""
                            }`
                            : formatMoney(product.price, product.currency)}
                    </span>
                    <span
                        className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-3 py-1 rounded-full ${isSold
                            ? "bg-red-600 text-white"
                            : isReserved
                                ? "bg-yellow-500 text-white"
                                : "bg-emerald-600 text-white"
                            }`}
                    >
                        {isSold ? (
                            <IoCloseCircle size={14} />
                        ) : isReserved ? (
                            <IoTimeOutline size={14} />
                        ) : (
                            <IoCheckmarkCircle size={14} />
                        )}
                        {isSold ? "Sold" : isReserved ? "Reserved" : "Available"}
                    </span>
                </div>

                {created && (
                    <p className="text-[color:var(--dim,#6B7280)] text-sm mt-1">
                        Posted {created.toLocaleDateString()}
                    </p>
                )}

                {/* ===== Location & Map (read-only) ===== */}
                {(locationLabel || center) && (
                    <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F3F4F6] border border-[color:var(--hair,#E5E7EB)]">
                                <IoLocationOutline
                                    size={18}
                                    className="text-[color:var(--dim,#6B7280)]"
                                />
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--dim,#6B7280)]">
                                    {isLand ? "Land Parcel Location" : "Location"}
                                </p>
                                {locationLabel && (
                                    <p className="text-sm font-semibold text-[color:var(--text,#0F172A)] truncate">
                                        {locationLabel}
                                    </p>
                                )}
                                {center && (
                                    <a
                                        href={`https://www.google.com/maps?q=${center.latitude},${center.longitude}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center text-[11px] font-semibold text-[#2563EB] hover:underline mt-0.5"
                                    >
                                        View on Google Maps
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* For arable land with polygon -> polygon preview, otherwise marker only */}
                        {center && landPolygon?.length && landPolygon.length >= 3 ? (
                            <MapPolygonPreview center={center} polygon={landPolygon} />
                        ) : center ? (
                            <MapPreview center={center} />
                        ) : null}
                    </div>
                )}
            </div>

            {/* Seller card */}
            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm mt-4 p-5 border border-[color:var(--hair,#E5E7EB)]">
                <div className="flex items-center gap-3">
                    <Image
                        src={seller?.photoURL || "/avatar-placeholder.png"}
                        alt="Seller"
                        width={44}
                        height={44}
                        className="rounded-full object-cover border border-[color:var(--hair,#E5E7EB)] bg-[#F3F4F6]"
                    />
                </div>

                <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-[color:var(--text,#0F172A)] truncate">
                            {seller?.firstName || seller?.displayName || "Seller"}
                        </p>
                        {seller?.handle && (
                            <p className="text-[color:var(--dim,#6B7280)] text-xs truncate">
                                {seller.handle}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                        <IoStar className="text-amber-400" size={14} />
                        <span className="text-xs font-extrabold text-[color:var(--text,#0F172A)]">
                            {avgRating.toFixed(1)} · {reviewCount}
                        </span>
                    </div>
                </div>

                <div className="mt-3">
                    {!isOwner ? (
                        <button
                            onClick={() => handleMessageClick(seller)}
                            className="w-full h-11 rounded-xl flex items-center justify-center gap-2 font-black text-white hover:opacity-95 transition"
                            style={{ backgroundColor: EKARI.gold }}
                        >
                            <IoChatbubbleEllipsesOutline size={18} />
                            Message seller
                        </button>
                    ) : (
                        <div className="w-full h-11 rounded-xl flex items-center justify-center font-black text-white bg-gray-300">
                            This is you
                        </div>
                    )}
                </div>
            </div>

            {/* Reviews */}
            {/* Seller Reviews (shared with profile page) */}
            {product.sellerId && (
                <SellerReviewsSection sellerId={product.sellerId} />
            )}
            {/**  <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm mt-4 p-5 border border-[color:var(--hair,#E5E7EB)]">
                <div className="flex items-center justify-between">
                    <h3 className="font-black text-[color:var(--text,#0F172A)] text-lg">
                        Reviews
                    </h3>
                    {!isOwner && (
                        <button
                            onClick={openReview}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-extrabold text-white hover:opacity-95"
                            style={{ backgroundColor: EKARI.forest }}
                        >
                            {myReview ? <IoCreateOutline size={16} /> : <IoStarOutline size={16} />}
                            {myReview ? "Edit Review" : "Leave Review"}
                        </button>
                    )}
                </div>

                {reviewCount > 0 && (
                    <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-[color:var(--text,#0F172A)]">
                                {avgRating.toFixed(1)}
                            </span>
                            <div className="flex items-center">
                                {Array.from({ length: 5 }).map((_, i) =>
                                    i < Math.round(avgRating) ? (
                                        <IoStar key={i} className="text-amber-400" size={16} />
                                    ) : (
                                        <IoStarOutline key={i} className="text-gray-300" size={16} />
                                    )
                                )}
                            </div>
                        </div>
                        <div className="text-sm font-semibold text-[color:var(--dim,#6B7280)]">
                            {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
                        </div>
                    </div>
                )}

                {reviews.length === 0 ? (
                    <p className="text-[color:var(--dim,#6B7280)] text-sm mt-2">
                        No reviews yet.
                    </p>
                ) : (
                    <div className="space-y-4 mt-3">
                        {reviews.map((r) => {
                            const u = reviewers[r.userId];
                            const mine = me?.uid === r.userId;
                            const ts = r.updatedAt || r.createdAt;
                            const d =
                                ts?.toDate?.() instanceof Date
                                    ? ts.toDate()
                                    : typeof ts === "number"
                                        ? new Date(ts)
                                        : undefined;

                            return (
                                <div
                                    key={r.id}
                                    className="pb-3 border-b border-[color:var(--hair,#E5E7EB)]"
                                >
                                    <div className="flex gap-3">
                                        <Image
                                            src={u?.photoURL || "/avatar-placeholder.png"}
                                            alt={u?.name || "User"}
                                            width={32}
                                            height={32}
                                            className="rounded-full h-8 w-8 object-cover bg-[#F3F4F6] border border-[color:var(--hair,#E5E7EB)]"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="font-extrabold text-[color:var(--text,#0F172A)] truncate">
                                                    {u?.name || "User"}
                                                </p>
                                                <span className="text-[11px] text-[color:var(--dim,#6B7280)]">
                                                    {d ? d.toLocaleDateString() : ""}
                                                </span>
                                            </div>

                                            <div className="mt-1 flex items-center">
                                                {Array.from({ length: 5 }).map((_, i) =>
                                                    i < (r.rating || 0) ? (
                                                        <IoStar key={i} className="text-amber-400" size={14} />
                                                    ) : (
                                                        <IoStarOutline key={i} className="text-gray-300" size={14} />
                                                    )
                                                )}
                                            </div>

                                            {!!r.text && (
                                                <p className="mt-2 text-sm text-[color:var(--text,#0F172A)]">
                                                    {r.text}
                                                </p>
                                            )}

                                            <div className="mt-2 flex items-center gap-2">
                                                {!mine && (
                                                    <button
                                                        onClick={() => toggleHelpful(r.userId)}
                                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-extrabold transition
      ${myHelpful[r.userId]
                                                                ? "bg-green-50 border-green-600 text-green-700"
                                                                : "bg-[#F6F7F7] border-[color:var(--hair,#E5E7EB)] text-[color:var(--text,#0F172A)]"
                                                            } hover:opacity-90`}
                                                        title="Mark as helpful"
                                                    >
                                                        {myHelpful[r.userId] ? (
                                                            <IoThumbsUp size={14} />
                                                        ) : (
                                                            <IoThumbsUpOutline size={14} />
                                                        )}
                                                        Helpful • {r.helpfulCount ?? 0}
                                                    </button>
                                                )}
                                                {mine && (
                                                    <span
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-extrabold opacity-60 cursor-not-allowed bg-[#F6F7F7] border-[color:var(--hair,#E5E7EB)] text-[color:var(--dim,#6B7280)]"
                                                        title="You can't vote your own review"
                                                    >
                                                        <IoThumbsUpOutline size={14} /> Helpful
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
*/}
            {/* Review modal 
            {rvVisible && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center md:justify-center">
                    <div className="w-full md:max-w-lg bg-white rounded-t-2xl md:rounded-2xl p-5 shadow-xl border border-[color:var(--hair,#E5E7EB)]">
                        <div className="flex items-center justify-between">
                            <h4 className="font-black text-[color:var(--text,#0F172A)]">
                                {myReview ? "Edit your review" : "Leave a review"}
                            </h4>
                            <button
                                onClick={() => setRvVisible(false)}
                                className="w-9 h-9 grid place-items-center rounded-full hover:bg-gray-100"
                            >
                                <IoClose size={18} />
                            </button>
                        </div>

                        <label className="mt-3 block text-xs font-bold text-[color:var(--dim,#6B7280)]">
                            Your rating
                        </label>
                        <div className="mt-2 flex items-center gap-2">
                            {Array.from({ length: 5 }).map((_, i) => {
                                const idx = i + 1;
                                const filled = idx <= rvStars;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => setRvStars(idx)}
                                        className="p-1 rounded hover:scale-105 transition"
                                    >
                                        {filled ? (
                                            <IoStar size={24} className="text-amber-400" />
                                        ) : (
                                            <IoStarOutline size={24} className="text-amber-400" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <label className="mt-4 block text-xs font-bold text-[color:var(--dim,#6B7280)]">
                            Your review (optional)
                        </label>
                        <textarea
                            value={rvText}
                            onChange={(e) => setRvText(e.target.value)}
                            rows={4}
                            maxLength={800}
                            placeholder="Share details about quality, delivery, or overall experience…"
                            className="mt-2 w-full rounded-xl border border-[color:var(--hair,#E5E7EB)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#233F39] focus:border-[#233F39]"
                        />

                        <div className="mt-4 flex items-center gap-2">
                            {myReview && (
                                <button
                                    onClick={deleteMyReview}
                                    className="inline-flex items-center gap-2 px-4 h-11 rounded-xl bg-red-600 text-white font-black hover:opacity-95"
                                >
                                    <IoTrashOutline size={18} /> Delete
                                </button>
                            )}
                            <div className="flex-1" />
                            <button
                                onClick={() => setRvVisible(false)}
                                className="px-4 h-11 rounded-xl bg-gray-500 text-white font-black hover:opacity-95"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitReview}
                                className="inline-flex items-center gap-2 px-4 h-11 rounded-xl text-white font-black hover:opacity-95"
                                style={{ backgroundColor: EKARI.forest }}
                            >
                                <IoCheckmark size={18} /> {myReview ? "Save" : "Submit"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
*/}
            {/* ===== Fullscreen Modal ===== */}
            {fsOpen && (
                <div className="fixed inset-0 z-[60] bg-black/90 text-white">
                    {/* top bar */}
                    <div className="absolute top-0 left-0 right-0 h-12 px-3 flex items-center justify-between">
                        <button
                            onClick={closeFullscreen}
                            className="w-9 h-9 grid place-items-center rounded-full hover:bg-white/10"
                            aria-label="Close"
                            title="Close"
                        >
                            <IoClose size={20} />
                        </button>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => zoomBy(-0.2)}
                                className="w-9 h-9 grid place-items-center rounded-full hover:bg-white/10"
                                title="Zoom out"
                            >
                                <IoRemove size={18} />
                            </button>
                            <button
                                onClick={() => setFsScale(1)}
                                className="px-2 h-9 rounded-full bg-white/10 text-xs font-bold"
                                title="Reset zoom"
                            >
                                {Math.round(fsScale * 100)}%
                            </button>
                            <button
                                onClick={() => zoomBy(0.2)}
                                className="w-9 h-9 grid place-items-center rounded-full hover:bg-white/10"
                                title="Zoom in"
                            >
                                <IoAdd size={18} />
                            </button>
                            <button
                                onClick={closeFullscreen}
                                className="w-9 h-9 grid place-items-center rounded-full hover:bg-white/10"
                                title="Exit fullscreen"
                            >
                                <IoContractOutline size={18} />
                            </button>
                        </div>
                    </div>

                    {/* image area */}
                    <div
                        className="h-full w-full flex items-center justify-center select-none"
                        onWheel={onFsWheel}
                        onDoubleClick={onFsDouble}
                        onPointerDown={onFsPointerDown}
                        onPointerMove={onFsPointerMove}
                        onPointerUp={onFsPointerUp}
                    >
                        <div
                            className="relative"
                            style={{
                                transform: `translate(${fsTx}px, ${fsTy}px) scale(${fsScale})`,
                                transition: drag.current ? "none" : "transform 120ms ease",
                            }}
                        >
                            <Image
                                src={images[fsIndex]}
                                alt={`image ${fsIndex + 1}`}
                                width={1600}
                                height={1000}
                                className="object-contain max-h-[80vh] md:max-h-[88vh] rounded"
                                priority
                            />
                        </div>

                        {/* prev/next */}
                        {images.length > 1 && (
                            <>
                                <button
                                    onClick={fsPrev}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center"
                                    aria-label="Previous"
                                >
                                    <IoChevronBack size={22} />
                                </button>
                                <button
                                    onClick={fsNext}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center"
                                    aria-label="Next"
                                >
                                    <IoChevronForward size={22} />
                                </button>
                            </>
                        )}

                        {/* counter */}
                        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[12px] font-bold bg-white/10 rounded-full px-3 py-1">
                            {fsIndex + 1} / {images.length}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
