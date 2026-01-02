"use client";

import React from "react";
import Image from "next/image";
import {
    IoCheckmarkCircle,
    IoCloseCircle,
    IoImagesOutline,
    IoTimeOutline,
    IoEyeOffOutline,
    IoShieldCheckmark,
} from "react-icons/io5";
import clsx from "clsx";
import { useRouter } from "next/navigation";

const EKARI = {
    forest: "#233F39",
    hair: "#E5E7EB",
    text: "#0F172A",
};

export type CurrencyCode = "KES" | "USD";

export type Product = {
    id: string;
    name: string;
    price?: number;              // 👈 safer as optional
    currency?: CurrencyCode;     // 👈 NEW
    category?: string;
    imageUrl?: string;
    imageUrls?: string[];
    sellerId?: string;
    seller?: {
        id?: string;
        verified?: boolean;
        handle?: string | null;
        photoURL?: string | null;
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
    location?: { latitude: number; longitude: number };
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
};

export const KES = (n: number) =>
    "KSh " + (n || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 });

export const USD = (n: number) =>
    "USD " + (n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

function formatListingPrice(p: Product): string {
    const raw = p.price ?? 0;

    if (!raw || raw <= 0) return "Price on request";

    const currency: CurrencyCode =
        p.currency === "USD" || p.currency === "KES" ? p.currency : "KES"; // default for old listings

    return currency === "USD" ? USD(raw) : KES(raw);
}

export function computeStatus(
    p: Product
): "active" | "sold" | "reserved" | "hidden" {
    if (p.status) return p.status;
    return p.sold ? "sold" : "active";
}

export default function ProductCard({
    p,
    onClick,
}: {
    p: Product;
    onClick?: () => void;
}) {
    const cover = (p.imageUrl || p.imageUrls?.[0]) as string | undefined;

    const imgCount = Array.isArray(p.imageUrls)
        ? p.imageUrls.length
        : cover
            ? 1
            : 0;

    // Use stored currency for normal items and for rate
    const numericRate = p.rate
        ? Number(String(p.rate).replace(/[^\d.]/g, ""))
        : 0;

    const rateText =
        numericRate > 0
            ? (p.currency === "USD" ? USD(numericRate) : KES(numericRate))
            : "—";

    const priceText =
        p.type === "lease" || p.type === "service"
            ? `${rateText}${p.billingUnit ? ` / ${p.billingUnit}` : ""}`
            : formatListingPrice(p); // 👈 uses stored currency

    const status = computeStatus(p);
    const isSold = status === "sold";
    const isReserved = status === "reserved";
    const isHidden = status === "hidden";
    const isSellerVerified = !!p.seller?.verified;

    const ringStyle = {
        "--tw-ring-color": `${EKARI.forest}`,
    } as React.CSSProperties;

    // --- image loading state ---
    const [imgLoading, setImgLoading] = React.useState<boolean>(!!cover);
    const [imgError, setImgError] = React.useState<boolean>(false);

    // if `cover` changes, reset loading state
    React.useEffect(() => {
        setImgLoading(!!cover);
        setImgError(false);
    }, [cover]);

    return (
        <button
            onClick={onClick}
            disabled={isHidden}
            className={clsx(
                "w-full text-left rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm hover:shadow transition",
                "focus:outline-none focus:ring-2 disabled:opacity-60"
            )}
            style={ringStyle}
            aria-label={`${p.name}, ${status}`}
        >
            {/* Image */}
            <div className="relative w-full aspect-[1/1] bg-gray-50">
                {cover && !imgError ? (
                    <>
                        {/* loader overlay */}
                        {imgLoading && (
                            <div className="absolute inset-0 grid place-items-center bg-gray-100">
                                <div
                                    className="h-8 w-8 rounded-full border-2 animate-spin"
                                    style={{
                                        borderColor: "#D1D5DB",
                                        borderTopColor: EKARI.forest,
                                    }}
                                    aria-hidden
                                />
                            </div>
                        )}

                        <Image
                            src={cover}
                            alt={p.name || "Product"}
                            fill
                            className={clsx(
                                "object-cover transition-opacity duration-300",
                                imgLoading ? "opacity-0" : "opacity-100",
                                (isSold || isHidden) && "opacity-60"
                            )}
                            sizes="(max-width: 768px) 100vw, 33vw"
                            onLoad={() => setImgLoading(false)}
                            onLoadingComplete={() => setImgLoading(false)}
                            onError={() => {
                                setImgError(true);
                                setImgLoading(false);
                            }}
                            priority={false}
                        />
                    </>
                ) : (
                    <div className="absolute inset-0 grid place-items-center text-gray-400 text-xs">
                        No photo
                    </div>
                )}

                {/* Status badge */}
                <div
                    className={clsx(
                        "absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-white text-[11px]",
                        isSold
                            ? "bg-red-600"
                            : isReserved
                                ? "bg-yellow-500"
                                : isHidden
                                    ? "bg-gray-500"
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
                    <span>
                        {isSold
                            ? "Sold"
                            : isReserved
                                ? "Reserved"
                                : isHidden
                                    ? "Hidden"
                                    : "Available"}
                    </span>
                </div>

                {/* Photo count */}
                {!!imgCount && imgCount > 1 && (
                    <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/40 text-gray-100 px-2 py-1 text-[11px] font-extrabold">
                        <IoImagesOutline size={12} />
                        <span>{imgCount}</span>
                    </div>
                )}

                {/* Price chip */}
                <div className="absolute left-2 bottom-2">
                    <div
                        className="inline-flex rounded-full text-white px-2.5 py-1 text-[12px] font-black"
                        style={{ backgroundColor: EKARI.forest }}
                    >
                        {priceText}
                    </div>
                </div>
            </div>

            {/* Meta */}
            <div className="p-2.5 space-y-1.5">
                <div className="text-[13px] leading-5 font-extrabold text-gray-900 line-clamp-2">
                    {p.name || "Untitled"}
                </div>

                <div className="flex items-center justify-between gap-2">
                    {!!p.category ? (
                        <div className="text-[12px] text-gray-700 truncate">{p.category}</div>
                    ) : (
                        <div />
                    )}

                    {!isSellerVerified && (
                        <span
                            className="shrink-0 text-[10px] font-black inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                            style={{
                                color: EKARI.forest,
                                border: `1px solid ${EKARI.hair}`,
                                backgroundColor: "white",
                            }}
                            title="Verified seller"
                        >
                            ✓ Verified Seller
                        </span>
                    )}
                </div>
            </div>

        </button>
    );
}
