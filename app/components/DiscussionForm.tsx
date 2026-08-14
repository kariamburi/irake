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


/* ---------- Theme ---------- */
const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
};
type DiscCategory =
    | "General"
    | "Seeds"
    | "Soil"
    | "Equipment"
    | "Market"
    | "Regulations"
    | "Other";
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

export function DiscussionForm({
    onDone,
    provideFooter,
}: {
    onDone: () => void;
    provideFooter: (node: ReactNode) => void;
}) {
    const { user } = useAuth();
    const uid = user?.uid || null;

    const [saving, setSaving] = useState(false);
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [category, setCategory] = useState<DiscCategory>("General");

    const { loading, trending, trendingMeta } = useHashtagSuggestions(uid);

    const [tags, setTags] = useState<string[]>([]);
    type Step = 0 | 1;
    const [step, setStep] = useState<Step>(0);
    const totalSteps = 2;

    const canNextFromBasics = title.trim().length > 0;

    const captionTags = useMemo(() => {
        const text = `${title}\n${body}`;
        return (text.match(/#([A-Za-z0-9_]{2,30})/g) || []).map((s) =>
            s.slice(1).toLowerCase()
        );
    }, [title, body]);

    const mergedTags = useMemo(
        () => Array.from(new Set([...tags.map((t) => t.toLowerCase()), ...captionTags])),
        [tags, captionTags]
    );

    const canPublish = mergedTags.length > 0;
    const [userProfile, setUserProfile] = useState<any | null>(null);
    useEffect(() => {

        if (!user) return;

        const db = getFirestore();
        (async () => {
            try {
                const uRef = doc(db, "users", user.uid);
                const uSnap = await getDoc(uRef);
                if (uSnap.exists()) {
                    const data = uSnap.data() as any;
                    setUserProfile(data);
                }
            } catch (e) {
                console.warn("Failed to load user profile for trending tags", e);
            }
        })();
    }, []);
    const save = useCallback(async () => {
        if (!title.trim()) {
            alert("Title is required");
            return;
        }
        if (!uid) {
            alert("Please sign in to start a discussion.");
            return;
        }

        try {
            setSaving(true);
            const refDoc = doc(collection(db, "discussions"));
            const badge = buildAuthorBadge(userProfile);
            await setDoc(refDoc, {
                title: title.trim(),
                body: body.trim() || null,
                authorId: uid,
                author: {
                    id: uid,
                    name: userProfile?.firstName + " " + userProfile?.surname,
                    handle: userProfile?.handle ?? null,
                    photoURL: userProfile?.photoURL ?? null,
                },
                authorBadge: badge,
                createdAt: serverTimestamp(),
                repliesCount: 0,
                category,
                tags: mergedTags,
                published: true,
            });

            setSaving(false);
            onDone();
        } catch (e: any) {
            console.error(e);
            setSaving(false);
            alert(`Failed to start discussion: ${e?.message || "Try again"}`);
        }
    }, [title, body, uid, category, mergedTags, onDone]);

    const goNext = () => setStep(1);
    const goBack = () => setStep(0);

    useEffect(() => {
        if (step === 0) {
            provideFooter(
                <div className="flex gap-2">
                    <button
                        onClick={onDone}
                        className="h-11 px-4 rounded-xl border font-bold bg-white flex-1"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={goNext}
                        disabled={!canNextFromBasics || saving}
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
                        disabled={!canPublish || saving}
                        className="h-11 px-4 rounded-xl font-bold text-white disabled:opacity-60 flex-1"
                        style={{ background: EKARI.gold }}
                    >
                        {saving ? "Posting…" : "Start Discussion"}
                    </button>
                </div>
            );
        }
    }, [
        step,
        saving,
        canNextFromBasics,
        canPublish,
        onDone,
        provideFooter,
        save,
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
                    {[0, 1].map((i) => (
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
                        placeholder="Discussion title"
                        className="h-11 w-full rounded-xl border px-3 text-sm bg-white"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />

                    <div>
                        <div className="text-xs font-extrabold" style={{ color: EKARI.dim }}>
                            Category
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {(
                                ["General", "Seeds", "Soil", "Equipment", "Market", "Regulations", "Other"] as DiscCategory[]
                            ).map((c) => {
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
                            })}
                        </div>
                    </div>

                    <textarea
                        placeholder="Describe your topic (optional)"
                        rows={6}
                        className="w-full rounded-xl border px-3 py-2 text-sm"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                    />
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
                            value={tags}
                            onChange={setTags}
                            ekari={EKARI}
                            trending={trending}
                            trendingMeta={trendingMeta}
                            max={10}
                            showCounter
                            placeholder={
                                loading
                                    ? "Loading suggestions…"
                                    : "Type # to add… e.g. #market #seedlings"
                            }
                        />
                    </div>

                    <p className="text-xs" style={{ color: EKARI.dim }}>
                        Add at least one tag so others can find your topic.
                    </p>
                </div>
            )}
        </div>
    );
}