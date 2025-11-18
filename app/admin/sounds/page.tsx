// app/admin/sounds/page.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import {
    collection,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    deleteDoc,
} from "firebase/firestore";
import {
    getAuth,
    onIdTokenChanged,
    User as FirebaseUser,
} from "firebase/auth";
import {
    getStorage,
    ref as sRef,
    uploadBytes,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject,
} from "firebase/storage";

import { db } from "@/lib/firebase";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
};

const MAX_AUDIO_MB = 15;
const MAX_AUDIO_BYTES = MAX_AUDIO_MB * 1024 * 1024;

type AdminSoundDoc = {
    id: string;
    title: string;
    artist?: string;
    url: string;
    thumbnailUrl?: string;
    coverUrl?: string;
    coverStoragePath?: string;
    durationSec?: number;
    status?: "approved" | "pending" | "disabled" | string;
    storagePath?: string;
    license?: string;
    mood?: string;
    recommendedMaxUseSec?: number;
    createdAt?: any;
};

const MOOD_OPTIONS = [
    { value: "", label: "None" },
    { value: "calm", label: "Calm / chill" },
    { value: "energetic", label: "Energetic / hype" },
    { value: "educational", label: "Educational" },
    { value: "inspirational", label: "Inspirational" },
    { value: "ambient", label: "Ambient / background" },
    { value: "dramatic", label: "Dramatic" },
];

function fmtDuration(sec?: number) {
    if (!sec || !Number.isFinite(sec)) return "—";
    const total = Math.round(sec);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmtDate(ts: any) {
    if (!ts) return "";
    if (ts.toDate) {
        const d = ts.toDate();
        return d.toLocaleString();
    }
    return String(ts);
}

// Helper: get duration from uploaded file (in seconds)
function getFileDuration(file: File): Promise<number | null> {
    return new Promise((resolve) => {
        try {
            const audio = document.createElement("audio");
            audio.preload = "metadata";
            audio.src = URL.createObjectURL(file);
            audio.onloadedmetadata = () => {
                const d = audio.duration;
                URL.revokeObjectURL(audio.src);
                resolve(Number.isFinite(d) ? Math.round(d) : null);
            };
            audio.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
}

export default function AdminSoundsPage() {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);

    const [sounds, setSounds] = useState<AdminSoundDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);

    const [newTitle, setNewTitle] = useState("");
    const [newArtist, setNewArtist] = useState("");
    const [newLicense, setNewLicense] = useState("");
    const [newMood, setNewMood] = useState<string>("");
    const [newMaxUseSec, setNewMaxUseSec] = useState<string>("60");
    const [newFile, setNewFile] = useState<File | null>(null);
    const [newCoverFile, setNewCoverFile] = useState<File | null>(null);
    const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Preview audio (in-browser player, shared for all rows)
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [previewId, setPreviewId] = useState<string | null>(null);
    const [previewBusy, setPreviewBusy] = useState(false);

    // --- Admin guard from custom claims ---
    useEffect(() => {
        const auth = getAuth();
        const unsub = onIdTokenChanged(auth, async (u) => {
            setUser(u || null);
            if (!u) {
                setIsAdmin(false);
                setCheckingAuth(false);
                return;
            }
            try {
                const token = await u.getIdTokenResult();
                setIsAdmin(!!token.claims.admin);
            } catch {
                setIsAdmin(false);
            } finally {
                setCheckingAuth(false);
            }
        });
        return () => unsub();
    }, []);

    // --- Load sounds from Firestore ---
    useEffect(() => {
        if (!isAdmin) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const base = query(
                    collection(db, "sounds"),
                    orderBy("createdAt", "desc")
                );
                const snap = await getDocs(base);
                if (cancelled) return;
                const rows: AdminSoundDoc[] = snap.docs.map((d) => {
                    const data = d.data() as any;
                    return {
                        id: d.id,
                        title: String(data.title || "Untitled"),
                        artist: data.artist ? String(data.artist) : undefined,
                        url: String(data.url || ""),
                        thumbnailUrl: data.thumbnailUrl || undefined,
                        coverUrl: data.coverUrl || undefined,
                        coverStoragePath: data.coverStoragePath || undefined,
                        durationSec:
                            typeof data.durationSec === "number"
                                ? data.durationSec
                                : undefined,
                        status: data.status || "approved",
                        storagePath: data.storagePath || undefined,
                        license: data.license || undefined,
                        mood: data.mood || undefined,
                        recommendedMaxUseSec:
                            typeof data.recommendedMaxUseSec === "number"
                                ? data.recommendedMaxUseSec
                                : undefined,
                        createdAt: data.createdAt,
                    };
                });
                setSounds(rows);
            } catch (err) {
                console.error("AdminSounds: load error", err);
                setSounds([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isAdmin]);

    const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
        const f = e.target.files?.[0] || null;
        if (!f) {
            setNewFile(null);
            return;
        }

        // client-side size guard
        if (f.size > MAX_AUDIO_BYTES) {
            alert(
                `Audio is too large. Max allowed is ${MAX_AUDIO_MB}MB. Your file is ~${(
                    f.size /
                    (1024 * 1024)
                ).toFixed(1)}MB.`
            );
            e.target.value = "";
            setNewFile(null);
            return;
        }

        setNewFile(f);
    };

    const onCoverChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
        const f = e.target.files?.[0] || null;
        if (!f) {
            setNewCoverFile(null);
            if (coverPreviewUrl) {
                URL.revokeObjectURL(coverPreviewUrl);
            }
            setCoverPreviewUrl(null);
            return;
        }

        setNewCoverFile(f);

        // small local preview
        if (coverPreviewUrl) {
            URL.revokeObjectURL(coverPreviewUrl);
        }
        const url = URL.createObjectURL(f);
        setCoverPreviewUrl(url);
    };

    const resetForm = () => {
        setNewTitle("");
        setNewArtist("");
        setNewLicense("");
        setNewMood("");
        setNewMaxUseSec("60");
        setNewFile(null);
        setNewCoverFile(null);
        setUploadProgress(0);

        if (coverPreviewUrl) {
            URL.revokeObjectURL(coverPreviewUrl);
        }
        setCoverPreviewUrl(null);
    };

    const createSound = async () => {
        if (!newFile) {
            alert("Please pick an audio file.");
            return;
        }
        if (!newTitle.trim()) {
            alert("Please enter a title.");
            return;
        }
        if (!user) {
            alert("Not signed in.");
            return;
        }

        let parsedMax: number | null = null;
        if (newMaxUseSec.trim()) {
            const n = Number(newMaxUseSec.trim());
            if (!Number.isFinite(n) || n <= 0) {
                alert("Recommended max seconds must be a positive number.");
                return;
            }
            parsedMax = Math.round(n);
        }

        try {
            setCreating(true);
            setUploadProgress(0);

            const storage = getStorage();
            const colRef = collection(db, "sounds");
            const soundDocRef = doc(colRef);
            const safeName = encodeURIComponent(newFile.name);
            const storagePath = `sounds/${soundDocRef.id}/${safeName}`;

            // 1) Upload audio with progress
            const fileRef = sRef(storage, storagePath);
            const uploadTask = uploadBytesResumable(fileRef, newFile);

            const url: string = await new Promise((resolve, reject) => {
                uploadTask.on(
                    "state_changed",
                    (snapshot) => {
                        if (snapshot.totalBytes > 0) {
                            const pct =
                                (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            setUploadProgress(Math.round(pct));
                        }
                    },
                    (error) => {
                        reject(error);
                    },
                    async () => {
                        try {
                            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                            setUploadProgress(100);
                            resolve(downloadUrl);
                        } catch (err) {
                            reject(err);
                        }
                    }
                );
            });

            // 2) Upload cover image (optional)
            let coverUrl: string | null = null;
            let coverStoragePath: string | null = null;

            if (newCoverFile) {
                const coverSafeName = encodeURIComponent(newCoverFile.name);
                coverStoragePath = `sounds/${soundDocRef.id}/cover-${coverSafeName}`;
                const coverRef = sRef(storage, coverStoragePath);
                await uploadBytes(coverRef, newCoverFile);
                coverUrl = await getDownloadURL(coverRef);
            }

            // 3) Get duration (best-effort)
            const durationSec = await getFileDuration(newFile);

            // 4) Save Firestore document
            await setDoc(soundDocRef, {
                title: newTitle.trim(),
                artist: newArtist.trim() || null,
                url,
                storagePath,
                coverUrl: coverUrl || null,
                coverStoragePath: coverStoragePath || null,
                durationSec: durationSec ?? null,
                license: newLicense.trim() || null,
                status: "approved",
                mood: newMood || null,
                recommendedMaxUseSec: parsedMax ?? null,
                createdAt: serverTimestamp(),
                createdBy: user.uid,
            });

            // 5) Refresh list locally
            setSounds((prev) => [
                {
                    id: soundDocRef.id,
                    title: newTitle.trim(),
                    artist: newArtist.trim() || undefined,
                    url,
                    storagePath,
                    coverUrl: coverUrl || undefined,
                    coverStoragePath: coverStoragePath || undefined,
                    durationSec: durationSec ?? undefined,
                    license: newLicense.trim() || undefined,
                    status: "approved",
                    mood: newMood || undefined,
                    recommendedMaxUseSec: parsedMax ?? undefined,
                    createdAt: null,
                },
                ...prev,
            ]);

            resetForm();
        } catch (err: any) {
            console.error("Create sound failed", err);
            alert(err?.message || "Failed to create sound. See console.");
        } finally {
            setCreating(false);
        }
    };

    const setStatus = async (
        row: AdminSoundDoc,
        status: "approved" | "disabled" | "pending"
    ) => {
        try {
            setBusyId(row.id);
            await updateDoc(doc(db, "sounds", row.id), { status });
            setSounds((prev) =>
                prev.map((s) => (s.id === row.id ? { ...s, status } : s))
            );
        } catch (err: any) {
            console.error("Update status failed", err);
            alert(err?.message || "Failed to update status.");
        } finally {
            setBusyId(null);
        }
    };

    const removeSound = async (row: AdminSoundDoc) => {
        const ok = window.confirm(
            `Delete sound "${row.title}"? This will also remove the audio and cover files.`
        );
        if (!ok) return;

        try {
            setBusyId(row.id);
            const storage = getStorage();

            // delete audio file
            if (row.storagePath) {
                try {
                    const fileRef = sRef(storage, row.storagePath);
                    await deleteObject(fileRef);
                } catch (err) {
                    console.warn("Failed to delete sound file from Storage", err);
                }
            }

            // delete cover image
            if (row.coverStoragePath) {
                try {
                    const coverRef = sRef(storage, row.coverStoragePath);
                    await deleteObject(coverRef);
                } catch (err) {
                    console.warn("Failed to delete cover image from Storage", err);
                }
            }

            await deleteDoc(doc(db, "sounds", row.id));

            setSounds((prev) => prev.filter((s) => s.id !== row.id));
        } catch (err: any) {
            console.error("Delete sound failed", err);
            alert(err?.message || "Failed to delete sound.");
        } finally {
            setBusyId(null);
        }
    };

    // ---- Preview controls (admin table) ----
    const stopPreview = () => {
        try {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        } catch (err) {
            console.error("stopPreview error", err);
        }
        setPreviewId(null);
        setPreviewBusy(false);
    };

    const togglePreview = async (row: AdminSoundDoc) => {
        if (!row.url) return;
        const audio = audioRef.current;
        if (!audio) {
            console.warn("Audio element not ready");
            return;
        }

        // If this row is already playing → stop it
        if (previewId === row.id) {
            stopPreview();
            return;
        }

        // Stop anything else first
        stopPreview();

        try {
            setPreviewBusy(true);

            audio.src = row.url;
            audio.preload = "auto";
            audio.volume = 1.0;

            audio.onended = () => {
                setPreviewId(null);
                setPreviewBusy(false);
            };
            audio.onerror = (e) => {
                console.error("Admin preview audio error", e);
                setPreviewId(null);
                setPreviewBusy(false);
            };

            setPreviewId(row.id);
            await audio.play();
            setPreviewBusy(false);
        } catch (err) {
            console.error("Admin preview play failed", err);
            setPreviewId(null);
            setPreviewBusy(false);
        }
    };

    if (checkingAuth) {
        return (
            <div className="p-6 text-sm" style={{ color: EKARI.dim }}>
                Checking admin permissions…
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="p-6">
                <div
                    className="max-w-md rounded-2xl border bg-white p-5 shadow-sm"
                    style={{ borderColor: EKARI.hair }}
                >
                    <h1 className="text-lg font-extrabold" style={{ color: EKARI.text }}>
                        You&apos;re not an admin
                    </h1>
                    <p className="mt-2 text-sm" style={{ color: EKARI.dim }}>
                        This area is restricted. If you believe this is a mistake, contact
                        the ekarihub team.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div>
                    <h1
                        className="text-2xl md:text-3xl font-extrabold"
                        style={{ color: EKARI.text }}
                    >
                        Sound library
                    </h1>
                    <p className="text-sm md:text-base" style={{ color: EKARI.dim }}>
                        Manage copyright-safe sounds that creators can use in their deeds.
                        Only sounds uploaded and approved here will appear in the composer.
                    </p>
                </div>
            </div>

            {/* Create new sound */}
            <div
                className="rounded-2xl border bg-white p-4 shadow-sm space-y-3"
                style={{ borderColor: EKARI.hair }}
            >
                <div className="text-sm font-extrabold" style={{ color: EKARI.text }}>
                    Add new sound
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-500">
                            Title
                        </label>
                        <input
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                            placeholder="Eg. Gentle sunrise"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-500">
                            Artist / source
                        </label>
                        <input
                            value={newArtist}
                            onChange={(e) => setNewArtist(e.target.value)}
                            className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                            placeholder="Eg. Ekarihub originals"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-500">
                            License / notes
                        </label>
                        <input
                            value={newLicense}
                            onChange={(e) => setNewLicense(e.target.value)}
                            className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                            placeholder="Eg. Royalty-free, CC BY, purchased..."
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-500">
                            Mood / category
                        </label>
                        <select
                            value={newMood}
                            onChange={(e) => setNewMood(e.target.value)}
                            className="w-full rounded-xl border px-3 py-2 text-sm outline-none bg-white"
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        >
                            {MOOD_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-500">
                            Recommended max seconds per deed
                        </label>
                        <input
                            type="number"
                            min={1}
                            value={newMaxUseSec}
                            onChange={(e) => setNewMaxUseSec(e.target.value)}
                            className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                            placeholder="Eg. 60"
                        />
                        <div className="text-[10px]" style={{ color: EKARI.dim }}>
                            Used by the editor as a soft cap so single deeds stay short &
                            performant (mixing can crop to this length).
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-500">
                            Audio file (admin upload only)
                        </label>
                        <input
                            type="file"
                            accept="audio/*"
                            onChange={onFileChange}
                            className="block w-full text-xs"
                        />
                        {newFile && (
                            <div className="text-xs mt-1" style={{ color: EKARI.dim }}>
                                Selected:{" "}
                                <span className="font-semibold">{newFile.name}</span>{" "}
                                <span>
                                    ({(newFile.size / (1024 * 1024)).toFixed(1)}MB)
                                </span>
                            </div>
                        )}
                        <div className="text-[10px]" style={{ color: EKARI.dim }}>
                            Max size: {MAX_AUDIO_MB}MB. Larger files will be rejected.
                        </div>
                    </div>

                    {/* Cover image upload */}
                    <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-500">
                            Cover image / artist avatar (optional)
                        </label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={onCoverChange}
                            className="block w-full text-xs"
                        />
                        {newCoverFile && (
                            <div className="text-xs mt-1" style={{ color: EKARI.dim }}>
                                Selected cover:{" "}
                                <span className="font-semibold">{newCoverFile.name}</span>
                            </div>
                        )}
                        {coverPreviewUrl && (
                            <div className="mt-2 flex items-center gap-2">
                                <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={coverPreviewUrl}
                                        alt="Cover preview"
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                                <span className="text-[11px]" style={{ color: EKARI.dim }}>
                                    Preview
                                </span>
                            </div>
                        )}
                        <div className="text-[10px]" style={{ color: EKARI.dim }}>
                            Used as circular avatar next to the sound in the composer.
                        </div>
                    </div>
                </div>

                {/* Upload progress */}
                {creating && (
                    <div className="pt-2 w-full">
                        <div
                            className="flex items-center justify-between text-[10px]"
                            style={{ color: EKARI.dim }}
                        >
                            <span>Uploading audio…</span>
                            <span>{uploadProgress}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-150"
                                style={{
                                    width: `${uploadProgress}%`,
                                    backgroundColor: EKARI.forest,
                                }}
                            />
                        </div>
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                        onClick={createSound}
                        disabled={creating}
                        className="rounded-xl px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
                        style={{ backgroundColor: EKARI.forest }}
                    >
                        {creating ? "Saving…" : "Save & approve"}
                    </button>
                    <button
                        onClick={resetForm}
                        type="button"
                        className="rounded-xl px-4 py-2 text-sm font-bold border"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                    >
                        Clear
                    </button>
                </div>
            </div>

            {/* Sounds table */}
            <div
                className="rounded-2xl border bg-white shadow-sm overflow-hidden"
                style={{ borderColor: EKARI.hair }}
            >
                <div
                    className="px-4 py-3 border-b"
                    style={{ borderColor: EKARI.hair }}
                >
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <h2
                                className="text-sm font-extrabold"
                                style={{ color: EKARI.text }}
                            >
                                Library sounds
                            </h2>
                            <p className="text-xs" style={{ color: EKARI.dim }}>
                                Only sounds with status <strong>approved</strong> are visible in
                                the composer. You can preview them here before approving.
                            </p>
                        </div>
                        <div className="text-xs" style={{ color: EKARI.dim }}>
                            {loading
                                ? "Loading…"
                                : `${sounds.length.toLocaleString("en-KE")} sound${sounds.length === 1 ? "" : "s"
                                }`}
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500">
                                <th className="text-left px-4 py-2 font-semibold">Title</th>
                                <th className="text-left px-2 py-2 font-semibold">Artist</th>
                                <th className="text-left px-2 py-2 font-semibold">Mood</th>
                                <th className="text-left px-2 py-2 font-semibold">Duration</th>
                                <th className="text-left px-2 py-2 font-semibold">
                                    Max per deed
                                </th>
                                <th className="text-left px-2 py-2 font-semibold">Status</th>
                                <th className="text-left px-2 py-2 font-semibold">License</th>
                                <th className="text-left px-2 py-2 font-semibold">Created</th>
                                <th className="text-right px-4 py-2 font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={9}
                                        className="px-4 py-6 text-center text-gray-400"
                                    >
                                        Loading…
                                    </td>
                                </tr>
                            ) : sounds.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={9}
                                        className="px-4 py-6 text-center text-gray-400"
                                    >
                                        No sounds in the library yet.
                                    </td>
                                </tr>
                            ) : (
                                sounds.map((s) => {
                                    const status = (s.status || "approved").toLowerCase();
                                    const badgeColor =
                                        status === "approved"
                                            ? "bg-emerald-50 text-emerald-800"
                                            : status === "disabled"
                                                ? "bg-gray-100 text-gray-700"
                                                : "bg-amber-50 text-amber-800";
                                    const label =
                                        status === "approved"
                                            ? "Approved"
                                            : status === "disabled"
                                                ? "Disabled"
                                                : "Pending";

                                    const moodLabel =
                                        MOOD_OPTIONS.find((m) => m.value === s.mood)?.label ||
                                        "—";

                                    const maxSec = s.recommendedMaxUseSec;
                                    const overLimit =
                                        maxSec && s.durationSec && s.durationSec > maxSec;

                                    return (
                                        <tr
                                            key={s.id}
                                            className="border-t text-gray-700"
                                            style={{ borderColor: EKARI.hair }}
                                        >
                                            <td className="px-4 py-2">
                                                <div className="flex items-center gap-2">
                                                    {s.coverUrl && (
                                                        <div className="h-7 w-7 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img
                                                                src={s.coverUrl}
                                                                alt={s.title}
                                                                className="h-full w-full object-cover"
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <div className="font-extrabold text-[11px] truncate">
                                                            {s.title}
                                                        </div>
                                                        <div className="font-mono text-[10px] text-gray-400 truncate">
                                                            {s.id}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-2 py-2 text-[11px] text-gray-600">
                                                {s.artist || "—"}
                                            </td>
                                            <td className="px-2 py-2 text-[11px] text-gray-600">
                                                {moodLabel}
                                            </td>
                                            <td className="px-2 py-2 text-[11px] text-gray-600">
                                                {fmtDuration(s.durationSec)}
                                            </td>
                                            <td className="px-2 py-2 text-[11px]">
                                                {maxSec ? (
                                                    <span
                                                        className={
                                                            overLimit
                                                                ? "text-rose-600 font-semibold"
                                                                : "text-gray-700"
                                                        }
                                                    >
                                                        {maxSec}s{" "}
                                                        {overLimit && (
                                                            <span className="ml-1 text-[10px]">
                                                                (clip to keep snappy)
                                                            </span>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-2 py-2">
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeColor}`}
                                                >
                                                    {label}
                                                </span>
                                            </td>
                                            <td className="px-2 py-2 text-[11px] text-gray-600">
                                                {s.license || "—"}
                                            </td>
                                            <td className="px-2 py-2 text-[11px] text-gray-500">
                                                {fmtDate(s.createdAt)}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                <div className="inline-flex flex-wrap gap-1 justify-end">
                                                    {/* Preview */}
                                                    <button
                                                        type="button"
                                                        disabled={!s.url}
                                                        onClick={() => togglePreview(s)}
                                                        className="rounded-full px-2 py-1 text-[10px] font-bold border disabled:opacity-40"
                                                        style={{
                                                            borderColor: EKARI.hair,
                                                            color:
                                                                previewId === s.id
                                                                    ? EKARI.gold
                                                                    : EKARI.text,
                                                        }}
                                                    >
                                                        {previewBusy && previewId === s.id
                                                            ? "…"
                                                            : previewId === s.id
                                                                ? "Pause"
                                                                : "Play"}
                                                    </button>

                                                    {/* Approve */}
                                                    <button
                                                        disabled={
                                                            busyId === s.id ||
                                                            s.status === "approved"
                                                        }
                                                        onClick={() => setStatus(s, "approved")}
                                                        className="rounded-full px-2 py-1 text-[10px] font-bold border disabled:opacity-40"
                                                        style={{
                                                            borderColor: EKARI.hair,
                                                            color: EKARI.forest,
                                                        }}
                                                    >
                                                        Approve
                                                    </button>

                                                    {/* Disable */}
                                                    <button
                                                        disabled={
                                                            busyId === s.id ||
                                                            s.status === "disabled"
                                                        }
                                                        onClick={() => setStatus(s, "disabled")}
                                                        className="rounded-full px-2 py-1 text-[10px] font-bold border disabled:opacity-40"
                                                        style={{
                                                            borderColor: EKARI.hair,
                                                            color: "#6B7280",
                                                        }}
                                                    >
                                                        Disable
                                                    </button>

                                                    {/* Delete */}
                                                    <button
                                                        disabled={busyId === s.id}
                                                        onClick={() => removeSound(s)}
                                                        className="rounded-full px-2 py-1 text-[10px] font-bold border disabled:opacity-40"
                                                        style={{
                                                            borderColor: "#FCA5A5",
                                                            color: "#B91C1C",
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Hidden audio element for admin preview */}
            <audio ref={audioRef} className="hidden" />
        </div>
    );
}
