"use client";

import React, {
    useState,
    useEffect,
    useCallback,
    useMemo,
    useRef,
    PropsWithChildren,
    ReactNode,
} from "react";
import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    startAfter,
    getDocs,
    where,
    DocumentData,
    QueryDocumentSnapshot,
    doc,
    setDoc,
    serverTimestamp,
    getDoc,
    getFirestore,
} from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import Image from "next/image";
import Link from "next/link";
import {
    IoAdd,
    IoChatbubblesOutline,
    IoChatbubbleEllipsesOutline,
    IoCalendarOutline,
    IoLocationOutline,
    IoSearch,
    IoCloseCircle,
    IoCompassOutline,
    IoTimeOutline,
    IoReload,
    IoClose,
    IoImageOutline,
    IoPricetagsOutline,
    IoCashOutline,
    IoHomeOutline,
    IoCartOutline,
    IoChevronForward,
    IoInformationCircleOutline,
    IoPersonCircleOutline,
    IoNotificationsOutline,
    IoMenu,
    IoSparklesOutline,
} from "react-icons/io5";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import AppShell from "@/app/components/AppShell";
import { createPortal } from "react-dom";
import { useAuth } from "@/app/hooks/useAuth";

// Hashtag picker + suggestions
import HashtagPicker from "@/app/components/HashtagPicker";
import { useInitEkariTags } from "@/app/hooks/useInitEkariTags";
import { useTrendingTags } from "@/app/hooks/useTrendingTags";
import { buildEkariTrending } from "@/utils/ekariTags";
import { usePathname } from "next/navigation";
import { useInboxTotalsWeb } from "@/hooks/useInboxTotalsWeb";
import { cacheEvent } from "@/lib/eventCache";
import { cacheDiscussion } from "@/lib/discussionCache";
import { cn } from "@/lib/utils";

/* ---------- Theme ---------- */
const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
};
type EventCategory = "Workshop" | "Fair" | "Training" | "Meetup" | "Other";
type CurrencyCode = "KES" | "USD";

type EventItem = {
    id: string;
    title: string;
    dateISO?: string;
    location?: string;
    coverUrl?: string;
    author?: any;
    authorBadge?: any;
    createdAt?: any;
    price?: number | null;
    currency?: CurrencyCode;
    registrationUrl?: string | null;
    category?: EventCategory;
    tags?: string[];
    description?: string | null;
};

/* ============================== */
/* Event Create Form (Sheet)      */
/* ============================== */
/* ---------- Hashtag helpers ---------- */
const asArray = (v: unknown): string[] => {
    if (!v) return [];
    if (Array.isArray(v))
        return v.map(String).map((s) => s.trim()).filter(Boolean);
    if (typeof v === "string") {
        return v
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return [];
};
/* ---------- Hashtag suggestions hook ---------- */
function useHashtagSuggestions(uid: string | null) {
    const [profile, setProfile] = useState<any | null>(null);

    useEffect(() => {
        if (!uid) {
            setProfile(null);
            return;
        }

        (async () => {
            try {
                const uRef = doc(db, "users", uid);
                const snap = await getDoc(uRef);
                setProfile(snap.exists() ? (snap.data() as any) : null);
            } catch {
                setProfile(null);
            }
        })();
    }, [uid]);

    const userRoles = asArray(profile?.roles);
    const userInterests = asArray(profile?.areaOfInterest);
    const userCountry = profile?.country || "kenya";
    const userCounty = profile?.county || undefined;

    const { list: liveTrending, meta, loading } = useTrendingTags();

    const trending = useMemo(() => {
        const base = buildEkariTrending({
            country: userCountry,
            county: userCounty,
            profile: {
                country: userCountry,
                roles: userRoles,
                areaOfInterest: userInterests,
            },
            crops: userInterests,
            limit: 800,
        });
        const merged = [...(liveTrending || []), ...base];
        return Array.from(new Set(merged));
    }, [liveTrending, userCountry, userCounty, userRoles, userInterests]);

    return {
        loading,
        trending,
        trendingMeta: meta,
    };
}
function pruneUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
    const out: any = {};
    Object.keys(obj).forEach((k) => {
        if (obj[k] !== undefined) out[k] = obj[k];
    });
    return out;
}

function buildAuthorBadge(userProfile: any) {
    const v = userProfile?.verification ?? {};

    const statusRaw = String(v.status ?? "none").toLowerCase();
    const typeRaw = String(v.verificationType ?? "individual").toLowerCase();

    const status = (["approved", "pending", "rejected", "none"] as const).includes(
        statusRaw as any
    )
        ? (statusRaw as "approved" | "pending" | "rejected" | "none")
        : "none";

    const type = (["individual", "business", "company", "organization"] as const).includes(
        typeRaw as any
    )
        ? (typeRaw as "individual" | "business" | "company" | "organization")
        : "individual";

    const roleLabel = typeof v.roleLabel === "string" && v.roleLabel.trim()
        ? v.roleLabel.trim()
        : null;

    const orgName =
        (type === "business" || type === "company" || type === "organization") &&
            typeof v.organizationName === "string" &&
            v.organizationName.trim()
            ? v.organizationName.trim()
            : null;

    return pruneUndefined({
        verificationStatus: status,
        verificationType: type,
        verificationRoleLabel: roleLabel,
        verificationOrganizationName: orgName,
    });
}

/* ============================== */
/* Banner Uploader (Pro)          */
/* ============================== */
function formatBytes(bytes: number) {
    if (!bytes && bytes !== 0) return "";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        sizes.length - 1
    );
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function BannerUploader({
    previewUrl,
    onPick,
    onRemove,
    ekari,
    accept = "image/*",
    maxSizeMB = 5,
}: {
    previewUrl: string | null;
    onPick: (file: File, objectUrl: string) => void;
    onRemove: () => void;
    ekari: typeof EKARI;
    accept?: string;
    maxSizeMB?: number;
}) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const maxBytes = maxSizeMB * 1024 * 1024;

    const choose = () => inputRef.current?.click();

    const handleFiles = (files?: FileList | null) => {
        const f = files?.[0];
        if (!f) return;
        if (!f.type.startsWith("image/")) {
            alert("Please select an image file.");
            return;
        }
        if (f.size > maxBytes) {
            alert(
                `Max file size is ${maxSizeMB}MB (you chose ${formatBytes(f.size)}).`
            );
            return;
        }
        const url = URL.createObjectURL(f);
        onPick(f, url);
    };

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
    };

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-extrabold" style={{ color: ekari.dim }}>
                    Banner image
                </div>
                <div className="text-[11px]" style={{ color: ekari.dim }}>
                    Recommended: 16:9 • ≥ 1280×720 • JPG/PNG • ≤ {maxSizeMB}MB
                </div>
            </div>

            {!previewUrl ? (
                <div
                    role="button"
                    tabIndex={0}
                    onClick={choose}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && choose()}
                    onDragEnter={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                    }}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    className={`rounded-2xl border-2 border-dashed bg-[#F9FAFB] transition
            ${dragOver
                            ? "border-[--ekari-forest] ring-2 ring-[--ekari-forest]/10"
                            : "border-gray-200"
                        }`}
                    style={{ ["--ekari-forest" as any]: ekari.forest }}
                >
                    <div className="px-5 py-8 text-center">
                        <div
                            className="mx-auto mb-3 h-12 w-12 rounded-full grid place-items-center border bg-white"
                            style={{ borderColor: ekari.hair }}
                        >
                            <IoImageOutline className="opacity-70" />
                        </div>
                        <div className="font-bold" style={{ color: ekari.text }}>
                            Add banner image
                        </div>
                        <p className="text-xs mt-1" style={{ color: ekari.dim }}>
                            Drag & drop, or click to browse
                        </p>
                        <div className="mt-4">
                            <button
                                type="button"
                                onClick={choose}
                                className="rounded-xl px-4 h-10 font-bold text-white"
                                style={{ background: ekari.forest }}
                            >
                                Choose image
                            </button>
                        </div>
                    </div>
                    <input
                        ref={inputRef}
                        type="file"
                        accept={accept}
                        hidden
                        onChange={(e) => handleFiles(e.target.files)}
                    />
                </div>
            ) : (
                <div
                    className="relative rounded-2xl overflow-hidden border bg-black aspect-[16/9]"
                    style={{ borderColor: ekari.hair }}
                >
                    {/* @ts-ignore */}
                    <Image
                        src={previewUrl}
                        alt="Event banner preview"
                        fill
                        className="object-cover"
                        unoptimized
                    />

                    <div className="absolute top-0 left-0 right-0 p-2 flex items-center justify-between bg-gradient-to-b from-black/40 to-transparent">
                        <span className="text-[11px] font-bold text-white/90 px-2 py-0.5 rounded-full bg-black/30 backdrop-blur">
                            16:9 recommended
                        </span>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 flex gap-2 justify-end bg-gradient-to-t from-black/45 to-transparent">
                        <button
                            type="button"
                            onClick={choose}
                            className="h-9 px-3 rounded-lg font-bold text-sm text-white/95 hover:text-white bg-white/10 hover:bg-white/15 backdrop-blur"
                        >
                            Change
                        </button>
                        <button
                            type="button"
                            onClick={onRemove}
                            className="h-9 px-3 rounded-lg font-bold text-sm text-white/95 hover:text-white bg-white/10 hover:bg-white/15 backdrop-blur"
                        >
                            Remove
                        </button>
                        <input
                            ref={inputRef}
                            type="file"
                            accept={accept}
                            hidden
                            onChange={(e) => handleFiles(e.target.files)}
                        />
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mt-2">
                <span className="text-[11px]" style={{ color: ekari.dim }}>
                    Tip: landscape images look best. Avoid heavy text on the banner.
                </span>
                <button
                    type="button"
                    onClick={() => alert("Coming soon: in-app cropping")}
                    className="text-[11px] font-bold underline underline-offset-2 hover:opacity-80"
                    style={{ color: ekari.text }}
                >
                    Crop?
                </button>
            </div>
        </div>
    );
}


export function EventForm({
    onDone,
    provideFooter,
}: {
    onDone: () => void;
    provideFooter: (node: ReactNode) => void;
}) {
    const { user } = useAuth();
    const uid = user?.uid || null;

    const { loading, trending, trendingMeta } = useHashtagSuggestions(uid);

    type Step = 0 | 1 | 2;
    const [step, setStep] = useState<Step>(0);

    const [saving, setSaving] = useState(false);
    const [title, setTitle] = useState("");
    const [dateISO, setDateISO] = useState("");
    const [location, setLocation] = useState("");
    const [category, setCategory] = useState<EventCategory>("Workshop");
    const [price, setPrice] = useState("");
    const [currency, setCurrency] = useState<CurrencyCode>("KES");
    const [registrationUrl, setRegistrationUrl] = useState("");
    const [description, setDescription] = useState("");

    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);

    const handlePickBanner = (file: File, url: string) => {
        if (coverPreview) URL.revokeObjectURL(coverPreview);
        setCoverFile(file);
        setCoverPreview(url);
    };
    const handleRemoveBanner = () => {
        if (coverPreview) URL.revokeObjectURL(coverPreview);
        setCoverFile(null);
        setCoverPreview(null);
    };

    const [eventTags, setEventTags] = useState<string[]>([]);

    const captionTags = useMemo(() => {
        const text = `${title}\n${description}`;
        return (text.match(/#([A-Za-z0-9_]{2,30})/g) || []).map((s) =>
            s.slice(1).toLowerCase()
        );
    }, [title, description]);

    const mergedTags = useMemo(
        () => Array.from(new Set([...eventTags.map((t) => t.toLowerCase()), ...captionTags])),
        [eventTags, captionTags]
    );

    const dateHint = useMemo(() => {
        if (!dateISO) return "";
        const d = new Date(dateISO);
        return Number.isNaN(d.getTime())
            ? ""
            : `${d.toLocaleDateString()} • ${d.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            })}`;
    }, [dateISO]);

    const [userProfile, setUserProfile] = useState<any | null>(null);
    useEffect(() => {
        if (!uid) return;
        (async () => {
            try {
                const uRef = doc(db, "users", uid);
                const uSnap = await getDoc(uRef);
                if (uSnap.exists()) {
                    const data = uSnap.data() as any;
                    setUserProfile(data);
                    const pref = data?.preferredCurrency;
                    if (pref === "USD" || pref === "KES") setCurrency(pref);
                }
            } catch { }
        })();
    }, [uid]);

    const canNextFromBasics = useMemo(() => {
        if (!title.trim()) return false;
        if (dateISO) {
            const d = new Date(dateISO);
            if (Number.isNaN(d.getTime())) return false;
            if (Date.now() > d.getTime()) return false;
        }
        return true;
    }, [title, dateISO]);

    const canNextFromTags = mergedTags.length > 0;

    const save = useCallback(async () => {
        if (!uid) {
            alert("Please sign in to create an event.");
            return;
        }
        if (!title.trim()) {
            alert("Title is required");
            return;
        }

        try {
            setSaving(true);
            const refDoc = doc(collection(db, "events"));
            let coverUrl: string | null = null;

            if (coverFile) {
                const storageRef = sRef(storage, `events/${uid}/${refDoc.id}/cover.jpg`);
                await uploadBytes(storageRef, coverFile, {
                    contentType: coverFile.type || "image/jpeg",
                });
                coverUrl = await getDownloadURL(storageRef);
            }

            const priceNum =
                price && /[0-9]/.test(price)
                    ? Number(price.replace(/[^\d.]/g, ""))
                    : null;
            const badge = buildAuthorBadge(userProfile);
            await setDoc(refDoc, {
                title: title.trim(),
                dateISO: dateISO || null,
                location: location || null,
                coverUrl,
                organizerId: uid,
                author: {
                    id: uid,
                    name: userProfile?.firstName + " " + userProfile?.surname,
                    handle: userProfile?.handle ?? null,
                    photoURL: userProfile?.photoURL ?? null,
                },
                authorBadge: badge,
                createdAt: serverTimestamp(),
                price: priceNum,
                currency: priceNum ? currency : null,
                registrationUrl: registrationUrl || null,
                category,
                tags: mergedTags,
                description: description.trim() || null,
                visibility: "public",
            });

            setSaving(false);
            onDone();
        } catch (e: any) {
            console.error(e);
            setSaving(false);
            alert(`Failed to create event: ${e?.message || "Try again"}`);
        }
    }, [
        uid,
        title,
        dateISO,
        location,
        coverFile,
        price,
        currency,
        registrationUrl,
        category,
        mergedTags,
        description,
        onDone,
    ]);

    const totalSteps = 3;
    const nextStep: Record<Step, Step> = { 0: 1, 1: 2, 2: 2 };
    const prevStep: Record<Step, Step> = { 0: 0, 1: 0, 2: 1 };
    const goNext = () => setStep((s) => nextStep[s]);
    const goBack = () => setStep((s) => prevStep[s]);

    useEffect(() => {
        if (step === 0) {
            provideFooter(
                <div className="flex gap-2">
                    <button
                        onClick={onDone}
                        className="h-11 px-4 rounded-xl border font-bold bg-white flex-1"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={goNext}
                        disabled={!canNextFromBasics}
                        className="h-11 px-4 rounded-xl font-bold text-white disabled:opacity-60 flex-1"
                        style={{ background: EKARI.gold }}
                    >
                        Next
                    </button>
                </div>
            );
        } else if (step === 1) {
            provideFooter(
                <div className="flex gap-2">
                    <button
                        onClick={goBack}
                        className="h-11 px-4 rounded-xl border font-bold bg-white flex-1"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                    >
                        Back
                    </button>
                    <button
                        onClick={goNext}
                        disabled={!canNextFromTags}
                        className="h-11 px-4 rounded-xl font-bold text-white disabled:opacity-60 flex-1"
                        style={{ background: EKARI.gold }}
                    >
                        Next
                    </button>
                </div>
            );
        } else {
            provideFooter(
                <div className="flex gap-2">
                    <button
                        onClick={goBack}
                        className="h-11 px-4 rounded-xl border font-bold bg-white flex-1"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        disabled={saving}
                    >
                        Back
                    </button>
                    <button
                        onClick={save}
                        className="h-11 px-4 rounded-xl font-bold text-white disabled:opacity-60 flex-1"
                        style={{ background: EKARI.gold }}
                        disabled={saving}
                    >
                        {saving ? "Saving…" : "Publish Event"}
                    </button>
                </div>
            );
        }
    }, [
        step,
        canNextFromBasics,
        canNextFromTags,
        save,
        onDone,
        saving,
        provideFooter,
    ]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold" style={{ color: EKARI.dim }}>
                        Step
                    </span>
                    <span className="text-xs font-black" style={{ color: EKARI.text }}>
                        {step + 1}/{totalSteps}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className={`h-2 w-2 rounded-full ${step >= i ? "bg-[--ekari-forest]" : "bg-gray-300"
                                }`}
                            style={{ ["--ekari-forest" as any]: EKARI.forest }}
                        />
                    ))}
                </div>
            </div>

            {step === 0 && (
                <div className="space-y-3">
                    <input
                        placeholder="Event title"
                        className="h-11 w-full rounded-xl border px-3 text-sm bg-white"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                            type="datetime-local"
                            className="h-11 rounded-xl border px-3 text-sm"
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                            value={dateISO}
                            onChange={(e) => setDateISO(e.target.value)}
                        />
                        <input
                            placeholder="Location"
                            className="h-11 rounded-xl border px-3 text-sm"
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        />
                    </div>

                    {!!dateISO && (
                        <div
                            className="flex items-center gap-2 rounded-xl border px-3 py-2 bg-[#F9FAFB]"
                            style={{ borderColor: EKARI.hair }}
                        >
                            <IoTimeOutline color={EKARI.dim} />
                            <div className="text-sm">
                                <span className="font-bold mr-1" style={{ color: EKARI.dim }}>
                                    Selected:
                                </span>
                                <span className="font-extrabold" style={{ color: EKARI.text }}>
                                    {dateHint}
                                </span>
                            </div>
                        </div>
                    )}

                    <div>
                        <div className="text-xs font-extrabold" style={{ color: EKARI.dim }}>
                            Category
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {(["Workshop", "Training", "Fair", "Meetup", "Other"] as EventCategory[]).map(
                                (c) => {
                                    const active = c === category;
                                    return (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setCategory(c)}
                                            className="h-8 rounded-full px-3 border text-xs font-bold"
                                            style={{
                                                borderColor: active ? EKARI.forest : "#eee",
                                                background: active ? EKARI.forest : "#f5f5f5",
                                                color: active ? "#fff" : EKARI.text,
                                            }}
                                        >
                                            {c}
                                        </button>
                                    );
                                }
                            )}
                        </div>
                    </div>
                </div>
            )}

            {step === 1 && (
                <div className="space-y-3">
                    <div
                        className="flex items-center gap-2 text-sm font-extrabold"
                        style={{ color: EKARI.text }}
                    >
                        <IoPricetagsOutline /> Select tags
                    </div>

                    <div className="relative overflow-visible pb-24">
                        <HashtagPicker
                            value={eventTags}
                            onChange={setEventTags}
                            ekari={EKARI}
                            trending={trending}
                            trendingMeta={trendingMeta}
                            max={10}
                            showCounter
                            placeholder={
                                loading
                                    ? "Loading suggestions…"
                                    : "Type # to add… e.g. #maize #irrigation"
                            }
                        />
                    </div>

                    <p className="text-xs" style={{ color: EKARI.dim }}>
                        Tip: you can also type <span className="font-bold">#tags</span> in
                        your title/description—we’ll auto-pick them.
                    </p>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                            <input
                                placeholder={currency === "KES" ? "Price (optional, KSh)" : "Price (optional, USD)"}
                                className="h-11 w-full rounded-xl border px-3 text-sm"
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                inputMode="decimal"
                            />
                        </div>

                        <div className="shrink-0">
                            <div
                                className="inline-flex rounded-full bg-[#F3F4F6] p-1 border"
                                style={{ borderColor: EKARI.hair }}
                            >
                                {(["KES", "USD"] as CurrencyCode[]).map((c) => {
                                    const active = c === currency;
                                    return (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setCurrency(c)}
                                            className={cn(
                                                "px-3 h-7 rounded-full text-[11px] font-bold",
                                                active ? "bg-white shadow-sm" : "bg-transparent"
                                            )}
                                            style={{ color: active ? EKARI.forest : EKARI.dim }}
                                        >
                                            {c === "KES" ? "KSh" : "USD"}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <input
                        placeholder="Registration link (optional)"
                        className="h-11 w-full rounded-xl border px-3 text-sm"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        value={registrationUrl}
                        onChange={(e) => setRegistrationUrl(e.target.value)}
                        autoCapitalize="none"
                    />
                    <textarea
                        placeholder="Description (optional)"
                        rows={5}
                        className="w-full rounded-xl border px-3 py-2 text-sm"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />

                    <BannerUploader
                        previewUrl={coverPreview}
                        onPick={handlePickBanner}
                        onRemove={handleRemoveBanner}
                        ekari={EKARI}
                    />
                </div>
            )}
        </div>
    );
}
