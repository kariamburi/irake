"use client";

import React from "react";
import Image from "next/image";
import {
    IoChatbubbleOutline,
    IoCheckmarkCircle,
    IoCloseCircle,
    IoEyeOffOutline,
    IoImagesOutline,
    IoLocationOutline,
    IoShieldCheckmark,
    IoStar,
    IoTimeOutline,
} from "react-icons/io5";
import clsx from "clsx";
import { useRouter } from "next/navigation";

import { bumpListingClick } from "@/lib/storeAnalytics";

const EKARI = {
    forest: "#173C2E",
    gold: "#F39A22",
    hair: "#DDD8CC",
    text: "#111827",
};

export type CurrencyCode = "KES" | "USD";

export type Product = {
    id: string;
    name: string;
    price?: number;
    currency?: CurrencyCode;
    category?: string;
    description?: string | null;
    imageUrl?: string;
    imageUrls?: string[];
    thumbnailUrl?: string;
    thumbnailUrls?: string[];
    sellerId?: string;
    seller?: {
        id?: string;
        verified?: boolean;
        handle?: string | null;
        photoURL?: string | null;
        name?: string | null;
    };
    createdAt?: any;
    type?: "product" | "lease" | "service";
    unit?: string;
    typicalPackSize?: number | string;
    grade?: string;
    rate?: string;
    billingUnit?: string;
    nameLower?: string;
    categoryLower?: string;
    location?: {
        latitude: number;
        longitude: number;
    };
    place?: {
        text?: string;
        county?: string;
        town?: string;
        textLower?: string;
        countyLower?: string;
        townLower?: string;
    };
    status?: "active" | "sold" | "reserved" | "hidden";
    sold?: boolean;
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

export const KES = (n: number) =>
    "KSh " +
    (n || 0).toLocaleString("en-KE", {
        maximumFractionDigits: 0,
    });

export const USD = (n: number) =>
    "USD " +
    (n || 0).toLocaleString("en-US", {
        maximumFractionDigits: 2,
    });

function formatListingPrice(p: Product): string {
    const raw = p.price ?? 0;

    if (!raw || raw <= 0) {
        return "Price on request";
    }

    const currency: CurrencyCode =
        p.currency === "USD" || p.currency === "KES"
            ? p.currency
            : "KES";

    return currency === "USD"
        ? USD(raw)
        : KES(raw);
}

export function computeStatus(
    p: Product
): "active" | "sold" | "reserved" | "hidden" {
    if (p.status) return p.status;
    return p.sold ? "sold" : "active";
}

export default function ProductCard({
    p,
}: {
    p: Product;
}) {
    const router = useRouter();

    const cover = (
        p.thumbnailUrl ||
        p.thumbnailUrls?.[0] ||
        p.imageUrl ||
        p.imageUrls?.[0]
    ) as string | undefined;

    const imgCount = Array.isArray(p.imageUrls)
        ? p.imageUrls.length
        : cover
            ? 1
            : 0;

    const numericRate = p.rate
        ? Number(
            String(p.rate).replace(/[^\d.]/g, "")
        )
        : 0;

    const rateText =
        numericRate > 0
            ? p.currency === "USD"
                ? USD(numericRate)
                : KES(numericRate)
            : "—";

    const priceText =
        p.type === "lease" ||
            p.type === "service"
            ? `${rateText}${p.billingUnit
                ? ` / ${p.billingUnit}`
                : ""
            }`
            : formatListingPrice(p);

    const status = computeStatus(p);
    const isSold = status === "sold";
    const isReserved = status === "reserved";
    const isHidden = status === "hidden";

    const showVerified =
        p.seller?.verified === true ||
        p.sellerPlan?.verifiedBadge === true;

    const [imgLoading, setImgLoading] =
        React.useState<boolean>(!!cover);

    const [imgError, setImgError] =
        React.useState(false);

    const ownerId =
        p.seller?.id ||
        p.sellerId ||
        ((p as any).ownerId as string) ||
        "";

    const locationText =
        p.place?.town ||
        p.place?.county ||
        p.place?.text ||
        "";

    React.useEffect(() => {
        setImgLoading(!!cover);
        setImgError(false);
    }, [cover]);

    const openListing = async () => {
        try {
            await bumpListingClick({
                sellerId: ownerId,
                listingId: p.id,
            });
        } finally {
            router.push(`/market/${p.id}`);
        }
    };

    const openMessage = (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        event.preventDefault();
        event.stopPropagation();

        const params = new URLSearchParams({
            listing: p.id,
        });

        if (ownerId) {
            params.set("seller", ownerId);
        }

        router.push(`/bonga?${params.toString()}`);
    };

    return (
        <article
            className={[
                "group h-full overflow-hidden rounded-[20px]",
                "border border-[#DDD8CC] bg-[#FBFAF6]",
                "shadow-[0_10px_26px_rgba(15,23,42,0.055)]",
                "transition-all duration-300 ease-out",
                "hover:-translate-y-[2px]",
                "hover:border-[#CFC8BA]",
                "hover:shadow-[0_18px_36px_rgba(15,23,42,0.09)]",
            ].join(" ")}
            aria-label={`${p.name}, ${status}`}
        >
            <button
                type="button"
                onClick={openListing}
                disabled={isHidden}
                className={[
                    "relative block aspect-[4/3] w-full overflow-hidden",
                    "bg-[#EDEBE4] text-left",
                    "disabled:cursor-not-allowed",
                ].join(" ")}
            >
                {cover && !imgError ? (
                    <>
                        {imgLoading ? (
                            <div className="absolute inset-0 z-10 grid place-items-center bg-[#ECEAE3]">
                                <div
                                    className="h-7 w-7 animate-spin rounded-full border-2"
                                    style={{
                                        borderColor: "#D1CEC4",
                                        borderTopColor:
                                            EKARI.forest,
                                    }}
                                />
                            </div>
                        ) : null}

                        <Image
                            src={cover}
                            alt={p.name || "Product"}
                            fill
                            className={clsx(
                                "object-cover transition-all duration-500 ease-out",
                                "group-hover:scale-[1.025]",
                                imgLoading
                                    ? "opacity-0"
                                    : "opacity-100",
                                (isSold || isHidden) &&
                                "opacity-60"
                            )}
                            sizes="(max-width: 768px) 50vw, (max-width: 1400px) 25vw, 240px"
                            onLoad={() =>
                                setImgLoading(false)
                            }
                            onLoadingComplete={() =>
                                setImgLoading(false)
                            }
                            onError={() => {
                                setImgError(true);
                                setImgLoading(false);
                            }}
                        />
                    </>
                ) : (
                    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#314F3F] to-[#173C2E]">
                        <div className="text-center text-white/60">
                            <IoImagesOutline
                                size={34}
                                className="mx-auto"
                            />
                            <div className="mt-2 text-[11px] font-bold">
                                No photo
                            </div>
                        </div>
                    </div>
                )}

                {p.featured &&
                    p.featuredUntil?.toMillis?.() >
                    Date.now() ? (
                    <div
                        className={[
                            "absolute left-2.5 top-2.5 z-20",
                            "inline-flex items-center gap-1 rounded-full",
                            "bg-[#F39A22] px-2 py-1",
                            "text-[10px] font-black text-white shadow-sm",
                        ].join(" ")}
                    >
                        <IoStar size={12} />
                        Featured
                    </div>
                ) : null}

                {!!imgCount ? (
                    <div className="absolute right-2.5 top-2.5 z-20 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10px] font-extrabold text-white backdrop-blur-md">
                        <IoImagesOutline size={12} />
                        {imgCount}
                    </div>
                ) : null}

                <div
                    className={clsx(
                        "absolute left-2.5 top-2.5 z-20 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black text-white shadow-sm",
                        p.featured
                            ? "top-10"
                            : "",
                        isSold
                            ? "bg-rose-600"
                            : isReserved
                                ? "bg-amber-500"
                                : isHidden
                                    ? "bg-slate-500"
                                    : "bg-emerald-600"
                    )}
                >
                    {isSold ? (
                        <IoCloseCircle size={12} />
                    ) : isReserved ? (
                        <IoTimeOutline size={12} />
                    ) : isHidden ? (
                        <IoEyeOffOutline size={12} />
                    ) : (
                        <IoCheckmarkCircle size={12} />
                    )}

                    {isSold
                        ? "Sold"
                        : isReserved
                            ? "Reserved"
                            : isHidden
                                ? "Hidden"
                                : "Available"}
                </div>

                <div className="absolute bottom-2.5 left-2.5 z-20">
                    <div className="inline-flex rounded-full bg-[#14291F]/94 px-2.5 py-1 text-[11px] font-black text-white shadow-md backdrop-blur-md">
                        {priceText}
                    </div>
                </div>
            </button>

            <div className="flex min-h-[154px] flex-col px-3 py-3">
                <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-[14px] font-black leading-[1.25] text-slate-900">
                            {p.name || "Untitled"}
                        </h3>

                        <div className="mt-1 truncate text-[11px] font-medium text-slate-400">
                            {p.category ||
                                (p.type === "lease"
                                    ? "Lease"
                                    : p.type === "service"
                                        ? "Service"
                                        : "Listing")}
                        </div>
                    </div>

                    {showVerified ? (
                        <span
                            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"
                            title="Verified seller"
                        >
                            <IoShieldCheckmark
                                size={14}
                            />
                        </span>
                    ) : null}
                </div>

                {locationText ? (
                    <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-slate-400">
                        <IoLocationOutline
                            size={13}
                            className="shrink-0 text-[#F39A22]"
                        />

                        <span className="truncate">
                            {locationText}
                        </span>
                    </div>
                ) : (
                    <div className="mt-2 h-[16px]" />
                )}

                <div className="mt-auto flex items-end gap-2 pt-3">
                    <button
                        type="button"
                        onClick={openListing}
                        disabled={isHidden}
                        className={[
                            "min-h-9 flex-1 rounded-xl bg-[#173C2E] px-3",
                            "text-[9px] font-black text-white",
                            "transition-all duration-200",
                            "hover:bg-[#214C3A]",
                            "active:scale-[0.98]",
                            "disabled:cursor-not-allowed disabled:opacity-45",
                        ].join(" ")}
                    >
                        View listing
                    </button>

                    <button
                        type="button"
                        onClick={openMessage}
                        disabled={!ownerId}
                        className={[
                            "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                            "border border-[#DDD8CC] bg-white",
                            "text-[#173C2E]",
                            "transition-all duration-200",
                            "hover:border-[#F39A22]/60 hover:bg-[#FFF8ED]",
                            "active:scale-95",
                            "disabled:cursor-not-allowed disabled:opacity-35",
                        ].join(" ")}
                        aria-label="Message seller"
                        title="Message seller"
                    >
                        <IoChatbubbleOutline size={16} />
                    </button>
                </div>
            </div>
        </article>
    );
}