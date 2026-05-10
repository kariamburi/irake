// app/admin/market/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
    collection,
    query,
    orderBy,
    limit,
    updateDoc,
    doc,
    deleteDoc,
    getDocs,
    where,
    startAfter,
    QueryDocumentSnapshot,
    DocumentData,
    onSnapshot,
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

const PAGE_SIZE = 20;

type MarketStatus = "active" | "sold" | "reserved" | "hidden" | "draft" | string;

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
    ownerId?: string;
    sellerId?: string;
    seller?: {
        id?: string;
        name?: string;
        handle?: string;
        photoURL?: string;
        verified?: boolean;
    };
    imageUrl?: string;
    imageUrls?: string[];
    createdAt?: any;
    updatedAt?: any;
    sold?: boolean;
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

const STATUS_LABEL: Record<string, string> = {
    active: "Active",
    sold: "Sold",
    reserved: "Reserved",
    hidden: "Hidden",
    draft: "Draft",
};

const STATUS_COLOR: Record<string, string> = {
    active: "bg-emerald-600",
    sold: "bg-rose-600",
    reserved: "bg-amber-500",
    hidden: "bg-gray-500",
    draft: "bg-slate-500",
};

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

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    const publicUrl = `/market/${listingId}`;

    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-3 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="relative flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
                style={{ borderColor: EKARI.hair, borderWidth: 1 }}
            >
                <div
                    className="flex items-center justify-between gap-3 border-b px-4 py-3 md:px-6"
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
                            className="mt-0.5 truncate text-sm font-bold md:text-base"
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
                            className="hidden h-8 items-center gap-1 rounded-full border px-3 text-xs font-semibold hover:bg-gray-50 sm:inline-flex"
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            Open full page
                        </Link>

                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold hover:bg-gray-50"
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 flex-col bg-gray-50/60">
                    {loading ? (
                        <div
                            className="grid flex-1 place-items-center text-sm"
                            style={{ color: EKARI.dim }}
                        >
                            Loading listing…
                        </div>
                    ) : !listing ? (
                        <div
                            className="grid flex-1 place-items-center px-4 text-center text-sm"
                            style={{ color: EKARI.dim }}
                        >
                            Could not load this listing. It may have been removed.
                        </div>
                    ) : (
                        <iframe
                            src={publicUrl}
                            title="Listing preview"
                            className="h-full w-full rounded-b-3xl"
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export default function AdminMarketPage() {
    const [items, setItems] = useState<ListingDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<MarketStatus | "all">("all");
    const [busyId, setBusyId] = useState<string | null>(null);
    const [previewListingId, setPreviewListingId] = useState<string | null>(null);

    const [page, setPage] = useState(1);
    const [pageCursors, setPageCursors] = useState<
        (QueryDocumentSnapshot<DocumentData> | null)[]
    >([null]);
    const [hasMore, setHasMore] = useState(true);

    const loadListings = async (
        targetPage: number,
        cursor: QueryDocumentSnapshot<DocumentData> | null
    ) => {
        setLoading(true);

        try {
            const constraints: any[] = [];

            if (filterStatus !== "all") {
                constraints.push(where("status", "==", filterStatus));
            }

            constraints.push(orderBy("createdAt", "desc"));

            if (cursor) {
                constraints.push(startAfter(cursor));
            }

            constraints.push(limit(PAGE_SIZE));

            const snap = await getDocs(
                query(collection(db, "marketListings"), ...constraints)
            );

            const nextItems = snap.docs.map(
                (d) =>
                ({
                    id: d.id,
                    ...(d.data() as any),
                } as ListingDoc)
            );

            setItems(nextItems);
            setPage(targetPage);
            setHasMore(snap.docs.length === PAGE_SIZE);

            const lastVisible = snap.docs[snap.docs.length - 1] ?? null;

            setPageCursors((prev) => {
                const copy = [...prev];
                copy[targetPage] = lastVisible;
                return copy;
            });
        } catch (err) {
            console.error("AdminMarket pagination error:", err);
            alert("Failed to load market listings.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setItems([]);
        setPage(1);
        setPageCursors([null]);
        setHasMore(true);

        loadListings(1, null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterStatus]);

    const filtered = useMemo(() => items, [items]);

    async function updateStatus(listing: ListingDoc, status: MarketStatus) {
        try {
            setBusyId(listing.id);

            await updateDoc(doc(db, "marketListings", listing.id), {
                status,
                sold: status === "sold",
            });

            setItems((prev) => prev.filter((item) => item.id !== listing.id));
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
            setItems((prev) => prev.filter((item) => item.id !== listing.id));
        } catch (err: any) {
            alert(err?.message || "Failed to delete listing");
        } finally {
            setBusyId(null);
        }
    }

    const closePreview = () => setPreviewListingId(null);

    return (
        <>
            <div className="space-y-6 p-4 md:p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1
                            className="text-2xl font-extrabold md:text-3xl"
                            style={{ color: EKARI.text }}
                        >
                            Marketplace listings
                        </h1>

                        <p className="text-sm md:text-base" style={{ color: EKARI.dim }}>
                            All market listings across ekarihub. As admin, you can moderate
                            status or remove spammy items.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold" style={{ color: EKARI.dim }}>
                            Filter status:
                        </span>

                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as any)}
                            className="rounded-full border bg-white px-3 py-1.5 text-xs outline-none md:text-sm"
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        >
                            <option value="all">All</option>
                            <option value="active">Active</option>
                            <option value="sold">Sold</option>
                            <option value="reserved">Reserved</option>
                            <option value="hidden">Hidden</option>
                            <option value="draft">Draft</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                        <IoCubeOutline className="text-emerald-700" />

                        <span className="font-semibold" style={{ color: EKARI.text }}>
                            Showing {items.length} listing{items.length === 1 ? "" : "s"}
                        </span>

                        <span className="text-xs" style={{ color: EKARI.dim }}>
                            • Page {page}
                        </span>

                        {filterStatus !== "all" && (
                            <span className="text-xs" style={{ color: EKARI.dim }}>
                                • Filtered by {filterStatus}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            disabled={loading || page === 1}
                            onClick={() => loadListings(page - 1, pageCursors[page - 2] || null)}
                            className="rounded-full border px-4 py-1.5 text-xs font-bold disabled:opacity-40"
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        >
                            Previous
                        </button>

                        <button
                            disabled={loading || !hasMore}
                            onClick={() => loadListings(page + 1, pageCursors[page] || null)}
                            className="rounded-full px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                            style={{ backgroundColor: EKARI.forest }}
                        >
                            {loading ? "Loading…" : "Next"}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-40 animate-pulse rounded-2xl bg-gray-100"
                            />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-16 text-center text-sm text-gray-400">
                        No listings match this filter.
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {filtered.map((l) => {
                                const status: MarketStatus =
                                    (l.status as MarketStatus) ?? (l.sold ? "sold" : "active");

                                const statusLabel =
                                    STATUS_LABEL[status] ||
                                    status.replace(/^\w/, (c) => c.toUpperCase());

                                const statusColorClass = STATUS_COLOR[status] || "bg-gray-500";

                                const cover = l.imageUrl || l.imageUrls?.[0] || "";

                                const isBusy = busyId === l.id;

                                const sellerName =
                                    l.seller?.name ||
                                    l.seller?.handle ||
                                    l.ownerId?.slice(0, 8) ||
                                    l.sellerId?.slice(0, 8) ||
                                    "unknown";

                                const priceText =
                                    l.type === "lease" || l.type === "service"
                                        ? `${l.rate || "—"}${l.billingUnit ? ` / ${l.billingUnit}` : ""
                                        }`
                                        : formatKES(Number(l.price || 0));

                                return (
                                    <div
                                        key={l.id}
                                        className="flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
                                        style={{ borderColor: EKARI.hair }}
                                    >
                                        <div className="relative h-36 bg-gray-100">
                                            {cover ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={cover}
                                                    alt={l.name || "Listing"}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                                                    No image
                                                </div>
                                            )}

                                            <div
                                                className={`absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-extrabold text-white ${statusColorClass}`}
                                            >
                                                <IoCheckmarkDone size={12} />
                                                {statusLabel}
                                            </div>
                                        </div>

                                        <div className="flex flex-1 flex-col gap-2 p-3">
                                            <div className="line-clamp-2 text-[13px] font-extrabold text-gray-900">
                                                {l.name || "Untitled listing"}
                                            </div>

                                            <div className="flex flex-wrap gap-1 text-xs text-gray-500">
                                                <span>
                                                    Seller:{" "}
                                                    <span className="font-semibold">{sellerName}</span>
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

                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewListingId(l.id)}
                                                    className="inline-flex items-center gap-1 rounded-full border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50"
                                                >
                                                    Preview listing
                                                </button>

                                                {status !== "active" && (
                                                    <button
                                                        onClick={() => updateStatus(l, "active")}
                                                        disabled={isBusy}
                                                        className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-60"
                                                    >
                                                        <IoCheckmarkDone size={12} />
                                                        Activate
                                                    </button>
                                                )}

                                                {status !== "sold" && (
                                                    <button
                                                        onClick={() => updateStatus(l, "sold")}
                                                        disabled={isBusy}
                                                        className="inline-flex items-center gap-1 rounded-full bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-60"
                                                    >
                                                        <IoCashOutline size={12} />
                                                        Sold
                                                    </button>
                                                )}

                                                {status !== "reserved" && (
                                                    <button
                                                        onClick={() => updateStatus(l, "reserved")}
                                                        disabled={isBusy}
                                                        className="inline-flex items-center gap-1 rounded-full bg-yellow-500 px-2.5 py-1 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-60"
                                                    >
                                                        <IoTimeOutline size={12} />
                                                        Reserve
                                                    </button>
                                                )}

                                                {status !== "hidden" && (
                                                    <button
                                                        onClick={() => updateStatus(l, "hidden")}
                                                        disabled={isBusy}
                                                        className="inline-flex items-center gap-1 rounded-full bg-gray-600 px-2.5 py-1 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-60"
                                                    >
                                                        <IoEyeOffOutline size={12} />
                                                        Hide
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => deleteListing(l)}
                                                    disabled={isBusy}
                                                    className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-60"
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

                        <div className="flex items-center justify-center gap-3 pt-4">
                            <button
                                disabled={loading || page === 1}
                                onClick={() => loadListings(page - 1, pageCursors[page - 2] || null)}
                                className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-40"
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                            >
                                Previous
                            </button>

                            <span className="text-sm font-bold" style={{ color: EKARI.dim }}>
                                Page {page}
                            </span>

                            <button
                                disabled={loading || !hasMore}
                                onClick={() => loadListings(page + 1, pageCursors[page] || null)}
                                className="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                                style={{ backgroundColor: EKARI.forest }}
                            >
                                {loading ? "Loading…" : "Next"}
                            </button>
                        </div>
                    </>
                )}
            </div>

            {previewListingId && (
                <ProductPreviewModal listingId={previewListingId} onClose={closePreview} />
            )}
        </>
    );
}