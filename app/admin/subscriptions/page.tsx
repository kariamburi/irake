"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    where,
    documentId,
    Timestamp,
    limit,
} from "firebase/firestore";
import { onAuthStateChanged, getAuth } from "firebase/auth";
import { db, app } from "@/lib/firebase"; // adjust if your exports differ
import { EKARI } from "@/app/constants/constants";

type BillingCycle = "monthly" | "yearly";
type SubStatus = "active" | "trialing" | "expired" | "canceled";

type SellerSubscription = {
    packageId: string;
    billingCycle: BillingCycle;
    status: SubStatus;
    currentPeriodEnd?: any;
    createdAt?: any;
    updatedAt?: any;
};

type UserDoc = {
    firstName?: string;
    lastName?: string; // sometimes you use surname in users collection
    surname?: string;
    username?: string;
    handle?: string; // "@skya"
    email?: string;

    // your real users collection uses photoURL
    photoURL?: string;

    // legacy possibilities
    photo?: string;
    imageUrl?: string;

    isAdmin?: boolean;
    isDeactivated?: boolean;
    isSuspended?: boolean;
};

type PackageDoc = {
    name?: string;
    priceMonthlyUsd?: number;
    priceYearlyUsd?: number;
    status?: "active" | "disabled";
};

type Row = {
    uid: string;
    status: SubStatus;
    billingCycle: BillingCycle;
    packageId: string;
    packageName: string;

    userName: string;
    handle: string; // "@skya" or fallback
    email: string;

    photoURL?: string | null;
    isDeactivated?: boolean;
    isSuspended?: boolean;

    currentPeriodEnd?: Date | null;

    // optional: we’ll show button only if we detect checkouts
    hasPayments?: boolean;
};

type SortKey = "status" | "plan" | "periodEnd";
type SortDir = "asc" | "desc";

function chunk<T>(arr: T[], size: number) {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function toDate(v: any): Date | null {
    if (!v) return null;
    if (v instanceof Timestamp) return v.toDate();
    if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
    if (typeof v === "number") return new Date(v);
    if (typeof v === "string") {
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
}

function fmtDate(d: Date | null | undefined) {
    if (!d) return "—";
    return d.toLocaleString();
}

function safeLower(s: string) {
    return (s || "").toLowerCase().trim();
}

function statusRank(s: SubStatus) {
    if (s === "active") return 1;
    if (s === "trialing") return 2;
    if (s === "expired") return 3;
    return 4; // canceled
}

function handleSlug(handle?: string) {
    if (!handle) return "";
    return String(handle).replace(/^@+/, "").trim();
}

function initialsFrom(handle?: string, uid?: string) {
    const base = handleSlug(handle) || (uid ? uid.slice(0, 2) : "U");
    return base.slice(0, 2).toUpperCase();
}

export default function AdminSubscriptionsPage() {
    const [authUid, setAuthUid] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [checkingAdmin, setCheckingAdmin] = useState(true);

    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);

    // UI state
    const [qText, setQText] = useState("");
    const [statusFilter, setStatusFilter] = useState<SubStatus | "all">("all");
    const [billingFilter, setBillingFilter] = useState<BillingCycle | "all">("all");

    const [sortKey, setSortKey] = useState<SortKey>("periodEnd");
    const [sortDir, setSortDir] = useState<SortDir>("desc");

    // ---- auth + admin check
    useEffect(() => {
        const unsub = onAuthStateChanged(getAuth(app), async (u) => {
            setCheckingAdmin(true);
            if (!u) {
                setAuthUid(null);
                setIsAdmin(false);
                setCheckingAdmin(false);
                return;
            }
            setAuthUid(u.uid);

            try {
                const snap = await getDoc(doc(db, "users", u.uid));
                const data = (snap.data() as UserDoc) || {};
                setIsAdmin(!!data.isAdmin);
            } catch {
                setIsAdmin(false);
            } finally {
                setCheckingAdmin(false);
            }
        });

        return () => unsub();
    }, []);

    // ---- load subscriptions + join users + packages
    useEffect(() => {
        if (checkingAdmin) return;
        if (!authUid || !isAdmin) {
            setRows([]);
            setLoading(false);
            return;
        }

        let cancelled = false;

        (async () => {
            setLoading(true);
            try {
                // A) load subs
                const subQ = query(collection(db, "sellerSubscriptions"), orderBy("status", "asc"));
                const subSnap = await getDocs(subQ);

                const subs: { uid: string; sub: SellerSubscription }[] = subSnap.docs.map((d) => ({
                    uid: d.id,
                    sub: d.data() as SellerSubscription,
                }));

                const uids = subs.map((x) => x.uid);
                const pkgIds = Array.from(new Set(subs.map((x) => x.sub.packageId).filter(Boolean)));

                // B) users (batches of 10)
                const userMap = new Map<string, UserDoc>();
                for (const group of chunk(uids, 10)) {
                    const uq = query(collection(db, "users"), where(documentId(), "in", group));
                    const us = await getDocs(uq);
                    us.forEach((d) => userMap.set(d.id, (d.data() as UserDoc) || {}));
                }

                // C) packages (batches of 10)
                const pkgMap = new Map<string, PackageDoc>();
                for (const group of chunk(pkgIds, 10)) {
                    const pq = query(collection(db, "packages"), where(documentId(), "in", group));
                    const ps = await getDocs(pq);
                    ps.forEach((d) => pkgMap.set(d.id, (d.data() as PackageDoc) || {}));
                }

                // D) OPTIONAL: detect if user has any checkout docs (for showing button)
                const hasPaymentsMap = new Map<string, boolean>();
                for (const uid of uids) {
                    try {
                        const q1 = query(
                            collection(db, "packageCheckouts"),
                            where("uid", "==", uid),
                            orderBy("createdAt", "desc"),
                            limit(1)
                        );
                        const snap = await getDocs(q1);
                        hasPaymentsMap.set(uid, !snap.empty);
                    } catch {
                        hasPaymentsMap.set(uid, false);
                    }
                }

                const built: Row[] = subs.map(({ uid, sub }) => {
                    const u = userMap.get(uid) || {};
                    const p = pkgMap.get(sub.packageId) || {};

                    const first = u.firstName || "";
                    const last = u.lastName || u.surname || "";
                    const name = (first + " " + last).trim() || "—";

                    const handle = u.handle || u.username || "—";
                    const email = u.email || "—";

                    const photoURL = u.photoURL || u.imageUrl || u.photo || null;

                    return {
                        uid,
                        status: (sub.status || "expired") as SubStatus,
                        billingCycle: (sub.billingCycle || "monthly") as BillingCycle,
                        packageId: sub.packageId,
                        packageName: String(p.name || sub.packageId || "—"),
                        userName: name,
                        handle: String(handle),
                        email: String(email),
                        photoURL,
                        isDeactivated: !!u.isDeactivated,
                        isSuspended: !!u.isSuspended,
                        currentPeriodEnd: toDate(sub.currentPeriodEnd),
                        hasPayments: hasPaymentsMap.get(uid) || false,
                    };
                });

                if (!cancelled) setRows(built);
            } catch (e) {
                console.error("Admin subscriptions load error:", e);
                if (!cancelled) setRows([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [authUid, isAdmin, checkingAdmin]);

    const filtered = useMemo(() => {
        const q = safeLower(qText);
        return rows.filter((r) => {
            if (statusFilter !== "all" && r.status !== statusFilter) return false;
            if (billingFilter !== "all" && r.billingCycle !== billingFilter) return false;

            if (!q) return true;
            const hay = safeLower(
                `${r.uid} ${r.userName} ${r.handle} ${r.email} ${r.packageName} ${r.status} ${r.billingCycle}`
            );
            return hay.includes(q);
        });
    }, [rows, qText, statusFilter, billingFilter]);

    const sorted = useMemo(() => {
        const dir = sortDir === "asc" ? 1 : -1;

        const copy = [...filtered];
        copy.sort((a, b) => {
            if (sortKey === "status") return (statusRank(a.status) - statusRank(b.status)) * dir;
            if (sortKey === "plan") return a.packageName.localeCompare(b.packageName) * dir;

            const ad = a.currentPeriodEnd?.getTime() ?? 0;
            const bd = b.currentPeriodEnd?.getTime() ?? 0;
            return (ad - bd) * dir;
        });
        return copy;
    }, [filtered, sortKey, sortDir]);

    if (checkingAdmin) return <div style={{ padding: 24 }}>Checking access…</div>;
    if (!authUid) return <div style={{ padding: 24 }}>Please sign in to view this page.</div>;
    if (!isAdmin) return <div style={{ padding: 24 }}>You don’t have permission to view subscriptions.</div>;

    return (
        <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Subscriptions</h1>
                    <p style={{ marginTop: 6, color: "#6B7280" }}>View seller plan status across all users.</p>
                </div>

                <div style={{ color: "#6B7280", fontWeight: 700 }}>
                    {loading ? "Loading…" : `${sorted.length} shown / ${rows.length} total`}
                </div>
            </div>

            {/* Controls */}
            <div
                style={{
                    marginTop: 14,
                    display: "grid",
                    gridTemplateColumns: "1fr 160px 160px 170px 140px",
                    gap: 10,
                    alignItems: "center",
                }}
            >
                <input
                    value={qText}
                    onChange={(e) => setQText(e.target.value)}
                    placeholder="Search uid, name, handle, email, plan…"
                    style={{
                        border: "1px solid #E5E7EB",
                        borderRadius: 12,
                        padding: "10px 12px",
                        outline: "none",
                    }}
                />

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: "10px 12px" }}
                >
                    <option value="all">All statuses</option>
                    <option value="active">active</option>
                    <option value="trialing">trialing</option>
                    <option value="expired">expired</option>
                    <option value="canceled">canceled</option>
                </select>

                <select
                    value={billingFilter}
                    onChange={(e) => setBillingFilter(e.target.value as any)}
                    style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: "10px 12px" }}
                >
                    <option value="all">All billing</option>
                    <option value="monthly">monthly</option>
                    <option value="yearly">yearly</option>
                </select>

                <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: "10px 12px" }}
                >
                    <option value="periodEnd">Sort: Period end</option>
                    <option value="status">Sort: Status</option>
                    <option value="plan">Sort: Plan</option>
                </select>

                <select
                    value={sortDir}
                    onChange={(e) => setSortDir(e.target.value as any)}
                    style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: "10px 12px" }}
                >
                    <option value="desc">Desc</option>
                    <option value="asc">Asc</option>
                </select>
            </div>

            {/* Table */}
            <div
                className="overflow-y-auto"
                style={{ marginTop: 14, border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}
            >
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "300px 170px 120px 110px 210px 1fr 220px",
                        background: "#F9FAFB",
                        padding: "10px 12px",
                        fontWeight: 800,
                        color: "#374151",
                        fontSize: 12,
                    }}
                >
                    <div>User</div>
                    <div>Plan</div>
                    <div>Status</div>
                    <div>Billing</div>
                    <div>Period end</div>
                    <div>UID</div>
                    <div style={{ textAlign: "right" }}>Actions</div>
                </div>

                {loading ? (
                    <div style={{ padding: 14 }}>Loading subscriptions…</div>
                ) : sorted.length === 0 ? (
                    <div style={{ padding: 14 }}>No results.</div>
                ) : (
                    sorted.map((r) => {
                        const slug = handleSlug(r.handle);
                        const publicHref = slug ? `/${slug}` : null;
                        const initials = initialsFrom(r.handle, r.uid);

                        return (
                            <div
                                key={r.uid}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "300px 170px 120px 110px 210px 1fr 220px",
                                    padding: "12px",
                                    borderTop: "1px solid #E5E7EB",
                                    alignItems: "center",
                                    fontSize: 13,
                                }}
                            >
                                {/* ✅ Avatar + handle link */}
                                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                    {publicHref ? (
                                        <Link href={publicHref} style={{ textDecoration: "none" }} title={r.handle}>
                                            <div
                                                style={{
                                                    height: 34,
                                                    width: 34,
                                                    borderRadius: 999,
                                                    overflow: "hidden",
                                                    background: "#E2E8F0",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    fontWeight: 900,
                                                    fontSize: 12,
                                                    color: "#475569",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {r.photoURL ? (
                                                    <Image
                                                        src={r.photoURL}
                                                        alt={r.handle || r.uid}
                                                        width={34}
                                                        height={34}
                                                        style={{ height: "100%", width: "100%", objectFit: "cover" }}
                                                    />
                                                ) : (
                                                    <span>{initials}</span>
                                                )}
                                            </div>
                                        </Link>
                                    ) : (
                                        <div
                                            style={{
                                                height: 34,
                                                width: 34,
                                                borderRadius: 999,
                                                overflow: "hidden",
                                                background: "#E2E8F0",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontWeight: 900,
                                                fontSize: 12,
                                                color: "#475569",
                                                flexShrink: 0,
                                            }}
                                        >
                                            <span>{initials}</span>
                                        </div>
                                    )}

                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 900, display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {r.userName}
                                            </span>

                                            {publicHref && r.handle !== "—" ? (
                                                <Link
                                                    href={publicHref}
                                                    style={{
                                                        fontSize: 12,
                                                        fontWeight: 800,
                                                        color: EKARI.forest,
                                                        textDecoration: "none",
                                                    }}
                                                >
                                                    {r.handle}
                                                </Link>
                                            ) : (
                                                <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 800 }}>{r.handle}</span>
                                            )}

                                            {(r.isSuspended || r.isDeactivated) && (
                                                <span
                                                    style={{
                                                        display: "inline-block",
                                                        padding: "2px 8px",
                                                        borderRadius: 999,
                                                        background: "#FEF2F2",
                                                        border: "1px solid #FECACA",
                                                        color: "#991B1B",
                                                        fontSize: 10,
                                                        fontWeight: 900,
                                                    }}
                                                >
                                                    {r.isSuspended ? "Suspended" : "Deactivated"}
                                                </span>
                                            )}
                                        </div>

                                        <div style={{ color: "#6B7280", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {r.email}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ fontWeight: 800 }}>{r.packageName}</div>

                                <div>
                                    <span
                                        style={{
                                            display: "inline-block",
                                            padding: "4px 10px",
                                            borderRadius: 999,
                                            fontWeight: 800,
                                            fontSize: 12,
                                            background:
                                                r.status === "active"
                                                    ? "#ECFDF5"
                                                    : r.status === "trialing"
                                                        ? "#EFF6FF"
                                                        : r.status === "canceled"
                                                            ? "#FEF2F2"
                                                            : "#F3F4F6",
                                            color:
                                                r.status === "active"
                                                    ? "#065F46"
                                                    : r.status === "trialing"
                                                        ? "#1D4ED8"
                                                        : r.status === "canceled"
                                                            ? "#991B1B"
                                                            : "#374151",
                                        }}
                                    >
                                        {r.status}
                                    </span>
                                </div>

                                <div style={{ fontWeight: 700 }}>{r.billingCycle}</div>
                                <div style={{ color: "#374151" }}>{fmtDate(r.currentPeriodEnd)}</div>

                                <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, color: "#6B7280" }}>
                                    {r.uid}
                                </div>

                                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                    {/* Open user (admin) */}
                                    <Link
                                        href={`/admin/users/${r.uid}`}
                                        style={{
                                            border: "1px solid #E5E7EB",
                                            borderRadius: 999,
                                            padding: "7px 10px",
                                            fontWeight: 800,
                                            fontSize: 12,
                                            textDecoration: "none",
                                            color: "#111827",
                                            background: "#fff",
                                        }}
                                    >
                                        Open user
                                    </Link>

                                    {/* Payments history */}
                                    <Link
                                        href={`/admin/payments?uid=${encodeURIComponent(r.uid)}&tab=subscriptions`}
                                        style={{
                                            border: "1px solid #E5E7EB",
                                            borderRadius: 999,
                                            padding: "7px 10px",
                                            fontWeight: 800,
                                            fontSize: 12,
                                            textDecoration: "none",
                                            color: r.hasPayments ? "#111827" : "#9CA3AF",
                                            background: "#fff",
                                            pointerEvents: r.hasPayments ? "auto" : "none",
                                            opacity: r.hasPayments ? 1 : 0.65,
                                        }}
                                        title={r.hasPayments ? "View payments history" : "No checkout records found"}
                                    >
                                        Payments
                                    </Link>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}