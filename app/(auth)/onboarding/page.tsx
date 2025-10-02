"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    IoChevronBack,
    IoCalendarOutline,
    IoAtOutline,
    IoLocationOutline,
    IoImagesOutline,
    IoCameraOutline,
    IoPersonCircleOutline,
    IoMaleOutline,
    IoFemaleOutline,
    IoPersonOutline,
} from "react-icons/io5";

import { db, storage } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/app/hooks/useAuth";
import { INTEREST_GROUPS, INTERESTS, ROLE_GROUPS, ROLES } from "@/app/constants/constants";

// If you already export normalizeTag from utils/ekariTags, import it.
// import { normalizeTag } from "@/utils/ekariTags";

// Fallback normalizer (keeps lowercase, safe hashtag-ish slug)
const normalizeTag = (s: string) =>
    (s ?? "")
        .toString()
        .replace(/^#/, "")
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/\+/g, "plus")
        .replace(/[^a-z0-9_]/g, "")
        .slice(0, 30);

type Gender = "male" | "female" | "other";

const EKARI = {
    forest: "#233F39",
    leaf: "#1F3A34",
    gold: "#C79257",
    sand: "#FFFFFF",
    hair: "#E5E7EB",
    text: "#0F172A",
    dim: "#6B7280",
    subtext: "#5C6B66",
    danger: "#B42318",
};

// Interests aligned to taxonomy (crops, inputs, value-add, services, finance,
// tech, compliance, logistics, climate, plus key pests/diseases/toxins)

type SmartPickerProps = {
    label: string;
    value: string[];
    onChange: (next: string[]) => void;
    options: string[];              // full catalog
    popular?: string[];             // show as quick chips
    placeholder?: string;
    max?: number;                   // selection cap
    ekari?: { hair: string; text: string; forest: string; gold: string; dim: string };
    groups?: { title: string; items: string[] }[]; // for modal
};

/* ---------- Small UI helpers ---------- */
function Field({
    label,
    helper,
    children,
    className = "",
}: {
    label: string;
    helper?: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`mt-4 ${className}`}>
            <div className="text-[13px] font-extrabold" style={{ color: EKARI.text }}>
                {label}
            </div>
            <div className="mt-1.5">{children}</div>
            {helper ? (
                <div className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                    {helper}
                </div>
            ) : null}
        </div>
    );
}

function GenderPills({
    value,
    onChange,
}: {
    value: Gender | null;
    onChange: (g: Gender) => void;
}) {
    const items: { key: Gender; label: string; Icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
        { key: "male", label: "Male", Icon: IoMaleOutline },
        { key: "female", label: "Female", Icon: IoFemaleOutline },
        { key: "other", label: "Other", Icon: IoPersonOutline },
    ];
    return (
        <div role="radiogroup" className="flex gap-2">
            {items.map(({ key, label, Icon }) => {
                const active = value === key;
                return (
                    <button
                        key={key}
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(key)}
                        className="flex items-center rounded-full border px-4 py-2"
                        style={{
                            borderColor: active ? EKARI.forest : EKARI.hair,
                            background: active ? EKARI.forest : "#fff",
                        }}
                    >
                        <Icon size={16} color={active ? "#fff" : EKARI.dim} />
                        <span className="ml-2 font-bold" style={{ color: active ? "#fff" : EKARI.text }}>
                            {label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

/* ===================== Onboarding Wizard ===================== */
export default function OnboardingWizardPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    // Guard: if auth resolved and no user → go to login
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace("/login");
        }
    }, [authLoading, user, router]);

    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

    // Step 1
    const [firstName, setFirstName] = useState("");
    const [surname, setSurname] = useState("");
    const [handle, setHandle] = useState("");
    const [dobDate, setDobDate] = useState<string>(""); // yyyy-mm-dd
    const [gender, setGender] = useState<Gender | null>(null);

    const [checkingHandle, setCheckingHandle] = useState(false);
    const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
    const handleCheckTimer = useRef<NodeJS.Timeout | null>(null);

    const today = new Date();
    const maxDOB = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate()); // 18+
    const minDOB = new Date(1900, 0, 1);
    const dateToStr = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const isAdult = useMemo(() => {
        if (!dobDate) return false;
        return new Date(dobDate) <= maxDOB;
    }, [dobDate]);

    // Step 2
    const [areaOfInterest, setAreaOfInterest] = useState<string[]>([]);
    const [roles, setRoles] = useState<string[]>([]);

    // Step 3
    const [locStatus, setLocStatus] = useState<"idle" | "denied" | "loading" | "ready">("idle");
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [place, setPlace] = useState<string>("");

    // Step 4 (photo)
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    function usePopularOptions(
        db: any,
        kind: "interests" | "roles",
        fallback: string[],
        limit = 12
    ) {
        const [popular, setPopular] = React.useState<string[]>(fallback.slice(0, limit));

        React.useEffect(() => {
            let mounted = true;
            (async () => {
                try {
                    const snap = await getDoc(doc(db, "meta", "popularity"));
                    const data = snap.exists() ? (snap.data() as any) : null;
                    const map: Record<string, number> | undefined = data?.[kind];
                    if (map && typeof map === "object") {
                        const sorted = Object.entries(map)
                            .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                            .map(([k]) => k)
                            .filter((v) => typeof v === "string" && v.trim().length > 0);
                        if (mounted && sorted.length) {
                            setPopular(sorted.slice(0, limit));
                        }
                    }
                } catch {
                    // ignore; fallback already set
                }
            })();
            return () => {
                mounted = false;
            };
        }, [db, kind, limit]);

        return popular;
    }
    const popularInterests = usePopularOptions(db, "interests", INTERESTS, 12);
    const popularRoles = usePopularOptions(db, "roles", ROLES, 12);

    function SmartPicker({
        label,
        value,
        onChange,
        options,
        popular = [],
        placeholder = "Search…",
        max = 8,
        ekari = { hair: "#E5E7EB", text: "#0F172A", forest: "#233F39", gold: "#C79257", dim: "#6B7280" },
        groups,
    }: SmartPickerProps) {
        const [query, setQuery] = React.useState("");
        const [openModal, setOpenModal] = React.useState(false);

        const selectedSet = React.useMemo(() => new Set(value), [value]);

        const filtered = React.useMemo(() => {
            const q = query.trim().toLowerCase();
            if (!q) return [];
            return options
                .filter((o) => !selectedSet.has(o))
                .filter((o) => o.toLowerCase().includes(q))
                .slice(0, 10);
        }, [query, options, selectedSet]);

        const canAddMore = value.length < max;

        function add(tag: string) {
            if (!canAddMore) return;
            if (selectedSet.has(tag)) return;
            onChange([...value, tag]);
            setQuery("");
        }
        function remove(tag: string) {
            onChange(value.filter((t) => t !== tag));
        }
        function toggle(tag: string) {
            selectedSet.has(tag) ? remove(tag) : add(tag);
        }

        return (
            <div>
                <div className="flex items-center justify-between">
                    <div className="font-extrabold" style={{ color: ekari.text }}>
                        {label}
                    </div>
                    <div className="text-xs" style={{ color: ekari.dim }}>
                        {value.length}/{max}
                    </div>
                </div>

                {/* Selected tokens */}
                {!!value.length && (
                    <div className="mt-2 flex flex-wrap gap-2">
                        {value.map((t) => (
                            <button
                                key={t}
                                onClick={() => remove(t)}
                                className="rounded-full border px-2 py-1 text-xs font-bold"
                                style={{ borderColor: ekari.hair, color: ekari.text }}
                                title="Remove"
                            >
                                {t} ×
                            </button>
                        ))}
                    </div>
                )}

                {/* Quick popular chips */}
                {!!popular.length && (
                    <div className="mt-2 flex flex-wrap gap-2">
                        {popular.map((p) => {
                            const active = selectedSet.has(p);
                            return (
                                <button
                                    key={p}
                                    onClick={() => toggle(p)}
                                    className="rounded-full border px-3 py-1.5 text-xs font-bold"
                                    style={{
                                        borderColor: active ? ekari.forest : ekari.hair,
                                        background: active ? ekari.forest : "#fff",
                                        color: active ? "#fff" : ekari.text,
                                    }}
                                >
                                    {p}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Search + autosuggest */}
                <div
                    className="mt-3 rounded-xl border px-3 py-2"
                    style={{ borderColor: ekari.hair, background: "#F6F7FB" }}
                >
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full bg-transparent outline-none text-sm"
                        placeholder={placeholder}
                    />
                    {!!filtered.length && (
                        <div className="mt-2 max-h-52 overflow-auto rounded-lg border bg-white text-sm"
                            style={{ borderColor: ekari.hair }}>
                            {filtered.map((opt) => (
                                <button
                                    key={opt}
                                    onClick={() => add(opt)}
                                    className="block w-full text-left px-3 py-2 hover:bg-gray-50"
                                    disabled={!canAddMore}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Browse all */}
                <div className="mt-2">
                    <button
                        type="button"
                        onClick={() => setOpenModal(true)}
                        className="text-xs font-bold underline"
                        style={{ color: ekari.forest }}
                    >
                        Browse all
                    </button>
                </div>

                {/* Modal */}
                {openModal && (
                    <div className="fixed inset-0 z-50">
                        <div className="absolute inset-0 bg-black/40" onClick={() => setOpenModal(false)} />
                        <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white p-4"
                            style={{ borderColor: ekari.hair }}>
                            <div className="flex items-center justify-between">
                                <div className="font-extrabold" style={{ color: ekari.text }}>
                                    {label}
                                </div>
                                <button onClick={() => setOpenModal(false)} className="text-sm font-bold">Close</button>
                            </div>

                            <div className="mt-3">
                                {/* Quick filter inside modal */}
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="w-full rounded-lg border px-3 py-2 text-sm"
                                    style={{ borderColor: ekari.hair, background: "#F6F7FB", color: ekari.text }}
                                    placeholder={placeholder}
                                />
                            </div>

                            <div className="mt-4 max-h-[60vh] overflow-auto space-y-5">
                                {(groups && groups.length ? groups : [{ title: "All", items: options }]).map((g) => {
                                    const items = g.items.filter((i) =>
                                        query ? i.toLowerCase().includes(query.toLowerCase()) : true
                                    );
                                    if (!items.length) return null;
                                    return (
                                        <div key={g.title}>
                                            <div className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: ekari.dim }}>
                                                {g.title}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {items.map((i) => {
                                                    const active = selectedSet.has(i);
                                                    return (
                                                        <button
                                                            key={i}
                                                            onClick={() => toggle(i)}
                                                            className="rounded-full border px-3 py-1.5 text-xs font-bold"
                                                            style={{
                                                                borderColor: active ? ekari.forest : ekari.hair,
                                                                background: active ? ekari.forest : "#fff",
                                                                color: active ? "#fff" : ekari.text,
                                                            }}
                                                            disabled={!active && !canAddMore}
                                                        >
                                                            {i}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-4 text-right text-xs" style={{ color: ekari.dim }}>
                                {value.length}/{max} selected
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Save state
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    /* ---------- Handle normalization & availability ---------- */

    const stripAt = (s: string) => s.replace(/^@+/, "");
    const normalizeHandleForInput = (txt: string) =>
        "@" + stripAt(txt).toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 24);
    const HANDLE_REGEX = /^[a-z0-9._]{3,24}$/;
    const [handleMsg, setHandleMsg] = useState<string | null>(null);
    const [handleReason, setHandleReason] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    function onChangeHandle(txt: string) {
        const norm = normalizeHandleForInput(txt);
        setHandle(norm);
        setHandleAvailable(null);
        setHandleMsg(null);
        setHandleReason(null);

        if (handleCheckTimer.current) clearTimeout(handleCheckTimer.current);
        handleCheckTimer.current = setTimeout(() => {
            checkHandleAvailability(norm); // pass the current value
        }, 450);
    }
    async function checkHandleAvailability(currentWithAt?: string) {
        const raw = (currentWithAt ?? handle).trim();
        const candidate = stripAt(raw); // for validation + server
        if (candidate.length < 3) return;
        // Optional: short-circuit if format is invalid
        if (!HANDLE_REGEX.test(candidate)) {
            setHandleAvailable(false);
            setHandleMsg("Use 3-24 chars: a-z, 0-9, dot or underscore.");
            setHandleReason("invalid_format");
            return;
        }

        setCheckingHandle(true);
        setHandleMsg(null);
        setHandleReason(null);

        try {
            // cancel in-flight request if any
            if (abortRef.current) abortRef.current.abort();
            const ctl = new AbortController();
            abortRef.current = ctl;
            const q = new URLSearchParams({ handle: candidate });
            const res = await fetch(`/api/handle/check?${q.toString()}`, {
                method: "GET",
                cache: "no-store",
                signal: ctl.signal,
            });
            console.log(res)
            const data = await res.json();
            if (!data?.ok) {
                setHandleAvailable(null);
                setHandleMsg("Server error. Try again.");
                setHandleReason("server_error");
                return;
            }

            setHandleAvailable(Boolean(data.available));
            setHandleReason(data.reason ?? null);
            if (data.available) {
                setHandleMsg("Handle available.");
            } else {
                setHandleMsg(
                    data.reason === "invalid_format"
                        ? "Use 3-24 chars: a-z, 0-9, dot or underscore."
                        : data.reason === "reserved"
                            ? "This handle is reserved."
                            : "This handle is taken."
                );
            }
        } catch (e: any) {
            if (e?.name !== "AbortError") {
                setHandleAvailable(null);
                setHandleMsg("Could not check handle.");
                setHandleReason("network_error");
            }
        } finally {
            setCheckingHandle(false);
        }
    }


    const canNext1 = useMemo(() => {
        const hn = stripAt(handle.trim());
        return (
            firstName.trim().length >= 2 &&
            surname.trim().length >= 2 &&
            gender !== null &&
            !!dobDate &&
            isAdult &&
            hn.length >= 3 &&
            handleAvailable === true
        );
    }, [firstName, surname, gender, dobDate, isAdult, handle, handleAvailable]);
    function toggleArray(arr: string[], val: string, setter: (v: string[]) => void) {
        setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
    }
    const canNext2 = areaOfInterest.length > 0 && roles.length > 0;

    /* ---------- Geolocation (web) ---------- */
    async function requestLocation() {
        try {
            if (!("geolocation" in navigator)) {
                setLocStatus("denied");
                return;
            }
            setLocStatus("loading");
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    setCoords({ lat, lng });
                    if (!place) setPlace("");
                    setLocStatus("ready");
                },
                () => setLocStatus("denied"),
                { enableHighAccuracy: false, timeout: 10000 }
            );
        } catch {
            setLocStatus("denied");
        }
    }
    const canNext3 = true; // optional step

    /* ---------- Photo (file input) ---------- */
    function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0] || null;
        setFile(f);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(f ? URL.createObjectURL(f) : null);
    }

    /* ---------- Flow ---------- */
    const onBack = () => setStep((s) => (s === 1 ? 1 : ((s - 1) as any)));
    const onNext = () => setStep((s) => (s === 4 ? 4 : ((s + 1) as any)));

    /* ---------- Storage helper ---------- */
    async function uploadProfilePhoto(f: File): Promise<string> {
        if (!user) throw new Error("Not signed in.");
        setUploading(true);
        try {
            const filename = `avatars/${user.uid}/${Date.now()}_${f.name}`;
            const rf = ref(storage, filename);
            const bytes = new Uint8Array(await f.arrayBuffer());
            await uploadBytes(rf, bytes, { contentType: f.type || "image/jpeg" });
            const url = await getDownloadURL(rf);
            return url;
        } finally {
            setUploading(false);
        }
    }

    /* ---------- Reverse geocode helper ---------- */
    type RevGeo = { country: string | null; countryCode: string | null; county: string | null; displayName?: string | null };
    async function reverseGeocode(lat: number, lng: number): Promise<RevGeo> {
        // 1) Try your API route (recommended)
        try {
            const q = new URLSearchParams({ lat: String(lat), lng: String(lng) });
            const resp = await fetch(`/api/revgeo?${q.toString()}`, { method: "GET", cache: "no-store" });
            if (resp.ok) {
                const data = await resp.json();
                return {
                    country: data?.country ?? null,
                    countryCode: data?.countryCode ?? null,
                    county: data?.county ?? null,
                    displayName: data?.displayName ?? null,
                };
            }
        } catch {
            // fall through to client-side nominatim
        }

        // 2) Fallback to Nominatim (no key). Respect usage policy in production.
        try {
            const url = new URL("https://nominatim.openstreetmap.org/reverse");
            url.searchParams.set("format", "jsonv2");
            url.searchParams.set("lat", String(lat));
            url.searchParams.set("lon", String(lng));
            url.searchParams.set("zoom", "10");
            url.searchParams.set("addressdetails", "1");

            const r = await fetch(url.toString(), { cache: "no-store" });
            if (!r.ok) throw new Error("revgeo failed");
            const data = await r.json();
            const a = (data?.address ?? {}) as Record<string, string | undefined>;
            const country = a.country ?? null;
            const countryCode = (a.country_code ?? "").toUpperCase() || null;
            const county =
                a.county ??
                a.state_district ??
                a.region ??
                a.state ??
                a.municipality ??
                null;

            return {
                country,
                countryCode,
                county,
                displayName: data?.display_name ?? null,
            };
        } catch {
            return { country: null, countryCode: null, county: null };
        }
    }

    /* ---------- Persist ---------- */
    async function saveProfile() {
        if (!user) {
            setErrorMsg("You must be logged in.");
            return;
        }
        setSaving(true);
        setErrorMsg("");

        const uid = user.uid;
        const now = serverTimestamp();

        // Attempt to derive country/county from coords
        let geoCountry: string | null = null;
        let geoCountryCode: string | null = null;
        let geoCounty: string | null = null;

        try {
            if (coords?.lat != null && coords?.lng != null) {
                const g = await reverseGeocode(coords.lat, coords.lng);
                geoCountry = g.country;
                geoCountryCode = g.countryCode;
                geoCounty = g.county;
                // If user didn't type a place, use displayName-lite
                if (!place && g.displayName) {
                    setPlace(g.displayName);
                }
            }
        } catch {
            // ignore geocode failure
        }

        // You can also have manual pickers; prefer user-input over geo when present
        const countryName = geoCountry || "Kenya";
        const countryCode = geoCountryCode || "KE";
        const countyName = geoCounty || null;

        // Ensure arrays
        const rolesArr = Array.isArray(roles) ? roles : roles ? [roles] : [];
        const interestsArr = Array.isArray(areaOfInterest) ? areaOfInterest : areaOfInterest ? [areaOfInterest] : [];

        let photoURL: string | null = (user.photoURL as string | null) || null;
        try {
            if (file) {
                photoURL = await uploadProfilePhoto(file);
            }

            const userDoc = {
                handle: handle.trim(),
                handleLower: stripAt(handle).toLowerCase(),
                firstName: firstName.trim(),
                surname: surname.trim(),
                dob: dobDate || null, // store ISO string (yyyy-mm-dd)
                gender: gender as Gender,
                phone: user.phoneNumber || null,
                email: user.email || null,

                // 🌍 Location fields (human-friendly + normalized tags)
                country: countryName,
                countryCode,
                county: countyName,
                countryTag: countryName ? normalizeTag(countryName) : null,
                countyTag: countyName ? normalizeTag(countyName) : null,

                areaOfInterest: interestsArr,
                accountType: "standard",
                roles: rolesArr,
                photoURL,
                bio: "",
                location: coords ? { lat: coords.lat, lng: coords.lng, place: place || null } : null,
                followersCount: 0,
                followingCount: 0,
                likes: 0,
                createdAt: now,
                updatedAt: now,
                premiumUntil: null,
                isSuspended: false,
                isDeactivated: false,
                onboarded: true,
            };

            await setDoc(doc(db, "users", uid), userDoc, { merge: true });
            router.replace("/deeds"); // Home after onboarding
        } catch (err: any) {
            setErrorMsg(err?.message || "Could not save your profile.");
        } finally {
            setSaving(false);
        }
    }

    /* ---------- Step header ---------- */
    function StepHeader({ title }: { title: string }) {
        return (
            <div className="mt-1 mb-2 flex items-center justify-between">
                <button onClick={onBack} disabled={step === 1} className="p-1 rounded-md" style={{ color: step === 1 ? "#CBD5E1" : EKARI.text }}>
                    <IoChevronBack size={22} />
                </button>
                <div className="font-black text-lg" style={{ color: EKARI.text }}>
                    {title}
                </div>
                <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="h-1.5 rounded-full"
                            style={{
                                width: step === i ? 28 : 14,
                                background: step >= i ? EKARI.gold : "#E5E7EB",
                                transition: "width .2s",
                            }}
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen w-full" style={{ backgroundColor: EKARI.sand }}>
            <div className="mx-auto max-w-3xl px-5 pt-6 pb-6">
                {/* Top spacing */}
                <div className="h-12" />

                <div className="flex justify-center">
                    <Image src="/ekarihub-logo.png" alt="ekarihub" width={320} height={86} priority />
                </div>

                <div className="mt-2" />

                {/* Steps container */}
                <div className="mt-2">
                    {/* STEP 1 */}
                    {step === 1 && (
                        <>
                            <StepHeader title="Create your profile" />
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-2xl border p-4"
                                style={{ borderColor: EKARI.hair, background: EKARI.sand }}
                            >
                                <Field label="Name">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <input
                                            placeholder="First name"
                                            className="h-12 rounded-xl border px-3 bg-[#F6F7FB] outline-none"
                                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                        />
                                        <input
                                            placeholder="Surname"
                                            className="h-12 rounded-xl border px-3 bg-[#F6F7FB] outline-none"
                                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                            value={surname}
                                            onChange={(e) => setSurname(e.target.value)}
                                        />
                                    </div>
                                </Field>

                                <Field
                                    label="Username"
                                    helper={
                                        checkingHandle
                                            ? "Checking availability…"
                                            : handleMsg || undefined
                                    }
                                >
                                    <div className="flex items-center h-12 rounded-xl border px-3 bg-[#F6F7FB]" style={{ borderColor: EKARI.hair }}>

                                        <input
                                            placeholder="@handle"
                                            className="w-full bg-transparent outline-none text-base"
                                            style={{ color: EKARI.text }}
                                            value={handle}
                                            onChange={(e) => onChangeHandle(e.target.value)}
                                        />
                                        {checkingHandle ? (
                                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                                        ) : handle.length > 0 && handleAvailable !== null ? (
                                            <span className="ml-2 text-sm font-bold" style={{ color: handleAvailable ? "#10B981" : "#EF4444" }}>
                                                {handleAvailable ? "OK" : "X"}
                                            </span>
                                        ) : null}
                                    </div>
                                </Field>

                                <Field label="Date of birth" helper="You must be 18+ to join.">
                                    <div className="flex items-center h-12 rounded-xl border px-3 bg-[#F6F7FB]" style={{ borderColor: EKARI.hair }}>
                                        <IoCalendarOutline className="mr-2" size={18} color={EKARI.dim} />
                                        <input
                                            type="date"
                                            className="w-full bg-transparent outline-none text-base"
                                            value={dobDate}
                                            onChange={(e) => setDobDate(e.target.value)}
                                            min={dateToStr(minDOB)}
                                            max={dateToStr(maxDOB)}
                                        />
                                    </div>
                                    {!!dobDate && !isAdult && (
                                        <div className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                                            You must be at least 18 years old.
                                        </div>
                                    )}
                                </Field>

                                <Field label="Gender">
                                    <GenderPills value={gender} onChange={setGender} />
                                </Field>

                                <button
                                    onClick={onNext}
                                    disabled={!canNext1}
                                    className="mt-4 w-full rounded-xl py-3 font-extrabold text-white active:scale-[0.98] transition"
                                    style={{ background: EKARI.gold, opacity: canNext1 ? 1 : 0.6 }}
                                >
                                    Next
                                </button>
                            </motion.div>
                        </>
                    )}

                    {/* STEP 2 */}
                    {step === 2 && (
                        <>
                            <StepHeader title="Interests & roles" />
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-2xl border p-4"
                                style={{ borderColor: EKARI.hair, background: EKARI.sand }}
                            >
                                <Field label="Choose your interests">
                                    <SmartPicker
                                        label="Interests"
                                        value={areaOfInterest}
                                        onChange={setAreaOfInterest}
                                        options={INTERESTS}
                                        popular={popularInterests}
                                        groups={INTEREST_GROUPS}
                                        max={8}
                                        ekari={EKARI}
                                        placeholder="Search interests (e.g., Maize, Irrigation)"
                                    />
                                </Field>

                                <Field label="What do you do?">
                                    <SmartPicker
                                        label="Roles"
                                        value={roles}
                                        onChange={setRoles}
                                        options={ROLES}
                                        popular={popularRoles}
                                        groups={ROLE_GROUPS}
                                        max={5}
                                        ekari={EKARI}
                                        placeholder="Search roles (e.g., Farmer, Aggregator)"
                                    />
                                </Field>

                                <button
                                    onClick={onNext}
                                    disabled={!canNext2}
                                    className="mt-4 w-full rounded-xl py-3 font-extrabold text-white active:scale-[0.98] transition"
                                    style={{ background: EKARI.gold, opacity: canNext2 ? 1 : 0.6 }}
                                >
                                    Next
                                </button>
                            </motion.div>
                        </>
                    )}

                    {/* STEP 3 */}
                    {step === 3 && (
                        <>
                            <StepHeader title="Location" />
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-2xl border p-4"
                                style={{ borderColor: EKARI.hair, background: EKARI.sand }}
                            >
                                <div className="text-sm mt-1" style={{ color: EKARI.subtext }}>
                                    We’ll show nearby markets and services.
                                </div>

                                <div className="mt-3 flex items-center rounded-xl border p-3" style={{ borderColor: EKARI.hair }}>
                                    <IoLocationOutline size={18} color={EKARI.dim} />
                                    <div className="ml-2 flex-1">
                                        {locStatus === "ready" && coords ? (
                                            <>
                                                <div className="font-bold" style={{ color: EKARI.text }}>
                                                    {place || "Location captured"}
                                                </div>
                                                <div className="text-xs" style={{ color: EKARI.subtext }}>
                                                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                                                </div>
                                            </>
                                        ) : locStatus === "denied" ? (
                                            <div className="font-bold" style={{ color: EKARI.danger }}>
                                                Permission denied. You can continue without it.
                                            </div>
                                        ) : (
                                            <div className="font-bold" style={{ color: EKARI.text }}>
                                                Grant permission to detect your location.
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={requestLocation}
                                        className="rounded-lg border px-3 py-2 font-extrabold"
                                        style={{ background: "#fff", borderColor: EKARI.hair, color: EKARI.text }}
                                    >
                                        {locStatus === "loading" ? "…" : "Allow"}
                                    </button>
                                </div>

                                {/* Manual place name (optional) */}
                                <Field label="Place (optional)" helper="e.g., Nakuru, Kenya">
                                    <input
                                        placeholder="Type your place/city"
                                        className="h-12 rounded-xl border px-3 bg-[#F6F7FB] outline-none w-full"
                                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                        value={place}
                                        onChange={(e) => setPlace(e.target.value)}
                                    />
                                </Field>

                                {errorMsg && (
                                    <div className="mt-3 text-center font-semibold" style={{ color: EKARI.danger }}>
                                        {errorMsg}
                                    </div>
                                )}

                                <button
                                    onClick={onNext}
                                    className="mt-4 w-full rounded-xl py-3 font-extrabold text-white active:scale-[0.98] transition"
                                    style={{ background: EKARI.gold }}
                                >
                                    Next
                                </button>
                            </motion.div>
                        </>
                    )}

                    {/* STEP 4 */}
                    {step === 4 && (
                        <>
                            <StepHeader title="Profile photo" />
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-2xl border p-4"
                                style={{ borderColor: EKARI.hair, background: EKARI.sand }}
                            >
                                <div className="text-sm" style={{ color: EKARI.subtext }}>
                                    Show your face or your farm brand.
                                </div>

                                <div className="mt-3 flex flex-col items-center gap-3">
                                    <div
                                        className="flex items-center justify-center overflow-hidden"
                                        style={{
                                            width: 128,
                                            height: 128,
                                            borderRadius: 999,
                                            background: "#F6F7FB",
                                            border: `1px solid ${EKARI.hair}`,
                                        }}
                                    >
                                        {previewUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={previewUrl} alt="avatar preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <IoPersonCircleOutline size={96} color={EKARI.dim} />
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <label
                                            className="cursor-pointer rounded-full border px-3 py-2 flex items-center gap-2"
                                            style={{ background: "#fff", borderColor: EKARI.hair, color: EKARI.text }}
                                        >
                                            <IoImagesOutline size={16} />
                                            <span className="font-bold">Choose photo</span>
                                            <input type="file" accept="image/*" className="hidden" onChange={onPickFile} />
                                        </label>

                                        {/* “Take photo” on web = also file input (mobile lets you use camera) */}
                                        <label
                                            className="cursor-pointer rounded-full border px-3 py-2 flex items-center gap-2"
                                            style={{ background: "#fff", borderColor: EKARI.hair, color: EKARI.text }}
                                        >
                                            <IoCameraOutline size={16} />
                                            <span className="font-bold">Take photo</span>
                                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickFile} />
                                        </label>
                                    </div>
                                </div>

                                <button
                                    onClick={saveProfile}
                                    disabled={uploading || saving || authLoading || !user}
                                    className="mt-4 w-full rounded-xl py-3 font-extrabold text-white active:scale-[0.98] transition"
                                    style={{ background: EKARI.gold, opacity: uploading || saving || authLoading || !user ? 0.6 : 1 }}
                                >
                                    {uploading || saving ? "Saving..." : previewUrl ? "Finish" : "Skip for now"}
                                </button>

                                {errorMsg && (
                                    <div className="mt-3 text-center font-semibold" style={{ color: EKARI.danger }}>
                                        {errorMsg}
                                    </div>
                                )}
                            </motion.div>
                        </>
                    )}
                </div>

                {/* Bottom spacer */}
                <div className="h-6" />
            </div>
        </main>
    );
}
