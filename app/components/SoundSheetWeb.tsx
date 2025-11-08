"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { collection, getDocs, getFirestore } from "firebase/firestore";
import Image from "next/image";

export type Tab = "library" | "upload" | "link";

export type PickedSound = {
    title?: string;
    artist?: string;
    source: "library" | "uploaded" | "external";
    soundId?: string;     // for library item
    url?: string;         // library/link (web will stream from here; server will fetch)
    file?: File | null;   // upload tab result (caller will upload to Storage)
};

type SoundDoc = {
    id: string;
    title: string;
    artist?: string;
    url: string;
    thumbnailUrl?: string;
    durationSec?: number;
};

const DUMMY_SOUNDS: SoundDoc[] = [
    {
        id: "dummy-1",
        title: "City Lights",
        artist: "Helix",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    },
    {
        id: "dummy-2",
        title: "Night Pulse",
        artist: "Chromatix",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    },
];

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    hair: "#E5E7EB",
    text: "#0F172A",
    dim: "#6B7280",
};

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
    const [link, setLink] = useState("");

    // library state
    const [loading, setLoading] = useState(false);
    const [library, setLibrary] = useState<SoundDoc[]>([]);
    const [filter, setFilter] = useState("");

    // audio preview (HTMLAudioElement)
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
                            thumbnailUrl: data.thumbnailUrl ? String(data.thumbnailUrl) : undefined,
                            durationSec: typeof data.durationSec === "number" ? data.durationSec : undefined,
                        };
                    })
                    .filter((r) => r.url);
                if (!cancelled) setLibrary(rows.length ? rows : DUMMY_SOUNDS);
            } catch {
                if (!cancelled) setLibrary(DUMMY_SOUNDS);
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
                audioRef.current.src = "";
            }
        } catch { }
        audioRef.current = null;
        setPlayingId(null);
        setPreviewLoading(false);
    }

    async function togglePreview(item: SoundDoc) {
        if (playingId === item.id) {
            stopPreview();
            return;
        }
        try {
            setPreviewLoading(true);
            stopPreview();
            const a = new Audio();
            a.preload = "none";
            a.src = item.url;
            a.volume = 1.0;
            a.oncanplay = () => {
                a.play().catch(() => { });
                setPreviewLoading(false);
            };
            a.onended = () => stopPreview();
            a.onerror = () => stopPreview();
            audioRef.current = a;
            setPlayingId(item.id);
        } catch {
            stopPreview();
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
            });
            onClose();
        },
        [onPick, onClose]
    );

    const onUploadFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        stopPreview();
        onPick({
            source: "uploaded",
            file: f,
            title: f.name.replace(/\.[^.]+$/, "") || "Upload",
        });
        onClose();
    };

    const useLink = () => {
        const val = link.trim();
        if (!/^https?:\/\//i.test(val)) return;
        stopPreview();
        onPick({ source: "external", url: val });
        onClose();
    };

    const closeAll = () => {
        stopPreview();
        onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[1000]">
            {/* backdrop */}
            <button
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={closeAll}
                aria-label="Close sound sheet"
            />
            {/* sheet */}
            <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-2xl rounded-t-2xl bg-white shadow-2xl">
                <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-gray-300" />
                <div className="p-4">
                    <div className="text-base font-extrabold text-gray-900">Use Sound</div>

                    {/* tabs */}
                    <div className="mt-3 grid grid-cols-3 rounded-xl border" style={{ borderColor: EKARI.hair }}>
                        {(["library", "upload", "link"] as Tab[]).map((t) => {
                            const active = tab === t;
                            return (
                                <button
                                    key={t}
                                    onClick={() => {
                                        stopPreview();
                                        setTab(t);
                                    }}
                                    className={`py-2 text-sm font-bold transition ${active ? "bg-white text-gray-900" : "bg-[#F7F7FA] text-gray-500 hover:text-gray-700"
                                        }`}
                                >
                                    {t[0].toUpperCase() + t.slice(1)}
                                </button>
                            );
                        })}
                    </div>

                    {/* LIBRARY */}
                    {tab === "library" && (
                        <div className="mt-4">
                            <input
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                placeholder="Search title or artist"
                                className="w-full rounded-xl border bg-[#F6F7FB] px-3 py-2 text-sm outline-none"
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                            />
                            {loading ? (
                                <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
                                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
                                    Loading sounds…
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="py-8 text-center text-sm text-gray-500">No sounds found.</div>
                            ) : (
                                <div className="mt-3 max-h-[50vh] overflow-y-auto">
                                    {filtered.map((it) => {
                                        const isPlaying = playingId === it.id;
                                        return (
                                            <div
                                                key={it.id}
                                                className="flex items-center gap-3 border-b py-2"
                                                style={{ borderColor: "#F3F4F6" }}
                                            >
                                                <div className="h-10 w-10 overflow-hidden rounded-lg bg-gray-100">
                                                    {it.thumbnailUrl ? (
                                                        <Image
                                                            src={it.thumbnailUrl}
                                                            alt={it.title}
                                                            width={40}
                                                            height={40}
                                                            className="h-10 w-10 object-cover"
                                                            unoptimized
                                                        />
                                                    ) : (
                                                        <div className="grid h-10 w-10 place-items-center text-gray-400">♪</div>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-sm font-extrabold text-gray-900">{it.title}</div>
                                                    <div className="truncate text-xs text-gray-500">{it.artist || "Unknown"}</div>
                                                </div>
                                                <button
                                                    onClick={() => togglePreview(it)}
                                                    className="rounded-lg border px-2 py-1 text-sm font-bold"
                                                    style={{ borderColor: EKARI.hair }}
                                                    title="Preview"
                                                >
                                                    {previewLoading && isPlaying ? "…" : isPlaying ? "Pause" : "Play"}
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

                            <div className="mt-3">
                                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold" style={{ borderColor: EKARI.hair }}>
                                    <input type="file" accept="audio/*,video/*" className="hidden" onChange={onUploadFile} />
                                    <span>Choose from device</span>
                                </label>
                                <div className="mt-2 text-xs text-gray-500">
                                    Tip: click a row to select. Use “Play” to preview.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* UPLOAD */}
                    {tab === "upload" && (
                        <div className="mt-4">
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold" style={{ borderColor: EKARI.hair }}>
                                <input type="file" accept="audio/*,video/*" className="hidden" onChange={onUploadFile} />
                                <span>Pick a file to upload</span>
                            </label>
                            <div className="mt-2 text-xs text-gray-500">
                                Audio or video are supported (server will use the audio track).
                            </div>
                        </div>
                    )}

                    {/* LINK */}
                    {tab === "link" && (
                        <div className="mt-4">
                            <input
                                value={link}
                                onChange={(e) => setLink(e.target.value)}
                                placeholder="https://example.com/song.mp3 or video.mp4"
                                className="w-full rounded-xl border bg-[#F6F7FB] px-3 py-2 text-sm outline-none"
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                            />
                            <button
                                onClick={useLink}
                                className="mt-3 w-full rounded-xl border px-3 py-2 text-sm font-extrabold"
                                style={{ borderColor: EKARI.hair }}
                            >
                                Use link
                            </button>
                        </div>
                    )}

                    {/* footer */}
                    <div className="mt-4 flex justify-center">
                        <button
                            onClick={closeAll}
                            className="rounded-xl px-4 py-2 text-sm font-extrabold text-white"
                            style={{ backgroundColor: EKARI.forest }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
