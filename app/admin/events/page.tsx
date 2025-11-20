// app/admin/events/page.tsx
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
    IoCalendarOutline,
    IoTimeOutline,
    IoLocationOutline,
    IoHeartOutline,
    IoPeopleOutline,
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

type EventStatus = "active" | "draft" | "cancelled" | "hidden" | string;

type EventDoc = {
    id: string;
    title?: string;
    dateISO?: string;
    organizerId?: string;
    location?: string;
    status?: EventStatus;
    stats?: {
        likes?: number;
        rsvps?: number;
    };
    createdAt?: any;
};

function fmtDate(iso?: string) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString();
}

const STATUS_LABEL: Record<EventStatus, string> = {
    active: "Active",
    draft: "Draft",
    cancelled: "Cancelled",
    hidden: "Hidden",
};

const STATUS_BADGE_COLORS: Record<EventStatus, { bg: string; text: string }> = {
    active: { bg: "#DCFCE7", text: "#15803D" },
    draft: { bg: "#E5E7EB", text: "#374151" },
    cancelled: { bg: "#FEE2E2", text: "#B91C1C" },
    hidden: { bg: "#E5E7EB", text: "#4B5563" },
};

/* ------------------------- Event preview modal ------------------------- */

type EventPreviewDoc = {
    title?: string;
};

function EventPreviewModal({
    eventId,
    onClose,
}: {
    eventId: string;
    onClose: () => void;
}) {
    const [eventDoc, setEventDoc] = useState<EventPreviewDoc | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const ref = doc(db, "events", eventId);
        const unsub = onSnapshot(
            ref,
            (snap) => {
                setEventDoc(snap.exists() ? (snap.data() as any) : null);
                setLoading(false);
            },
            () => setLoading(false)
        );
        return () => unsub();
    }, [eventId]);

    // Close on Esc
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    const stop = (e: React.MouseEvent) => e.stopPropagation();

    // 👉 correct public event route
    const publicUrl = `/nexus/event/${eventId}`;

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
                            Event preview
                        </div>
                        <div
                            className="mt-0.5 text-sm md:text-base font-bold truncate"
                            style={{ color: EKARI.text }}
                        >
                            {eventDoc?.title || "Untitled event"}
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
                            Loading event…
                        </div>
                    ) : !eventDoc ? (
                        <div
                            className="flex-1 grid place-items-center text-sm text-center px-4"
                            style={{ color: EKARI.dim }}
                        >
                            Could not load this event. It may have been removed.
                        </div>
                    ) : (
                        <div className="flex-1">
                            <iframe
                                src={publicUrl}
                                title="Event preview"
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

export default function AdminEventsPage() {
    const [events, setEvents] = useState<EventDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<EventStatus | "all">("all");
    const [previewEventId, setPreviewEventId] = useState<string | null>(null);

    useEffect(() => {
        const base = query(
            collection(db, "events"),
            orderBy("dateISO", "desc"),
            limit(80)
        );

        const unsub = onSnapshot(
            base,
            (snap) => {
                setEvents(
                    snap.docs.map(
                        (d) =>
                        ({
                            id: d.id,
                            ...(d.data() as any),
                        } as EventDoc)
                    )
                );
                setLoading(false);
            },
            (err) => {
                console.error("AdminEvents listener error:", err);
                setLoading(false);
            }
        );

        return () => unsub();
    }, []);

    const filtered = useMemo(() => {
        if (filterStatus === "all") return events;
        return events.filter((e) => (e.status ?? "active") === filterStatus);
    }, [events, filterStatus]);

    async function setStatus(e: EventDoc, status: EventStatus) {
        try {
            setBusyId(e.id);
            await updateDoc(doc(db, "events", e.id), { status });
        } catch (err: any) {
            alert(err?.message || "Failed to update event");
        } finally {
            setBusyId(null);
        }
    }

    async function removeEvent(e: EventDoc) {
        const ok = window.confirm(
            "Delete this event? This will also orphan any RSVPs in the UI."
        );
        if (!ok) return;
        try {
            setBusyId(e.id);
            await deleteDoc(doc(db, "events", e.id));
        } catch (err: any) {
            alert(err?.message || "Failed to delete event");
        } finally {
            setBusyId(null);
        }
    }

    const closePreview = () => setPreviewEventId(null);

    return (
        <>
            <div className="p-4 md:p-6 space-y-6">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                    <div>
                        <h1
                            className="text-2xl md:text-3xl font-extrabold"
                            style={{ color: EKARI.text }}
                        >
                            Events
                        </h1>
                        <p className="text-sm md:text-base" style={{ color: EKARI.dim }}>
                            Admin view of all events created across ekarihub. Moderate status or
                            clean up spammy / outdated events.
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
                            <option value="draft">Draft</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="hidden">Hidden</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                    <IoCalendarOutline className="text-emerald-700" />
                    <span className="font-semibold" style={{ color: EKARI.text }}>
                        {events.length} event{events.length === 1 ? "" : "s"} loaded
                    </span>
                    {filterStatus !== "all" && (
                        <span className="text-xs" style={{ color: EKARI.dim }}>
                            • Showing {filtered.length} {filterStatus} event
                            {filtered.length === 1 ? "" : "s"}
                        </span>
                    )}
                </div>

                {loading ? (
                    <div className="flex justify-center py-16 text-sm text-gray-400">
                        Loading…
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-16 text-center text-sm text-gray-400">
                        No events match this filter.
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {filtered.map((e) => {
                            const status: EventStatus = (e.status ?? "active") as EventStatus;
                            const label =
                                STATUS_LABEL[status] ||
                                status.replace(/^\w/, (c) => c.toUpperCase());
                            const badge =
                                STATUS_BADGE_COLORS[status] || STATUS_BADGE_COLORS["draft"];
                            const likes = e?.stats?.likes ?? 0;
                            const rsvps = e?.stats?.rsvps ?? 0;
                            const isBusy = busyId === e.id;

                            return (
                                <div
                                    key={e.id}
                                    className="rounded-2xl border bg-white shadow-sm hover:shadow-md transition p-4 flex flex-col gap-2"
                                    style={{ borderColor: EKARI.hair }}
                                >
                                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                        <div className="flex items-start gap-3">
                                            <div className="h-9 w-9 rounded-full bg-emerald-700 text-white grid place-items-center">
                                                <IoCalendarOutline size={16} />
                                            </div>
                                            <div className="min-w-0">
                                                <div
                                                    className="text-sm md:text-base font-extrabold truncate"
                                                    style={{ color: EKARI.text }}
                                                >
                                                    {e.title || "Untitled event"}
                                                </div>
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                                                    {e.dateISO && (
                                                        <span className="inline-flex items-center gap-1">
                                                            <IoTimeOutline size={13} />
                                                            {fmtDate(e.dateISO)}
                                                        </span>
                                                    )}
                                                    {e.location && (
                                                        <span className="inline-flex items-center gap-1">
                                                            <IoLocationOutline size={13} />
                                                            {e.location}
                                                        </span>
                                                    )}
                                                    <span>•</span>
                                                    <span>
                                                        Organizer:{" "}
                                                        <span className="font-mono">
                                                            {e.organizerId?.slice(0, 8) || "unknown"}
                                                        </span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span
                                                className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold"
                                                style={{
                                                    backgroundColor: badge.bg,
                                                    color: badge.text,
                                                }}
                                            >
                                                {label}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 text-[11px] mt-1">
                                        <div className="inline-flex items-center gap-1 border rounded-full px-2.5 py-1 text-xs font-bold text-gray-700 border-gray-200">
                                            <IoHeartOutline className="text-emerald-700" size={14} />
                                            {likes} likes
                                        </div>
                                        <div className="inline-flex items-center gap-1 border rounded-full px-2.5 py-1 text-xs font-bold text-gray-700 border-gray-200">
                                            <IoPeopleOutline className="text-emerald-700" size={14} />
                                            {rsvps} RSVPs
                                        </div>
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] items-center">
                                        {/* Preview event in modal */}
                                        <button
                                            type="button"
                                            onClick={() => setPreviewEventId(e.id)}
                                            className="px-2.5 py-1 rounded-full border text-emerald-700 font-bold hover:bg-emerald-50 border-emerald-200"
                                        >
                                            Preview event
                                        </button>

                                        {status !== "active" && (
                                            <button
                                                onClick={() => setStatus(e, "active")}
                                                disabled={isBusy}
                                                className="px-2.5 py-1 rounded-full bg-emerald-600 text-white font-bold hover:opacity-90 disabled:opacity-60"
                                            >
                                                Mark active
                                            </button>
                                        )}
                                        {status !== "draft" && (
                                            <button
                                                onClick={() => setStatus(e, "draft")}
                                                disabled={isBusy}
                                                className="px-2.5 py-1 rounded-full bg-gray-200 text-gray-800 font-bold hover:bg-gray-300 disabled:opacity-60"
                                            >
                                                Draft
                                            </button>
                                        )}
                                        {status !== "cancelled" && (
                                            <button
                                                onClick={() => setStatus(e, "cancelled")}
                                                disabled={isBusy}
                                                className="px-2.5 py-1 rounded-full bg-rose-600 text-white font-bold hover:opacity-90 disabled:opacity-60"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                        {status !== "hidden" && (
                                            <button
                                                onClick={() => setStatus(e, "hidden")}
                                                disabled={isBusy}
                                                className="px-2.5 py-1 rounded-full bg-gray-700 text-white font-bold hover:opacity-90 disabled:opacity-60"
                                            >
                                                Hide
                                            </button>
                                        )}
                                        <button
                                            onClick={() => removeEvent(e)}
                                            disabled={isBusy}
                                            className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 font-bold border border-rose-200 hover:bg-rose-100 disabled:opacity-60"
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

            {previewEventId && (
                <EventPreviewModal eventId={previewEventId} onClose={closePreview} />
            )}
        </>
    );
}
