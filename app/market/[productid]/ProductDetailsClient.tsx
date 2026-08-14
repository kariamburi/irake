"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { app, db } from "@/lib/firebase";
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
    IoArrowRedo,
    IoStorefrontOutline,
    IoShieldCheckmark,
    IoStarOutline,
    IoRocketOutline,
    IoArrowForwardOutline,
    IoSparklesOutline,
    IoLockClosedOutline,
    IoCartOutline,
    IoLocationOutline,
    IoCallOutline,
    IoLogoWhatsapp,
    IoGlobeOutline,
    IoInformationCircleOutline,
} from "react-icons/io5";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import SellerReviewsSection from "@/app/components/SellerReviewsSection";
import { createPortal } from "react-dom";
import AppShell from "@/app/components/AppShell";
import AppShellRightRail from "@/app/components/AppShellRightRail";
import { AuthorBadgePill } from "@/app/components/AuthorBadgePill";
import OpenInAppBanner from "@/app/components/OpenInAppBanner";
import { getFunctions, httpsCallable } from "firebase/functions";
import { bumpLead, bumpListingView } from "@/lib/storeAnalytics";

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
    description?: string | null; // ✅ add this
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
    sellerPlan?: {
        verifiedBadge?: boolean;
        storefront?: boolean;
        packageId?: string | null;
        active?: boolean;
        topOfSearch?: boolean;
        priorityRanking?: boolean;
    };
    featured?: boolean;
    featuredUntil?: any;

};

const EKARI = {
    forest: "#173C2E",
    forestSoft: "#214C3A",
    gold: "#F39A22",
    sand: "#F8F7F2",
    paper: "#FBFAF6",
    text: "#0F172A",
    dim: "#64748B",
    hair: "#DDD8CC",
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


function SafeSellerAvatar({
    src,
    alt,
    size = 44,
}: {
    src?: string | null;
    alt: string;
    size?: number;
}) {
    const [failed, setFailed] = useState(false);

    const safeSrc =
        !failed && src && String(src).trim()
            ? String(src).trim()
            : "/avatar-placeholder.png";

    return (
        <div
            className="relative shrink-0 overflow-hidden rounded-full bg-[#EDEBE4]"
            style={{
                width: size,
                height: size,
            }}
        >
            <Image
                src={safeSrc}
                alt={alt}
                fill
                sizes={`${size}px`}
                className="object-cover"
                onError={() => setFailed(true)}
            />
        </div>
    );
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
    const fn = getFunctions(app);
    const boostCallable = useMemo(() => httpsCallable(fn, "boostMarketListing"), [fn]);
    const featureCallable = useMemo(() => httpsCallable(fn, "featureMarketListing"), [fn]);

    const [perkLoading, setPerkLoading] = useState<"boost" | "feature" | null>(null);
    const [perkMsg, setPerkMsg] = useState<string | null>(null);


    const [msgLoading, setMsgLoading] = useState(false);


    const doBoost = async () => {
        if (!product) return;
        if (!auth.currentUser?.uid) return router.replace("/login");
        if (!isOwner) return;

        setPerkMsg(null);
        setPerkLoading("boost");
        try {
            const res: any = await boostCallable({ listingId: product.id });
            setPerkMsg(res?.data?.message || "Boost applied ✅");
        } catch (e: any) {
            setPerkMsg(e?.message || "Boost failed.");
        } finally {
            setPerkLoading(null);
        }
    };

    const doFeature = async () => {
        if (!product) return;
        if (!auth.currentUser?.uid) return router.replace("/login");
        if (!isOwner) return;

        setPerkMsg(null);
        setPerkLoading("feature");
        try {
            const res: any = await featureCallable({ listingId: product.id });
            setPerkMsg(res?.data?.message || "Featured ✅");
        } catch (e: any) {
            setPerkMsg(e?.message || "Feature failed.");
        } finally {
            setPerkLoading(null);
        }
    };

    const webUrl =
        typeof window !== "undefined"
            ? window.location.href
            : `https://ekarihub.com/market/${encodeURIComponent(productid)}`;

    const appUrl = `ekarihub:///market/${encodeURIComponent(productid)}`;
    const [subActive, setSubActive] = useState(false);

    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (!uid) {
            setSubActive(false);
            return;
        }

        const subRef = doc(dbi, "sellerSubscriptions", uid);
        return onSnapshot(subRef, (snap) => {
            const sub = snap.exists() ? (snap.data() as any) : null;

            const statusOk = String(sub?.status || "").toLowerCase() === "active";
            const endMs = sub?.currentPeriodEnd?.toMillis?.() ?? 0;

            // ✅ active if status active AND period end is in future
            setSubActive(statusOk && endMs > Date.now());
        });
    }, [dbi, auth]);


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




    const images = useMemo(() => {
        if (!product) return [];
        const arr = product.imageUrls?.length
            ? product.imageUrls
            : product.imageUrl
                ? [product.imageUrl]
                : [];
        return (arr || []).filter(Boolean);
    }, [product]);


    // put this immediately after images useMemo

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
    const shareProduct = useCallback(async () => {
        if (!product) return;

        const url =
            typeof window !== "undefined"
                ? window.location.href
                : `https://ekarihub.com/market/${encodeURIComponent(product.id)}`;

        const priceText =
            product.type === "lease" || product.type === "service"
                ? `${product.rate ? KES(Number(product.rate)) : "-"}${product.billingUnit ? ` / ${product.billingUnit}` : ""}`
                : formatMoney(product.price, product.currency);

        const statusText =
            product.status === "sold" || product.sold
                ? "Sold"
                : product.status === "reserved"
                    ? "Reserved"
                    : "Available";

        const message = `${product.name}\n${priceText} • ${statusText}`;

        try {
            if (navigator.share) {
                await navigator.share({
                    title: product.name || "Product",
                    text: message,
                    url,
                });
            } else {
                await navigator.clipboard.writeText(`${message}\n${url}`);
                alert("Link copied to clipboard");
            }
        } catch {
            // ignore cancel / errors
        }
    }, [product]);
    const descriptionText = (product as any)?.description
        ? String((product as any).description).trim()
        : "";
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
    const openProfile = (handle?: string) => {
        if (!handle) return
        router.push(`/${encodeURIComponent(handle)}`);
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

    useEffect(() => {
        if (!product?.id) return;

        const sellerId =
            (product.seller?.id as string | undefined) ||
            (product.sellerId as string | undefined) ||
            ((product as any).ownerId as string | undefined);

        if (!sellerId) return;

        bumpListingView({ sellerId, listingId: product.id }).catch(() => { });
    }, [product?.id]);


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
    const uid = auth.currentUser?.uid;

    // old + new schemas supported
    const ownerId =
        (product.seller?.id as string | undefined) ||
        (product.sellerId as string | undefined) ||
        ((product as any).ownerId as string | "");

    const isOwner = !!uid && !!ownerId && ownerId === uid;
    const hasActivePlan = isOwner ? subActive : (product.sellerPlan?.active === true);

    const isSold = product.status === "sold" || product.sold;
    const isReserved = product.status === "reserved";
    const isTree = product.type === "tree";
    const nowMs = Date.now();

    const showFeatured =
        !!product.featured && (product.featuredUntil?.toMillis?.() ?? 0) > nowMs;

    const showVerified =
        product.seller?.verified === true || product.sellerPlan?.verifiedBadge === true;

    const showStorefront = product.sellerPlan?.storefront === true;

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
        const peerId = product?.seller?.id;

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
            bumpLead({ sellerId: peerId, listingId: null, kind: "message" }).catch(() => { });
            qs.set("thread", threadId);
            router.push(`/bonga?${qs.toString()}`);
        } finally {
            setMsgLoading(false);
        }
    };
    const sellerId = product.seller?.id ?? product.sellerId;
    const storeUrl = sellerId ? `/store/${encodeURIComponent(sellerId)}?src=market` : null;


    const sellerPhone =
        String((product as any)?.seller?.phone || (product as any)?.sellerPhone || "")
            .trim();

    const sellerWebsite =
        String((product as any)?.seller?.website || (product as any)?.sellerWebsite || "")
            .trim();

    const normalizedPhone = sellerPhone
        ? sellerPhone.replace(/[^\d+]/g, "")
        : "";

    const whatsappHref = normalizedPhone
        ? `https://wa.me/${normalizedPhone.replace(/^\+/, "")}`
        : "";

    const websiteHref = sellerWebsite
        ? /^https?:\/\//i.test(sellerWebsite)
            ? sellerWebsite
            : `https://${sellerWebsite}`
        : "";

    const listingPriceText =
        product.type === "lease" || product.type === "service"
            ? `${product.rate ? KES(Number(product.rate)) : "-"}${product.billingUnit ? ` / ${product.billingUnit}` : ""}`
            : formatMoney(product.price, product.currency);

    const listingStatusText = isSold
        ? "Sold"
        : isReserved
            ? "Reserved"
            : "Available";

    const sellerDisplayName =
        product.seller?.name ||
        product.seller?.handle ||
        "Seller";

    const sellerHandle =
        product.seller?.handle || "";

    const sellerPhoto =
        product.seller?.photoURL || null;

    /* ===================== Shared Body ===================== */

    const SellerSummary = ({
        compact = false,
    }: {
        compact?: boolean;
    }) => (
        <section
            className={[
                "rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6]",
                compact
                    ? "p-3.5"
                    : "p-4",
                "shadow-[0_10px_28px_rgba(15,23,42,0.035)]",
            ].join(" ")}
        >
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() =>
                        openProfile(
                            product?.seller?.handle ??
                            ""
                        )
                    }
                    className="relative shrink-0 rounded-full border border-[#DDD8CC]"
                    title="Open seller profile"
                >
                    <SafeSellerAvatar
                        src={sellerPhoto}
                        alt={sellerDisplayName}
                        size={44}
                    />
                </button>

                <div className="min-w-0 flex-1">
                    <button
                        type="button"
                        onClick={() =>
                            openProfile(
                                product?.seller?.handle ??
                                ""
                            )
                        }
                        className="block max-w-full truncate text-left text-[13px] font-black text-slate-900 hover:underline"
                    >
                        {sellerDisplayName}
                    </button>

                    {sellerHandle ? (
                        <div className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">
                            {sellerHandle}
                        </div>
                    ) : null}

                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {showVerified ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF4E7] px-2 py-0.5 text-[9px] font-black text-[#3E6F28]">
                                <IoShieldCheckmark
                                    size={11}
                                />
                                Verified
                            </span>
                        ) : null}

                        <AuthorBadgePill
                            badge={
                                (product as any)
                                    .authorBadge
                            }
                        />
                    </div>
                </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
                {!isOwner ? (
                    <button
                        type="button"
                        onClick={handleMessageClick}
                        disabled={msgLoading}
                        className={[
                            "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl",
                            "bg-[#F39A22] px-4 text-[11px] font-black text-white",
                            "shadow-[0_8px_18px_rgba(243,154,34,0.16)]",
                            "transition-all duration-200",
                            msgLoading
                                ? "cursor-not-allowed opacity-65"
                                : "hover:-translate-y-0.5 hover:bg-[#E98C12]",
                        ].join(" ")}
                    >
                        {msgLoading ? (
                            <>
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                                Opening…
                            </>
                        ) : (
                            <>
                                <IoChatbubbleEllipsesOutline
                                    size={16}
                                />
                                Message seller
                            </>
                        )}
                    </button>
                ) : (
                    <div className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-[#E8ECE8] px-4 text-[11px] font-black text-[#173C2E]">
                        Your listing
                    </div>
                )}

                {showStorefront && storeUrl ? (
                    <button
                        type="button"
                        onClick={() =>
                            router.push(storeUrl)
                        }
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#D9D3C7] bg-white text-[#173C2E] transition hover:border-[#F39A22]/55 hover:bg-[#FFF9F0]"
                        title="Visit seller store"
                    >
                        <IoStorefrontOutline
                            size={16}
                        />
                    </button>
                ) : null}
            </div>

            {(normalizedPhone ||
                whatsappHref ||
                websiteHref) ? (
                <div className="mt-2 flex items-center gap-2">
                    {normalizedPhone ? (
                        <a
                            href={`tel:${normalizedPhone}`}
                            className="grid h-9 w-9 place-items-center rounded-full border border-[#D9D3C7] bg-white text-slate-600 transition hover:border-[#F39A22]/55 hover:bg-[#FFF9F0]"
                            title="Call seller"
                        >
                            <IoCallOutline
                                size={14}
                            />
                        </a>
                    ) : null}

                    {whatsappHref ? (
                        <a
                            href={whatsappHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="grid h-9 w-9 place-items-center rounded-full border border-[#D9D3C7] bg-white text-slate-600 transition hover:border-[#F39A22]/55 hover:bg-[#FFF9F0]"
                            title="WhatsApp seller"
                        >
                            <IoLogoWhatsapp
                                size={15}
                            />
                        </a>
                    ) : null}

                    {websiteHref ? (
                        <a
                            href={websiteHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="grid h-9 w-9 place-items-center rounded-full border border-[#D9D3C7] bg-white text-slate-600 transition hover:border-[#F39A22]/55 hover:bg-[#FFF9F0]"
                            title="Seller website"
                        >
                            <IoGlobeOutline
                                size={15}
                            />
                        </a>
                    ) : null}
                </div>
            ) : null}
        </section>
    );

    const BuyerSafetyCard = () => (
        <section className="rounded-[18px] border border-[#E8D8B9] bg-[#FFF9EE] p-4">
            <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F39A22]/12 text-[#B66A0C]">
                    <IoShieldCheckmark
                        size={17}
                    />
                </span>

                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.08em] text-[#8A5109]">
                            Buyer safety
                        </h3>

                        <span className="rounded-full bg-[#F39A22]/15 px-2 py-0.5 text-[8px] font-black text-[#9A5A08]">
                            Stay safe
                        </span>
                    </div>

                    <p className="mt-2 text-[10px] font-medium leading-5 text-slate-600">
                        Inspect the item before paying,
                        avoid advance payments and meet
                        the seller in a safe place where
                        possible.
                    </p>

                    <p className="mt-2 text-[9px] font-medium leading-4 text-slate-400">
                        ekarihub provides the marketplace
                        platform and does not handle
                        payments or deliveries between
                        users.
                    </p>
                </div>
            </div>
        </section>
    );

    const OwnerPerksCard = () => {
        if (!isOwner) return null;

        return (
            <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4">
                <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FFF4E3] text-[#F39A22]">
                        <IoSparklesOutline
                            size={17}
                        />
                    </span>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <h3 className="text-[12px] font-black text-slate-900">
                                    Listing perks
                                </h3>

                                <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                                    Improve reach and featured
                                    placement.
                                </p>
                            </div>

                            {!hasActivePlan ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[8px] font-black text-slate-500">
                                    <IoLockClosedOutline
                                        size={10}
                                    />
                                    Locked
                                </span>
                            ) : null}
                        </div>

                        {!hasActivePlan ? (
                            <button
                                type="button"
                                onClick={() =>
                                    router.push(
                                        "/seller/dashboard"
                                    )
                                }
                                className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#173C2E] px-4 text-[10px] font-black text-white transition hover:-translate-y-0.5 hover:bg-[#214C3A]"
                            >
                                <IoSparklesOutline
                                    size={15}
                                />
                                Upgrade to unlock
                                <IoArrowForwardOutline
                                    size={13}
                                />
                            </button>
                        ) : (
                            <>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={doBoost}
                                        disabled={
                                            perkLoading !==
                                            null
                                        }
                                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#D9D3C7] bg-white text-[10px] font-black text-slate-600 transition hover:border-[#F39A22]/50 hover:bg-[#FFF9F0] disabled:opacity-50"
                                    >
                                        {perkLoading ===
                                            "boost" ? (
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#173C2E]" />
                                        ) : (
                                            <IoRocketOutline
                                                size={15}
                                                className="text-[#F39A22]"
                                            />
                                        )}
                                        Boost
                                    </button>

                                    <button
                                        type="button"
                                        onClick={doFeature}
                                        disabled={
                                            perkLoading !==
                                            null
                                        }
                                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#173C2E] text-[10px] font-black text-white transition hover:bg-[#214C3A] disabled:opacity-50"
                                    >
                                        {perkLoading ===
                                            "feature" ? (
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                        ) : (
                                            <IoStarOutline
                                                size={15}
                                            />
                                        )}
                                        Feature
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        router.push(
                                            "/market/packages"
                                        )
                                    }
                                    className="mt-2 text-[9px] font-black text-[#173C2E] underline underline-offset-2"
                                >
                                    Manage plan
                                </button>
                            </>
                        )}

                        {perkMsg ? (
                            <div className="mt-3 rounded-xl border border-[#DDD8CC] bg-white px-3 py-2 text-[9px] font-semibold text-slate-500">
                                {perkMsg}
                            </div>
                        ) : null}
                    </div>
                </div>
            </section>
        );
    };

    const RightRail = (
        <aside className="h-full overflow-y-auto bg-[#F8F7F2] px-3 py-3 no-scrollbar">
            <div className="space-y-3">
                <SellerSummary compact />

                {!isOwner ? (
                    <BuyerSafetyCard />
                ) : (
                    <OwnerPerksCard />
                )}

                <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4">
                    <div className="flex items-center gap-2 text-[#F39A22]">
                        <IoCartOutline
                            size={15}
                        />

                        <h3 className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
                            ekariMarket
                        </h3>
                    </div>

                    <p className="mt-2 text-[11px] font-semibold leading-5 text-slate-600">
                        Browse more products, services,
                        animals, land and lease listings.
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            router.push("/market")
                        }
                        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#173C2E] px-3 text-[10px] font-black text-white transition hover:bg-[#214C3A]"
                    >
                        Back to market
                        <IoArrowForwardOutline
                            size={13}
                        />
                    </button>
                </section>
            </div>
        </aside>
    );

    const Body = (
        <main
            className={[
                "w-full bg-[#F8F7F2]",
                isMobile
                    ? "min-h-screen"
                    : "h-[100svh] min-h-0 overflow-y-auto no-scrollbar",
            ].join(" ")}
            style={
                isMobile
                    ? {
                        paddingBottom:
                            "calc(18px + env(safe-area-inset-bottom))",
                    }
                    : undefined
            }
        >
            {/* MARKET-STYLE HEADER */}
            <motion.header
                initial={{
                    opacity: 0,
                    y: -5,
                }}
                animate={{
                    opacity: 1,
                    y: 0,
                }}
                transition={{
                    duration: 0.24,
                    ease: "easeOut",
                }}
                className={[
                    "sticky top-0 z-50",
                    "border-b border-[#E5E0D6]",
                    "bg-[#FBFAF6]/95 backdrop-blur-xl",
                ].join(" ")}
            >
                <div className="mx-auto flex h-[64px] max-w-[980px] items-center gap-3 px-3 sm:px-5">
                    <button
                        type="button"
                        onClick={() =>
                            router.back()
                        }
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#D9D3C7] bg-white text-slate-700 transition hover:border-[#F39A22]/50 hover:bg-[#FFF9F0] active:scale-95"
                        aria-label="Back"
                    >
                        <IoArrowBack
                            size={18}
                        />
                    </button>

                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E9ECE7] text-[#173C2E]">
                        <IoCartOutline
                            size={19}
                        />
                    </span>

                    <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
                            ekariMarket
                        </div>

                        <div className="truncate text-[14px] font-black text-slate-900">
                            Product details
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={shareProduct}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#D9D3C7] bg-white text-slate-700 transition hover:border-[#F39A22]/50 hover:bg-[#FFF9F0] active:scale-95"
                        aria-label="Share product"
                        title="Share"
                    >
                        <IoArrowRedo
                            size={17}
                        />
                    </button>
                </div>
            </motion.header>

            {isMobile ? (
                <OpenInAppBanner
                    webUrl={webUrl}
                    appUrl={appUrl}
                    title="Open this product in ekarihub"
                    subtitle="Faster loading, messaging, and full features."
                    playStoreUrl="https://play.google.com/store/apps/details?id=com.ekarihub.app"
                    appStoreUrl="https://apps.apple.com"
                />
            ) : null}

            <div className="mx-auto max-w-[980px] px-3 pb-7 pt-3 sm:px-5 sm:pt-5">
                {/* PRIMARY PRODUCT WORKSPACE */}
                <motion.section
                    initial={{
                        opacity: 0,
                        y: 6,
                    }}
                    animate={{
                        opacity: 1,
                        y: 0,
                    }}
                    transition={{
                        duration: 0.28,
                        ease: "easeOut",
                    }}
                    className="space-y-4"
                >
                    {/* GALLERY */}
                    <div>
                        <div
                            className={[
                                "relative overflow-hidden rounded-[20px]",
                                "border border-[#DDD8CC] bg-[#EDEBE4]",
                                "shadow-[0_12px_32px_rgba(15,23,42,0.055)]",
                            ].join(" ")}
                            onMouseEnter={() =>
                                setIsPaused(true)
                            }
                            onMouseLeave={() =>
                                setIsPaused(false)
                            }
                            onTouchStart={
                                onTouchStart
                            }
                            onTouchMove={
                                onTouchMove
                            }
                            onTouchEnd={
                                onTouchEnd
                            }
                        >
                            {images.length ? (
                                <>
                                    <div
                                        ref={
                                            scrollRef
                                        }
                                        className="flex h-[250px] snap-x snap-mandatory overflow-x-hidden scroll-smooth sm:h-[300px] lg:h-[350px]"
                                        onScroll={(
                                            e
                                        ) => {
                                            const L =
                                                e
                                                    .currentTarget
                                                    .scrollLeft;
                                            const W =
                                                e
                                                    .currentTarget
                                                    .clientWidth;

                                            setActive(
                                                Math.round(
                                                    L /
                                                    W
                                                )
                                            );
                                        }}
                                    >
                                        {images.map(
                                            (
                                                url,
                                                i
                                            ) => (
                                                <div
                                                    key={
                                                        i
                                                    }
                                                    className="relative h-full w-full shrink-0 snap-center overflow-hidden"
                                                >
                                                    <Image
                                                        src={
                                                            url
                                                        }
                                                        alt={`${product.name} ${i +
                                                            1
                                                            }`}
                                                        fill
                                                        className="cursor-zoom-in object-cover transition-transform duration-500 hover:scale-[1.015]"
                                                        sizes="(max-width: 1024px) 100vw, 620px"
                                                        priority={
                                                            i ===
                                                            0
                                                        }
                                                        onClick={() =>
                                                            openFullscreen(
                                                                i
                                                            )
                                                        }
                                                    />
                                                </div>
                                            )
                                        )}
                                    </div>

                                    <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
                                        <span
                                            className={[
                                                "inline-flex items-center gap-1 rounded-full px-2.5 py-1",
                                                "text-[9px] font-black text-white shadow-sm backdrop-blur-md",
                                                isSold
                                                    ? "bg-rose-600"
                                                    : isReserved
                                                        ? "bg-amber-500"
                                                        : "bg-emerald-600",
                                            ].join(
                                                " "
                                            )}
                                        >
                                            {isSold ? (
                                                <IoCloseCircle
                                                    size={
                                                        11
                                                    }
                                                />
                                            ) : isReserved ? (
                                                <IoTimeOutline
                                                    size={
                                                        11
                                                    }
                                                />
                                            ) : (
                                                <IoCheckmarkCircle
                                                    size={
                                                        11
                                                    }
                                                />
                                            )}

                                            {
                                                listingStatusText
                                            }
                                        </span>

                                        {showFeatured ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-[#F39A22] px-2.5 py-1 text-[9px] font-black text-white shadow-sm">
                                                <IoStar
                                                    size={
                                                        11
                                                    }
                                                />
                                                Featured
                                            </span>
                                        ) : null}
                                    </div>

                                    {images.length >
                                        1 ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    goTo(
                                                        active >
                                                            0
                                                            ? active -
                                                            1
                                                            : images.length -
                                                            1
                                                    )
                                                }
                                                className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md transition hover:bg-black/50"
                                                aria-label="Previous image"
                                            >
                                                <IoChevronBack
                                                    size={
                                                        18
                                                    }
                                                />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    goTo(
                                                        active +
                                                            1 <
                                                            images.length
                                                            ? active +
                                                            1
                                                            : 0
                                                    )
                                                }
                                                className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md transition hover:bg-black/50"
                                                aria-label="Next image"
                                            >
                                                <IoChevronForward
                                                    size={
                                                        18
                                                    }
                                                />
                                            </button>
                                        </>
                                    ) : null}

                                    <button
                                        type="button"
                                        onClick={() =>
                                            openFullscreen(
                                                active
                                            )
                                        }
                                        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md transition hover:bg-black/50"
                                        aria-label="View fullscreen"
                                    >
                                        <IoExpandOutline
                                            size={15}
                                        />
                                    </button>

                                    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 backdrop-blur-md">
                                        {images.map(
                                            (
                                                _,
                                                i
                                            ) => (
                                                <button
                                                    key={
                                                        i
                                                    }
                                                    type="button"
                                                    onClick={() =>
                                                        goTo(
                                                            i
                                                        )
                                                    }
                                                    className={[
                                                        "h-1.5 rounded-full transition-all",
                                                        i ===
                                                            active
                                                            ? "w-5 bg-white"
                                                            : "w-1.5 bg-white/50",
                                                    ].join(
                                                        " "
                                                    )}
                                                    aria-label={`Go to image ${i +
                                                        1
                                                        }`}
                                                />
                                            )
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="grid h-[250px] place-items-center text-slate-400 sm:h-[300px] lg:h-[350px]">
                                    <div className="text-center">
                                        <IoImageOutline
                                            size={
                                                38
                                            }
                                            className="mx-auto"
                                        />

                                        <p className="mt-2 text-[11px] font-bold">
                                            No photo
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>


                    {/* PRODUCT DETAILS BELOW IMAGE */}
                    <div
                        className={[
                            "rounded-[20px] border border-[#DDD8CC]",
                            "bg-[#FBFAF6] p-4 sm:p-5",
                            "shadow-[0_10px_28px_rgba(15,23,42,0.035)]",
                        ].join(" ")}
                    >
                        {/* Listing labels */}
                        <div className="flex flex-wrap items-center gap-2">
                            {product.category ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#EFECE5] px-2.5 py-1 text-[9px] font-black text-slate-500">
                                    <IoPricetagOutline size={11} />
                                    {product.category}
                                </span>
                            ) : null}

                            <span
                                className={[
                                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1",
                                    "text-[9px] font-black text-white",
                                    isSold
                                        ? "bg-rose-600"
                                        : isReserved
                                            ? "bg-amber-500"
                                            : "bg-emerald-600",
                                ].join(" ")}
                            >
                                {isSold ? (
                                    <IoCloseCircle size={11} />
                                ) : isReserved ? (
                                    <IoTimeOutline size={11} />
                                ) : (
                                    <IoCheckmarkCircle size={11} />
                                )}

                                {listingStatusText}
                            </span>

                            {showFeatured ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#F39A22] px-2.5 py-1 text-[9px] font-black text-white">
                                    <IoStar size={11} />
                                    Featured
                                </span>
                            ) : null}
                        </div>

                        {/* Title + price */}
                        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <h1 className="text-[24px] font-black leading-[1.1] tracking-[-0.035em] text-slate-900 sm:text-[28px]">
                                    {product.name}
                                </h1>

                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-400">
                                    {product.type ? (
                                        <span className="capitalize">
                                            {product.type}
                                        </span>
                                    ) : null}

                                    {product.unit ? (
                                        <span>
                                            {product.typicalPackSize
                                                ? `${product.typicalPackSize} `
                                                : ""}
                                            {product.unit}
                                        </span>
                                    ) : null}

                                    {created ? (
                                        <span>
                                            Posted{" "}
                                            {created.toLocaleDateString()}
                                        </span>
                                    ) : null}
                                </div>
                            </div>

                            <div className="shrink-0 sm:text-right">
                                <div className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                                    Price
                                </div>

                                <div className="mt-1 text-[28px] font-black tracking-[-0.035em] text-[#173C2E] sm:text-[30px]">
                                    {listingPriceText}
                                </div>

                                {product.billingUnit ? (
                                    <div className="mt-1 text-[9px] font-semibold text-slate-400">
                                        per {product.billingUnit}
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {/* Description */}
                        {descriptionText ? (
                            <div className="mt-5 border-t border-[#E4DED2] pt-4">
                                <div className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
                                    About this listing
                                </div>

                                <p className="mt-2 whitespace-pre-wrap text-[12px] font-medium leading-6 text-slate-600">
                                    {descriptionText}
                                </p>
                            </div>
                        ) : null}

                        {/* Other listing details */}
                        <div className="mt-5 border-t border-[#E4DED2] pt-4">
                            <div className="mb-3 flex items-center gap-2">
                                <IoInformationCircleOutline
                                    size={14}
                                    className="text-[#F39A22]"
                                />

                                <div className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
                                    Listing details
                                </div>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {product.category ? (
                                    <div className="rounded-xl bg-[#F4F2ED] px-3 py-3">
                                        <div className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
                                            Category
                                        </div>

                                        <div className="mt-1 text-[11px] font-black text-slate-700">
                                            {product.category}
                                        </div>
                                    </div>
                                ) : null}

                                {product.type ? (
                                    <div className="rounded-xl bg-[#F4F2ED] px-3 py-3">
                                        <div className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
                                            Listing type
                                        </div>

                                        <div className="mt-1 capitalize text-[11px] font-black text-slate-700">
                                            {product.type}
                                        </div>
                                    </div>
                                ) : null}

                                {product.unit ? (
                                    <div className="rounded-xl bg-[#F4F2ED] px-3 py-3">
                                        <div className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
                                            Quantity / unit
                                        </div>

                                        <div className="mt-1 text-[11px] font-black text-slate-700">
                                            {product.typicalPackSize
                                                ? `${product.typicalPackSize} `
                                                : ""}
                                            {product.unit}
                                        </div>
                                    </div>
                                ) : null}

                                {product.billingUnit ? (
                                    <div className="rounded-xl bg-[#F4F2ED] px-3 py-3">
                                        <div className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
                                            Billing unit
                                        </div>

                                        <div className="mt-1 text-[11px] font-black text-slate-700">
                                            {product.billingUnit}
                                        </div>
                                    </div>
                                ) : null}

                                <div className="rounded-xl bg-[#F4F2ED] px-3 py-3">
                                    <div className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
                                        Status
                                    </div>

                                    <div className="mt-1 text-[11px] font-black text-slate-700">
                                        {listingStatusText}
                                    </div>
                                </div>

                                {created ? (
                                    <div className="rounded-xl bg-[#F4F2ED] px-3 py-3">
                                        <div className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
                                            Posted
                                        </div>

                                        <div className="mt-1 text-[11px] font-black text-slate-700">
                                            {created.toLocaleDateString()}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {isTree && product.useCase ? (
                            <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#EEF6EC] px-3 py-2.5 text-[10px] font-semibold leading-5 text-[#3E6F28]">
                                <IoLeafOutline
                                    size={14}
                                    className="mt-0.5 shrink-0"
                                />
                                {product.useCase}
                            </div>
                        ) : null}
                    </div>
                </motion.section>

                {/* MOBILE / TABLET SELLER + SAFETY */}
                <div className="mt-4 space-y-3 lg:hidden">
                    <SellerSummary />

                    {!isOwner ? (
                        <BuyerSafetyCard />
                    ) : (
                        <OwnerPerksCard />
                    )}
                </div>

                {/* REVIEWS */}
                {sellerId ? (
                    <motion.div
                        initial={{
                            opacity: 0,
                            y: 6,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                        }}
                        transition={{
                            delay: 0.06,
                            duration: 0.24,
                        }}
                        className="mt-4"
                    >
                        <SellerReviewsSection
                            sellerId={
                                sellerId
                            }
                        />
                    </motion.div>
                ) : null}
            </div>

            {/* FULLSCREEN GALLERY */}
            {fsOpen &&
                createPortal(
                    <motion.div
                        initial={{
                            opacity: 0,
                        }}
                        animate={{
                            opacity: 1,
                        }}
                        className="fixed inset-0 z-[9999] bg-black/95 text-white"
                    >
                        <div className="absolute left-0 right-0 top-0 z-20 flex h-14 items-center justify-between px-3">
                            <button
                                type="button"
                                onClick={
                                    closeFullscreen
                                }
                                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"
                            >
                                <IoContractOutline
                                    size={17}
                                />
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        zoomBy(
                                            -0.2
                                        )
                                    }
                                    className="grid h-9 w-9 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"
                                >
                                    <IoRemove
                                        size={16}
                                    />
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setFsScale(
                                            1
                                        )
                                    }
                                    className="h-9 rounded-full bg-white/10 px-3 text-[10px] font-black"
                                >
                                    {Math.round(
                                        fsScale *
                                        100
                                    )}
                                    %
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        zoomBy(
                                            0.2
                                        )
                                    }
                                    className="grid h-9 w-9 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"
                                >
                                    <IoAdd
                                        size={16}
                                    />
                                </button>
                            </div>
                        </div>

                        <div
                            className="flex h-full w-full select-none items-center justify-center"
                            onWheel={
                                onFsWheel
                            }
                            onDoubleClick={
                                onFsDouble
                            }
                            onPointerDown={
                                onFsPointerDown
                            }
                            onPointerMove={
                                onFsPointerMove
                            }
                            onPointerUp={
                                onFsPointerUp
                            }
                        >
                            <div
                                className="relative"
                                style={{
                                    transform: `translate(${fsTx}px, ${fsTy}px) scale(${fsScale})`,
                                    transition:
                                        drag.current
                                            ? "none"
                                            : "transform 120ms ease",
                                }}
                            >
                                <Image
                                    src={
                                        images[
                                        fsIndex
                                        ]
                                    }
                                    alt={`image ${fsIndex +
                                        1
                                        }`}
                                    width={1600}
                                    height={1000}
                                    className="max-h-[86vh] rounded-lg object-contain lg:max-h-[90vh]"
                                    priority
                                />
                            </div>

                            {images.length >
                                1 ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={
                                            fsPrev
                                        }
                                        className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"
                                    >
                                        <IoChevronBack
                                            size={
                                                21
                                            }
                                        />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={
                                            fsNext
                                        }
                                        className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"
                                    >
                                        <IoChevronForward
                                            size={
                                                21
                                            }
                                        />
                                    </button>
                                </>
                            ) : null}

                            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black">
                                {fsIndex + 1} /{" "}
                                {images.length}
                            </div>
                        </div>
                    </motion.div>,
                    document.body
                )}
        </main>
    );

    if (!isMobile) {
        return (
            <AppShellRightRail
                rightRail={RightRail}
                rightRailClassName="border-l border-[#E4DED2] bg-[#F8F7F2]"
            >
                {Body}
            </AppShellRightRail>
        );
    }

    return Body;

}