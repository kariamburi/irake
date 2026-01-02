"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
    doc,
    getDoc,
    collection,
    query,
    orderBy,
    onSnapshot,
    getFirestore,
    Timestamp,
    QuerySnapshot,
    DocumentData,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "@/lib/firebase";
import {
    IoArrowBack,
    IoChatbubbleEllipsesOutline,
    IoImageOutline,
    IoPricetagOutline,
    IoStar,
    IoTimeOutline,
    IoCheckmarkCircle,
    IoCloseCircle,
    IoExpandOutline,
    IoContractOutline,
    IoAdd,
    IoRemove,
    IoChevronBack,
    IoChevronForward,
    IoCubeOutline,
    IoLeafOutline,
} from "react-icons/io5";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import SellerReviewsSection from "@/app/components/SellerReviewsSection";
import { createPortal } from "react-dom";
import AppShell from "@/app/components/AppShell";
import { AuthorBadgePill } from "@/app/components/AuthorBadgePill";

/* ---------------- utils ---------------- */
function useMediaQuery(queryStr: string) {
    const [matches, setMatches] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia(queryStr);
        const onChange = () => setMatches(mq.matches);
        onChange();
        mq.addEventListener?.("change", onChange);
        return () => mq.removeEventListener?.("change", onChange);
    }, [queryStr]);
    return matches;
}
function useIsMobile() {
    return useMediaQuery("(max-width: 1023px)");
}

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

type ProductDoc = {
    id: string;
    name: string;
    currency?: CurrencyCode;
    price: number;
    category?: string;
    imageUrl?: string;
    imageUrls?: string[];
    sellerId?: string;
    seller?: {
        id?: string;
        verified?: boolean;
        handle?: string | null;
        photoURL?: string | null;
        name?: string | null;
    };
    createdAt?: Timestamp | any;
    type?: string;
    unit?: string;
    typicalPackSize?: number | string;
    rate?: string;
    billingUnit?: string;
    status?: "active" | "sold" | "reserved" | "hidden";
    sold?: boolean;
    useCase?: string;
};

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
    if (!n || n <= 0) return safeCurrency === "USD" ? "USD 0.00" : "KSh 0";
    return safeCurrency === "USD" ? USD(n) : KES(n);
}

export default function ProductDetailsClient({
    params,
}: {
    params: { productid: string };
}) {
    const router = useRouter();
    const isMobile = useIsMobile();
    const { productid } = params;

    const auth = getAuth();
    const dbi = getFirestore();

    const [loading, setLoading] = useState(true);
    const [product, setProduct] = useState<ProductDoc | null>(null);

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
    const [fsScale, setFsScale] = useState(1);
    const [fsTx, setFsTx] = useState(0);
    const [fsTy, setFsTy] = useState(0);
    const drag = useRef<{ x: number; y: number; sx: number; sy: number } | null>(
        null
    );

    // listing reviews summary (for seller card chip)
    const [reviews, setReviews] = useState<Review[]>([]);
    const [avgRating, setAvgRating] = useState(0);
    const [reviewCount, setReviewCount] = useState(0);

    const [msgLoading, setMsgLoading] = useState(false);

    // ===== Load product & seller =====
    useEffect(() => {
        let alive = true;

        (async () => {
            try {
                // 1) Try cache first
                const key = `market:listing:${productid}`;
                const cachedRaw = typeof window !== "undefined" ? sessionStorage.getItem(key) : null;

                if (cachedRaw) {
                    const cached = JSON.parse(cachedRaw) as ProductDoc;
                    if (alive && cached?.id === productid) {
                        setProduct(cached);
                        setLoading(false);
                        return; // ✅ no Firestore read
                    }
                }

                // 2) Fallback: fetch from Firestore (direct open / refresh)
                const pRef = doc(dbi, "marketListings", productid);
                const pSnap = await getDoc(pRef);

                if (!pSnap.exists()) {
                    router.push("/market");
                    return;
                }

                if (!alive) return;

                const p = { id: pSnap.id, ...(pSnap.data() as any) } as ProductDoc;
                setProduct(p);

                // Prefer embedded seller if you store it

            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [dbi, productid, router]);


    // ===== Live reviews on listing (summary only) =====
    useEffect(() => {
        const qRef = query(
            collection(db, "marketListings", productid, "reviews"),
            orderBy("createdAt", "desc")
        );
        const unsub = onSnapshot(qRef, (snap: QuerySnapshot<DocumentData>) => {
            const rows = snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as any),
            })) as Review[];
            setReviews(rows);

            if (rows.length) {
                const total = rows.reduce((s, r) => s + (Number(r.rating) || 0), 0);
                setAvgRating(total / rows.length);
                setReviewCount(rows.length);
            } else {
                setAvgRating(0);
                setReviewCount(0);
            }
        });
        return () => unsub();
    }, [productid]);


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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const clamp = (v: number, a: number, b: number) =>
        Math.max(a, Math.min(b, v));
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fsOpen, fsIndex, images.length]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center text-gray-500">
                <BouncingBallLoader />
            </div>
        );
    }

    if (!product) {
        return (
            <div className="flex h-screen items-center justify-center text-gray-500">
                Product not found
            </div>
        );
    }

    const isOwner = product.sellerId === auth.currentUser?.uid;
    const isSold = product.status === "sold" || product.sold;
    const isReserved = product.status === "reserved";
    const isTree = product.type === "tree";

    const created =
        product.createdAt?.toDate?.() instanceof Date
            ? (product.createdAt as Timestamp).toDate()
            : null;

    const makeThreadId = (a: string, b: string) => [a, b].sort().join("_");

    const buildListingContextQs = (p: ProductDoc) => {
        const qs = new URLSearchParams();
        qs.set("listingId", p.id);
        qs.set("listingName", p.name || "");
        qs.set("listingImage", (p.imageUrls?.[0] || p.imageUrl || "") as string);
        qs.set("listingPrice", String(p.price ?? ""));
        qs.set("listingCurrency", String(p.currency ?? "KES"));
        qs.set("listingType", String(p.type ?? "marketListing"));
        qs.set("listingUrl", `/market/${encodeURIComponent(p.id)}`);
        return qs;
    };

    const handleMessageClick = async () => {
        const uid = auth.currentUser?.uid;
        const peerId = product?.sellerId;

        if (!uid) return router.replace("/login");
        if (!peerId) return;
        if (uid === peerId) return;
        if (msgLoading) return;

        setMsgLoading(true);
        try {

            const threadId = makeThreadId(uid, peerId);

            const qs = new URLSearchParams();
            qs.set("peerId", peerId);
            if (product.seller?.name) qs.set("peerName", product.seller.name);
            if (product.seller?.photoURL) qs.set("peerPhotoURL", product.seller.photoURL);
            if (product.seller?.handle) qs.set("peerHandle", product.seller.handle);

            const lqs = buildListingContextQs(product);
            lqs.forEach((v, k) => qs.set(k, v));

            router.push(`/bonga/${encodeURIComponent(threadId)}?${qs.toString()}`);
        } finally {
            setMsgLoading(false);
        }
    };
    const sellerId = product.seller?.id ?? product.sellerId;
    /* ===================== Shared Body ===================== */
    const Body = (
        <main
            className={
                isMobile
                    ? "min-h-screen w-full bg-white"
                    : "min-h-screen w-full bg-white pb-10"
            }
            style={
                isMobile
                    ? { paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }
                    : undefined
            }
        >
            {/* Sticky header */}
            <div
                className="sticky top-0 z-50 border-b"
                style={{
                    backgroundColor: "rgba(255,255,255,0.95)",
                    borderColor: EKARI.hair,
                }}
            >
                <div className="h-[56px] lg:h-14 px-3 lg:px-4 flex items-center max-w-4xl mx-auto">
                    <button
                        onClick={() => router.back()}
                        className="w-10 h-10 rounded-full border grid place-items-center hover:bg-black/[0.03]"
                        style={{ borderColor: EKARI.hair }}
                    >
                        <IoArrowBack style={{ color: EKARI.text }} size={20} />
                    </button>
                    <h1 className="ml-3 font-black text-base" style={{ color: EKARI.text }}>
                        Product Details
                    </h1>
                </div>
            </div>

            {/* Body container */}
            <div className="max-w-4xl mx-auto px-3 lg:px-4 pt-3 lg:pt-4 pb-4 lg:pb-6">
                {/* Carousel */}
                <div
                    className="relative w-full rounded-2xl overflow-hidden shadow-sm bg-gray-100"
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
                                className="flex overflow-x-hidden snap-x snap-mandatory h-[320px] lg:h-96 scroll-smooth"
                                onScroll={(e) => {
                                    const L = e.currentTarget.scrollLeft;
                                    const W = e.currentTarget.clientWidth;
                                    setActive(Math.round(L / W));
                                }}
                            >
                                {images.map((url: string, i: number) => (
                                    <div key={i} className="flex-shrink-0 snap-center w-full h-full relative">
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

                            {images.length > 1 && (
                                <>
                                    <button
                                        onClick={() => goTo(active > 0 ? active - 1 : images.length - 1)}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/85 hover:bg-white rounded-full p-2 shadow-md transition"
                                        aria-label="Previous image"
                                    >
                                        <IoChevronBack size={20} className="text-gray-700" />
                                    </button>
                                    <button
                                        onClick={() => goTo(active + 1 < images.length ? active + 1 : 0)}
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
                        <div className="flex flex-col items-center justify-center h-[320px] text-gray-400">
                            <IoImageOutline size={40} />
                            <p>No image</p>
                        </div>
                    )}
                </div>

                {/* Info card */}
                <div className="bg-white rounded-2xl shadow-sm mt-4 p-5 border" style={{ borderColor: EKARI.hair }}>
                    <h2 className="font-black text-2xl" style={{ color: EKARI.text }}>
                        {product.name}
                    </h2>
                    <p className="text-sm" style={{ color: EKARI.dim }}>
                        {product.type} {product.unit && `• ${product.unit}`}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                        {product.category && (
                            <span
                                className="inline-flex items-center gap-1 border bg-[#FAFAFA] text-xs font-semibold rounded-full px-3 py-1"
                                style={{ borderColor: EKARI.hair }}
                            >
                                <IoPricetagOutline size={14} />
                                {product.category}
                            </span>
                        )}

                        {product.unit && (
                            <span
                                className="inline-flex items-center gap-1 border bg-[#F9FAFB] text-xs font-semibold rounded-full px-3 py-1"
                                style={{ borderColor: EKARI.hair }}
                            >
                                <IoCubeOutline size={14} style={{ color: EKARI.dim }} />
                                <span>
                                    {product.typicalPackSize ? `${product.typicalPackSize} ` : ""}
                                    {product.unit}
                                </span>
                            </span>
                        )}

                        {isTree && product.useCase && (
                            <span className="inline-flex items-center gap-1 border border-emerald-200 bg-emerald-50 text-xs font-semibold rounded-full px-3 py-1">
                                <IoLeafOutline size={14} className="text-emerald-600" />
                                <span className="text-emerald-700 truncate max-w-[180px]">{product.useCase}</span>
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                        <span className="text-3xl font-black" style={{ color: EKARI.forest }}>
                            {product.type === "lease" || product.type === "service"
                                ? `${product.rate ? KES(Number(product.rate)) : "-"}${product.billingUnit ? ` / ${product.billingUnit}` : ""
                                }`
                                : formatMoney(product.price, product.currency)}
                        </span>

                        <span
                            className={[
                                "inline-flex items-center gap-1 text-[11px] font-extrabold px-3 py-1 rounded-full",
                                isSold ? "bg-red-600 text-white" : isReserved ? "bg-yellow-500 text-white" : "bg-emerald-600 text-white",
                            ].join(" ")}
                        >
                            {isSold ? <IoCloseCircle size={14} /> : isReserved ? <IoTimeOutline size={14} /> : <IoCheckmarkCircle size={14} />}
                            {isSold ? "Sold" : isReserved ? "Reserved" : "Available"}
                        </span>
                    </div>

                    {created && (
                        <p className="text-sm mt-1" style={{ color: EKARI.dim }}>
                            Posted {created.toLocaleDateString()}
                        </p>
                    )}
                </div>

                {/* Seller card */}

                {/* Seller card */}
                <div className="bg-white rounded-2xl shadow-sm mt-4 p-5 border" style={{ borderColor: EKARI.hair }}>
                    <div className="flex items-center gap-3">
                        <Image
                            src={product.seller?.photoURL || "/avatar-placeholder.png"}
                            alt="Seller"
                            width={44}
                            height={44}
                            className="rounded-full object-cover border bg-[#F3F4F6]"
                            style={{ borderColor: EKARI.hair }}
                        />

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                                <p className="font-extrabold truncate" style={{ color: EKARI.text }}>
                                    {product.seller?.name || "Seller"}
                                </p>
                                <AuthorBadgePill badge={(product as any).authorBadge} />

                            </div>

                            {product.seller?.handle && (
                                <p className="text-xs truncate" style={{ color: EKARI.dim }}>
                                    {product.seller.handle}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                            <IoStar className="text-amber-400" size={14} />
                            <span className="text-xs font-extrabold" style={{ color: EKARI.text }}>
                                {avgRating.toFixed(1)} · {reviewCount}
                            </span>
                        </div>
                    </div>

                    <div className="mt-3">
                        {!isOwner ? (
                            <button
                                onClick={handleMessageClick}
                                disabled={msgLoading}
                                className={[
                                    "w-full h-11 rounded-xl flex items-center justify-center gap-2 font-black text-white transition",
                                    msgLoading ? "opacity-70 cursor-not-allowed" : "hover:opacity-95",
                                ].join(" ")}
                                style={{ backgroundColor: EKARI.gold }}
                            >
                                {msgLoading ? (
                                    <>
                                        <span className="inline-block h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin" />
                                        Opening…
                                    </>
                                ) : (
                                    <>
                                        <IoChatbubbleEllipsesOutline size={18} />
                                        Message seller
                                    </>
                                )}
                            </button>
                        ) : (
                            <div className="w-full h-11 rounded-xl flex items-center justify-center font-black text-white bg-gray-300">
                                This is you
                            </div>
                        )}
                    </div>
                </div>

                {/* Seller Reviews */}
                {sellerId ? <SellerReviewsSection sellerId={sellerId} /> : null}
            </div>

            {/* Fullscreen modal */}
            {fsOpen &&
                createPortal(
                    <div className="fixed inset-0 z-[70] bg-black/90 text-white">
                        <div className="absolute top-0 left-0 right-0 h-12 px-3 flex items-center justify-between">
                            <button
                                onClick={closeFullscreen}
                                className="w-9 h-9 grid place-items-center rounded-full hover:bg-white/10"
                            >
                                <IoContractOutline size={18} />
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => zoomBy(-0.2)}
                                    className="w-9 h-9 grid place-items-center rounded-full hover:bg-white/10"
                                >
                                    <IoRemove size={18} />
                                </button>
                                <button
                                    onClick={() => setFsScale(1)}
                                    className="px-2 h-9 rounded-full bg-white/10 text-xs font-bold"
                                >
                                    {Math.round(fsScale * 100)}%
                                </button>
                                <button
                                    onClick={() => zoomBy(0.2)}
                                    className="w-9 h-9 grid place-items-center rounded-full hover:bg-white/10"
                                >
                                    <IoAdd size={18} />
                                </button>
                            </div>
                        </div>

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
                                    className="object-contain max-h-[80vh] lg:max-h-[88vh] rounded"
                                    priority
                                />
                            </div>

                            {images.length > 1 && (
                                <>
                                    <button
                                        onClick={fsPrev}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center"
                                    >
                                        <IoChevronBack size={22} />
                                    </button>
                                    <button
                                        onClick={fsNext}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center"
                                    >
                                        <IoChevronForward size={22} />
                                    </button>
                                </>
                            )}

                            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[12px] font-bold bg-white/10 rounded-full px-3 py-1">
                                {fsIndex + 1} / {images.length}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </main>
    );

    // ✅ Desktop: wrap in AppShell
    if (!isMobile) return <AppShell>{Body}</AppShell>;

    // ✅ Mobile: DO NOT use AppShell
    return Body;
}
