"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    IoArrowForward,
    IoLocationOutline,
    IoPeopleOutline,
    IoPricetagOutline,
    IoTrendingUpOutline,
} from "react-icons/io5";

import type { Product } from "@/app/components/ProductCard";

type Props = {
    items: Product[];
    onSearch: (term: string) => void;
    onSell: () => void;
    onNearby: () => void;
};

type SellerSummary = {
    id: string;
    handle: string;
    photoURL?: string | null;
    county?: string | null;
    listings: number;
};

function RailCard({
    title,
    icon,
    children,
    className = "",
}: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section
            className={[
                "rounded-[18px] border border-[#DDD8CC]",
                "bg-[#FBFAF6] px-4 py-4",
                "shadow-[0_12px_32px_rgba(15,23,42,0.04)]",
                "transition-all duration-300 ease-out",
                "hover:-translate-y-[1px] hover:shadow-[0_16px_36px_rgba(15,23,42,0.07)]",
                className,
            ].join(" ")}
        >
            <div className="mb-3 flex items-center gap-2">
                <span className="text-[#c69258]">{icon}</span>
                <h2 className="text-[11px] font-black uppercase tracking-[0.09em] text-slate-500">
                    {title}
                </h2>
            </div>

            {children}
        </section>
    );
}
function SellerAvatar({
    photoURL,
    handle,
}: {
    photoURL?: string | null;
    handle: string;
}) {
    const [imageFailed, setImageFailed] = React.useState(false);

    // Reset failure state if the seller/photo changes
    React.useEffect(() => {
        setImageFailed(false);
    }, [photoURL]);

    const initial =
        handle
            .replace(/^@/, "")
            .trim()
            .slice(0, 1)
            .toUpperCase() || "S";

    const showImage = Boolean(photoURL) && !imageFailed;

    return (
        <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#E9ECE7] text-xs font-black text-[#173C2E]">
            {showImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={photoURL!}
                    alt={handle}
                    className="h-full w-full object-cover"
                    onError={() => setImageFailed(true)}
                />
            ) : (
                <span>{initial}</span>
            )}
        </div>
    );
}
export default function MarketDiscoveryRail({
    items,
    onSearch,
    onSell,
    onNearby,
}: Props) {
    const router = useRouter();

    const trending = useMemo(() => {
        const counts = new Map<string, number>();

        items.forEach((item) => {
            const name = String(item.name ?? "").trim();
            if (!name) return;

            const key = name.toLowerCase();
            counts.set(key, (counts.get(key) ?? 0) + 1);
        });

        return Array.from(counts.entries())
            .map(([key, count]) => {
                const found = items.find(
                    (item) =>
                        String(item.name ?? "")
                            .trim()
                            .toLowerCase() === key
                );

                return {
                    label: found?.name ?? key,
                    count,
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [items]);

    const sellers = useMemo(() => {
        const map = new Map<string, SellerSummary>();

        items.forEach((item) => {
            const id =
                item.seller?.id ??
                item.sellerId ??
                (item as any)?.ownerId ??
                "";

            if (!id) return;

            const existing = map.get(id);
            const handle =
                item.seller?.handle?.trim() ||
                "Seller";

            const county =
                item.place?.county ??
                item.place?.town ??
                null;

            if (existing) {
                existing.listings += 1;
                if (!existing.photoURL && item.seller?.photoURL) {
                    existing.photoURL = item.seller.photoURL;
                }
                return;
            }

            map.set(id, {
                id,
                handle,
                photoURL: item.seller?.photoURL ?? null,
                county,
                listings: 1,
            });
        });

        return Array.from(map.values())
            .sort((a, b) => b.listings - a.listings)
            .slice(0, 3);
    }, [items]);

    return (
        <aside className="h-[100svh] w-full bg-[#F8F7F2]">
            <div className="h-full overflow-y-auto px-3 py-4 no-scrollbar">
                <div className="space-y-3">
                    <RailCard
                        title="Trending now"
                        icon={<IoTrendingUpOutline size={16} />}
                    >
                        {trending.length ? (
                            <div className="space-y-1">
                                {trending.map((entry, index) => (
                                    <button
                                        key={entry.label}
                                        type="button"
                                        onClick={() => onSearch(entry.label)}
                                        className={[
                                            "group flex w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left",
                                            "transition-all duration-200 hover:translate-x-1 hover:bg-black/[0.025]",
                                        ].join(" ")}
                                    >
                                        <span className="w-4 shrink-0 text-[11px] font-black text-[#c69258]">
                                            {index + 1}
                                        </span>

                                        <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-slate-700 transition-colors group-hover:text-[#173C2E]">
                                            {entry.label}
                                        </span>

                                        <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                                            {entry.count} listing{entry.count === 1 ? "" : "s"}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400">
                                Trending listings will appear here.
                            </p>
                        )}
                    </RailCard>

                    <RailCard
                        title="Active sellers"
                        icon={<IoPeopleOutline size={16} />}
                    >
                        {sellers.length ? (
                            <div className="space-y-2">
                                {sellers.map((seller) => (
                                    <div
                                        key={seller.id}
                                        className="flex items-center gap-2.5"
                                    >
                                        <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#E9ECE7] text-xs font-black text-[#173C2E]">
                                            <SellerAvatar
                                                photoURL={seller.photoURL}
                                                handle={seller.handle}
                                            />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-[12px] font-extrabold text-slate-800">
                                                {seller.handle.startsWith("@")
                                                    ? seller.handle
                                                    : `@${seller.handle}`}
                                            </div>

                                            <div className="truncate text-[10px] text-slate-400">
                                                {seller.county
                                                    ? `${seller.county} · `
                                                    : ""}
                                                {seller.listings} listing{seller.listings === 1 ? "" : "s"}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.push(
                                                    `/store/${seller.id}?src=market`
                                                )
                                            }
                                            className={[
                                                "rounded-full border border-[#c69258] px-2.5 py-1",
                                                "text-[10px] font-black text-[#c69258]",
                                                "transition-all duration-200",
                                                "hover:bg-[#c69258] hover:text-white active:scale-95",
                                            ].join(" ")}
                                        >
                                            View
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400">
                                Seller activity will appear here.
                            </p>
                        )}
                    </RailCard>

                    <RailCard
                        title="Sell on ekarihub"
                        icon={<IoPricetagOutline size={16} />}
                        className="bg-[#F7F8F5]"
                    >
                        <p className="text-[12px] font-medium leading-5 text-slate-600">
                            Reach farmers and buyers across Kenya. List products,
                            animals, land, lease offers or services.
                        </p>

                        <button
                            type="button"
                            onClick={onSell}
                            className={[
                                "mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl",
                                "bg-[#c69258] text-sm font-black text-white",
                                "shadow-[0_10px_24px_rgba(243,154,34,0.18)]",
                                "transition-all duration-250 ease-out",
                                "hover:-translate-y-0.5 hover:bg-[#E98C12]",
                                "active:translate-y-0 active:scale-[0.98]",
                            ].join(" ")}
                        >
                            Post a listing
                            <IoArrowForward size={15} />
                        </button>
                    </RailCard>

                    <RailCard
                        title="Nearby"
                        icon={<IoLocationOutline size={16} />}
                    >
                        <p className="text-[12px] font-medium leading-5 text-slate-600">
                            Use location filters to find listings closer to your
                            farm or business.
                        </p>

                        <button
                            type="button"
                            onClick={onNearby}
                            className={[
                                "mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl",
                                "border border-[#D7D2C7] bg-white",
                                "text-[12px] font-extrabold text-[#173C2E]",
                                "transition-all duration-200",
                                "hover:border-[#c69258]/60 hover:bg-[#FFF9F0]",
                                "active:scale-[0.98]",
                            ].join(" ")}
                        >
                            <IoLocationOutline size={15} />
                            Set location
                        </button>
                    </RailCard>
                </div>
            </div>
        </aside>
    );
}