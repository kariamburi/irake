"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
    IoCalendarOutline,
    IoLocationOutline,
    IoImagesOutline,
    IoCameraOutline,
    IoPersonCircleOutline,
    IoMaleOutline,
    IoFemaleOutline,
    IoPersonOutline,
    IoChevronBackOutline,
} from "react-icons/io5";

import { GoogleMap, Marker, useLoadScript, Autocomplete } from "@react-google-maps/api";

import { db, storage } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/app/hooks/useAuth";
import { INTEREST_GROUPS, INTERESTS, ROLE_GROUPS, ROLES } from "@/app/constants/constants";
import { signOut } from "firebase/auth";
import { ConfirmModal } from "@/app/components/ConfirmModal";

/* ---------- Brand ---------- */
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

type Gender = "male" | "female" | "other";

/* ---------- Helpers ---------- */
const normalizeTag = (s: string) =>
    (s ?? "")
        .toString()
        .replace(/^#/, "")
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/\+/g, "plus")
        .replace(/[^a-z0-9_]/g, "")
        .slice(0, 30);

const RESERVED = new Set([
    "admin",
    "administrator",
    "root",
    "support",
    "ekarihub",
    "help",
    "moderator",
    "system",
]);

/* ---------------- Small UI helpers ---------------- */
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
    const items: {
        key: Gender;
        label: string;
        Icon: React.ComponentType<{ size?: number; color?: string }>;
    }[] = [
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
                        <span
                            className="ml-2 font-bold"
                            style={{ color: active ? "#fff" : EKARI.text }}
                        >
                            {label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

/* ---------------- SmartPicker (web) ---------------- */
type SmartPickerProps = {
    label: string;
    value: string[];
    onChange: (next: string[]) => void;
    options: string[];
    popular?: string[];
    placeholder?: string;
    max?: number;
    ekari?: { hair: string; text: string; forest: string; gold: string; dim: string };
    groups?: { title: string; items: string[] }[];
    inlineBrowse?: boolean;
};

function SmartPicker({
    label,
    value,
    onChange,
    options,
    popular = [],
    placeholder = "Search…",
    max = 10,
    ekari = {
        hair: "#E5E7EB",
        text: "#0F172A",
        forest: "#233F39",
        gold: "#C79257",
        dim: "#6B7280",
    },
    groups,
    inlineBrowse = true,
}: SmartPickerProps) {
    const [query, setQuery] = useState("");
    const [openModal, setOpenModal] = useState(false);

    const selectedSet = useMemo(() => new Set(value), [value]);
    const canAddMore = value.length < max;

    const packs = useMemo(() => {
        const base = groups?.length ? groups : [{ title: "All", items: options }];
        const q = query.trim().toLowerCase();
        return base.map((g) => ({
            ...g,
            items: q ? g.items.filter((i) => i.toLowerCase().includes(q)) : g.items,
        }));
    }, [groups, options, query]);

    function add(tag: string) {
        if (!canAddMore) return;
        if (selectedSet.has(tag)) return;
        onChange([...value, tag]);
    }
    function remove(tag: string) {
        onChange(value.filter((t) => t !== tag));
    }
    function toggle(tag: string) {
        selectedSet.has(tag) ? remove(tag) : add(tag);
    }

    const GroupedList = () => (
        <div className="mt-3 max-h-[60vh] overflow-auto space-y-5">
            {packs.map((g) => {
                if (!g.items.length) return null;
                return (
                    <div key={g.title}>
                        <div
                            className="mb-2 text-xs font-bold uppercase tracking-wider"
                            style={{ color: ekari.dim }}
                        >
                            {g.title}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {g.items.map((i) => {
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
    );

    return (
        <div>
            <div className="flex items-center justify-between">
                <div className="text-xs" style={{ color: ekari.dim }}>
                    {value.length}/{max}
                </div>
            </div>

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

            {inlineBrowse ? (
                <GroupedList />
            ) : (
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
            )}

            {openModal && (
                <div className="fixed inset-0 z-50">
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setOpenModal(false)}
                    />
                    <div
                        className="absolute left-1/2 top-1/2 w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white p-4"
                        style={{ borderColor: ekari.hair }}
                    >
                        <div className="flex items-center justify-between">
                            <div className="font-extrabold" style={{ color: ekari.text }}>
                                {label}
                            </div>
                            <button onClick={() => setOpenModal(false)} className="text-sm font-bold">
                                Close
                            </button>
                        </div>

                        <div className="mt-3">
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="w-full rounded-lg border px-3 py-2 text-sm"
                                style={{
                                    borderColor: ekari.hair,
                                    background: "#F6F7FB",
                                    color: ekari.text,
                                }}
                                placeholder={placeholder}
                            />
                        </div>

                        <GroupedList />

                        <div className="mt-4 text-right text-xs" style={{ color: ekari.dim }}>
                            {value.length}/{max} selected
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ===================== Onboarding Wizard (Web) ===================== */
export default function OnboardingWizardPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    // Guard: if auth resolved and no user → go to login
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace("/login");
        }
    }, [authLoading, user, router]);

    // Align steps with mobile: 1..5
    const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

    // Step 1
    const [firstName, setFirstName] = useState("");
    const [surname, setSurname] = useState("");
    const [handle, setHandle] = useState("");
    const [dobDate, setDobDate] = useState<string>(""); // yyyy-mm-dd
    const [gender, setGender] = useState<Gender | null>(null);

    const [checkingHandle, setCheckingHandle] = useState(false);
    const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
    const [handleMsg, setHandleMsg] = useState<string | null>(null);
    const [handleReason, setHandleReason] = useState<string | null>(null);
    const handleCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const today = new Date();
    const maxDOB = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate()); // 18+
    const minDOB = new Date(1900, 0, 1);
    const dateToStr = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
            d.getDate()
        ).padStart(2, "0")}`;
    const isAdult = useMemo(() => {
        if (!dobDate) return false;
        return new Date(dobDate) <= maxDOB;
    }, [dobDate]);

    // Step 2 & 3
    const [areaOfInterest, setAreaOfInterest] = useState<string[]>([]);
    const [roles, setRoles] = useState<string[]>([]);

    // Step 4
    const [locStatus, setLocStatus] = useState<"idle" | "denied" | "loading" | "ready">(
        "idle"
    );
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [place, setPlace] = useState<string>("");
    const [locTab, setLocTab] = useState<"search" | "map">("search");

    // Step 5 (photo)
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    /* ---------- Handle normalization & availability ---------- */
    const stripAt = (s: string) => s.replace(/^@+/, "");
    const normalizeHandleForInput = (txt: string) =>
        "@" +
        stripAt(txt)
            .toLowerCase()
            .replace(/[^a-z0-9._]/g, "")
            .slice(0, 29); // 29 core + '@' => ≤30 total

    const HANDLE_REGEX = /^[a-z0-9._]{3,29}$/; // ≤29 core

    function onChangeHandle(txt: string) {
        const norm = normalizeHandleForInput(txt);
        setHandle(norm);
        setHandleAvailable(null);
        setHandleMsg(null);
        setHandleReason(null);

        if (handleCheckTimer.current) clearTimeout(handleCheckTimer.current);
        handleCheckTimer.current = setTimeout(() => {
            void checkHandleAvailability(norm); // pass current
        }, 450);
    }

    async function checkHandleAvailability(currentWithAt?: string) {
        const raw = (currentWithAt ?? handle).trim();
        const core = stripAt(raw);

        // Client validations first
        if (!HANDLE_REGEX.test(core)) {
            setHandleAvailable(false);
            setHandleMsg("Use 3–29 chars: a-z, 0-9, dot or underscore.");
            setHandleReason("invalid_format");
            return;
        }
        if (RESERVED.has(core)) {
            setHandleAvailable(false);
            setHandleMsg("This handle is reserved.");
            setHandleReason("reserved");
            return;
        }

        setCheckingHandle(true);
        setHandleMsg(null);
        setHandleReason(null);

        try {
            if (abortRef.current) abortRef.current.abort();
            const ctl = new AbortController();
            abortRef.current = ctl;

            const q = new URLSearchParams({ handle: core });
            const res = await fetch(`/api/handle/check?${q.toString()}`, {
                method: "GET",
                cache: "no-store",
                signal: ctl.signal,
            });
            const data = await res.json();
            if (!data?.ok) {
                setHandleAvailable(null);
                setHandleMsg("Server error. Try again.");
                setHandleReason("server_error");
                return;
            }

            const available = Boolean(data.available);
            setHandleAvailable(available);
            setHandleReason(data.reason ?? null);
            setHandleMsg(
                available
                    ? "Handle available."
                    : data.reason === "invalid_format"
                        ? "Use 3–29 chars: a-z, 0-9, dot or underscore."
                        : data.reason === "reserved"
                            ? "This handle is reserved."
                            : "This handle is taken."
            );
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
        const core = stripAt(handle.trim());
        return (
            firstName.trim().length >= 2 &&
            surname.trim().length >= 2 &&
            gender !== null &&
            !!dobDate &&
            isAdult &&
            core.length >= 3 &&
            HANDLE_REGEX.test(core) &&
            handleAvailable === true
        );
    }, [firstName, surname, gender, dobDate, isAdult, handle, handleAvailable]);

    const canNext2 = areaOfInterest.length > 0;
    const canNext3 = roles.length > 0;

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

    /* ---------- Photo ---------- */
    function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0] || null;
        setFile(f);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(f ? URL.createObjectURL(f) : null);
    }

    /* ---------- Flow ---------- */
    const onBack = () => setStep((s) => (s === 1 ? 1 : ((s - 1) as any)));
    const handleNext = () => {
        if (step === 5) {
            void saveProfile();
        } else {
            setStep((s) => (s === 5 ? 5 : ((s + 1) as any)));
        }
    };

    /* --- Footer with ONLY Back & Next --- */
    function FooterNav({
        onBack,
        onNext,
        disableBack,
        disableNext,
        nextLabel = "Next",
    }: {
        onBack: () => void;
        onNext: () => void;
        disableBack?: boolean;
        disableNext?: boolean;
        nextLabel?: string;
    }) {
        return (
            <div className="mt-4 flex gap-3">
                <button
                    onClick={onBack}
                    disabled={disableBack}
                    className="w-1/2 rounded-xl py-3 font-extrabold border"
                    style={{
                        background: "#fff",
                        borderColor: EKARI.hair,
                        color: disableBack ? "#9CA3AF" : EKARI.text,
                        opacity: disableBack ? 0.6 : 1,
                    }}
                >
                    Back
                </button>
                <button
                    onClick={onNext}
                    disabled={disableNext}
                    className="w-1/2 rounded-xl py-3 font-extrabold text-white active:scale-[0.98] transition"
                    style={{
                        background: EKARI.gold,
                        opacity: disableNext ? 0.6 : 1,
                    }}
                >
                    {nextLabel}
                </button>
            </div>
        );
    }

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
    type RevGeo = {
        country: string | null;
        countryCode: string | null;
        county: string | null;
        displayName?: string | null;
    };
    async function reverseGeocode(lat: number, lng: number): Promise<RevGeo> {
        try {
            const q = new URLSearchParams({ lat: String(lat), lng: String(lng) });
            const resp = await fetch(`/api/revgeo?${q.toString()}`, {
                method: "GET",
                cache: "no-store",
            });
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
            /* fall through */
        }
        return { country: null, countryCode: null, county: null };
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
                if (!place && g.displayName) setPlace(g.displayName);
            }
        } catch {
            /* ignore geocode failure */
        }

        // Prefer geo if available; default to Kenya
        const countryName = geoCountry || "Kenya";
        const countryCode = geoCountryCode || "KE";
        const countyName = geoCounty || null;

        const rolesArr = Array.isArray(roles) ? roles : roles ? [roles] : [];
        const interestsArr = Array.isArray(areaOfInterest) ? areaOfInterest : areaOfInterest ? [areaOfInterest] : [];

        let photoURL: string | null = (user.photoURL as string | null) || null;
        try {
            if (file) {
                photoURL = await uploadProfilePhoto(file);
            }

            const normalizedHandle =
                "@" +
                stripAt(handle)
                    .toLowerCase()
                    .replace(/[^a-z0-9._]/g, "")
                    .slice(0, 29);

            const userDoc = {
                handle: normalizedHandle,
                handleLower: stripAt(normalizedHandle).toLowerCase(),

                firstName: firstName.trim(),
                surname: surname.trim(),
                dob: dobDate || null,
                gender: gender as Gender,

                phone: user.phoneNumber || null,
                email: user.email || null,

                // Location
                country: countryName,
                countryCode,
                county: countyName,
                countryTag: countryName ? normalizeTag(countryName) : null,
                countyTag: countyName ? normalizeTag(countyName) : null,
                location: coords
                    ? { lat: coords.lat, lng: coords.lng, place: place || null }
                    : null,

                // Interests / Roles + lowercase for indexing
                areaOfInterest: interestsArr,
                areaOfInterestLower: interestsArr.map((s) => s.toLowerCase()),
                roles: rolesArr,
                rolesLower: rolesArr.map((s) => s.toLowerCase()),

                accountType: "standard",
                photoURL,
                bio: "",

                profileViews: 0,
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
            router.replace("/deeds");
        } catch (err: any) {
            setErrorMsg(err?.message || "Could not save your profile.");
        } finally {
            setSaving(false);
        }
    }

    /* ---------- Step header (no chevron; only title + step pills) ---------- */
    function StepHeader({ title }: { title: string }) {
        return (
            <div className="mt-1 mb-2 flex items-center justify-between">
                <div className="p-1 rounded-md" />
                <div className="font-black text-lg" style={{ color: EKARI.text }}>
                    {title}
                </div>
                <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((i) => (
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

    /* ---------- Google Maps bits ---------- */
    const { isLoaded, loadError } = useLoadScript({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries: ["places"],
    });

    const defaultCenter = useMemo(
        () =>
            coords
                ? { lat: coords.lat, lng: coords.lng }
                : { lat: -1.286389, lng: 36.817223 }, // Nairobi CBD default
        [coords]
    );

    // Autocomplete ref so we can read the selected place
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
    const autocompleteInputRef = useRef<HTMLInputElement | null>(null);

    function onAutocompleteLoad(ac: google.maps.places.Autocomplete) {
        autocompleteRef.current = ac;
    }

    function onPlaceChanged() {
        const ac = autocompleteRef.current;
        if (!ac) return;
        const placeObj = ac.getPlace();
        if (!placeObj || !placeObj.geometry || !placeObj.geometry.location) return;
        const lat = placeObj.geometry.location.lat();
        const lng = placeObj.geometry.location.lng();
        setCoords({ lat, lng });
        setPlace(placeObj.formatted_address || placeObj.name || "");
        setLocStatus("ready");
    }
    // shows a subtle "resolving…" state if you want to echo it in UI later
    const [resolvingAddress, setResolvingAddress] = useState(false);
    const geocoderRef = useRef<google.maps.Geocoder | null>(null);

    // create geocoder once Maps is loaded
    useEffect(() => {
        if (isLoaded && !geocoderRef.current) {
            geocoderRef.current = new google.maps.Geocoder();
        }
    }, [isLoaded]);

    async function updateAddressFromCoords(lat: number, lng: number) {
        setResolvingAddress(true);
        try {
            // Try Google client-side geocoder first
            if (geocoderRef.current) {
                const resp = await geocoderRef.current.geocode({ location: { lat, lng } });
                const best = resp.results?.[0];
                if (best?.formatted_address) {
                    setPlace(best.formatted_address);
                    return;
                }
            }
            // Fallback to your API (OpenStreetMap/Nominatim or whatever you wired)
            const g = await reverseGeocode(lat, lng);
            setPlace(g.displayName || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        } catch {
            setPlace(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        } finally {
            setResolvingAddress(false);
        }
    }
    const { signOutUser } = useAuth();
    // inside your component:
    const [confirmOpen, setConfirmOpen] = useState(false);
    const cancelLogout = () => setConfirmOpen(false);
    const confirmLogout = async () => {
        setConfirmOpen(false);
        try { await signOutUser(); } catch { }
        router.replace("/login");
    };

    return (
        <main className="min-h-screen w-full" style={{ backgroundColor: EKARI.sand }}>
            {/* Top bar: cancel/back */}
            <div className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b" style={{ borderColor: EKARI.hair }}>
                <div className="mx-auto max-w-3xl px-5 h-12 flex items-center">
                    <ConfirmModal
                        open={confirmOpen}
                        title="Cancel onboarding?"
                        message="You’ll be signed out and taken to the login page."
                        confirmText="Yes, log me out"
                        cancelText="No, stay here"
                        onConfirm={confirmLogout}
                        onCancel={cancelLogout}
                    />
                </div>
            </div>
            <div className="mx-auto max-w-3xl px-5 pt-6 pb-6">
                <div className="mt-0">
                    {/* STEP 1 — Create profile */}
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
                                    helper={checkingHandle ? "Checking availability…" : handleMsg || undefined}
                                >
                                    <div
                                        className="flex items-center h-12 rounded-xl border px-3 bg-[#F6F7FB]"
                                        style={{ borderColor: EKARI.hair }}
                                    >
                                        <input
                                            placeholder="@handle"
                                            className="w-full bg-transparent outline-none text-base"
                                            style={{ color: EKARI.text }}
                                            value={handle}
                                            onChange={(e) => onChangeHandle(e.target.value)}
                                            autoCapitalize="none"
                                        />
                                        {checkingHandle ? (
                                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                                        ) : handle.length > 0 && handleAvailable !== null ? (
                                            <span
                                                className="ml-2 text-sm font-bold"
                                                style={{ color: handleAvailable ? "#10B981" : "#EF4444" }}
                                            >
                                                {handleAvailable ? "OK" : "X"}
                                            </span>
                                        ) : null}
                                    </div>
                                </Field>

                                <Field label="Date of birth" helper="You must be 18+ to join.">
                                    <div
                                        className="flex items-center h-12 rounded-xl border px-3 bg-[#F6F7FB]"
                                        style={{ borderColor: EKARI.hair }}
                                    >
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

                                <FooterNav
                                    onBack={onBack}
                                    onNext={handleNext}
                                    disableBack={step === 1}
                                    disableNext={!canNext1}
                                />
                            </motion.div>
                        </>
                    )}

                    {/* STEP 2 — Interests */}
                    {step === 2 && (
                        <>
                            <StepHeader title="Choose your interests" />
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-2xl border p-4"
                                style={{ borderColor: EKARI.hair, background: EKARI.sand }}
                            >
                                <div className="text-base" style={{ color: EKARI.forest }}>
                                    Pick what you care about in agriculture.
                                </div>

                                <Field label="">
                                    <SmartPicker
                                        label="Interests"
                                        value={areaOfInterest}
                                        onChange={setAreaOfInterest}
                                        options={INTERESTS}
                                        popular={[]}
                                        groups={INTEREST_GROUPS}
                                        max={10}
                                        ekari={EKARI}
                                        inlineBrowse
                                        placeholder="Search interests (e.g., Maize, Irrigation)"
                                    />
                                </Field>

                                <FooterNav
                                    onBack={onBack}
                                    onNext={handleNext}
                                    disableBack={false}
                                    disableNext={!canNext2}
                                />
                            </motion.div>
                        </>
                    )}

                    {/* STEP 3 — Roles */}
                    {step === 3 && (
                        <>
                            <StepHeader title="What do you do?" />
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-2xl border p-4"
                                style={{ borderColor: EKARI.hair, background: EKARI.sand }}
                            >
                                <div className="text-base" style={{ color: EKARI.forest }}>
                                    Tell us your role(s) in the value chain.
                                </div>

                                <Field label="">
                                    <SmartPicker
                                        label="Roles"
                                        value={roles}
                                        onChange={setRoles}
                                        options={ROLES}
                                        popular={[]}
                                        groups={ROLE_GROUPS}
                                        max={10}
                                        ekari={EKARI}
                                        inlineBrowse
                                        placeholder="Search roles (e.g., Farmer, Aggregator)"
                                    />
                                </Field>

                                <FooterNav
                                    onBack={onBack}
                                    onNext={handleNext}
                                    disableBack={false}
                                    disableNext={!canNext3}
                                />
                            </motion.div>
                        </>
                    )}

                    {/* STEP 4 — Location (Search OR Map) */}
                    {step === 4 && (
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

                                {/* Allow device (browser) location quick pick */}
                                <div
                                    className="mt-3 flex items-center rounded-xl border p-3"
                                    style={{ borderColor: EKARI.hair }}
                                >
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

                                    {/**     <button
                                        onClick={requestLocation}
                                        className="rounded-lg border px-3 py-2 font-extrabold"
                                        style={{ background: "#fff", borderColor: EKARI.hair, color: EKARI.text }}
                                    >
                                        {locStatus === "loading" ? "…" : "Allow"}
                                    </button> */}
                                </div>

                                {/* Tabs: Search vs Map */}
                                <div className="mt-4 flex gap-2">
                                    <button
                                        className="rounded-full px-3 py-1.5 text-sm font-bold border"
                                        style={{
                                            borderColor: locTab === "search" ? EKARI.forest : EKARI.hair,
                                            background: locTab === "search" ? EKARI.forest : "#fff",
                                            color: locTab === "search" ? "#fff" : EKARI.text,
                                        }}
                                        onClick={() => setLocTab("search")}
                                    >
                                        Search by address
                                    </button>
                                    <button
                                        className="rounded-full px-3 py-1.5 text-sm font-bold border"
                                        style={{
                                            borderColor: locTab === "map" ? EKARI.forest : EKARI.hair,
                                            background: locTab === "map" ? EKARI.forest : "#fff",
                                            color: locTab === "map" ? "#fff" : EKARI.text,
                                        }}
                                        onClick={() => setLocTab("map")}
                                    >
                                        Pick on map
                                    </button>
                                </div>

                                {/* Search by address (Google Places Autocomplete) */}
                                {locTab === "search" && (
                                    <div className="mt-3 w-full">
                                        {!isLoaded ? (
                                            <div className="text-sm" style={{ color: EKARI.dim }}>
                                                Loading Google Places…
                                            </div>
                                        ) : loadError ? (
                                            <div className="text-sm" style={{ color: EKARI.danger }}>
                                                Failed to load Google API. Check your NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 w-full">
                                                <Autocomplete onLoad={onAutocompleteLoad} onPlaceChanged={onPlaceChanged}>
                                                    <input
                                                        ref={autocompleteInputRef}
                                                        placeholder="Search an address"
                                                        className="h-12 w-full rounded-xl border px-3 bg-[#F6F7FB] outline-none"
                                                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                                    />
                                                </Autocomplete>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Pick on map */}
                                {locTab === "map" && (
                                    <div className="mt-3">
                                        {!isLoaded ? (
                                            <div className="text-sm" style={{ color: EKARI.dim }}>
                                                Loading Google Map…
                                            </div>
                                        ) : loadError ? (
                                            <div className="text-sm" style={{ color: EKARI.danger }}>
                                                Failed to load Google API. Check your NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
                                            </div>
                                        ) : (
                                            <div className="rounded-2xl overflow-hidden border" style={{ borderColor: EKARI.hair }}>
                                                <GoogleMap
                                                    mapContainerStyle={{ width: "100%", height: 320 }}
                                                    center={defaultCenter}
                                                    zoom={coords ? 14 : 11}
                                                    options={{
                                                        streetViewControl: false,
                                                        fullscreenControl: false,
                                                        // mapTypeControl: true,
                                                        zoomControl: true,
                                                    }}
                                                    onClick={async (e) => {
                                                        const lat = e.latLng?.lat();
                                                        const lng = e.latLng?.lng();
                                                        if (lat != null && lng != null) {
                                                            setCoords({ lat, lng });
                                                            setLocStatus("ready");
                                                            await updateAddressFromCoords(lat, lng); // <-- update address here
                                                        }
                                                    }}
                                                >
                                                    {coords && <Marker position={{ lat: coords.lat, lng: coords.lng }} />}
                                                </GoogleMap>
                                            </div>
                                        )}
                                        <div className="mt-2 text-xs" style={{ color: EKARI.dim }}>
                                            Tap anywhere on the map to drop a pin. You can still edit the label below.
                                        </div>
                                    </div>
                                )}

                                {/**   <Field label="Place (optional)" helper="e.g., Nakuru, Kenya">
                                    <input
                                        placeholder="Type your place/city or landmark"
                                        className="h-12 rounded-xl border px-3 bg-[#F6F7FB] outline-none w-full"
                                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                        value={place}
                                        onChange={(e) => setPlace(e.target.value)}
                                    />
                                </Field> */}

                                {errorMsg && (
                                    <div className="mt-3 text-center font-semibold" style={{ color: EKARI.danger }}>
                                        {errorMsg}
                                    </div>
                                )}

                                <FooterNav onBack={onBack} onNext={handleNext} disableBack={false} disableNext={false} />
                            </motion.div>
                        </>
                    )}

                    {/* STEP 5 — Photo */}
                    {step === 5 && (
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
                                            <img
                                                src={previewUrl}
                                                alt="avatar preview"
                                                className="w-full h-full object-cover"
                                            />
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

                                        {/* “Take photo” on mobile browsers opens camera */}
                                        <label
                                            className="cursor-pointer rounded-full border px-3 py-2 flex items-center gap-2"
                                            style={{ background: "#fff", borderColor: EKARI.hair, color: EKARI.text }}
                                        >
                                            <IoCameraOutline size={16} />
                                            <span className="font-bold">Take photo</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                className="hidden"
                                                onChange={onPickFile}
                                            />
                                        </label>
                                    </div>
                                </div>

                                <FooterNav
                                    onBack={onBack}
                                    onNext={handleNext}
                                    disableBack={false}
                                    disableNext={!(!!user && !uploading && !saving && !authLoading)}
                                    nextLabel="Finish"
                                />

                                {errorMsg && (
                                    <div className="mt-3 text-center font-semibold" style={{ color: EKARI.danger }}>
                                        {errorMsg}
                                    </div>
                                )}
                            </motion.div>
                        </>
                    )}
                </div>

                <div className="h-6" />
            </div>
        </main>
    );
}
