"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    IoArrowForward,
    IoBriefcaseOutline,
    IoLeafOutline,
    IoPeopleOutline,
    IoShieldCheckmarkOutline,
    IoStar,
    IoStarOutline,
} from "react-icons/io5";

import type { PublicExpert } from "@/app/types/publicExpert";

type Props = {
    experts: PublicExpert[];
    specialtyOptions: string[];
    featuredExpert?: PublicExpert | null;
    onSpecialtySelect: (specialty: string) => void;
};

function getExpertName(expert: PublicExpert) {
    return (
        expert.displayName?.trim() ||
        [expert.firstName, expert.surname]
            .filter(Boolean)
            .join(" ")
            .trim() ||
        expert.organizationName?.trim() ||
        expert.handle?.trim() ||
        "ekari Expert"
    );
}

function getProfileHref(expert: PublicExpert) {
    return expert.handle
        ? `/${encodeURIComponent(expert.handle)}`
        : `/ekari-experts/${encodeURIComponent(expert.uid)}`;
}

function Avatar({
    expert,
    sizeClass = "h-16 w-16",
}: {
    expert: PublicExpert;
    sizeClass?: string;
}) {
    const [failed, setFailed] = React.useState(false);
    const name = getExpertName(expert);

    React.useEffect(() => {
        setFailed(false);
    }, [expert.photoURL]);

    return (
        <div
            className={[
                "relative grid shrink-0 place-items-center overflow-hidden rounded-full",
                "bg-[#E8ECE8] text-[#173C2E] ring-1 ring-black/[0.05]",
                sizeClass,
            ].join(" ")}
        >
            {expert.photoURL && !failed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={expert.photoURL}
                    alt={name}
                    className="h-full w-full object-cover"
                    onError={() => setFailed(true)}
                />
            ) : (
                <IoPeopleOutline size={24} />
            )}

            {expert.acceptingBookings ? (
                <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#FBFAF6] bg-emerald-500" />
            ) : null}
        </div>
    );
}

function RailCard({
    title,
    icon,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section
            className={[
                "rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6]",
                "px-4 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.04)]",
                "transition-all duration-300 ease-out",
                "hover:-translate-y-[1px] hover:shadow-[0_16px_36px_rgba(15,23,42,0.07)]",
            ].join(" ")}
        >
            <div className="mb-3 flex items-center gap-2">
                <span className="text-[#F39A22]">{icon}</span>
                <h2 className="text-[11px] font-black uppercase tracking-[0.09em] text-slate-500">
                    {title}
                </h2>
            </div>

            {children}
        </section>
    );
}

export default function ExpertDiscoveryRail({
    experts,
    specialtyOptions,
    featuredExpert,
    onSpecialtySelect,
}: Props) {
    const router = useRouter();

    const specialtyCounts = useMemo(() => {
        return specialtyOptions
            .map((specialty) => ({
                specialty,
                count: experts.filter((expert) =>
                    expert.specialties?.some(
                        (item) =>
                            item.trim().toLowerCase() ===
                            specialty.trim().toLowerCase()
                    )
                ).length,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [experts, specialtyOptions]);

    const acceptingCount = useMemo(
        () =>
            experts.filter(
                (expert) => expert.acceptingBookings
            ).length,
        [experts]
    );

    return (
        <aside className="h-[100svh] w-full bg-[#F8F7F2]">
            <div className="h-full overflow-y-auto px-3 py-4 no-scrollbar">
                <div className="space-y-3">
                    {featuredExpert ? (
                        <RailCard
                            title="Featured expert"
                            icon={<IoStarOutline size={16} />}
                        >
                            <div className="flex flex-col items-center text-center">
                                <Avatar expert={featuredExpert} />

                                <div className="mt-3 text-[14px] font-black text-slate-900">
                                    {getExpertName(featuredExpert)}
                                </div>

                                <div className="mt-1 line-clamp-2 text-[11px] font-bold text-[#E88712]">
                                    {featuredExpert.headline ||
                                        featuredExpert.specialties?.[0] ||
                                        "Agricultural professional"}
                                </div>

                                <div className="mt-2 flex items-center gap-1 text-[#F39A22]">
                                    <IoStar size={14} />
                                    <span className="text-[11px] font-black text-slate-700">
                                        {Number(
                                            featuredExpert.rating
                                                ?.average || 0
                                        ).toFixed(1)}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        ·{" "}
                                        {featuredExpert.rating
                                            ?.count || 0}{" "}
                                        review
                                        {(featuredExpert.rating
                                            ?.count || 0) === 1
                                            ? ""
                                            : "s"}
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        router.push(
                                            getProfileHref(
                                                featuredExpert
                                            )
                                        )
                                    }
                                    className={[
                                        "mt-4 h-10 w-full rounded-xl bg-[#173C2E]",
                                        "text-[12px] font-black text-white",
                                        "transition-all duration-250 ease-out",
                                        "hover:-translate-y-0.5 hover:bg-[#214C3A]",
                                        "active:translate-y-0 active:scale-[0.98]",
                                    ].join(" ")}
                                >
                                    Book now
                                </button>
                            </div>
                        </RailCard>
                    ) : null}

                    <RailCard
                        title="Browse by specialty"
                        icon={<IoLeafOutline size={16} />}
                    >
                        {specialtyCounts.length ? (
                            <div className="divide-y divide-[#E6E1D7]">
                                {specialtyCounts.map(
                                    ({ specialty, count }) => (
                                        <button
                                            key={specialty}
                                            type="button"
                                            onClick={() =>
                                                onSpecialtySelect(
                                                    specialty
                                                )
                                            }
                                            className={[
                                                "group flex w-full items-center gap-2.5 py-2.5 text-left",
                                                "transition-transform duration-200 hover:translate-x-1",
                                            ].join(" ")}
                                        >
                                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#E8ECE8] text-[#173C2E]">
                                                <IoBriefcaseOutline
                                                    size={15}
                                                />
                                            </span>

                                            <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-slate-700 group-hover:text-[#173C2E]">
                                                {specialty}
                                            </span>

                                            <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                                                {count} expert
                                                {count === 1
                                                    ? ""
                                                    : "s"}
                                            </span>
                                        </button>
                                    )
                                )}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400">
                                Specialties will appear here.
                            </p>
                        )}
                    </RailCard>

                    <RailCard
                        title="Available experts"
                        icon={
                            <IoShieldCheckmarkOutline
                                size={16}
                            />
                        }
                    >
                        <div className="flex items-end justify-between gap-3">
                            <div>
                                <div className="text-[26px] font-black leading-none text-[#173C2E]">
                                    {acceptingCount}
                                </div>

                                <div className="mt-1 text-[11px] font-semibold text-slate-400">
                                    accepting new clients
                                </div>
                            </div>

                            <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                                <IoPeopleOutline size={19} />
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                router.push(
                                    "/ekari-experts?accepting=true"
                                )
                            }
                            className={[
                                "mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl",
                                "border border-[#D7D2C7] bg-white",
                                "text-[11px] font-black text-[#173C2E]",
                                "transition-all duration-200",
                                "hover:border-[#F39A22]/55 hover:bg-[#FFF9F0]",
                                "active:scale-[0.98]",
                            ].join(" ")}
                        >
                            Browse available
                            <IoArrowForward size={14} />
                        </button>
                    </RailCard>
                </div>
            </div>
        </aside>
    );
}