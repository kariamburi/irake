"use client";

import { PublicExpert } from "@/app/types/publicExpert";
import Link from "next/link";
import {
    IoArrowForward,
    IoCallOutline,
    IoCheckmarkCircle,
    IoLocationOutline,
    IoLogoWhatsapp,
    IoPeopleOutline,
    IoStar,
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
    currency = "KES"
): string {
    return new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
    }).format(Math.max(0, amount));
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
    const town =
        expert.primaryLocation?.town?.trim();

    const county =
        expert.primaryLocation?.county?.trim();

    if (town && county) {
        return `${town}, ${county}`;
    }

    return town || county || "Kenya";
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
        ? expert.specialties.slice(0, 3)
        : [];

    const remainingSpecialties =
        Math.max(
            0,
            (expert.specialties?.length || 0) -
            specialties.length
        );

    return (
        <article
            className="group flex h-full flex-col overflow-hidden rounded-3xl border bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"
            style={{ borderColor: EKARI.hair }}
        >
            <div
                className="h-1.5 w-full"
                style={{
                    background:
                        "linear-gradient(90deg, #233F39, #C79257)",
                }}
            />

            <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start gap-4">
                    <Link
                        href={profilePath}
                        className="relative shrink-0"
                        aria-label={`View ${displayName}'s profile`}
                    >
                        {expert.photoURL ? (
                            <img
                                src={expert.photoURL}
                                alt={displayName}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="h-20 w-20 rounded-2xl border object-cover"
                                style={{
                                    borderColor: EKARI.hair,
                                    backgroundColor: EKARI.soft,
                                }}
                                onError={(event) => {
                                    event.currentTarget.style.display =
                                        "none";

                                    const fallback =
                                        event.currentTarget
                                            .nextElementSibling as HTMLElement | null;

                                    if (fallback) {
                                        fallback.style.display =
                                            "grid";
                                    }
                                }}
                            />
                        ) : null}

                        <span
                            className="h-20 w-20 place-items-center rounded-2xl text-xl font-black text-white"
                            style={{
                                display: expert.photoURL
                                    ? "none"
                                    : "grid",
                                background:
                                    "linear-gradient(135deg, #233F39, #C79257)",
                            }}
                        >
                            {getInitials(displayName)}
                        </span>

                        {expert.acceptingBookings ? (
                            <span
                                title="Accepting clients"
                                className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-white bg-emerald-500"
                            />
                        ) : null}
                    </Link>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <Link
                                    href={profilePath}
                                    className="flex items-center gap-1.5"
                                >
                                    <h2
                                        className="truncate text-base font-black transition group-hover:underline"
                                        style={{ color: EKARI.text }}
                                    >
                                        {displayName}
                                    </h2>

                                    {expert.verified ? (
                                        <IoCheckmarkCircle
                                            size={18}
                                            className="shrink-0"
                                            color="#1D9BF0"
                                            title="Verified expert"
                                        />
                                    ) : null}
                                </Link>

                                <p
                                    className="mt-1 truncate text-xs font-bold"
                                    style={{ color: EKARI.gold }}
                                >
                                    {expert.verificationRole ||
                                        expert.organizationName ||
                                        "Agricultural professional"}
                                </p>
                            </div>

                            {rating > 0 ? (
                                <div className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">
                                    <IoStar size={13} />
                                    {rating.toFixed(1)}
                                </div>
                            ) : null}
                        </div>

                        <div
                            className="mt-2 flex items-center gap-1 text-xs"
                            style={{ color: EKARI.subtext }}
                        >
                            <IoLocationOutline
                                size={14}
                                className="shrink-0"
                            />

                            <span className="truncate">
                                {getLocationLabel(expert)}
                            </span>
                        </div>
                    </div>
                </div>

                <Link
                    href={profilePath}
                    className="mt-5 block"
                >
                    <h3
                        className="line-clamp-2 min-h-12 text-base font-black leading-6"
                        style={{ color: EKARI.text }}
                    >
                        {expert.headline ||
                            "Agricultural expert consultation"}
                    </h3>
                </Link>

                {expert.expertBio ? (
                    <p
                        className="mt-2 line-clamp-3 text-sm leading-6"
                        style={{ color: EKARI.subtext }}
                    >
                        {expert.expertBio}
                    </p>
                ) : null}

                {specialties.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {specialties.map((specialty: any) => (
                            <span
                                key={specialty}
                                className="rounded-full border px-3 py-1.5 text-[11px] font-bold"
                                style={{
                                    borderColor:
                                        "rgba(35,63,57,0.15)",
                                    backgroundColor:
                                        "rgba(35,63,57,0.06)",
                                    color: EKARI.forest,
                                }}
                            >
                                {specialty}
                            </span>
                        ))}

                        {remainingSpecialties > 0 ? (
                            <span
                                className="rounded-full border px-3 py-1.5 text-[11px] font-bold"
                                style={{
                                    borderColor: EKARI.hair,
                                    color: EKARI.subtext,
                                }}
                            >
                                +{remainingSpecialties} more
                            </span>
                        ) : null}
                    </div>
                ) : null}

                <div className="mt-auto pt-5">
                    <div
                        className="flex items-center justify-between gap-3 border-t pt-4"
                        style={{ borderColor: EKARI.hair }}
                    >
                        <div>
                            <div
                                className="text-sm font-black"
                                style={{ color: EKARI.forest }}
                            >
                                {getPriceLabel(expert)}
                            </div>

                            {expert.pricing
                                ?.consultationDurationMinutes ? (
                                <div
                                    className="mt-0.5 text-[11px]"
                                    style={{
                                        color: EKARI.subtext,
                                    }}
                                >
                                    {
                                        expert.pricing
                                            .consultationDurationMinutes
                                    }{" "}
                                    minute consultation
                                </div>
                            ) : null}
                        </div>

                        <ConsultationIcons
                            methods={
                                expert.consultationMethods || []
                            }
                        />
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                        <Link
                            href={profilePath}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white"
                            style={{
                                backgroundColor: EKARI.forest,
                            }}
                        >
                            View profile
                            <IoArrowForward size={16} />
                        </Link>
                    </div>

                    <div
                        className="mt-3 flex min-h-5 items-center justify-between gap-2 text-[11px]"
                        style={{ color: EKARI.subtext }}
                    >
                        <span className="inline-flex items-center gap-1">
                            <IoPeopleOutline size={13} />

                            {completedConsultations > 0
                                ? `${completedConsultations} consultations`
                                : "New expert"}
                        </span>

                        <span>
                            {ratingCount > 0
                                ? `${ratingCount} ${ratingCount === 1
                                    ? "review"
                                    : "reviews"
                                }`
                                : expert.acceptingBookings
                                    ? "Accepting clients"
                                    : "Not accepting clients"}
                        </span>
                    </div>
                </div>
            </div>
        </article>
    );
}