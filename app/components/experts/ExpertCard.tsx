"use client";

import React from "react";

import { PublicExpert } from "@/app/types/publicExpert";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    IoArrowForward,
    IoCallOutline,
    IoChatbubbleEllipsesOutline,
    IoCheckmarkCircle,
    IoLocationOutline,
    IoLogoWhatsapp,
    IoPeopleOutline,
    IoStar,
    IoStarHalf,
    IoStarOutline,
    IoVideocamOutline,
} from "react-icons/io5";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    text: "#111827",
    subtext: "#6B7280",
    hair: "#E5E7EB",
    soft: "#F8FAFC",
    success: "#15803D",
};

function getInitials(name: string): string {
    const parts = name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);

    if (parts.length === 0) {
        return "EX";
    }

    return parts
        .map((part) => part.charAt(0).toUpperCase())
        .join("");
}

function formatMoney(
    amount: number,
    currency:
        | "KES"
        | "USD" = "KES"
): string {
    const value = Math.max(
        0,
        Number(amount) || 0
    );

    try {
        return new Intl.NumberFormat(
            currency === "KES"
                ? "en-KE"
                : "en-US",
            {
                style: "currency",
                currency,
                maximumFractionDigits:
                    currency === "KES"
                        ? 0
                        : 2,
            }
        ).format(value);
    } catch {
        return `${currency} ${value.toLocaleString()}`;
    }
}

function getPriceLabel(
    expert: PublicExpert
): string {
    const feeType = expert.pricing?.feeType;
    const amount =
        Number(expert.pricing?.consultationFee) || 0;

    if (feeType === "free" || amount === 0) {
        return "Free consultation";
    }

    const formatted = formatMoney(
        amount,
        expert.pricing?.currency || "KES"
    );

    if (feeType === "starting_from") {
        return `From ${formatted}`;
    }

    return formatted;
}

function getLocationLabel(
    expert: PublicExpert
): string {
    const location =
        expert.primaryLocation;

    const directLabel =
        String(
            location?.label || ""
        ).trim();

    if (directLabel) {
        return directLabel;
    }

    const locality =
        String(
            location?.locality || ""
        ).trim();

    const city =
        String(
            location?.city || ""
        ).trim();

    const region =
        String(
            location?.region || ""
        ).trim();

    const country =
        String(
            location?.country || ""
        ).trim();

    const parts = [
        locality,
        city,
        region,
        country,
    ].filter(Boolean);

    const uniqueParts =
        parts.filter(
            (value, index, values) =>
                values.findIndex(
                    (item) =>
                        item.toLowerCase() ===
                        value.toLowerCase()
                ) === index
        );

    return (
        uniqueParts.join(", ") ||
        "Location not specified"
    );
}
function ExpertRating({
    average,
    count,
}: {
    average: number;
    count: number;
}) {
    const safeAverage = Math.max(
        0,
        Math.min(5, Number(average) || 0)
    );

    const safeCount = Math.max(
        0,
        Number(count) || 0
    );

    if (safeCount === 0) {
        return (
            <div
                className="inline-flex items-center gap-1.5 text-xs font-bold"
                style={{
                    color: EKARI.subtext,
                }}
            >
                <div className="flex items-center gap-0.5">
                    {Array.from({
                        length: 5,
                    }).map((_, index) => (
                        <IoStarOutline
                            key={index}
                            size={14}
                            className="text-slate-300"
                        />
                    ))}
                </div>

                <span>New</span>
            </div>
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <div
                className="flex items-center gap-0.5"
                aria-label={`${safeAverage.toFixed(
                    1
                )} out of 5 stars`}
            >
                {Array.from({
                    length: 5,
                }).map((_, index) => {
                    const starNumber =
                        index + 1;

                    if (
                        safeAverage >=
                        starNumber
                    ) {
                        return (
                            <IoStar
                                key={index}
                                size={15}
                                className="text-amber-400"
                            />
                        );
                    }

                    if (
                        safeAverage >=
                        starNumber - 0.5
                    ) {
                        return (
                            <IoStarHalf
                                key={index}
                                size={15}
                                className="text-amber-400"
                            />
                        );
                    }

                    return (
                        <IoStarOutline
                            key={index}
                            size={15}
                            className="text-slate-300"
                        />
                    );
                })}
            </div>

            <span
                className="text-xs font-black"
                style={{
                    color: EKARI.text,
                }}
            >
                {safeAverage.toFixed(1)}
            </span>

            <span
                className="text-[11px] font-semibold"
                style={{
                    color: EKARI.subtext,
                }}
            >
                ({safeCount}{" "}
                {safeCount === 1
                    ? "review"
                    : "reviews"}
                )
            </span>
        </div>
    );
}
function ConsultationIcons({
    methods,
}: {
    methods: string[];
}) {
    const visibleMethods = methods.slice(0, 4);

    return (
        <div className="flex items-center gap-1.5">
            {visibleMethods.includes("phone") ? (
                <span
                    title="Phone consultation"
                    className="grid h-8 w-8 place-items-center rounded-full border bg-white"
                    style={{
                        borderColor: EKARI.hair,
                        color: EKARI.forest,
                    }}
                >
                    <IoCallOutline size={15} />
                </span>
            ) : null}

            {visibleMethods.includes("whatsapp") ? (
                <span
                    title="WhatsApp consultation"
                    className="grid h-8 w-8 place-items-center rounded-full border bg-white"
                    style={{
                        borderColor: EKARI.hair,
                        color: "#15803D",
                    }}
                >
                    <IoLogoWhatsapp size={15} />
                </span>
            ) : null}

            {visibleMethods.includes("video") ? (
                <span
                    title="Video consultation"
                    className="grid h-8 w-8 place-items-center rounded-full border bg-white"
                    style={{
                        borderColor: EKARI.hair,
                        color: EKARI.forest,
                    }}
                >
                    <IoVideocamOutline size={15} />
                </span>
            ) : null}
            {visibleMethods.includes("chat") ? (
                <span
                    title="Ekarihub chat"
                    className="grid h-8 w-8 place-items-center rounded-full border bg-white"
                    style={{
                        borderColor: EKARI.hair,
                        color: EKARI.forest,
                    }}
                >
                    <IoChatbubbleEllipsesOutline
                        size={15}
                    />
                </span>
            ) : null}
            {visibleMethods.includes("physical") ? (
                <span
                    title="Physical farm visit"
                    className="grid h-8 w-8 place-items-center rounded-full border bg-white"
                    style={{
                        borderColor: EKARI.hair,
                        color: EKARI.gold,
                    }}
                >
                    <IoLocationOutline size={15} />
                </span>
            ) : null}

        </div>
    );
}

export default function ExpertCard({
    expert,
}: {
    expert: PublicExpert;
}) {
    const profilePath = expert.handle
        ? `/${encodeURIComponent(expert.handle)}`
        : `/ekari-experts/${encodeURIComponent(
            expert.uid
        )}`;

    const displayName =
        expert.displayName?.trim() ||
        expert.organizationName?.trim() ||
        [expert.firstName, expert.surname]
            .filter(Boolean)
            .join(" ")
            .trim() ||
        "ekari Expert";

    const rating =
        Number(expert.rating?.average) || 0;

    const ratingCount =
        Number(expert.rating?.count) || 0;

    const completedConsultations =
        Number(expert.completedConsultations) || 0;

    const specialties = Array.isArray(
        expert.specialties
    )
        ? expert.specialties.slice(0, 4)
        : [];

    const [imageFailed, setImageFailed] =
        React.useState(false);

    React.useEffect(() => {
        setImageFailed(false);
    }, [expert.photoURL]);

    return (
        <motion.article
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.28,
                ease: "easeOut",
            }}
            className={[
                "group rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6]",
                "px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.045)]",
                "transition-all duration-300 ease-out",
                "hover:-translate-y-[2px]",
                "hover:border-[#CBC4B7]",
                "hover:shadow-[0_18px_38px_rgba(15,23,42,0.08)]",
            ].join(" ")}
        >
            <div className="flex items-start gap-4">
                <Link
                    href={profilePath}
                    className="relative shrink-0"
                    aria-label={`View ${displayName}'s profile`}
                >
                    <div
                        className={[
                            "grid h-[84px] w-[84px] place-items-center overflow-hidden rounded-full",
                            "bg-[#E8ECE8] text-lg font-black text-[#173C2E]",
                            "ring-1 ring-black/[0.05]",
                        ].join(" ")}
                    >
                        {expert.photoURL && !imageFailed ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={expert.photoURL}
                                alt={displayName}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="h-full w-full object-cover"
                                onError={() =>
                                    setImageFailed(true)
                                }
                            />
                        ) : (
                            getInitials(displayName)
                        )}
                    </div>

                    {expert.acceptingBookings ? (
                        <span
                            title="Accepting clients"
                            className="absolute bottom-1 right-0 h-4 w-4 rounded-full border-[3px] border-[#FBFAF6] bg-emerald-500"
                        />
                    ) : null}
                </Link>

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <Link
                                href={profilePath}
                                className="inline-flex max-w-full items-center gap-1.5"
                            >
                                <h2 className="truncate text-[17px] font-black tracking-[-0.02em] text-slate-900 transition group-hover:text-[#173C2E]">
                                    {displayName}
                                </h2>

                                {expert.verificationStatus ===
                                    "approved" ? (
                                    <IoCheckmarkCircle
                                        size={16}
                                        className="shrink-0 text-[#F39A22]"
                                        title="Verified expert"
                                    />
                                ) : null}
                            </Link>

                            <p className="mt-1 truncate text-[13px] font-extrabold text-[#E88712]">
                                {expert.headline ||
                                    expert.verificationRole ||
                                    expert.specialties?.[0] ||
                                    expert.organizationName ||
                                    "Agricultural professional"}
                            </p>
                        </div>

                        <div
                            className={[
                                "shrink-0 rounded-full border border-[#F39A22]/45",
                                "bg-[#FFF8ED] px-2.5 py-1",
                                "text-[11px] font-black text-[#9A5A08]",
                            ].join(" ")}
                        >
                            ★ {rating.toFixed(1)} ·{" "}
                            {ratingCount}{" "}
                            {ratingCount === 1
                                ? "review"
                                : "reviews"}
                        </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-semibold text-slate-400">
                        <span className="inline-flex items-center gap-1">
                            <IoLocationOutline
                                size={14}
                                className="text-[#F39A22]"
                            />
                            {getLocationLabel(expert)}
                        </span>

                        <span className="inline-flex items-center gap-1">
                            <IoPeopleOutline size={14} />
                            {completedConsultations} consultation
                            {completedConsultations === 1
                                ? ""
                                : "s"}
                        </span>

                        <span
                            className={
                                expert.acceptingBookings
                                    ? "font-bold text-emerald-600"
                                    : "text-slate-400"
                            }
                        >
                            {expert.acceptingBookings
                                ? "Accepting clients"
                                : "Not accepting clients"}
                        </span>
                    </div>

                    {expert.expertBio ? (
                        <p className="mt-3 line-clamp-3 text-[13px] leading-5 text-slate-600">
                            {expert.expertBio}
                        </p>
                    ) : null}

                    {specialties.length ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {specialties.map((specialty) => (
                                <span
                                    key={specialty}
                                    className={[
                                        "rounded-full border border-[#B9DDAA]",
                                        "bg-[#F4FBF0] px-2.5 py-1",
                                        "text-[10px] font-bold text-[#3F751D]",
                                    ].join(" ")}
                                >
                                    {specialty}
                                </span>
                            ))}
                        </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Link
                            href={profilePath}
                            className={[
                                "inline-flex min-h-10 items-center justify-center rounded-xl",
                                "bg-[#173C2E] px-4",
                                "text-[12px] font-black text-white",
                                "transition-all duration-200",
                                "hover:-translate-y-0.5 hover:bg-[#214C3A]",
                                "active:translate-y-0 active:scale-[0.98]",
                            ].join(" ")}
                        >
                            Book consultation
                        </Link>

                        <Link
                            href="/bonga"
                            className={[
                                "inline-flex min-h-10 items-center justify-center rounded-xl",
                                "bg-[#F39A22] px-4",
                                "text-[12px] font-black text-white",
                                "transition-all duration-200",
                                "hover:-translate-y-0.5 hover:bg-[#E98C12]",
                                "active:translate-y-0 active:scale-[0.98]",
                            ].join(" ")}
                        >
                            Bonga
                        </Link>

                        <Link
                            href={profilePath}
                            className={[
                                "inline-flex min-h-10 items-center justify-center rounded-xl",
                                "border border-[#D7D2C7] bg-white px-4",
                                "text-[12px] font-black text-slate-600",
                                "transition-all duration-200",
                                "hover:border-[#F39A22]/50 hover:bg-[#FFF9F0]",
                                "active:scale-[0.98]",
                            ].join(" ")}
                        >
                            View full profile
                        </Link>

                        <div className="ml-auto hidden sm:block">
                            <div className="text-right text-[11px] font-black text-[#173C2E]">
                                {getPriceLabel(expert)}
                            </div>

                            <div className="mt-1">
                                <ConsultationIcons
                                    methods={
                                        expert.consultationMethods ||
                                        []
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.article>
    );
}