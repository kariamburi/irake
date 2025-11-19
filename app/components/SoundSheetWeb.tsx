// app/components/SoundSheetWeb.tsx (or wherever you keep it)
"use client";

import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
    useCallback,
} from "react";
import { collection, getDocs, getFirestore } from "firebase/firestore";
import Image from "next/image";

export type Tab = "library" | "upload" | "link";

export type PickedSound = {
    title?: string;
    artist?: string;
    source: "library" | "uploaded" | "external";
    soundId?: string;
    url?: string;
    file?: File | null;
    coverUrl?: string;
    thumbnailUrl?: string;
};

type SoundDoc = {
    id: string;
    title: string;
    artist?: string;
    url: string;
    thumbnailUrl?: string;
    coverUrl?: string;
    durationSec?: number;
    status?: string;
    mood?: string;
    recommendedMaxUseSec?: number;
};

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    hair: "#E5E7EB",
    text: "#0F172A",
    dim: "#6B7280",
};

const MOOD_LABEL: Record<string, string> = {
    calm: "Calm",
    energetic: "Energetic",
    educational: "Educational",
    inspirational: "Inspirational",
    ambient: "Ambient",
    dramatic: "Dramatic",
};

function fmtDuration(sec?: number) {
    if (!sec || !Number.isFinite(sec)) return "—";
    const total = Math.round(sec);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SoundSheetWeb({
    open,
    onClose,
    onPick,
}: {
    open: boolean;
    onClose: () => void;
    onPick: (sound: PickedSound) => void;
}) {
    const [tab, setTab] = useState<Tab>("library");

    const [loading, setLoading] = useState(false);
    const [library, setLibrary] = useState<SoundDoc[]>([]);
    const [filter, setFilter] = useState("");

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    // fetch sounds when opened
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const db = getFirestore();
                const snap = await getDocs(collection(db, "sounds"));
                const rows: SoundDoc[] = snap.docs
                    .map((d) => {
                        const data = d.data() as any;
                        return {
                            id: d.id,
                            title: String(data.title || "Untitled"),
                            artist: data.artist ? String(data.artist) : undefined,
                            url: String(data.url || ""),
                            thumbnailUrl: data.thumbnailUrl
                                ? String(data.thumbnailUrl)
                                : undefined,
                            coverUrl: data.coverUrl
                                ? String(data.coverUrl)
                                : data.thumbnailUrl
                                    ? String(data.thumbnailUrl)
                                    : undefined, // fallback to thumbnail if needed
                            durationSec:
                                typeof data.durationSec === "number"
                                    ? data.durationSec
                                    : undefined,
                            status: data.status,
                            mood: data.mood || undefined,
                            recommendedMaxUseSec:
                                typeof data.recommendedMaxUseSec === "number"
                                    ? data.recommendedMaxUseSec
                                    : undefined,
                        };
                    })
                    .filter((r) => r.url);
                // Firestore rules already restrict non-admins to approved sounds only
                if (!cancelled) setLibrary(rows);
            } catch (err) {
                console.error("SoundSheetWeb: load sounds error", err);
                if (!cancelled) setLibrary([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open]);

    // stop audio on close/unmount
    useEffect(() => {
        if (!open) stopPreview();
        return () => stopPreview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const filtered = useMemo(() => {
        const f = filter.trim().toLowerCase();
        if (!f) return library;
        return library.filter(
            (s) =>
                s.title.toLowerCase().includes(f) ||
                (s.artist || "").toLowerCase().includes(f)
        );
    }, [library, filter]);

    function stopPreview() {
        try {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        } catch (err) {
            console.error("stopPreview error", err);
        }
        setPlayingId(null);
        setPreviewLoading(false);
    }

    async function togglePreview(item: SoundDoc) {
        if (!item.url) return;
        const audio = audioRef.current;
        if (!audio) {
            console.warn("Audio element not ready");
            return;
        }

        // If this sound is currently playing → stop it
        if (playingId === item.id) {
            stopPreview();
            return;
        }

        // Stop any existing track first
        stopPreview();

        try {
            setPreviewLoading(true);

            audio.src = item.url;
            audio.preload = "auto";
            audio.volume = 1.0;

            audio.onended = () => {
                setPlayingId(null);
                setPreviewLoading(false);
            };
            audio.onerror = (e) => {
                console.error("Audio preview error", e);
                setPlayingId(null);
                setPreviewLoading(false);
            };

            setPlayingId(item.id);
            console.log("Trying to play:", item.url);
            await audio.play();
            setPreviewLoading(false);
        } catch (err) {
            console.error("Play failed", err);
            setPlayingId(null);
            setPreviewLoading(false);
        }
    }

    const selectLibrary = useCallback(
        (it: SoundDoc) => {
            stopPreview();
            onPick({
                source: "library",
                soundId: it.id,
                url: it.url,
                title: it.title,
                artist: it.artist,
                coverUrl: it.coverUrl,
                thumbnailUrl: it.thumbnailUrl,
            });
            onClose();
        },
        [onPick, onClose]
    );

    const closeAll = () => {
        stopPreview();
        onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-end md:items-center justify-center">
            {/* backdrop */}
            <button
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={closeAll}
                aria-label="Close sound sheet"
            />

            {/* sheet / centered modal */}
            <div className="relative w-full max-w-2xl px-3 pb-3 md:px-0 md:pb-0">
                <div
                    className="
                        w-full max-h-[80vh]
                        rounded-t-2xl md:rounded-2xl
                        bg-white shadow-2xl
                        overflow-hidden flex flex-col
                        transition-transform duration-200 ease-out
                    "
                >
                    {/* drag handle (mobile feel) */}
                    <div className="mt-2 mb-1 flex justify-center md:hidden">
                        <div className="h-1.5 w-12 rounded-full bg-gray-300" />
                    </div>

                    <div className="p-4 pt-2 md:pt-4 flex-1 flex flex-col">
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-base font-extrabold text-gray-900">
                                Use Sound
                            </div>
                            <button
                                onClick={closeAll}
                                className="hidden md:inline-flex items-center justify-center rounded-full border px-2 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-50"
                                style={{ borderColor: EKARI.hair }}
                            >
                                Close
                            </button>
                        </div>

                        {/* tabs: library only */}
                        <div
                            className="mt-3 grid grid-cols-1 rounded-xl border"
                            style={{ borderColor: EKARI.hair }}
                        >
                            <button
                                onClick={() => {
                                    stopPreview();
                                    setTab("library");
                                }}
                                className={`py-2 text-sm font-bold transition ${tab === "library"
                                    ? "bg-white text-gray-900"
                                    : "bg-[#F7F7FA] text-gray-500 hover:text-gray-700"
                                    }`}
                            >
                                Library
                            </button>
                        </div>

                        {/* LIBRARY */}
                        {tab === "library" && (
                            <div className="mt-4 flex-1 flex flex-col">
                                <input
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    placeholder="Search title or artist"
                                    className="w-full rounded-xl border bg-[#F6F7FB] px-3 py-2 text-sm outline-none"
                                    style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                />
                                {loading ? (
                                    <div className="flex-1 flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
                                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
                                        Loading sounds…
                                    </div>
                                ) : filtered.length === 0 ? (
                                    <div className="flex-1 flex items-center justify-center py-8 text-center text-sm text-gray-500">
                                        No sounds available yet. Please ask ekarihub admin to add
                                        some to the library.
                                    </div>
                                ) : (
                                    <div className="mt-3 max-h-[50vh] md:max-h-[55vh] overflow-y-auto">
                                        {filtered.map((it) => {
                                            const isPlaying = playingId === it.id;
                                            const moodLabel =
                                                it.mood && MOOD_LABEL[it.mood]
                                                    ? MOOD_LABEL[it.mood]
                                                    : null;
                                            const overLimit =
                                                it.recommendedMaxUseSec &&
                                                it.durationSec &&
                                                it.durationSec >
                                                it.recommendedMaxUseSec;

                                            const imgSrc = it.coverUrl || it.thumbnailUrl;

                                            return (
                                                <div
                                                    key={it.id}
                                                    className="flex items-center gap-3 border-b py-2"
                                                    style={{ borderColor: "#F3F4F6" }}
                                                >
                                                    {/* Artist avatar / cover */}
                                                    <div className="h-10 w-10 md:h-11 md:w-11 overflow-hidden rounded-full bg-gray-100 flex-shrink-0">
                                                        {imgSrc ? (
                                                            <Image
                                                                src={imgSrc}
                                                                alt={it.title}
                                                                width={44}
                                                                height={44}
                                                                className="h-full w-full object-cover"
                                                                unoptimized
                                                            />
                                                        ) : (
                                                            <div className="grid h-full w-full place-items-center text-gray-400 text-lg">
                                                                ♪
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate text-sm font-extrabold text-gray-900">
                                                            {it.title}
                                                        </div>
                                                        <div className="truncate text-[11px] text-gray-500 flex flex-wrap gap-1">
                                                            <span>{it.artist || "Unknown"}</span>
                                                            {moodLabel && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span>{moodLabel}</span>
                                                                </>
                                                            )}
                                                            {it.durationSec && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span>
                                                                        {fmtDuration(it.durationSec)}
                                                                    </span>
                                                                </>
                                                            )}
                                                            {it.recommendedMaxUseSec && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span
                                                                        className={
                                                                            overLimit
                                                                                ? "text-rose-600 font-semibold"
                                                                                : ""
                                                                        }
                                                                    >
                                                                        Use ~
                                                                        {it.recommendedMaxUseSec}
                                                                        s
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={() => togglePreview(it)}
                                                        className="rounded-lg border px-2 py-1 text-sm font-bold"
                                                        style={{ borderColor: EKARI.hair }}
                                                        title="Preview"
                                                    >
                                                        {previewLoading && isPlaying
                                                            ? "…"
                                                            : isPlaying
                                                                ? "Pause"
                                                                : "Play"}
                                                    </button>
                                                    <button
                                                        onClick={() => selectLibrary(it)}
                                                        className="rounded-lg border px-2 py-1 text-sm font-bold"
                                                        style={{ borderColor: EKARI.hair }}
                                                        title="Select"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="mt-2 text-xs text-gray-500">
                                    Only copyrighted & licensed sounds approved by ekarihub admin
                                    are shown here. Longer tracks may be clipped to keep deeds
                                    snappy.
                                </div>
                            </div>
                        )}

                        {/* footer (mobile close button) */}
                        <div className="mt-4 flex justify-center md:hidden">
                            <button
                                onClick={closeAll}
                                className="rounded-xl px-4 py-2 text-sm font-extrabold text-white"
                                style={{ backgroundColor: EKARI.forest }}
                            >
                                Close
                            </button>
                        </div>
                    </div>

                    {/* Hidden audio element for preview */}
                    <audio ref={audioRef} className="hidden" />
                </div>
            </div>
        </div>
    );
}
