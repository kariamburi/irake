"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    updateDoc,
    where,
    serverTimestamp,
    getDoc,
    QueryDocumentSnapshot,
    DocumentData,
    startAfter,
    getDocs,
    limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import Image from "next/image";

type ReportStatus = "open" | "in_review" | "resolved" | "dismissed";

type Report = {
    id: string;
    type?: string;
    deedId?: string;
    reportedUserId?: string;
    reportedBy?: string;
    reason?: string;
    status?: ReportStatus;
    source?: string;
    createdAt?: any;
    deedSnapshot?: {
        text?: string;
        authorUsername?: string | null;
        mediaType?: string | null;
    };
};

const TABS: { key: ReportStatus | "suspended"; label: string }[] = [
    { key: "open", label: "Open" },
    { key: "in_review", label: "In review" },
    { key: "resolved", label: "Resolved" },
    { key: "dismissed", label: "Dismissed" },
    { key: "suspended", label: "Suspended users" },
];

function dateText(ts: any) {
    try {
        const d = typeof ts?.toDate === "function" ? ts.toDate() : new Date(ts);
        return d.toLocaleString();
    } catch {
        return "";
    }
}
function safeHandleSlug(handle: string) {
    return handle.replace(/^@+/, "").trim();
}

function getInitialId(handle?: string | null, uid?: string | null) {
    const base = String(handle || uid || "U").replace(/^@+/, "").trim();
    return base.slice(0, 2).toUpperCase();
}
function ReportedDeedPreviewModal({
    deedId,
    onClose,
}: {
    deedId: string;
    onClose: () => void;
}) {
    const [deed, setDeed] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, "deeds", deedId), (snap) => {
            setDeed(snap.exists() ? snap.data() : null);
            setLoading(false);
        });

        return () => unsub();
    }, [deedId]);

    const handleRaw = deed?.authorUsername || "";
    const handleSlug = handleRaw ? safeHandleSlug(handleRaw) : "";
    const publicUrl = handleSlug ? `/${handleSlug}/deed/${deedId}` : null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-3"
            onClick={onClose}
        >
            <div
                className="h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b px-5 py-3">
                    <div>
                        <div className="text-xs font-bold uppercase text-slate-500">
                            Reported deed preview
                        </div>
                        <div className="font-black text-slate-900">
                            {deed?.caption || deed?.text || "Untitled deed"}
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="rounded-full border px-3 py-1 font-bold"
                    >
                        ✕
                    </button>
                </div>

                {loading ? (
                    <div className="grid h-full place-items-center text-sm text-slate-500">
                        Loading deed…
                    </div>
                ) : publicUrl ? (
                    <iframe src={publicUrl} className="h-full w-full" />
                ) : (
                    <div className="p-6 text-sm text-slate-500">
                        Could not build public preview URL.
                    </div>
                )}
            </div>
        </div>
    );
}
export default function ReportedCasesPage() {
    const [activeTab, setActiveTab] = useState<ReportStatus | "suspended">("open");
    const [reports, setReports] = useState<Report[]>([]);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [previewDeedId, setPreviewDeedId] = useState<string | null>(null);
    const [userCache, setUserCache] = useState<Record<string, any>>({});
    const PAGE_SIZE = 20;

    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [loadingReports, setLoadingReports] = useState(false);
    const [hasMoreReports, setHasMoreReports] = useState(true);
    useEffect(() => {
        const ids = Array.from(
            new Set(reports.map((r) => r.reportedUserId).filter(Boolean))
        ) as string[];

        ids.forEach(async (uid) => {
            if (userCache[uid]) return;

            const snap = await getDoc(doc(db, "users", uid));
            if (snap.exists()) {
                setUserCache((prev) => ({
                    ...prev,
                    [uid]: snap.data(),
                }));
            }
        });
    }, [reports, userCache]);
    useEffect(() => {
        if (activeTab === "suspended") return;

        setReports([]);
        setLastDoc(null);
        setHasMoreReports(true);

        loadReports(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    const title = useMemo(() => {
        return TABS.find((t) => t.key === activeTab)?.label || "Reported cases";
    }, [activeTab]);
    const loadReports = async (reset = false) => {
        if (activeTab === "suspended") return;
        if (loadingReports) return;
        if (!reset && !hasMoreReports) return;

        setLoadingReports(true);

        try {
            const constraints: any[] = [
                where("status", "==", activeTab),
                orderBy("createdAt", "desc"),
                limit(PAGE_SIZE),
            ];

            if (!reset && lastDoc) {
                constraints.splice(2, 0, startAfter(lastDoc));
            }

            const snap = await getDocs(query(collection(db, "reports"), ...constraints));

            const nextItems = snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as any),
            }));

            setReports((prev) => (reset ? nextItems : [...prev, ...nextItems]));
            setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
            setHasMoreReports(snap.docs.length === PAGE_SIZE);
        } finally {
            setLoadingReports(false);
        }
    };
    const updateReportStatus = async (report: Report, status: ReportStatus) => {
        setBusyId(report.id);

        try {
            await updateDoc(doc(db, "reports", report.id), {
                status,
                updatedAt: serverTimestamp(),
            });
        } finally {
            setBusyId(null);
        }
    };

    const removeDeed = async (report: Report) => {
        if (!report.deedId) return;

        const ok = confirm("Remove this deed from public feed?");
        if (!ok) return;

        setBusyId(report.id);

        try {
            await updateDoc(doc(db, "deeds", report.deedId), {
                status: "deleted",
                visibility: "private",
                removedByAdmin: true,
                removedAt: serverTimestamp(),
                removedReason: report.reason || "Reported content violation",
                updatedAt: serverTimestamp(),
            });

            await updateDoc(doc(db, "reports", report.id), {
                status: "resolved",
                actionTaken: "deed_removed",
                updatedAt: serverTimestamp(),
            });
        } finally {
            setBusyId(null);
        }
    };

    const suspendUser = async (report: Report) => {
        if (!report.reportedUserId) return;

        const ok = confirm("Suspend this user account?");
        if (!ok) return;

        setBusyId(report.id);

        try {
            await updateDoc(doc(db, "users", report.reportedUserId), {
                isSuspended: true,
                suspendedAt: serverTimestamp(),
                suspendedReason: report.reason || "Community guideline violation",
                updatedAt: serverTimestamp(),
            });

            await updateDoc(doc(db, "reports", report.id), {
                status: "resolved",
                actionTaken: "user_suspended",
                updatedAt: serverTimestamp(),
            });
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-black text-slate-900">Reported cases</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Review objectionable content reports, remove violating posts, and suspend abusive users.
                </p>
            </div>

            <div className="flex flex-wrap gap-2">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={[
                            "rounded-full border px-4 py-2 text-sm font-bold",
                            activeTab === tab.key
                                ? "bg-[#233F39] text-white border-[#233F39]"
                                : "bg-white text-slate-700 border-slate-200",
                        ].join(" ")}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === "suspended" ? (
                <SuspendedUsers />
            ) : (
                <div className="rounded-2xl border bg-white">
                    <div className="border-b px-5 py-4">
                        <h2 className="font-black text-slate-900">{title}</h2>
                    </div>

                    {reports.length === 0 ? (
                        <div className="p-6 text-sm text-slate-500">No reports found.</div>
                    ) : (
                        <div className="divide-y">

                            {reports.map((r) => (
                                <div key={r.id} className="p-5">
                                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-red-700">
                                                    {r.reason || "Reported"}
                                                </span>

                                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                                                    {r.type || "deed"}
                                                </span>

                                                <span className="text-xs text-slate-400">
                                                    {dateText(r.createdAt)}
                                                </span>
                                            </div>

                                            <div className="mt-3 text-sm text-slate-700">
                                                <div>
                                                    <b>Deed:</b>{" "}
                                                    {r.deedId ? (
                                                        <button
                                                            onClick={() => setPreviewDeedId(r.deedId!)}
                                                            className="font-mono text-emerald-700 hover:underline"
                                                        >
                                                            {r.deedId}
                                                        </button>
                                                    ) : (
                                                        "-"
                                                    )}
                                                </div>
                                                <div>
                                                    <ReportedUserCell uid={r.reportedUserId} user={r.reportedUserId ? userCache[r.reportedUserId] : null} />
                                                </div>
                                                <div>
                                                    <b>Reported by:</b> {r.reportedBy || "-"}
                                                </div>
                                            </div>

                                            {r.deedSnapshot?.text ? (
                                                <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                                                    {r.deedSnapshot.text}
                                                </div>
                                            ) : null}
                                        </div>

                                        <div className="flex flex-wrap gap-2 md:justify-end">
                                            {r.status === "open" && (
                                                <button
                                                    disabled={busyId === r.id}
                                                    onClick={() => updateReportStatus(r, "in_review")}
                                                    className="rounded-xl border px-3 py-2 text-sm font-bold"
                                                >
                                                    Review
                                                </button>
                                            )}

                                            <button
                                                disabled={busyId === r.id}
                                                onClick={() => removeDeed(r)}
                                                className="rounded-xl bg-orange-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                                            >
                                                Remove deed
                                            </button>

                                            <button
                                                disabled={busyId === r.id}
                                                onClick={() => suspendUser(r)}
                                                className="rounded-xl bg-red-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                                            >
                                                Suspend user
                                            </button>

                                            <button
                                                disabled={busyId === r.id}
                                                onClick={() => updateReportStatus(r, "dismissed")}
                                                className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-60"
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div className="p-5 flex justify-center">
                                {hasMoreReports ? (
                                    <button
                                        disabled={loadingReports}
                                        onClick={() => loadReports(false)}
                                        className="rounded-xl bg-[#233F39] px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
                                    >
                                        {loadingReports ? "Loading…" : "Load more"}
                                    </button>
                                ) : (
                                    <span className="text-sm text-slate-400">No more reports</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
            {previewDeedId && (
                <ReportedDeedPreviewModal
                    deedId={previewDeedId}
                    onClose={() => setPreviewDeedId(null)}
                />
            )}
        </div>
    );
}
function ReportedUserCell({ uid, user }: { uid?: string; user?: any }) {
    if (!uid) return <div><b>Reported user:</b> -</div>;

    const handle = user?.handle || user?.username || "";
    const photoURL = user?.photoURL || user?.providerPhotoURL || "";
    const name =
        `${user?.firstName || ""} ${user?.surname || ""}`.trim() ||
        handle ||
        uid;

    const slug = handle ? safeHandleSlug(handle) : "";
    const href = slug ? `/${slug}` : null;
    const initials = getInitialId(handle || name, uid);

    return (
        <div className="mt-2 flex items-center gap-2">
            {href ? (
                <Link href={href} className="shrink-0">
                    <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-slate-200 text-xs font-black text-slate-600">
                        {photoURL ? (<>


                            <Image src={photoURL || "/avatar-placeholder.png"} alt={name} width={32} height={32} className="h-full w-full object-cover" />
                        </>) : (
                            initials
                        )}
                    </div>
                </Link>
            ) : (
                <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-xs font-black text-slate-600">
                    {initials}
                </div>
            )}

            <div className="min-w-0">
                <div className="text-sm font-black text-slate-900 truncate">{name}</div>
                <div className="text-xs text-slate-500 font-mono truncate">{uid.slice(0, 12)}…</div>
            </div>
        </div>
    );
}
function SuspendedUsers() {
    const [users, setUsers] = useState<any[]>([]);
    const [busyId, setBusyId] = useState<string | null>(null);

    useEffect(() => {
        const qy = query(
            collection(db, "users"),
            where("isSuspended", "==", true),
            orderBy("updatedAt", "desc")
        );

        const unsub = onSnapshot(qy, (snap) => {
            setUsers(
                snap.docs.map((d) => ({
                    id: d.id,
                    ...(d.data() as any),
                }))
            );
        });

        return () => unsub();
    }, []);

    const unsuspendUser = async (uid: string) => {
        const ok = confirm("Unsuspend this user?");
        if (!ok) return;

        setBusyId(uid);

        try {
            await updateDoc(doc(db, "users", uid), {
                isSuspended: false,
                unsuspendedAt: serverTimestamp(),
                suspendedReason: null,
                updatedAt: serverTimestamp(),
            });
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="rounded-2xl border bg-white">
            <div className="border-b px-5 py-4">
                <h2 className="font-black text-slate-900">Suspended users</h2>
            </div>

            {users.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">No suspended users.</div>
            ) : (
                <div className="divide-y">
                    {users.map((u) => (
                        <div key={u.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="font-black text-slate-900">
                                    {u.handle || `${u.firstName || ""} ${u.surname || ""}`.trim() || u.id}
                                </div>
                                <div className="text-sm text-slate-500">
                                    {u.email || "No email"} · {u.suspendedReason || "Suspended"}
                                </div>
                            </div>

                            <button
                                disabled={busyId === u.id}
                                onClick={() => unsuspendUser(u.id)}
                                className="rounded-xl bg-[#233F39] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                            >
                                Unsuspend
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}