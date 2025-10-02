"use client";

import React, { useEffect, useMemo, useState } from "react";
import { normalizeTag } from "@/utils/ekariTags";

/** Simple theme contract so the picker matches your palette */
export type EkariTheme = {
    hair: string; // border color
    text: string; // primary text
    dim?: string; // secondary text
};

const DEFAULT_THEME: EkariTheme = {
    hair: "#E5E7EB",
    text: "#0F172A",
    dim: "#6B7280",
};

export interface HashtagPickerProps {
    /** Selected tags (without #), normalized/lowercased preferred */
    value: string[];
    /** Called with the full new list whenever a tag is added/removed */
    onChange: (next: string[]) => void;

    /** Optional styling palette */
    ekari?: EkariTheme;

    /** Trending suggestions to seed (should be normalized already, but raw is OK) */
    trending?: string[];

    /**
     * Optional metadata for trending items to show "↑".
     * Keys should be normalized tags. Example: { maize: { count: 120, delta: +8 } }
     */
    trendingMeta?: Record<string, { count: number; delta?: number }>;

    /** Max number of tags that can be selected (default 10) */
    max?: number;

    /** Input placeholder */
    placeholder?: string;

    /** Wrapper className */
    className?: string;

    /** Show the "X/Max" counter on the right (default true) */
    showCounter?: boolean;
}

/**
 * TikTok-style hashtag input with:
 * - chips
 * - autosuggest (recent + trending)
 * - keyboard nav (↑/↓, Enter/Tab/Comma/Space)
 * - limit + counter
 * - "↑ trending" badges using trendingMeta.delta
 */
export default function HashtagPicker({
    value,
    onChange,
    ekari = DEFAULT_THEME,
    trending = [],
    trendingMeta,
    max = 10,
    placeholder = "Type # to search… e.g. #agribusiness",
    className = "",
    showCounter = true,
}: HashtagPickerProps) {
    // bump key to avoid old corrupted "recent" data
    const HISTORY_KEY = "ekari.hashtag.history.v2";

    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [activeIdx, setActiveIdx] = useState(0);
    const [recent, setRecent] = useState<string[]>([]);

    // load recents
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const raw = localStorage.getItem(HISTORY_KEY);
            if (raw) {
                setRecent(JSON.parse(raw));
            } else {
                // clean legacy key (with possibly truncated entries)
                localStorage.removeItem("ekari.hashtag.history");
            }
        } catch {
            // ignore
        }
    }, []);

    const limitReached = value.length >= max;
    const already = new Set(value.map((v) => v.toLowerCase()));
    const q = normalizeTag(query);

    // de-duped base pool (recent + trending), normalized, excluding already selected
    const basePool = useMemo(() => {
        const pool = Array.from(
            new Set([...recent, ...trending].map((t) => normalizeTag(t)).filter(Boolean))
        ).filter((t) => !already.has(t));
        return pool;
    }, [recent, trending, value]);

    // rank: startsWith first, then includes
    const suggestions = useMemo(() => {
        if (!q) return basePool.slice(0, 12);
        const starts = basePool.filter((t) => t.startsWith(q));
        const includes = basePool.filter((t) => t.includes(q) && !t.startsWith(q));
        return [...starts, ...includes].slice(0, 12);
    }, [q, basePool]);

    const canAdd = (t: string) => t && !already.has(t) && !limitReached;

    const commit = (t: string) => {
        const tag = normalizeTag(t);
        if (!canAdd(tag)) return;
        const next = [...value, tag];
        onChange(next);
        setQuery("");
        setActiveIdx(0);
        setOpen(false);

        // persist to recent
        try {
            const merged = Array.from(new Set([tag, ...recent]));
            const trimmed = merged.slice(0, 25);
            setRecent(trimmed);
            if (typeof window !== "undefined") {
                localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
            }
        } catch {
            // ignore
        }
    };

    const removeAt = (idx: number) => {
        const next = [...value];
        next.splice(idx, 1);
        onChange(next);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) setOpen(true);
            setActiveIdx((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
            return;
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => Math.max(0, i - 1));
            return;
        }
        if (e.key === "Escape") {
            setOpen(false);
            return;
        }
        if (["Enter", "Tab", ",", " "].includes(e.key)) {
            const chosen = suggestions[activeIdx];
            if (open && chosen) {
                e.preventDefault();
                commit(chosen);
                return;
            }
            if (q) {
                e.preventDefault();
                commit(q);
                return;
            }
        }
        if (e.key === "Backspace" && !query) {
            if (value.length) {
                e.preventDefault();
                removeAt(value.length - 1);
            }
        }
    };

    return (
        <div className={`mt-2 ${className}`}>
            {/* Input + chips */}
            <div
                className="min-h-[46px] w-full rounded-xl border bg-[#F6F7FB] px-2.5 py-2 text-sm focus-within:ring-2"
                style={{ borderColor: ekari.hair, color: ekari.text }}
            >
                <div className="flex flex-wrap items-center gap-1.5">
                    {value.map((t, i) => (
                        <span
                            key={`${t}-${i}`}
                            className="group inline-flex items-center gap-1 rounded-full border bg-white px-2 py-1 text-xs font-bold"
                            style={{ borderColor: ekari.hair, color: ekari.text }}
                            title={`#${t}`}
                        >
                            #{t}
                            <button
                                type="button"
                                aria-label={`Remove ${t}`}
                                onClick={() => removeAt(i)}
                                className="rounded p-0.5 opacity-70 transition group-hover:opacity-100"
                                style={{ lineHeight: 0 }}
                            >
                                ×
                            </button>
                        </span>
                    ))}

                    <input
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setOpen(true);
                            setActiveIdx(0);
                        }}
                        onFocus={() => setOpen(true)}
                        onBlur={() => setTimeout(() => setOpen(false), 100)} // allow clicks on popover
                        onKeyDown={onKeyDown}
                        placeholder={limitReached ? `Limit reached (${max})` : placeholder}
                        disabled={limitReached}
                        className="flex-1 bg-transparent outline-none placeholder:text-[13px] placeholder:text-gray-400 disabled:cursor-not-allowed"
                        style={{ color: ekari.text }}
                    />

                    {showCounter && (
                        <div className="ml-auto pl-2 text-[11px]" style={{ color: ekari.dim || DEFAULT_THEME.dim }}>
                            {value.length}/{max}
                        </div>
                    )}
                </div>
            </div>

            {/* Suggestions popover */}
            {open &&
                (suggestions.length > 0 || (!q && (recent.length > 0 || trending.length > 0))) && (
                    <div
                        className="relative"
                        onMouseDown={(e) => {
                            // keep focus so Enter works after click
                            e.preventDefault();
                        }}
                    >
                        <div
                            className="absolute z-20 mt-2 w-full rounded-xl border bg-white shadow-xl"
                            style={{ borderColor: ekari.hair }}
                            role="listbox"
                            aria-activedescendant={`opt-${activeIdx}`}
                        >
                            {/* Groups when no query */}
                            {!q && (
                                <>
                                    <SuggestGroup
                                        title="Recent"
                                        items={recent.filter((t) => !already.has(normalizeTag(t))).slice(0, 10)}
                                        onPick={commit}
                                        ekari={ekari}
                                        disabled={limitReached}
                                    />
                                    <SuggestGroup
                                        title="Trending"
                                        items={Array.from(new Set(trending.map((t) => normalizeTag(t))))
                                            .filter((t) => !already.has(t))
                                            .slice(0, 20)}
                                        onPick={commit}
                                        ekari={ekari}
                                        trendingMeta={trendingMeta}
                                        disabled={limitReached}
                                    />
                                </>
                            )}

                            {/* Flat list when typing */}
                            {q && suggestions.length > 0 && (
                                <ul className="max-h-64 overflow-auto py-1">
                                    {suggestions.map((s, idx) => {
                                        const meta = trendingMeta?.[s];
                                        const hot = meta && (meta.delta ?? 0) > 0;
                                        return (
                                            <li
                                                id={`opt-${idx}`}
                                                key={s}
                                                role="option"
                                                aria-selected={idx === activeIdx}
                                                className={[
                                                    "flex cursor-pointer items-center justify-between px-3 py-2 text-sm",
                                                    idx === activeIdx ? "bg-gray-100" : "hover:bg-gray-50",
                                                ].join(" ")}
                                                onMouseEnter={() => setActiveIdx(idx)}
                                                onClick={() => commit(s)}
                                            >
                                                <span className="truncate">#{s}</span>
                                                <div className="flex items-center gap-2">
                                                    {hot && (
                                                        <span className="text-[10px] text-emerald-600" title="Trending up">
                                                            ↑
                                                        </span>
                                                    )}
                                                    <span
                                                        className="text-[11px]"
                                                        style={{ color: ekari.dim || DEFAULT_THEME.dim }}
                                                    >
                                                        Add
                                                    </span>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

            {/* Helper */}
            <div className="mt-1 text-[11px]" style={{ color: ekari.dim || DEFAULT_THEME.dim }}>
                Press <b>Enter</b> to add · Use <b>↑/↓</b> to navigate suggestions
            </div>
        </div>
    );
}

/* ---------- Suggestion group with optional trending "↑" badge ---------- */
function SuggestGroup({
    title,
    items,
    onPick,
    ekari,
    trendingMeta,
    disabled = false,
}: {
    title: string;
    items: string[];
    onPick: (t: string) => void;
    ekari: EkariTheme;
    trendingMeta?: Record<string, { count: number; delta?: number }>;
    disabled?: boolean;
}) {
    if (items.length === 0) return null;
    return (
        <div className="border-b last:border-none" style={{ borderColor: ekari.hair }}>
            <div
                className="px-3 pt-2 text-[11px] font-bold uppercase tracking-wider"
                style={{ color: ekari.dim || DEFAULT_THEME.dim }}
            >
                {title}
            </div>
            <div className="flex flex-wrap gap-2 px-3 py-2">
                {items.map((t) => {
                    const n = normalizeTag(t);
                    const meta = trendingMeta?.[n];
                    const hot = meta && (meta.delta ?? 0) > 0;
                    return (
                        <button
                            key={n}
                            onClick={() => onPick(n)}
                            disabled={disabled}
                            className={[
                                "rounded-full border bg-white px-2 py-1 text-xs font-bold",
                                disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-50",
                            ].join(" ")}
                            style={{ borderColor: ekari.hair, color: ekari.text }}
                            title={`#${n}`}
                        >
                            #{n}
                            {hot && <span className="ml-1 text-[10px] text-emerald-600">↑</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
