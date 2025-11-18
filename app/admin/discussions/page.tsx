// app/admin/discussions/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    updateDoc,
    deleteDoc,
    doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    IoChatbubblesOutline,
    IoTimeOutline,
    IoChatbubbleEllipsesOutline,
    IoTrashOutline,
} from "react-icons/io5";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
};

type DiscussionDoc = {
    id: string;
    title?: string;
    authorId?: string;
    createdAt?: any;
    repliesCount?: number;
    published?: boolean;
};

function dateText(ts: any) {
    if (!ts) return "";
    if (typeof ts === "string") return ts;
    if (ts?.toDate) {
        const d = ts.toDate();
        return d.toLocaleString();
    }
    return "";
}

export default function AdminDiscussionsPage() {
    const [items, setItems] = useState<DiscussionDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [filter, setFilter] = useState<"all" | "published" | "unpublished">("all");

    useEffect(() => {
        const base = query(
            collection(db, "discussions"),
            orderBy("createdAt", "desc"),
            limit(80)
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
                        } as DiscussionDoc)
                    )
                );
                setLoading(false);
            },
            (err) => {
                console.error("AdminDiscussions listener error:", err);
                setLoading(false);
            }
        );

        return () => unsub();
    }, []);

    const filtered = items.filter((d) => {
        if (filter === "all") return true;
        const p = d.published ?? true;
        return filter === "published" ? p : !p;
    });

    async function togglePublish(row: DiscussionDoc) {
        try {
            setBusyId(row.id);
            await updateDoc(doc(db, "discussions", row.id), {
                published: !(row.published ?? true),
            });
        } catch (err: any) {
            alert(err?.message || "Failed to update discussion");
        } finally {
            setBusyId(null);
        }
    }

    async function removeDiscussion(row: DiscussionDoc) {
        const ok = window.confirm(
            "Delete this discussion? This will also orphan replies."
        );
        if (!ok) return;
        try {
            setBusyId(row.id);
            await deleteDoc(doc(db, "discussions", row.id));
        } catch (err: any) {
            alert(err?.message || "Failed to delete");
        } finally {
            setBusyId(null);
        }
    }

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div>
                    <h1
                        className="text-2xl md:text-3xl font-extrabold"
                        style={{ color: EKARI.text }}
                    >
                        Discussions
                    </h1>
                    <p className="text-sm md:text-base" style={{ color: EKARI.dim }}>
                        Moderate long-form agribusiness discussions. Publish/unpublish or
                        delete threads that violate policy.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: EKARI.dim }}>
                        Filter:
                    </span>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as any)}
                        className="text-xs md:text-sm rounded-full border px-3 py-1.5 outline-none bg-white"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                    >
                        <option value="all">All</option>
                        <option value="published">Published</option>
                        <option value="unpublished">Unpublished</option>
                    </select>
                </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
                <IoChatbubblesOutline className="text-emerald-700" />
                <span className="font-semibold" style={{ color: EKARI.text }}>
                    {items.length} discussion{items.length === 1 ? "" : "s"} loaded
                </span>
            </div>

            {loading ? (
                <div className="flex justify-center py-16 text-sm text-gray-400">
                    Loading…
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400">
                    No discussions match this filter.
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {filtered.map((item) => {
                        const isPublished = item.published ?? true;
                        const isBusy = busyId === item.id;

                        return (
                            <div
                                key={item.id}
                                className="rounded-2xl border bg-white shadow-sm hover:shadow-md transition p-4"
                                style={{ borderColor: EKARI.hair }}
                            >
                                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className="h-9 w-9 rounded-full bg-emerald-700 text-white grid place-items-center">
                                            <IoChatbubblesOutline size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <div
                                                className="text-sm md:text-base font-extrabold line-clamp-2"
                                                style={{ color: EKARI.text }}
                                            >
                                                {item.title || "Untitled discussion"}
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                                                {item.createdAt && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <IoTimeOutline size={13} />
                                                        {dateText(item.createdAt)}
                                                    </span>
                                                )}
                                                <span>•</span>
                                                <span>
                                                    Author:{" "}
                                                    <span className="font-mono">
                                                        {item.authorId?.slice(0, 8) || "unknown"}
                                                    </span>
                                                </span>
                                                <span>•</span>
                                                <span className="inline-flex items-center gap-1">
                                                    <IoChatbubbleEllipsesOutline size={13} />
                                                    {(item.repliesCount ?? 0).toString()} replies
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${isPublished
                                                ? "bg-emerald-50 text-emerald-700"
                                                : "bg-gray-100 text-gray-600"
                                                }`}
                                        >
                                            {isPublished ? "Published" : "Unpublished"}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                                    <button
                                        onClick={() => togglePublish(item)}
                                        disabled={isBusy}
                                        className={`px-2.5 py-1 rounded-full font-bold text-white hover:opacity-90 disabled:opacity-60 ${isPublished ? "bg-amber-600" : "bg-emerald-700"
                                            }`}
                                    >
                                        {isBusy
                                            ? "Working…"
                                            : isPublished
                                                ? "Unpublish"
                                                : "Publish"}
                                    </button>

                                    <button
                                        onClick={() => removeDiscussion(item)}
                                        disabled={isBusy}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 font-bold border border-rose-200 hover:bg-rose-100 disabled:opacity-60 ml-auto"
                                    >
                                        <IoTrashOutline size={14} />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
