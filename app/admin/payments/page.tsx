// app/admin/payments/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    where,
    Timestamp,
    doc,
    getDoc,
    documentId,
} from "firebase/firestore";
import { onAuthStateChanged, getAuth } from "firebase/auth";
import { db, app } from "@/lib/firebase";

type PaymentTab = "donations" | "subscriptions" | "activation";

type PaymentRow = {
    id: string;
    type: PaymentTab;
    uid?: string;
    createdAt: Date | null;

    status: string;

    // raw fields
    amount: number | null; // usually minor units from Paystack (kobo/cents)
    currency: string;

    // ✅ normalized display in USD (minor/cents)
    amountUsdMinor?: number | null;
    usdNote?: string;

    reference?: string;
    checkoutUrl?: string;

    label?: string;
    raw?: any;
};

type UserLite = {
    id: string;
    handle?: string | null; // "@skya"
    photoURL?: string | null;
    firstName?: string | null;
    surname?: string | null;
    isDeactivated?: boolean;
    isSuspended?: boolean;
};

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
};

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

function fmtDate(d: Date | null) {
    if (!d) return "—";
    return d.toLocaleString();
}

function fmtUsdFromMinor(usdMinor: number | null | undefined) {
    if (usdMinor == null) return "—";
    const major = usdMinor / 100;
    return `USD ${major.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function normalizeToUsdMinor(opts: {
    tab: PaymentTab;
    x: any;
    currency: string;
    amount: number | null;
    usdToKesRate: number;
}): { usdMinor: number | null; note?: string } {
    const { tab, x, currency, amount, usdToKesRate } = opts;
    if (amount == null) return { usdMinor: null };

    const cur = (currency || "").toUpperCase();

    // ✅ Donations already have canonical USD minor from your webhook update
    if (tab === "donations" && typeof x.grossAmountUsdMinor === "number") {
        return { usdMinor: x.grossAmountUsdMinor, note: "donation USD canonical" };
    }

    // if stored in USD minor already
    if (cur === "USD") {
        return { usdMinor: amount, note: "USD" };
    }

    // if stored in KES minor -> convert to USD minor using rate
    if (cur === "KES") {
        const rate = usdToKesRate > 0 ? usdToKesRate : 130;
        const usdMinor = Math.round(amount / rate);
        return { usdMinor, note: `KES→USD @${rate}` };
    }

    // unknown currency: treat as USD to avoid blanks
    return { usdMinor: amount, note: `treated as USD (${cur || "unknown"})` };
}

/* ---------------- Firestore sources per tab ---------------- */

type Tab = "donations" | "subscriptions" | "activation";
type WhereOp =
    | "=="
    | "!="
    | "<"
    | "<="
    | ">"
    | ">="
    | "in"
    | "not-in"
    | "array-contains"
    | "array-contains-any";

type SourceCfg = {
    collectionName: string;
    uidField?: string;
    createdAtField: string;
    extraWheres?: { field: string; op: WhereOp; value: any }[];
};

const SOURCES: Record<Tab, SourceCfg[]> = {
    donations: [
        {
            collectionName: "donations",
            uidField: "donorId",
            createdAtField: "createdAt",
            extraWheres: [{ field: "status", op: "==", value: "succeeded" }],
        },
    ],
    subscriptions: [
        {
            collectionName: "packageCheckouts",
            uidField: "userUid",
            createdAtField: "createdAt",
        },
    ],
    activation: [
        {
            collectionName: "verificationSessions",
            uidField: "userUid",
            createdAtField: "paidAt",
        },
    ],
};

/* ---------------- user helpers ---------------- */

function handleSlug(handle?: string | null) {
    return handle ? String(handle).replace(/^@+/, "").trim() : "";
}

function initialsFrom(handle?: string | null, id?: string) {
    const base = handleSlug(handle) || (id ? id.slice(0, 2) : "U");
    return base.slice(0, 2).toUpperCase();
}

function chunk<T>(arr: T[], size: number) {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

export default function AdminPaymentsPage() {
    const sp = useSearchParams();
    const uid = sp.get("uid") || ""; // optional
    const tab = (sp.get("tab") as PaymentTab) || "donations";

    const [authUid, setAuthUid] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [checkingAdmin, setCheckingAdmin] = useState(true);

    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<PaymentRow[]>([]);
    const [errorMsg, setErrorMsg] = useState<string>("");

    // ✅ FX rate (KES per 1 USD)
    const [usdToKesRate, setUsdToKesRate] = useState<number>(130);

    // ✅ Users cache for uid -> profile
    const [usersById, setUsersById] = useState<Record<string, UserLite>>({});
    const [usersLoading, setUsersLoading] = useState(false);

    // auth + admin check (supports claim OR users/{uid}.isAdmin)
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
                const token = await u.getIdTokenResult();
                const claimAdmin = !!(token.claims as any)?.admin;
                if (claimAdmin) {
                    setIsAdmin(true);
                    setCheckingAdmin(false);
                    return;
                }

                const snap = await getDoc(doc(db, "users", u.uid));
                const data = (snap.data() as any) || {};
                setIsAdmin(!!data.isAdmin);
            } catch {
                setIsAdmin(false);
            } finally {
                setCheckingAdmin(false);
            }
        });

        return () => unsub();
    }, []);

    // ✅ Load USD/KES rate from adminSettings/finance
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const financeSnap = await getDoc(doc(db, "adminSettings", "finance"));
                const finance = financeSnap.exists() ? (financeSnap.data() as any) : {};
                const r =
                    typeof finance.usdToKesRate === "number" && finance.usdToKesRate > 0
                        ? finance.usdToKesRate
                        : 130;

                if (!cancelled) setUsdToKesRate(r);
            } catch {
                // keep default
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // loader: fetch current tab payments (all users OR one uid)
    useEffect(() => {
        if (checkingAdmin) return;

        if (!authUid) {
            setLoading(false);
            setRows([]);
            return;
        }

        if (!isAdmin) {
            setLoading(false);
            setRows([]);
            return;
        }

        let cancelled = false;

        (async () => {
            setLoading(true);
            setErrorMsg("");
            setRows([]);

            try {
                const sources = SOURCES[tab] || [];
                if (sources.length === 0) {
                    setRows([]);
                    setErrorMsg(
                        "No Firestore source configured for this tab. Update SOURCES in /admin/payments/page.tsx."
                    );
                    setLoading(false);
                    return;
                }

                let pickedError: any = null;

                for (const src of sources) {
                    try {
                        const colRef = collection(db, src.collectionName);

                        const wheres: any[] = [];
                        if (uid && src.uidField) {
                            wheres.push(where(src.uidField, "==", uid));
                        }
                        for (const w of src.extraWheres || []) {
                            wheres.push(where(w.field, w.op, w.value));
                        }

                        const qy = query(colRef, ...wheres, orderBy(src.createdAtField, "desc"), limit(200));
                        const snap = await getDocs(qy);

                        const built: PaymentRow[] = snap.docs.map((d) => {
                            const x: any = d.data();

                            const created =
                                toDate(x[src.createdAtField]) || toDate(x.createdAt) || toDate(x.paidAt) || null;

                            const status = x.status || x.state || x.paystackStatus || x.paymentStatus || "—";

                            const currency =
                                x.currency ||
                                x.currencyCode ||
                                x.paidCurrency ||
                                x.gatewayCurrency ||
                                (tab === "donations" ? "USD" : "KES") ||
                                "—";

                            const rawAmount =
                                x.paidAmountMinor ??
                                x.gatewayAmountMinor ??
                                x.amountMinor ??
                                x.amountInMinor ??
                                x.amount ??
                                x.grossAmountUsdMinor ??
                                x.paidAmount ??
                                null;

                            const amount = typeof rawAmount === "number" ? rawAmount : null;

                            const norm = normalizeToUsdMinor({
                                tab,
                                x,
                                currency,
                                amount,
                                usdToKesRate,
                            });

                            const reference =
                                x.reference ||
                                x.paystackReference ||
                                x.txRef ||
                                x.gatewayRef ||
                                x.checkoutReference ||
                                x.providerRef ||
                                x.mpesaReceiptNumber ||
                                "";

                            const checkoutUrl = x.checkoutUrl || x.url || x.authorizationUrl || "";

                            const inferredUid =
                                (src.uidField && x[src.uidField]) ||
                                x.userUid ||
                                x.uid ||
                                x.userId ||
                                x.donorId ||
                                x.creatorId ||
                                "";

                            const label =
                                x.planName ||
                                x.packageName ||
                                x.purchaseType ||
                                x.tier ||
                                x.reason ||
                                x.packageId ||
                                "";

                            return {
                                id: d.id,
                                type: tab,
                                uid: inferredUid,
                                createdAt: created,
                                status,
                                amount,
                                currency: currency || "—",
                                amountUsdMinor: norm.usdMinor,
                                usdNote: norm.note,
                                reference,
                                checkoutUrl,
                                label,
                                raw: x,
                            };
                        });

                        if (!cancelled) {
                            setRows(built);
                            setLoading(false);
                        }
                        return; // ✅ success
                    } catch (err) {
                        pickedError = err;
                    }
                }

                throw pickedError || new Error("Failed to load from all configured sources.");
            } catch (e: any) {
                console.error("Admin payments load error:", e);

                const msg = String(e?.message || "");
                const lower = msg.toLowerCase();

                if (!cancelled) {
                    setRows([]);

                    if (lower.includes("insufficient permissions")) {
                        setErrorMsg(
                            "Missing or insufficient permissions. Firestore rules blocked this collection for admin reads."
                        );
                    } else if (lower.includes("failed-precondition") || lower.includes("index")) {
                        setErrorMsg(
                            "Firestore index required for this query (where + orderBy). Create the composite index suggested in the console."
                        );
                    } else {
                        setErrorMsg(msg || "Failed to load payments.");
                    }

                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [tab, uid, authUid, isAdmin, checkingAdmin, usdToKesRate]);

    // ✅ Fetch user profiles for any uid present in rows
    useEffect(() => {
        let cancelled = false;

        async function loadUsers() {
            const ids = Array.from(new Set(rows.map((r) => r.uid).filter(Boolean))) as string[];
            if (ids.length === 0) return;

            const missing = ids.filter((id) => !usersById[id]);
            if (missing.length === 0) return;

            setUsersLoading(true);
            try {
                const batches = chunk(missing, 10); // Firestore "in" supports up to 10
                const next: Record<string, UserLite> = {};

                for (const batch of batches) {
                    const q = query(collection(db, "users"), where(documentId(), "in", batch));
                    const snap = await getDocs(q);

                    snap.docs.forEach((docSnap) => {
                        const u = docSnap.data() as any;
                        next[docSnap.id] = {
                            id: docSnap.id,
                            handle: u.handle ?? null,
                            photoURL: u.photoURL ?? null,
                            firstName: u.firstName ?? null,
                            surname: u.surname ?? null,
                            isDeactivated: !!u.isDeactivated,
                            isSuspended: !!u.isSuspended,
                        };
                    });
                }

                if (!cancelled) setUsersById((prev) => ({ ...prev, ...next }));
            } catch (e) {
                console.error("AdminPayments loadUsers error", e);
            } finally {
                if (!cancelled) setUsersLoading(false);
            }
        }

        loadUsers();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows]);

    const title = useMemo(() => {
        if (tab === "donations") return "Uplifts";
        if (tab === "subscriptions") return "Subscriptions";
        return "Activation fees";
    }, [tab]);

    // ✅ totals only in USD
    const totals = useMemo(() => {
        let count = 0;
        let totalUsdMinor = 0;

        for (const r of rows) {
            count++;
            if (typeof r.amountUsdMinor === "number") {
                totalUsdMinor += r.amountUsdMinor;
            }
        }

        return { count, totalUsdMinor };
    }, [rows]);

    if (checkingAdmin) return <div className="p-6">Checking access…</div>;
    if (!authUid) return <div className="p-6">Please sign in.</div>;
    if (!isAdmin) return <div className="p-6">You don’t have permission to view payments.</div>;

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold" style={{ color: EKARI.text }}>
                        Payments (USD)
                    </h1>
                    <p className="text-sm" style={{ color: EKARI.dim }}>
                        {uid ? (
                            <>
                                Showing <b>{title}</b> for UID <span className="font-mono">{uid}</span>
                            </>
                        ) : (
                            <>
                                Showing <b>{title}</b> for <b>all users</b> (latest records)
                            </>
                        )}
                    </p>
                    {usersLoading ? (
                        <p className="text-[11px] mt-1" style={{ color: EKARI.dim }}>
                            Loading user profiles…
                        </p>
                    ) : null}
                </div>

                <div className="flex gap-2">
                    {uid ? (
                        <Link
                            href={`/admin/users/${uid}`}
                            className="rounded-full px-4 py-2 text-xs font-extrabold border bg-white hover:bg-gray-50"
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        >
                            Open user
                        </Link>
                    ) : null}

                    <Link
                        href={`/admin/overview`}
                        className="rounded-full px-4 py-2 text-xs font-extrabold border bg-white hover:bg-gray-50"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                    >
                        Back to overview
                    </Link>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2">
                {(["donations", "subscriptions", "activation"] as PaymentTab[]).map((t) => {
                    const active = t === tab;
                    return (
                        <Link
                            key={t}
                            href={`/admin/payments?${uid ? `uid=${encodeURIComponent(uid)}&` : ""}tab=${t}`}
                            className="rounded-full px-4 py-2 text-xs font-extrabold border"
                            style={{
                                borderColor: EKARI.hair,
                                background: active ? EKARI.text : "#fff",
                                color: active ? "#fff" : EKARI.text,
                            }}
                        >
                            {t === "donations" ? "Uplifts" : t === "subscriptions" ? "Subscriptions" : "Activation fee"}
                        </Link>
                    );
                })}
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
                    <div className="text-xs font-semibold text-gray-500">Records</div>
                    <div className="text-2xl font-extrabold mt-1" style={{ color: EKARI.text }}>
                        {loading ? "…" : totals.count.toLocaleString("en-US")}
                    </div>
                </div>

                <div className="rounded-2xl border bg-white p-4 sm:col-span-2" style={{ borderColor: EKARI.hair }}>
                    <div className="text-xs font-semibold text-gray-500">Total (USD)</div>
                    <div className="text-2xl font-extrabold mt-1" style={{ color: EKARI.text }}>
                        {loading ? "…" : fmtUsdFromMinor(totals.totalUsdMinor)}
                    </div>
                    <div className="mt-2 text-[11px] text-gray-500">
                        KES payments are converted using rate: <b>{usdToKesRate}</b> (KES per USD). Uplifts use canonical USD
                        from webhook when available.
                    </div>
                </div>
            </div>

            {/* Error */}
            {errorMsg ? (
                <div className="p-3 rounded-2xl border" style={{ borderColor: "#FECACA", background: "#FEF2F2" }}>
                    <div className="text-sm font-extrabold" style={{ color: "#991B1B" }}>
                        Error
                    </div>
                    <div className="text-sm" style={{ color: "#991B1B" }}>
                        {errorMsg}
                    </div>

                    {errorMsg.toLowerCase().includes("index") ? (
                        <div className="mt-2 text-[12px]" style={{ color: EKARI.dim }}>
                            Fix: create the composite index suggested in the console for{" "}
                            <code className="font-mono">{uid ? "uidField == uid, " : ""}orderBy createdAtField desc</code>.
                        </div>
                    ) : null}
                </div>
            ) : null}

            {/* Table */}
            <div className="rounded-2xl border bg-white overflow-hidden" style={{ borderColor: EKARI.hair }}>
                {/* ✅ Added User column */}
                <div className="grid grid-cols-[180px_220px_140px_190px_1fr_220px] bg-gray-50 px-4 py-2 text-xs font-extrabold text-gray-500">
                    <div>Date</div>
                    <div>User</div>
                    <div>Status</div>
                    <div>Amount (USD)</div>
                    <div>Reference / Label</div>
                    <div className="text-right">Checkout</div>
                </div>

                {loading ? (
                    <div className="p-4 text-sm text-gray-500">Loading…</div>
                ) : rows.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">No records found.</div>
                ) : (
                    rows.map((r) => {
                        const u = r.uid ? usersById[r.uid] : undefined;
                        const h = u?.handle ?? null; // "@skya"
                        const slug = handleSlug(h);
                        const href = slug ? `/${slug}` : null;
                        const initials = initialsFrom(h, r.uid);
                        const suspended = !!u?.isSuspended;
                        const deactivated = !!u?.isDeactivated;

                        return (
                            <div
                                key={r.id}
                                className="grid grid-cols-[180px_220px_140px_190px_1fr_220px] px-4 py-3 border-t text-sm items-center"
                                style={{ borderColor: EKARI.hair }}
                            >
                                <div className="text-gray-700">{fmtDate(r.createdAt)}</div>

                                {/* ✅ User cell */}
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                        {href ? (
                                            <Link href={href} className="shrink-0" title={h ?? r.uid ?? ""}>
                                                <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center text-[11px] font-extrabold text-slate-700">
                                                    {u?.photoURL ? (
                                                        <Image
                                                            src={u.photoURL}
                                                            alt={h ?? r.uid ?? "user"}
                                                            width={32}
                                                            height={32}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <span>{initials}</span>
                                                    )}
                                                </div>
                                            </Link>
                                        ) : (
                                            <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center text-[11px] font-extrabold text-slate-700">
                                                <span>{initials}</span>
                                            </div>
                                        )}

                                        <div className="min-w-0 flex flex-col">
                                            {href && h ? (
                                                <Link
                                                    href={href}
                                                    className="text-xs font-semibold text-emerald-700 hover:underline truncate"
                                                    title={h}
                                                >
                                                    {h}
                                                </Link>
                                            ) : (
                                                <div className="text-[11px] text-gray-400 font-mono truncate">
                                                    {r.uid ? `${r.uid.slice(0, 12)}…` : "—"}
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2">
                                                {!uid && r.uid ? (
                                                    <span className="text-[11px] text-gray-400 font-mono truncate">uid: {r.uid}</span>
                                                ) : null}

                                                {(suspended || deactivated) && (
                                                    <span className="inline-flex items-center rounded-full bg-rose-50 border border-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                                        {suspended ? "Suspended" : "Deactivated"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="font-extrabold">{r.status}</div>

                                <div className="min-w-0">
                                    <div className="font-extrabold">{fmtUsdFromMinor(r.amountUsdMinor ?? null)}</div>
                                    {r.usdNote ? <div className="text-[10px] text-gray-400">{r.usdNote}</div> : null}
                                </div>

                                <div className="min-w-0">
                                    <div className="font-mono text-xs text-gray-500 truncate">{r.reference || "—"}</div>

                                    {r.label ? (
                                        <div className="text-[11px] text-emerald-700 font-semibold truncate">{r.label}</div>
                                    ) : null}
                                </div>

                                <div className="text-right">
                                    {r.checkoutUrl ? (
                                        <a
                                            href={r.checkoutUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="font-extrabold text-emerald-700 hover:underline"
                                        >
                                            Open ↗
                                        </a>
                                    ) : (
                                        <span className="text-gray-300">—</span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}