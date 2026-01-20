"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    Timestamp,
    where,
    doc,
    getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import clsx from "clsx";

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Tooltip,
    Legend,
    Title,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Tooltip,
    Legend,
    Title
);

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
    bg: "#FAFAFA",
};

type RangeKey = 7 | 30 | 90;

type DailyRow = {
    id: string;
    sellerId: string;
    dayKey: string;
    dayStart: Timestamp;

    storeViews?: number;
    listingClicks?: number;
    leadsTotal?: number;
    leadsCall?: number;
    leadsWhatsApp?: number;
    leadsMessage?: number;

    srcMarketViews?: number;
    srcSearchViews?: number;
    srcShareViews?: number;
    srcProfileViews?: number;
};

type SellerRow = {
    sellerId: string;
    name: string;
    handle?: string | null;
    storeViews: number;
    listingClicks: number;
    leadsTotal: number;
    traffic: {
        market: number;
        search: number;
        share: number;
        profile: number;
    };
};

type TopListingRow = {
    id: string;
    sellerId: string;
    title: string;
    views: number;
    clicks: number;
    leads: number;
};

function nfmt(n: number) {
    const x = Number(n || 0);
    if (x >= 1_000_000) return (x / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (x >= 1_000) return (x / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(x);
}

function pct(x: number) {
    if (!isFinite(x) || x <= 0) return "0%";
    return (x * 100).toFixed(x < 0.1 ? 1 : 0).replace(/\.0$/, "") + "%";
}

function safeDiv(a: number, b: number) {
    const A = Number(a || 0);
    const B = Number(b || 0);
    if (!B) return 0;
    return A / B;
}

function dayLabel(ts?: Timestamp) {
    if (!ts?.toDate) return "";
    const d = ts.toDate();
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function chunk<T>(arr: T[], size: number) {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function downloadCSV(filename: string, rows: Record<string, any>[]) {
    const cols = Array.from(
        rows.reduce((s: any, r: any) => {
            Object.keys(r || {}).forEach((k) => s.add(k));
            return s;
        }, new Set<string>())
    );

    const esc = (v: any) => {
        const s = String(v ?? "");
        if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
    };

    const csv = [
        cols.join(","),
        ...rows.map((r) => cols.map((c: any) => esc(r?.[c])).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
}

function Card({
    title,
    value,
    subtitle,
}: {
    title: string;
    value: string;
    subtitle?: string;
}) {
    return (
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
            <div className="text-xs font-extrabold" style={{ color: EKARI.dim }}>
                {title}
            </div>
            <div className="mt-1 text-2xl font-black" style={{ color: EKARI.text }}>
                {value}
            </div>
            {subtitle ? (
                <div className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                    {subtitle}
                </div>
            ) : null}
        </div>
    );
}

export default function AdminAnalyticsPage() {
    const [range, setRange] = useState<RangeKey>(30);
    const [loading, setLoading] = useState(false);

    const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
    const [topStores, setTopStores] = useState<SellerRow[]>([]);
    const [topListings, setTopListings] = useState<TopListingRow[]>([]);

    // drill-down
    const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
    const [selectedSellerListings, setSelectedSellerListings] = useState<TopListingRow[]>([]);
    const selectedSeller = useMemo(
        () => (selectedSellerId ? topStores.find((s) => s.sellerId === selectedSellerId) || null : null),
        [selectedSellerId, topStores]
    );

    const sinceTs = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - (range - 1));
        d.setHours(0, 0, 0, 0);
        return Timestamp.fromDate(d);
    }, [range]);

    const loadSellerListings = useCallback(async (sellerId: string) => {
        // Try seller.id first, then ownerId fallback (because your data varies)
        const results: TopListingRow[] = [];
        const seen = new Set<string>();

        async function runOne(q: any) {
            const snap = await getDocs(q);
            for (const d of snap.docs) {
                if (seen.has(d.id)) continue;
                seen.add(d.id);
                const x = d.data() as any;
                results.push({
                    id: d.id,
                    sellerId: x?.seller?.id || x?.ownerId || sellerId,
                    title: x?.name || x?.title || "Listing",
                    views: Number(x?.stats?.views || 0),
                    clicks: Number(x?.stats?.clicks || 0),
                    leads: Number(x?.stats?.leads || 0),
                });
            }
        }

        try {
            await runOne(
                query(
                    collection(db, "marketListings"),
                    where("status", "==", "active"),
                    where("seller.id", "==", sellerId),
                    orderBy("stats.views", "desc"),
                    limit(20)
                )
            );
        } catch {
            // ignore (index missing etc.)
        }

        if (results.length < 5) {
            try {
                await runOne(
                    query(
                        collection(db, "marketListings"),
                        where("status", "==", "active"),
                        where("ownerId", "==", sellerId),
                        orderBy("stats.views", "desc"),
                        limit(20)
                    )
                );
            } catch {
                // ignore
            }
        }

        results.sort((a, b) => b.views - a.views);
        setSelectedSellerListings(results.slice(0, 20));
    }, []);
    const loadTopListings = useCallback(async () => {
        const out: TopListingRow[] = [];
        const seen = new Set<string>();

        const pushSnap = (snap: any) => {
            snap.docs.forEach((d: any) => {
                if (seen.has(d.id)) return;
                seen.add(d.id);
                const x = d.data() as any;
                out.push({
                    id: d.id,
                    sellerId: x?.seller?.id || x?.ownerId || "—",
                    title: x?.name || x?.title || "Listing",
                    views: Number(x?.stats?.views || 0),
                    clicks: Number(x?.stats?.clicks || 0),
                    leads: Number(x?.stats?.leads || 0),
                });
            });
        };

        // A) Try status == active + order by stats.views
        try {
            const q1 = query(
                collection(db, "marketListings"),
                where("status", "==", "active"),
                orderBy("stats.views", "desc"),
                limit(20)
            );
            pushSnap(await getDocs(q1));
        } catch { }

        // B) If empty, try without status filter
        if (out.length === 0) {
            try {
                const q2 = query(collection(db, "marketListings"), orderBy("stats.views", "desc"), limit(20));
                pushSnap(await getDocs(q2));
            } catch { }
        }

        // C) If still empty, show latest listings (so table is never blank)
        if (out.length === 0) {
            try {
                const q3 = query(collection(db, "marketListings"), orderBy("createdAt", "desc"), limit(20));
                pushSnap(await getDocs(q3));
            } catch { }
        }

        out.sort((a, b) => b.views - a.views);
        return out.slice(0, 20);
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            // 1) Load storeDailyStats for range
            const qDaily = query(
                collection(db, "storeDailyStats"),
                where("dayStart", ">=", sinceTs),
                orderBy("dayStart", "asc")
            );

            const dailySnap = await getDocs(qDaily);
            const rows: DailyRow[] = dailySnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
            setDailyRows(rows);

            // 2) Aggregate per seller
            const bySeller = new Map<string, SellerRow>();

            for (const r of rows) {
                const sid = String(r.sellerId || "");
                if (!sid) continue;

                const cur =
                    bySeller.get(sid) ||
                    ({
                        sellerId: sid,
                        name: "—",
                        handle: null,
                        storeViews: 0,
                        listingClicks: 0,
                        leadsTotal: 0,
                        traffic: { market: 0, search: 0, share: 0, profile: 0 },
                    } as SellerRow);

                cur.storeViews += Number(r.storeViews || 0);
                cur.listingClicks += Number(r.listingClicks || 0);
                cur.leadsTotal += Number(r.leadsTotal || 0);

                cur.traffic.market += Number(r.srcMarketViews || 0);
                cur.traffic.search += Number(r.srcSearchViews || 0);
                cur.traffic.share += Number(r.srcShareViews || 0);
                cur.traffic.profile += Number(r.srcProfileViews || 0);

                bySeller.set(sid, cur);
            }

            // 3) Hydrate seller names from users/{uid}
            const sellerIds = Array.from(bySeller.keys());
            const idChunks = chunk(sellerIds, 25);

            await Promise.all(
                idChunks.flat().map(async (sid) => {
                    try {
                        const uSnap = await getDoc(doc(db, "users", sid));
                        if (!uSnap.exists()) return;
                        const u = uSnap.data() as any;

                        const full = [u?.firstName, u?.surname].filter(Boolean).join(" ").trim();
                        const name = full || u?.businessname || u?.username || u?.handle || "—";
                        const handle = u?.handle
                            ? String(u.handle).startsWith("@")
                                ? u.handle
                                : `@${u.handle}`
                            : null;

                        const row = bySeller.get(sid);
                        if (row) {
                            row.name = name;
                            row.handle = handle;
                            bySeller.set(sid, row);
                        }
                    } catch {
                        // ignore
                    }
                })
            );

            const storeList = Array.from(bySeller.values()).sort((a, b) => b.storeViews - a.storeViews);
            setTopStores(storeList.slice(0, 20));

            // 4) Top listings (lifetime)
            // 4) Top listings (lifetime) — robust fallback
            const top = await loadTopListings();
            setTopListings(top);


            // refresh drill-down if selected
            if (selectedSellerId) {
                loadSellerListings(selectedSellerId).catch(() => { });
            }
        } finally {
            setLoading(false);
        }
    }, [sinceTs, selectedSellerId, loadSellerListings]);

    useEffect(() => {
        load().catch(() => { });
    }, [load]);

    // KPIs totals
    const totals = useMemo(() => {
        let storeViews = 0,
            clicks = 0,
            leads = 0;

        let leadsCall = 0,
            leadsWhatsApp = 0,
            leadsMessage = 0;

        let market = 0,
            search = 0,
            share = 0,
            profile = 0;

        for (const r of dailyRows) {
            storeViews += Number(r.storeViews || 0);
            clicks += Number(r.listingClicks || 0);
            leads += Number(r.leadsTotal || 0);

            leadsCall += Number(r.leadsCall || 0);
            leadsWhatsApp += Number(r.leadsWhatsApp || 0);
            leadsMessage += Number(r.leadsMessage || 0);

            market += Number(r.srcMarketViews || 0);
            search += Number(r.srcSearchViews || 0);
            share += Number(r.srcShareViews || 0);
            profile += Number(r.srcProfileViews || 0);
        }

        return {
            storeViews,
            clicks,
            leads,
            leadsCall,
            leadsWhatsApp,
            leadsMessage,
            market,
            search,
            share,
            profile,
        };
    }, [dailyRows]);

    // Funnel metrics
    const funnel = useMemo(() => {
        const ctr = safeDiv(totals.clicks, totals.storeViews);
        const leadRate = safeDiv(totals.leads, totals.clicks);
        const leadsPerView = safeDiv(totals.leads, totals.storeViews);
        const leadsPer100Views = leadsPerView * 100;

        return { ctr, leadRate, leadsPerView, leadsPer100Views };
    }, [totals]);

    // Labels
    const labels = useMemo(() => dailyRows.map((r) => dayLabel(r.dayStart)), [dailyRows]);

    // Main trend
    const trendData = useMemo(() => {
        const viewsSeries = dailyRows.map((r) => Number(r.storeViews || 0));
        const clicksSeries = dailyRows.map((r) => Number(r.listingClicks || 0));
        const leadsSeries = dailyRows.map((r) => Number(r.leadsTotal || 0));

        return {
            labels,
            datasets: [
                {
                    label: "Views",
                    data: viewsSeries,
                    borderColor: EKARI.forest,
                    backgroundColor: "rgba(35,63,57,0.12)",
                    tension: 0.35,
                },
                {
                    label: "Clicks",
                    data: clicksSeries,
                    borderColor: EKARI.gold,
                    backgroundColor: "rgba(199,146,87,0.12)",
                    tension: 0.35,
                },
                {
                    label: "Leads",
                    data: leadsSeries,
                    borderColor: "#4B82F0",
                    backgroundColor: "rgba(75,130,240,0.12)",
                    tension: 0.35,
                },
            ],
        };
    }, [dailyRows, labels]);

    // Traffic trend
    const trafficTrendData = useMemo(() => {
        const m = dailyRows.map((r) => Number(r.srcMarketViews || 0));
        const s = dailyRows.map((r) => Number(r.srcSearchViews || 0));
        const sh = dailyRows.map((r) => Number(r.srcShareViews || 0));
        const p = dailyRows.map((r) => Number(r.srcProfileViews || 0));

        return {
            labels,
            datasets: [
                { label: "Market", data: m, borderColor: EKARI.forest, tension: 0.35 },
                { label: "Search", data: s, borderColor: EKARI.gold, tension: 0.35 },
                { label: "Share", data: sh, borderColor: "#4B82F0", tension: 0.35 },
                { label: "Profile", data: p, borderColor: "#8B5CF6", tension: 0.35 },
            ],
        };
    }, [dailyRows, labels]);

    // Leads breakdown trend
    const leadsBreakdownData = useMemo(() => {
        const c = dailyRows.map((r) => Number(r.leadsCall || 0));
        const w = dailyRows.map((r) => Number(r.leadsWhatsApp || 0));
        const m = dailyRows.map((r) => Number(r.leadsMessage || 0));
        return {
            labels,
            datasets: [
                { label: "Call", data: c, borderColor: "#0EA5E9", tension: 0.35 },
                { label: "WhatsApp", data: w, borderColor: "#16A34A", tension: 0.35 },
                { label: "Message", data: m, borderColor: "#F59E0B", tension: 0.35 },
            ],
        };
    }, [dailyRows, labels]);

    const lineOptions = useMemo(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                tooltip: { enabled: true },
                title: { display: false },
            },
            scales: {
                y: { beginAtZero: true },
            },
        }),
        []
    );

    // Seller drill-down daily rows
    const sellerDailyRows = useMemo(() => {
        if (!selectedSellerId) return [];
        return dailyRows.filter((r) => String(r.sellerId) === selectedSellerId);
    }, [dailyRows, selectedSellerId]);

    const sellerTotals = useMemo(() => {
        let storeViews = 0,
            clicks = 0,
            leads = 0;
        let call = 0,
            wa = 0,
            msg = 0;

        for (const r of sellerDailyRows) {
            storeViews += Number(r.storeViews || 0);
            clicks += Number(r.listingClicks || 0);
            leads += Number(r.leadsTotal || 0);
            call += Number(r.leadsCall || 0);
            wa += Number(r.leadsWhatsApp || 0);
            msg += Number(r.leadsMessage || 0);
        }

        const ctr = safeDiv(clicks, storeViews);
        const leadRate = safeDiv(leads, clicks);
        return { storeViews, clicks, leads, call, wa, msg, ctr, leadRate };
    }, [sellerDailyRows]);

    const sellerLabels = useMemo(
        () => sellerDailyRows.map((r) => dayLabel(r.dayStart)),
        [sellerDailyRows]
    );

    const sellerTrendData = useMemo(() => {
        const v = sellerDailyRows.map((r) => Number(r.storeViews || 0));
        const c = sellerDailyRows.map((r) => Number(r.listingClicks || 0));
        const l = sellerDailyRows.map((r) => Number(r.leadsTotal || 0));

        return {
            labels: sellerLabels,
            datasets: [
                { label: "Views", data: v, borderColor: EKARI.forest, tension: 0.35 },
                { label: "Clicks", data: c, borderColor: EKARI.gold, tension: 0.35 },
                { label: "Leads", data: l, borderColor: "#4B82F0", tension: 0.35 },
            ],
        };
    }, [sellerDailyRows, sellerLabels]);

    const onSelectSeller = useCallback(
        async (sid: string) => {
            setSelectedSellerId(sid);
            setSelectedSellerListings([]);
            await loadSellerListings(sid);
        },
        [loadSellerListings]
    );

    const exportAll = useCallback(() => {
        const daily = dailyRows.map((r) => ({
            dayKey: r.dayKey,
            dayStart: r.dayStart?.toDate?.()?.toISOString?.() || "",
            sellerId: r.sellerId,
            storeViews: Number(r.storeViews || 0),
            listingClicks: Number(r.listingClicks || 0),
            leadsTotal: Number(r.leadsTotal || 0),
            leadsCall: Number(r.leadsCall || 0),
            leadsWhatsApp: Number(r.leadsWhatsApp || 0),
            leadsMessage: Number(r.leadsMessage || 0),
            srcMarketViews: Number(r.srcMarketViews || 0),
            srcSearchViews: Number(r.srcSearchViews || 0),
            srcShareViews: Number(r.srcShareViews || 0),
            srcProfileViews: Number(r.srcProfileViews || 0),
        }));

        const stores = topStores.map((s) => ({
            sellerId: s.sellerId,
            name: s.name,
            handle: s.handle || "",
            storeViews: s.storeViews,
            listingClicks: s.listingClicks,
            leadsTotal: s.leadsTotal,
            trafficMarket: s.traffic.market,
            trafficSearch: s.traffic.search,
            trafficShare: s.traffic.share,
            trafficProfile: s.traffic.profile,
            ctr: safeDiv(s.listingClicks, s.storeViews),
            leadRate: safeDiv(s.leadsTotal, s.listingClicks),
        }));

        const listings = topListings.map((x) => ({
            listingId: x.id,
            sellerId: x.sellerId,
            title: x.title,
            views: x.views,
            clicks: x.clicks,
            leads: x.leads,
        }));

        downloadCSV(`analytics_daily_${range}d.csv`, daily);
        downloadCSV(`analytics_top_stores_${range}d.csv`, stores);
        downloadCSV(`analytics_top_listings_lifetime.csv`, listings);

        if (selectedSellerId && selectedSellerListings.length) {
            downloadCSV(`analytics_${selectedSellerId}_top_listings.csv`, selectedSellerListings);
        }
    }, [dailyRows, topStores, topListings, range, selectedSellerId, selectedSellerListings]);

    return (
        <main className="min-h-screen" style={{ background: EKARI.bg }}>
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-black" style={{ color: EKARI.text }}>
                        Admin Analytics
                    </h1>

                    <div className="ml-auto flex items-center gap-2">
                        <div className="inline-flex rounded-full border bg-white p-1" style={{ borderColor: EKARI.hair }}>
                            {[7, 30, 90].map((d) => (
                                <button
                                    key={d}
                                    onClick={() => setRange(d as RangeKey)}
                                    className={clsx(
                                        "h-9 px-4 rounded-full text-xs font-black transition",
                                        range === d ? "text-white" : "text-slate-700 hover:bg-black/[0.03]"
                                    )}
                                    style={range === d ? { background: EKARI.forest } : {}}
                                >
                                    {d}d
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => load()}
                            className="h-10 px-4 rounded-xl text-xs font-black text-white"
                            style={{ background: EKARI.gold }}
                            disabled={loading}
                        >
                            {loading ? "Refreshing…" : "Refresh"}
                        </button>

                        <button
                            onClick={exportAll}
                            className="h-10 px-4 rounded-xl text-xs font-black"
                            style={{ border: `1px solid ${EKARI.hair}`, background: "#fff", color: EKARI.text }}
                        >
                            Export CSV
                        </button>
                    </div>
                </div>

                <p className="mt-2 text-sm" style={{ color: EKARI.dim }}>
                    Overview for the last <span className="font-black">{range}</span> days.
                </p>

                {/* KPIs */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Card title="Total store views" value={nfmt(totals.storeViews)} subtitle={`${range} days`} />
                    <Card title="Total listing clicks" value={nfmt(totals.clicks)} subtitle={`${range} days`} />
                    <Card title="Total leads" value={nfmt(totals.leads)} subtitle={`${range} days`} />
                    <Card
                        title="Traffic split"
                        value={`${nfmt(totals.market)} • ${nfmt(totals.search)} • ${nfmt(totals.share)} • ${nfmt(totals.profile)}`}
                        subtitle="Market • Search • Share • Profile"
                    />
                </div>

                {/* Funnel KPIs */}
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Card title="CTR (Clicks / Views)" value={pct(funnel.ctr)} subtitle="Higher = better thumbnails/titles" />
                    <Card title="Lead Rate (Leads / Clicks)" value={pct(funnel.leadRate)} subtitle="Higher = better listing details" />
                    <Card title="Leads per 100 views" value={(funnel.leadsPer100Views || 0).toFixed(2)} subtitle="Overall conversion health" />
                </div>

                {/* Charts */}
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="rounded-3xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
                        <div className="text-sm font-black" style={{ color: EKARI.text }}>
                            Trend: Views / Clicks / Leads
                        </div>
                        <div className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                            Daily totals
                        </div>
                        <div className="mt-3 h-64">
                            <Line data={trendData as any} options={lineOptions as any} />
                        </div>
                    </div>

                    <div className="rounded-3xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
                        <div className="text-sm font-black" style={{ color: EKARI.text }}>
                            Trend: Traffic Sources
                        </div>
                        <div className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                            Market / Search / Share / Profile
                        </div>
                        <div className="mt-3 h-64">
                            <Line data={trafficTrendData as any} options={lineOptions as any} />
                        </div>
                    </div>
                </div>

                {/* Leads breakdown */}
                <div className="mt-3 rounded-3xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
                    <div className="flex flex-wrap items-start gap-2">
                        <div>
                            <div className="text-sm font-black" style={{ color: EKARI.text }}>
                                Trend: Leads Breakdown
                            </div>
                            <div className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                                Call vs WhatsApp vs Message
                            </div>
                        </div>
                        <div className="ml-auto text-xs" style={{ color: EKARI.dim }}>
                            Call: <span className="font-black" style={{ color: EKARI.text }}>{nfmt(totals.leadsCall)}</span>{" "}
                            • WhatsApp: <span className="font-black" style={{ color: EKARI.text }}>{nfmt(totals.leadsWhatsApp)}</span>{" "}
                            • Message: <span className="font-black" style={{ color: EKARI.text }}>{nfmt(totals.leadsMessage)}</span>
                        </div>
                    </div>
                    <div className="mt-3 h-64">
                        <Line data={leadsBreakdownData as any} options={lineOptions as any} />
                    </div>
                </div>

                {/* Tables */}
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="rounded-3xl border bg-white overflow-hidden" style={{ borderColor: EKARI.hair }}>
                        <div className="p-4 border-b" style={{ borderColor: EKARI.hair }}>
                            <div className="text-sm font-black" style={{ color: EKARI.text }}>
                                Top Stores (by views)
                            </div>
                            <div className="text-xs" style={{ color: EKARI.dim }}>
                                Click a seller to drill down
                            </div>
                        </div>

                        <div className="p-4 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left" style={{ color: EKARI.dim }}>
                                        <th className="py-2">Seller</th>
                                        <th className="py-2">Views</th>
                                        <th className="py-2">Clicks</th>
                                        <th className="py-2">Leads</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topStores.map((s) => {
                                        const active = selectedSellerId === s.sellerId;
                                        return (
                                            <tr
                                                key={s.sellerId}
                                                className={clsx("border-t cursor-pointer", active && "bg-black/[0.03]")}
                                                style={{ borderColor: EKARI.hair }}
                                                onClick={() => onSelectSeller(s.sellerId)}
                                                title="Click to drill down"
                                            >
                                                <td className="py-2">
                                                    <div className="font-black" style={{ color: EKARI.text }}>
                                                        {s.name}
                                                    </div>
                                                    <div className="text-xs" style={{ color: EKARI.dim }}>
                                                        {s.handle || s.sellerId}
                                                    </div>
                                                </td>
                                                <td className="py-2 font-black" style={{ color: EKARI.text }}>
                                                    {nfmt(s.storeViews)}
                                                </td>
                                                <td className="py-2 font-black" style={{ color: EKARI.text }}>
                                                    {nfmt(s.listingClicks)}
                                                </td>
                                                <td className="py-2 font-black" style={{ color: EKARI.text }}>
                                                    {nfmt(s.leadsTotal)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {!topStores.length ? (
                                        <tr>
                                            <td colSpan={4} className="py-4 text-sm" style={{ color: EKARI.dim }}>
                                                No data yet.
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="rounded-3xl border bg-white overflow-hidden" style={{ borderColor: EKARI.hair }}>
                        <div className="p-4 border-b" style={{ borderColor: EKARI.hair }}>
                            <div className="text-sm font-black" style={{ color: EKARI.text }}>
                                Top Listings (by views)
                            </div>
                            <div className="text-xs" style={{ color: EKARI.dim }}>
                                Pulled from marketListings.stats (lifetime)
                            </div>
                        </div>
                        <div className="p-4 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left" style={{ color: EKARI.dim }}>
                                        <th className="py-2">Listing</th>
                                        <th className="py-2">Views</th>
                                        <th className="py-2">Clicks</th>
                                        <th className="py-2">Leads</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topListings.map((x) => (
                                        <tr key={x.id} className="border-t" style={{ borderColor: EKARI.hair }}>
                                            <td className="py-2">
                                                <div className="font-black" style={{ color: EKARI.text }}>
                                                    {x.title}
                                                </div>
                                                <div className="text-xs" style={{ color: EKARI.dim }}>
                                                    {x.id}
                                                </div>
                                            </td>
                                            <td className="py-2 font-black" style={{ color: EKARI.text }}>
                                                {nfmt(x.views)}
                                            </td>
                                            <td className="py-2 font-black" style={{ color: EKARI.text }}>
                                                {nfmt(x.clicks)}
                                            </td>
                                            <td className="py-2 font-black" style={{ color: EKARI.text }}>
                                                {nfmt(x.leads)}
                                            </td>
                                        </tr>
                                    ))}
                                    {!topListings.length ? (
                                        <tr>
                                            <td colSpan={4} className="py-4 text-sm" style={{ color: EKARI.dim }}>
                                                No listings data yet.
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Seller Drill-down */}
                {selectedSellerId ? (
                    <div className="mt-4 rounded-3xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
                        <div className="flex flex-wrap items-center gap-2">
                            <div>
                                <div className="text-sm font-black" style={{ color: EKARI.text }}>
                                    Seller Drill-down
                                </div>
                                <div className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                                    {selectedSeller?.name || "Seller"} • {selectedSeller?.handle || selectedSellerId}
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    setSelectedSellerId(null);
                                    setSelectedSellerListings([]);
                                }}
                                className="ml-auto h-9 px-3 rounded-xl text-xs font-black"
                                style={{ border: `1px solid ${EKARI.hair}`, background: "#fff", color: EKARI.text }}
                            >
                                Clear
                            </button>
                        </div>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Card title="Views" value={nfmt(sellerTotals.storeViews)} subtitle={`${range} days`} />
                            <Card title="CTR" value={pct(sellerTotals.ctr)} subtitle="Clicks / Views" />
                            <Card title="Lead Rate" value={pct(sellerTotals.leadRate)} subtitle="Leads / Clicks" />
                        </div>

                        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <div className="rounded-3xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
                                <div className="text-sm font-black" style={{ color: EKARI.text }}>
                                    Seller Trend: Views / Clicks / Leads
                                </div>
                                <div className="mt-3 h-56">
                                    <Line data={sellerTrendData as any} options={lineOptions as any} />
                                </div>
                            </div>

                            <div className="rounded-3xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
                                <div className="text-sm font-black" style={{ color: EKARI.text }}>
                                    Seller Top Listings
                                </div>
                                <div className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                                    Active listings ordered by views (stats)
                                </div>

                                <div className="mt-3 overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left" style={{ color: EKARI.dim }}>
                                                <th className="py-2">Listing</th>
                                                <th className="py-2">Views</th>
                                                <th className="py-2">Clicks</th>
                                                <th className="py-2">Leads</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedSellerListings.map((x) => (
                                                <tr key={x.id} className="border-t" style={{ borderColor: EKARI.hair }}>
                                                    <td className="py-2">
                                                        <div className="font-black" style={{ color: EKARI.text }}>
                                                            {x.title}
                                                        </div>
                                                        <div className="text-xs" style={{ color: EKARI.dim }}>
                                                            {x.id}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 font-black" style={{ color: EKARI.text }}>
                                                        {nfmt(x.views)}
                                                    </td>
                                                    <td className="py-2 font-black" style={{ color: EKARI.text }}>
                                                        {nfmt(x.clicks)}
                                                    </td>
                                                    <td className="py-2 font-black" style={{ color: EKARI.text }}>
                                                        {nfmt(x.leads)}
                                                    </td>
                                                </tr>
                                            ))}
                                            {!selectedSellerListings.length ? (
                                                <tr>
                                                    <td colSpan={4} className="py-4 text-sm" style={{ color: EKARI.dim }}>
                                                        No seller listings found (or missing index). If needed we can add a simple index.
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

                {/* Footer note 
                <div className="mt-4 text-xs" style={{ color: EKARI.dim }}>
                    Tip: If you want “Top listings in last 7/30/90 days”, we’ll add a daily listing stats collection (or Cloud Function
                    rollups). Your current marketListings.stats is lifetime counts.
                </div>*/}
            </div>
        </main>
    );
}
