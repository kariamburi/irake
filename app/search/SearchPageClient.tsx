"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";
import AppShell from "@/app/components/AppShell";
import {
    ArrowLeft, Search, X, Clock3, ChevronRight, PlayCircle,
    UserRound, Sprout, ShoppingBag, AlertCircle, LoaderCircle,
    Sparkles, Trash2,
} from "lucide-react";

// Same Firebase V2 callable and response schema as mobile SearchScreen.tsx.
type SearchItem = {
    type: "user" | "expert" | "deed" | "market";
    id: string;
    title: string;
    subtitle: string;
    imageURL?: string;
    handle?: string;
    profession?: string;
    authorId?: string;
    authorUsername?: string;
    price?: number;
    currency?: string;
};
type SearchResponse = { items?: SearchItem[]; query?: string; hasMore?: boolean };

const functions = getFunctions(app, "us-central1");
const searchV2 = httpsCallable<{ q: string }, SearchResponse>(functions, "searchEkarihubV2");
const RECENTS_KEY = "ekari.search.recents";
const FOREST = "#173F2D";

function normalizeInput(raw: string) {
    return raw.trim().replace(/^[@#]/, "");
}
function typeLabel(t: SearchItem["type"]) {
    return t === "user" ? "User" : t === "expert" ? "Expert" : t === "market" ? "Market" : "Deed";
}
function TypeIcon({ type }: { type: SearchItem["type"] }) {
    if (type === "deed") return <PlayCircle size={23} />;
    if (type === "expert") return <Sprout size={23} />;
    if (type === "market") return <ShoppingBag size={23} />;
    return <UserRound size={23} />;
}
function displayPrice(item: SearchItem) {
    if (item.type !== "market" || !Number.isFinite(item.price) || !item.price) return "";
    const prefix = item.currency === "USD" ? "USD " : "KSh ";
    return prefix + new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(item.price);
}
function safeHandle(raw?: string) {
    return (raw || "").replace(/^@+/, "").trim();
}

export default function SearchPageClient() {
    const router = useRouter();
    const params = useSearchParams();
    const urlQuery = params.get("q") || (params.get("tag") ? `#${params.get("tag")}` : "");
    const [q, setQ] = useState(urlQuery);
    const [results, setResults] = useState<SearchItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [recents, setRecents] = useState<string[]>([]);
    const [retry, setRetry] = useState(0);
    const latestRequest = useRef(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Respect incoming links from profile, deed and hashtag surfaces.
    useEffect(() => { setQ(urlQuery); }, [urlQuery]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(RECENTS_KEY);
            const parsed: unknown = raw ? JSON.parse(raw) : [];
            if (Array.isArray(parsed)) setRecents(parsed.filter((x): x is string => typeof x === "string").slice(0, 8));
        } catch { /* private browsing or unavailable storage */ }
    }, []);

    // Live search: debounce and ignore out-of-order responses.
    useEffect(() => {
        const term = q.trim();
        const requestId = ++latestRequest.current;
        setError("");
        if (normalizeInput(term).length < 2) {
            setResults([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        const timeout = window.setTimeout(async () => {
            try {
                const res = await searchV2({ q: term });
                if (requestId !== latestRequest.current) return;
                setResults(Array.isArray(res.data?.items) ? res.data.items : []);
            } catch (e) {
                if (requestId !== latestRequest.current) return;
                console.error("EKARI_WEB_SEARCH_V2_FAILED", e);
                setError("Search is temporarily unavailable. Please try again.");
                setResults([]);
            } finally {
                if (requestId === latestRequest.current) setLoading(false);
            }
        }, 270);
        return () => window.clearTimeout(timeout);
    }, [q, retry]);

    const saveRecent = useCallback((value: string) => {
        const term = value.trim();
        if (!term) return;
        setRecents((current) => {
            const next = [term, ...current.filter((x) => x.toLowerCase() !== term.toLowerCase())].slice(0, 8);
            try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
            return next;
        });
    }, []);

    const clearRecent = useCallback(() => {
        setRecents([]);
        try { localStorage.removeItem(RECENTS_KEY); } catch { /* ignore */ }
    }, []);

    const submitSearch = useCallback((event?: React.FormEvent) => {
        event?.preventDefault();
        const term = q.trim();
        if (!term) return;
        saveRecent(term);
        inputRef.current?.blur();
        // Navigation without a full reload; users can bookmark or share their query.
        const destination = `/search?q=${encodeURIComponent(term)}`;
        if (urlQuery !== term) router.replace(destination, { scroll: false });
    }, [q, router, saveRecent, urlQuery]);

    const chooseRecent = useCallback((value: string) => {
        setQ(value);
        inputRef.current?.focus();
    }, []);

    const openResult = useCallback((item: SearchItem) => {
        saveRecent(q);
        if (item.type === "deed") {
            const author = safeHandle(item.authorUsername) || item.authorId || "deed";
            router.push(`/${encodeURIComponent(author)}/deed/${encodeURIComponent(item.id)}`);
            return;
        }
        if (item.type === "market") {
            router.push(`/market/${encodeURIComponent(item.id)}`);
            return;
        }
        // Both users and experts are backed by a user profile in Search V2.
        // Prefer a real public handle, falling back to profile ID.
        const profile = safeHandle(item.handle) || item.id;
        router.push(`/${encodeURIComponent(profile)}`);
    }, [q, router, saveRecent]);

    const back = () => {
        if (window.history.length > 1) router.back();
        else router.push("/");
    };
    const hasQuery = !!q.trim();
    const validQuery = normalizeInput(q).length >= 2;

    return (
        <AppShell>
            <main className="min-h-[100dvh] w-full min-w-0 bg-[#F8F7F2] text-[#191919]">
                <div className="sticky top-0 z-30 bg-[#173F2D] shadow-[0_4px_18px_rgba(12,41,29,0.10)]">
                    <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-3 py-4 sm:gap-3 sm:px-6 sm:py-5">
                        <button type="button" onClick={back} aria-label="Go back"
                            className="grid h-11 w-10 shrink-0 place-items-center rounded-xl text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                            <ArrowLeft size={23} />
                        </button>
                        <form className="flex h-[52px] min-w-0 flex-1 items-center gap-2 rounded-2xl bg-white px-4 shadow-sm focus-within:ring-2 focus-within:ring-[#C79257]" onSubmit={submitSearch}>
                            <Search size={21} className="shrink-0 text-[#718078]" />
                            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                                autoFocus autoComplete="off" spellCheck={false}
                                placeholder="Search deeds, users, experts, market..."
                                aria-label="Search Ekarihub"
                                className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[#172B20] outline-none placeholder:text-[#8F9A94]" />
                            {hasQuery && <button type="button" onClick={() => { setQ(""); inputRef.current?.focus(); if (urlQuery) router.replace("/search", { scroll: false }); }}
                                aria-label="Clear search" className="shrink-0 rounded-full p-1 text-[#89968D] hover:bg-slate-100"><X size={18} /></button>}
                        </form>
                    </div>
                </div>

                <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 sm:px-7 sm:pt-8">
                    {!hasQuery ? (
                        <div className="max-w-3xl">
                            <div className="mb-5 flex items-center gap-2 text-[17px] font-extrabold text-[#173F2D]"><Clock3 size={20} /> Recent searches</div>
                            {recents.length ? <>
                                <div className="overflow-hidden rounded-2xl border border-[#E5E1D8] bg-white">
                                    {recents.map((term) => <button key={term} type="button" onClick={() => chooseRecent(term)}
                                        className="flex w-full items-center gap-3 border-b border-[#EFECE5] px-4 py-3.5 text-left transition last:border-0 hover:bg-[#F2F7F1]">
                                        <Clock3 size={18} className="text-[#84948A]" /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{term}</span><ChevronRight size={17} className="text-[#A1ABA5]" />
                                    </button>)}
                                </div>
                                <button onClick={clearRecent} type="button" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#A56E36] hover:underline"><Trash2 size={15} /> Clear recent searches</button>
                            </> : <div className="rounded-2xl border border-[#E5E1D8] bg-white px-5 py-7 text-sm text-[#77746F]">Search agricultural deeds, people, experts and market listings in one place.</div>}
                            <button type="button" onClick={() => router.push("/ai")} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#173F2D] px-5 py-3 text-sm font-bold text-white hover:bg-[#214C3A]"><Sparkles size={17} /> Ask ekari AI</button>
                        </div>
                    ) : !validQuery ? (
                        <p className="pt-4 text-sm text-[#798B7F]">Type at least two characters to start searching.</p>
                    ) : <section aria-label="Search results" className="max-w-4xl" aria-busy={loading}>
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <h1 className="text-lg font-extrabold text-[#173F2D]">Matching results</h1>
                            {loading ? <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#687F70]"><LoaderCircle className="animate-spin" size={17} /> Searching...</span> : <span className="text-xs font-semibold text-[#8A948C]">{results.length} shown</span>}
                        </div>
                        {error ? <div role="alert" className="mb-3 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                            <AlertCircle size={20} /> <span className="flex-1">{error}</span><button type="button" onClick={() => setRetry((n) => n + 1)} className="font-bold underline">Retry</button>
                        </div> : null}
                        <div className="overflow-hidden rounded-2xl border border-[#E5E1D8] bg-white">
                            {results.map((item) => <button type="button" key={`${item.type}_${item.id}`} onClick={() => openResult(item)}
                                className="group flex w-full items-center gap-3 border-b border-[#ECEBE5] px-3 py-3.5 text-left transition last:border-0 hover:bg-[#F2F7F1] sm:px-4">
                                <span className="grid h-[55px] w-[55px] shrink-0 place-items-center overflow-hidden rounded-xl bg-[#E5EEE7] text-[#173F2D] sm:h-16 sm:w-16">
                                    {item.imageURL ? <img src={item.imageURL} alt="" className="h-full w-full object-cover" loading="lazy" /> : <TypeIcon type={item.type} />}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block line-clamp-2 text-[14px] font-extrabold leading-5 text-[#1A2920] sm:text-[15px]">{item.title || typeLabel(item.type)}</span>
                                    <span className="mt-1 block truncate text-xs font-medium text-[#859087]">{item.subtitle || typeLabel(item.type)}{displayPrice(item) ? ` · ${displayPrice(item)}` : ""}</span>
                                </span>
                                <span className="shrink-0 rounded-full bg-[#EDF2EB] px-2.5 py-1.5 text-[11px] font-extrabold text-[#173F2D]">{typeLabel(item.type)}</span>
                                <ChevronRight size={18} className="shrink-0 text-[#A3ACA6] group-hover:text-[#173F2D]" />
                            </button>)}
                            {!loading && !error && results.length === 0 ? <div className="px-5 py-20 text-center">
                                <Search size={32} className="mx-auto text-[#A6B5AA]" />
                                <h2 className="mt-4 text-base font-extrabold text-[#20352A]">No matches found</h2>
                                <p className="mt-1 text-sm text-[#829087]">Try another name, profession or keyword.</p>
                            </div> : null}
                            {loading && results.length === 0 ? <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#829087]"><LoaderCircle size={19} className="animate-spin" /> Finding results...</div> : null}
                        </div>
                        <p className="mt-4 text-center text-xs text-[#96A097]">Results are ranked by relevance across Ekarihub.</p>
                    </section>}
                </div>
            </main>
        </AppShell>
    );
}
