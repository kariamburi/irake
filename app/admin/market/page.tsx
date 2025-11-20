// app/admin/market/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    updateDoc,
    doc,
    deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    IoCubeOutline,
    IoCheckmarkDone,
    IoCashOutline,
    IoTimeOutline,
    IoEyeOffOutline,
    IoTrashOutline,
} from "react-icons/io5";
import Link from "next/link";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
};

type MarketStatus = "active" | "sold" | "reserved" | "hidden" | string;

type MarketType =
    | "product"
    | "lease"
    | "service"
    | "animal"
    | "crop"
    | "equipment"
    | "tree"
    | string;

type ListingDoc = {
    id: string;
    name?: string;
    price?: number;
    rate?: string;
    billingUnit?: string;
    category?: string;
    type?: MarketType;
    status?: MarketStatus;
    sellerId?: string;
    imageUrl?: string;
    imageUrls?: string[];
    createdAt?: any;
};

function formatKES(n: number | undefined) {
    if (!n || !Number.isFinite(n)) return "—";
    return (
        "KSh " +
        Number(n).toLocaleString("en-KE", {
            maximumFractionDigits: 0,
        })
    );
}

function formatDate(ts: any) {
    if (!ts) return "";
    if (ts.toDate) {
        const d = ts.toDate();
        return d.toLocaleDateString() + " " + d.toLocaleTimeString();
    }
    return String(ts);
}

const STATUS_LABEL: Record<MarketStatus, string> = {
    active: "Active",
    sold: "Sold",
    reserved: "Reserved",
    hidden: "Hidden",
};

const STATUS_COLOR: Record<MarketStatus, string> = {
    active: "bg-emerald-600",
    sold: "bg-rose-600",
    reserved: "bg-amber-500",
    hidden: "bg-gray-500",
};

/* ------------------------ Product preview modal ------------------------ */

type ListingPreviewDoc = {
    name?: string;
};

function ProductPreviewModal({
    listingId,
    onClose,
}: {
    listingId: string;
    onClose: () => void;
}) {
    const [listing, setListing] = useState<ListingPreviewDoc | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const ref = doc(db, "marketListings", listingId);
        const unsub = onSnapshot(
            ref,
            (snap) => {
                setListing(snap.exists() ? (snap.data() as any) : null);
                setLoading(false);
            },
            () => setLoading(false)
        );
        return () => unsub();
    }, [listingId]);

    // Close on Esc
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    const stop = (e: React.MouseEvent) => e.stopPropagation();

    const publicUrl = `/market/${listingId}`;

    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 backdrop-blur-sm px-3"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-5xl h-[90vh] rounded-3xl bg-white shadow-xl flex flex-col overflow-hidden"
                onClick={stop}
                style={{ borderColor: EKARI.hair, borderWidth: 1 }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 border-b"
                    style={{ borderColor: EKARI.hair }}
                >
                    <div className="min-w-0">
                        <div
                            className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                            style={{ color: EKARI.dim }}
                        >
                            Listing preview
                        </div>
                        <div
                            className="mt-0.5 text-sm md:text-base font-bold truncate"
                            style={{ color: EKARI.text }}
                        >
                            {listing?.name || "Untitled listing"}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href={publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="hidden sm:inline-flex items-center gap-1 rounded-full border px-3 h-8 text-xs font-semibold hover:bg-gray-50"
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            Open full page
                        </Link>
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-full border text-xs font-bold hover:bg-gray-50"
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 bg-gray-50/60 flex flex-col">
                    {loading ? (
                        <div
                            className="flex-1 grid place-items-center text-sm"
                            style={{ color: EKARI.dim }}
                        >
                            Loading listing…
                        </div>
                    ) : !listing ? (
                        <div
                            className="flex-1 grid place-items-center text-sm text-center px-4"
                            style={{ color: EKARI.dim }}
                        >
                            Could not load this listing. It may have been removed.
                        </div>
                    ) : (
                        <div className="flex-1">
                            <iframe
                                src={publicUrl}
                                title="Listing preview"
                                className="w-full h-full rounded-b-3xl"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ------------------------------ Main page ------------------------------ */

export default function AdminMarketPage() {
    const [items, setItems] = useState<ListingDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<MarketStatus | "all">("all");
    const [busyId, setBusyId] = useState<string | null>(null);
    const [previewListingId, setPreviewListingId] = useState<string | null>(null);

    useEffect(() => {
        const base = query(
            collection(db, "marketListings"),
            orderBy("createdAt", "desc"),
            limit(60)
        );

        const unsub = onSnapshot(
            base,
            (snap) => {
                setItems(
                    snap.docs.map(
                        (d) =>
                        ({
                            id: d.id,
                            ...(d.data() as any),
                        } as ListingDoc)
                    )
                );
                setLoading(false);
            },
            (err) => {
                console.error("AdminMarket listener error:", err);
                setLoading(false);
            }
        );

        return () => unsub();
    }, []);

    const filtered = useMemo(() => {
        if (filterStatus === "all") return items;
        return items.filter((i) => (i.status || "active") === filterStatus);
    }, [items, filterStatus]);

    async function updateStatus(listing: ListingDoc, status: MarketStatus) {
        try {
            setBusyId(listing.id);
            await updateDoc(doc(db, "marketListings", listing.id), {
                status,
                sold: status === "sold",
            });
        } catch (err: any) {
            alert(err?.message || "Failed to update listing");
        } finally {
            setBusyId(null);
        }
    }

    async function deleteListing(listing: ListingDoc) {
        const ok = window.confirm(
            "Delete this listing? This will remove it from the marketplace."
        );
        if (!ok) return;
        try {
            setBusyId(listing.id);
            await deleteDoc(doc(db, "marketListings", listing.id));
        } catch (err: any) {
            alert(err?.message || "Failed to delete listing");
        } finally {
            setBusyId(null);
        }
    }

    const closePreview = () => setPreviewListingId(null);

    return (
        <>
            <div className="p-4 md:p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                    <div>
                        <h1
                            className="text-2xl md:text-3xl font-extrabold"
                            style={{ color: EKARI.text }}
                        >
                            Marketplace listings
                        </h1>
                        <p className="text-sm md:text-base" style={{ color: EKARI.dim }}>
                            All market listings across ekarihub. As admin, you can moderate status
                            or remove spammy items.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <span
                            className="text-xs font-semibold"
                            style={{ color: EKARI.dim }}
                        >
                            Filter status:
                        </span>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as any)}
                            className="text-xs md:text-sm rounded-full border px-3 py-1.5 outline-none bg-white"
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        >
                            <option value="all">All</option>
                            <option value="active">Active</option>
                            <option value="sold">Sold</option>
                            <option value="reserved">Reserved</option>
                            <option value="hidden">Hidden</option>
                        </select>
                    </div>
                </div>

                {/* Summary badge */}
                <div className="flex items-center gap-2 text-sm">
                    <IoCubeOutline className="text-emerald-700" />
                    <span className="font-semibold" style={{ color: EKARI.text }}>
                        {items.length} listing{items.length === 1 ? "" : "s"} loaded
                    </span>
                    {filterStatus !== "all" && (
                        <span className="text-xs" style={{ color: EKARI.dim }}>
                            • Showing {filtered.length} {filterStatus} items
                        </span>
                    )}
                </div>

                {/* Listing cards */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-40 rounded-2xl bg-gray-100 animate-pulse"
                            />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-16 text-center text-sm text-gray-400">
                        No listings match this filter.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map((l) => {
                            const status: MarketStatus =
                                (l.status as MarketStatus) ??
                                ((l as any).sold ? "sold" : "active");

                            const statusLabel =
                                STATUS_LABEL[status] ||
                                status.replace(/^\w/, (c) => c.toUpperCase());
                            const statusColorClass =
                                STATUS_COLOR[status] || "bg-gray-500";

                            const cover =
                                l.imageUrl || (l.imageUrls && l.imageUrls[0]) || "";

                            const isBusy = busyId === l.id;

                            const priceText =
                                l.type === "lease" || l.type === "service"
                                    ? `${l.rate || "—"}${l.billingUnit ? ` / ${l.billingUnit}` : ""
                                    }`
                                    : formatKES(Number(l.price || 0));

                            return (
                                <div
                                    key={l.id}
                                    className="rounded-2xl border bg-white shadow-sm hover:shadow-md transition flex flex-col overflow-hidden"
                                    style={{ borderColor: EKARI.hair }}
                                >
                                    {/* Image / header area */}
                                    <div className="relative h-36 bg-gray-100">
                                        {cover ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={cover}
                                                alt={l.name || "Listing"}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">
                                                No image
                                            </div>
                                        )}
                                        <div
                                            className={`absolute left-2 top-2 text-[10px] font-extrabold text-white px-2 py-1 rounded-full flex items-center gap-1 ${statusColorClass}`}
                                        >
                                            <IoCheckmarkDone size={12} />
                                            {statusLabel}
                                        </div>
                                    </div>

                                    {/* Body */}
                                    <div className="p-3 flex-1 flex flex-col gap-2">
                                        <div className="text-[13px] font-extrabold text-gray-900 line-clamp-2">
                                            {l.name || "Untitled listing"}
                                        </div>

                                        <div className="text-xs text-gray-500 flex flex-wrap gap-1">
                                            <span>
                                                Seller:{" "}
                                                <span className="font-mono">
                                                    {l.sellerId?.slice(0, 8) || "unknown"}
                                                </span>
                                            </span>
                                            {l.category && (
                                                <>
                                                    <span>•</span>
                                                    <span>{l.category}</span>
                                                </>
                                            )}
                                        </div>

                                        <div
                                            className="text-sm font-black"
                                            style={{ color: EKARI.forest }}
                                        >
                                            {priceText}
                                        </div>

                                        <div className="text-[11px] text-gray-400">
                                            Created: {formatDate(l.createdAt)}
                                        </div>

                                        {/* Admin actions */}
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {/* Preview listing */}
                                            <button
                                                type="button"
                                                onClick={() => setPreviewListingId(l.id)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                            >
                                                Preview listing
                                            </button>

                                            {status !== "active" && (
                                                <button
                                                    onClick={() => updateStatus(l, "active")}
                                                    disabled={isBusy}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600 text-white hover:opacity-90 disabled:opacity-60"
                                                >
                                                    <IoCheckmarkDone size={12} />
                                                    Activate
                                                </button>
                                            )}
                                            {status !== "sold" && (
                                                <button
                                                    onClick={() => updateStatus(l, "sold")}
                                                    disabled={isBusy}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-600 text-white hover:opacity-90 disabled:opacity-60"
                                                >
                                                    <IoCashOutline size={12} />
                                                    Sold
                                                </button>
                                            )}
                                            {status !== "reserved" && (
                                                <button
                                                    onClick={() => updateStatus(l, "reserved")}
                                                    disabled={isBusy}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-yellow-500 text-white hover:opacity-90 disabled:opacity-60"
                                                >
                                                    <IoTimeOutline size={12} />
                                                    Reserve
                                                </button>
                                            )}
                                            {status !== "hidden" && (
                                                <button
                                                    onClick={() => updateStatus(l, "hidden")}
                                                    disabled={isBusy}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-600 text-white hover:opacity-90 disabled:opacity-60"
                                                >
                                                    <IoEyeOffOutline size={12} />
                                                    Hide
                                                </button>
                                            )}
                                            <button
                                                onClick={() => deleteListing(l)}
                                                disabled={isBusy}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-600 text-white hover:opacity-90 disabled:opacity-60"
                                            >
                                                <IoTrashOutline size={12} />
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {previewListingId && (
                <ProductPreviewModal
                    listingId={previewListingId}
                    onClose={closePreview}
                />
            )}
        </>
    );
}
