// app/onboarding/page.tsx
"use client";

import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    IoCalendarOutline,
    IoLocationOutline,
    IoImagesOutline,
    IoCameraOutline,
    IoPersonCircleOutline,
    IoMaleOutline,
    IoFemaleOutline,
    IoPersonOutline,
} from "react-icons/io5";
import {
    GoogleMap,
    Marker,
    useLoadScript,
    Autocomplete,
} from "@react-google-maps/api";

import { db, storage } from "@/lib/firebase";
import {
    doc,
    setDoc,
    serverTimestamp,
    collection,
    getDocs,
    query,
    orderBy,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/app/hooks/useAuth";
import {
    INTEREST_GROUPS as STATIC_INTEREST_GROUPS,
    INTERESTS as STATIC_INTERESTS,
    ROLE_GROUPS as STATIC_ROLE_GROUPS,
    ROLES as STATIC_ROLES,
} from "@/app/constants/constants";
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
type Currency = "KES" | "USD";
type GroupConfig = {
    id?: string;
    title: string;
    items: string[];
};

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
            <div
                className="text-[13px] font-extrabold"
                style={{ color: EKARI.text }}
            >
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
        <div role="radiogroup" className="flex flex-wrap gap-2">
            {items.map(({ key, label, Icon }) => {
                const active = value === key;
                return (
                    <button
                        key={key}
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(key)}
                        className="flex items-center rounded-full border px-4 py-2 text-sm"
                        style={{
                            borderColor: active ? EKARI.forest : EKARI.hair,
                            background: active ? EKARI.forest : "#fff",
                            boxShadow: active
                                ? "0 8px 18px rgba(0,0,0,0.1)"
                                : "none",
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
    ekari?: {
        hair: string;
        text: string;
        forest: string;
        gold: string;
        dim: string;
    };
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
            items: q
                ? g.items.filter((i) => i.toLowerCase().includes(q))
                : g.items,
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

    const GroupedList = () => {
        // Flatten + dedupe all items from all packs
        const seen = new Set<string>();
        const flat: string[] = [];
        packs.forEach((g) => {
            g.items.forEach((i) => {
                if (!seen.has(i)) {
                    seen.add(i);
                    flat.push(i);
                }
            });
        });

        return (
            <div className="mt-3 max-h-[60vh] overflow-auto">
                <div className="flex flex-wrap gap-2">
                    {flat.map((i) => {
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
    };


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
                        className="absolute left-1/2 top-1/2 w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white p-4 shadow-xl"
                        style={{ borderColor: ekari.hair }}
                    >
                        <div className="flex items-center justify-between">
                            <div
                                className="font-extrabold"
                                style={{ color: ekari.text }}
                            >
                                {label}
                            </div>
                            <button
                                onClick={() => setOpenModal(false)}
                                className="text-sm font-bold"
                            >
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

                        <div
                            className="mt-4 text-right text-xs"
                            style={{ color: ekari.dim }}
                        >
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
    const { user, loading: authLoading, signOutUser } = useAuth();

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
    const [handleAvailable, setHandleAvailable] = useState<boolean | null>(
        null
    );
    const [handleMsg, setHandleMsg] = useState<string | null>(null);
    const [handleReason, setHandleReason] = useState<string | null>(null);
    const handleCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(
        null
    );
    const abortRef = useRef<AbortController | null>(null);

    const today = new Date();
    const maxDOB = new Date(
        today.getFullYear() - 18,
        today.getMonth(),
        today.getDate()
    ); // 18+
    const minDOB = new Date(1900, 0, 1);

    const isAdult = useMemo(() => {
        if (!dobDate) return false;
        return new Date(dobDate) <= maxDOB;
    }, [dobDate, maxDOB]);
    const quickDecades = [
        { label: "1960s", year: 1965 },
        { label: "1970s", year: 1975 },
        { label: "1980s", year: 1985 },
        { label: "1990s", year: 1995 },
        { label: "2000s", year: 2005 },
    ];

    // Step 2 & 3 selections
    const [areaOfInterest, setAreaOfInterest] = useState<string[]>([]);
    const [roles, setRoles] = useState<string[]>([]);

    // 🔹 Dynamic taxonomy from Firestore
    const [interestGroups, setInterestGroups] = useState<GroupConfig[]>([]);
    const [roleGroups, setRoleGroups] = useState<GroupConfig[]>([]);
    const [taxonomyLoading, setTaxonomyLoading] = useState(true);
    const [taxonomyError, setTaxonomyError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function loadTaxonomy() {
            try {
                setTaxonomyLoading(true);
                setTaxonomyError(null);

                const igSnap = await getDocs(
                    query(collection(db, "interest_groups"), orderBy("order", "asc"))
                );
                const rgSnap = await getDocs(
                    query(collection(db, "role_groups"), orderBy("order", "asc"))
                );

                if (cancelled) return;

                const ig: GroupConfig[] = igSnap.docs
                    .map((d) => {
                        const data = d.data() as any;
                        return {
                            id: d.id,
                            title: data.title ?? d.id,
                            items: Array.isArray(data.items) ? data.items : [],
                        };
                    })
                    .filter((g) => g.items.length);

                const rg: GroupConfig[] = rgSnap.docs
                    .map((d) => {
                        const data = d.data() as any;
                        return {
                            id: d.id,
                            title: data.title ?? d.id,
                            items: Array.isArray(data.items) ? data.items : [],
                        };
                    })
                    .filter((g) => g.items.length);

                setInterestGroups(ig);
                setRoleGroups(rg);
            } catch (e: any) {
                if (!cancelled) {
                    setTaxonomyError("Could not load interest/role options.");
                }
            } finally {
                if (!cancelled) setTaxonomyLoading(false);
            }
        }

        void loadTaxonomy();
        return () => {
            cancelled = true;
        };
    }, []);

    // Use Firestore groups when available, otherwise fall back to constants
    const interestGroupsForUI = interestGroups.length
        ? interestGroups
        : STATIC_INTEREST_GROUPS;

    const roleGroupsForUI = roleGroups.length
        ? roleGroups
        : STATIC_ROLE_GROUPS;

    const interestOptions = useMemo(() => {
        const fromGroups = interestGroupsForUI.flatMap((g) => g.items);
        const all = fromGroups.length ? fromGroups : STATIC_INTERESTS;
        return Array.from(new Set(all));
    }, [interestGroupsForUI]);

    const roleOptions = useMemo(() => {
        const fromGroups = roleGroupsForUI.flatMap((g) => g.items);
        const all = fromGroups.length ? fromGroups : STATIC_ROLES;
        return Array.from(new Set(all));
    }, [roleGroupsForUI]);

    // Step 4
    const [locStatus, setLocStatus] = useState<
        "idle" | "denied" | "loading" | "ready"
    >("idle");
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
        null
    );
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
    }, [
        firstName,
        surname,
        gender,
        dobDate,
        isAdult,
        handle,
        handleAvailable,
    ]);

    const canNext2 = areaOfInterest.length > 0;
    const canNext3 = roles.length > 0;

    /* ---------- Photo ---------- */
    function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0] || null;
        setFile(f);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(f ? URL.createObjectURL(f) : null);
    }

    /* ---------- Flow ---------- */
    const onBack = () =>
        setStep((s) => (s === 1 ? 1 : ((s - 1) as 1 | 2 | 3 | 4 | 5)));
    const handleNext = () => {
        if (step === 5) {
            void saveProfile();
        } else {
            setStep((s) => (s === 5 ? 5 : ((s + 1) as 1 | 2 | 3 | 4 | 5)));
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
            <div className="mt-5 flex gap-3">
                <button
                    onClick={onBack}
                    disabled={disableBack}
                    className="w-1/2 rounded-xl py-3 text-sm font-extrabold border"
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
                    className="w-1/2 rounded-xl py-3 text-sm font-extrabold text-white active:scale-[0.98] transition"
                    style={{
                        background:
                            "linear-gradient(135deg, #C79257, #fbbf77)",
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
            await uploadBytes(rf, bytes, {
                contentType: f.type || "image/jpeg",
            });
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
    async function reverseGeocode(
        lat: number,
        lng: number
    ): Promise<RevGeo> {
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
        // 👇 Auto-derive preferred currency based on country
        let derivedCurrency: Currency = "USD";

        if (countryCode === "KE") {
            // Kenya → KES so M-Pesa is visible by default
            derivedCurrency = "KES";
        } else {
            // Everyone else → USD (global cards)
            derivedCurrency = "USD";
        }
        const rolesArr = Array.isArray(roles) ? roles : roles ? [roles] : [];
        const interestsArr = Array.isArray(areaOfInterest)
            ? areaOfInterest
            : areaOfInterest
                ? [areaOfInterest]
                : [];

        let photoURL: string | null =
            (user.photoURL as string | null) || null;
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
                // 👇 Auto-set based on country
                preferredCurrency: derivedCurrency,
                preferredCurrencyTag: derivedCurrency.toLowerCase(),
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
                areaOfInterestLower: interestsArr.map((s) =>
                    s.toLowerCase()
                ),
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

    /* ---------- Step header (centered title + pill progress) ---------- */
    function StepHeader({ title }: { title: string }) {
        return (
            <div className="mb-3 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: EKARI.dim }}>
                    Onboarding
                </div>
                <div className="font-black text-base md:text-lg" style={{ color: EKARI.text }}>
                    {title}
                </div>
                <div className="flex items-center gap-1.5">

                    {[1, 2, 3, 4, 5].map((i) => (
                        <div
                            key={i}
                            className="h-1.5 rounded-full"
                            style={{
                                width: step === i ? 26 : 12,
                                background: step >= i ? EKARI.gold : "#E5E7EB",
                                transition: "width .2s",
                            }}
                        />
                    ))}
                    <button
                        type="button"
                        onClick={() => setConfirmOpen(true)}
                        className="text-xs px-3 py-1.5 rounded-full border hover:bg-red-50 transition"
                        style={{
                            borderColor: EKARI.hair,
                            color: EKARI.danger,
                            background: "#fff",
                        }}
                    >
                        Cancel onboarding
                    </button>

                    <ConfirmModal
                        open={confirmOpen}
                        title="Cancel onboarding?"
                        message="You’ll be signed out and taken back to login."
                        confirmText="Yes, log me out"
                        cancelText="No, stay here"
                        onConfirm={confirmLogout}
                        onCancel={cancelLogout}
                    />
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
                : { lat: -1.286389, lng: 36.817223 }, // Nairobi default
        [coords]
    );

    // Autocomplete ref so we can read the selected place
    const autocompleteRef =
        useRef<google.maps.places.Autocomplete | null>(null);
    const autocompleteInputRef = useRef<HTMLInputElement | null>(null);

    function onAutocompleteLoad(ac: google.maps.places.Autocomplete) {
        autocompleteRef.current = ac;
    }

    function onPlaceChanged() {
        const ac = autocompleteRef.current;
        if (!ac) return;
        const placeObj = ac.getPlace();
        if (!placeObj || !placeObj.geometry || !placeObj.geometry.location)
            return;
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
                const resp = await geocoderRef.current.geocode({
                    location: { lat, lng },
                });
                const best = resp.results?.[0];
                if (best?.formatted_address) {
                    setPlace(best.formatted_address);
                    return;
                }
            }
            // Fallback to your API
            const g = await reverseGeocode(lat, lng);
            setPlace(g.displayName || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        } catch {
            setPlace(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        } finally {
            setResolvingAddress(false);
        }
    }

    // Logout confirm
    const [confirmOpen, setConfirmOpen] = useState(false);
    const cancelLogout = () => setConfirmOpen(false);
    const confirmLogout = async () => {
        setConfirmOpen(false);
        try {
            await signOutUser();
        } catch {
            /* ignore */
        }
        router.replace("/login");
    };

    // NEW: split DOB for nicer UI
    const [dobYear, setDobYear] = useState<string>("");
    const [dobMonth, setDobMonth] = useState<string>(""); // "01".."12"
    const [dobDay, setDobDay] = useState<string>(""); // "01".."31"

    const years = useMemo(() => {
        const out: number[] = [];
        for (let y = maxDOB.getFullYear(); y >= minDOB.getFullYear(); y--) {
            out.push(y);
        }
        return out;
    }, [maxDOB, minDOB]);

    const months = [
        { label: "Jan", value: "01" },
        { label: "Feb", value: "02" },
        { label: "Mar", value: "03" },
        { label: "Apr", value: "04" },
        { label: "May", value: "05" },
        { label: "Jun", value: "06" },
        { label: "Jul", value: "07" },
        { label: "Aug", value: "08" },
        { label: "Sep", value: "09" },
        { label: "Oct", value: "10" },
        { label: "Nov", value: "11" },
        { label: "Dec", value: "12" },
    ];

    function daysInMonth(year: number, month: number) {
        return new Date(year, month, 0).getDate(); // month 1..12
    }

    const days = useMemo(() => {
        const y = parseInt(dobYear, 10);
        const m = parseInt(dobMonth, 10);
        if (!y || !m) return [];
        const count = daysInMonth(y, m);
        return Array.from({ length: count }, (_, i) =>
            String(i + 1).padStart(2, "0")
        );
    }, [dobYear, dobMonth]);

    function handleDecadeClick(targetYear: number) {
        if (!years.includes(targetYear)) return;

        const yStr = String(targetYear);
        setDobYear(yStr);

        if (dobMonth) {
            const maxDay = daysInMonth(targetYear, parseInt(dobMonth, 10));
            const currentDay = parseInt(dobDay || "0", 10);

            if (!currentDay || currentDay > maxDay) {
                setDobDay(String(Math.min(currentDay || 1, maxDay)).padStart(2, "0"));
            }
        }
    }

    // When user changes any part, recompute dobDate
    useEffect(() => {
        if (dobYear && dobMonth && dobDay) {
            setDobDate(`${dobYear}-${dobMonth}-${dobDay}`);
        } else {
            setDobDate("");
        }
    }, [dobYear, dobMonth, dobDay]);

    // If user comes back and dobDate already set, pre-fill selects
    useEffect(() => {
        if (!dobDate) return;
        const [y, m, d] = dobDate.split("-");
        setDobYear(y || "");
        setDobMonth(m || "");
        setDobDay(d || "");
    }, [dobDate]);

    return (
        <main
            className="min-h-screen w-full"
            style={{
                background:
                    "radial-gradient(circle at top left, rgba(35,63,57,0.12), transparent 55%), radial-gradient(circle at bottom right, rgba(199,146,87,0.16), #F3F4F6)",
            }}
        >
            {/* Top bar: cancel onboarding */}

            <div className="mx-auto max-w-3xl px-5 pt-6 pb-10">
                <motion.div
                    className="rounded-3xl bg-white/90 backdrop-blur-xl border border-white/70 shadow-[0_22px_70px_rgba(15,23,42,0.3)] px-4 py-5 md:px-6 md:py-7"
                    initial={{ opacity: 0, y: 10, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                >
                    {/* STEP 1 — Create profile */}
                    {step === 1 && (
                        <>
                            <StepHeader title="Create your profile" />
                            <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-2xl border px-4 py-4 md:px-5 md:py-5"
                                style={{
                                    borderColor: EKARI.hair,
                                    background: "#F9FAFB",
                                }}
                            >
                                <Field label="Name">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <input
                                            placeholder="First name"
                                            className="h-11 rounded-xl border px-3 bg-[#F6F7FB] outline-none text-sm"
                                            style={{
                                                borderColor: EKARI.hair,
                                                color: EKARI.text,
                                            }}
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                        />
                                        <input
                                            placeholder="Surname"
                                            className="h-11 rounded-xl border px-3 bg-[#F6F7FB] outline-none text-sm"
                                            style={{
                                                borderColor: EKARI.hair,
                                                color: EKARI.text,
                                            }}
                                            value={surname}
                                            onChange={(e) => setSurname(e.target.value)}
                                        />

                                    </div>
                                </Field>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <Field
                                        label="Username"
                                        helper={
                                            checkingHandle
                                                ? "Checking availability…"
                                                : handleMsg || undefined
                                        }
                                    >
                                        <div
                                            className="flex items-center h-11 rounded-xl border px-3 bg-[#F6F7FB]"
                                            style={{ borderColor: EKARI.hair }}
                                        >

                                            <input
                                                placeholder="@handle"
                                                className="w-full bg-transparent outline-none text-sm"
                                                style={{ color: EKARI.text }}
                                                value={handle}
                                                onChange={(e) => onChangeHandle(e.target.value)}
                                                autoCapitalize="none"
                                            />
                                            {checkingHandle ? (
                                                <span className="ml-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                                            ) : handle.length > 0 && handleAvailable !== null ? (
                                                <span
                                                    className="ml-2 text-xs font-bold"
                                                    style={{
                                                        color: handleAvailable ? "#10B981" : "#EF4444",
                                                    }}
                                                >
                                                    {handleAvailable ? "OK" : "X"}
                                                </span>
                                            ) : null}
                                        </div>
                                    </Field>
                                    <Field
                                        label="Email"

                                    >
                                        <div
                                            className="flex items-center h-11 rounded-xl border px-3 bg-[#F6F7FB]"
                                            style={{ borderColor: EKARI.hair }}
                                        >
                                            <input
                                                placeholder="@email"
                                                className="w-full bg-transparent outline-none text-sm"
                                                style={{ color: EKARI.text }}
                                                value={user?.email ?? ""}
                                                autoCapitalize="none"
                                                disabled
                                            />

                                        </div>
                                    </Field>
                                </div>
                                <Field
                                    label="Date of birth"
                                    helper="You must be 18+ to join."
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <IoCalendarOutline
                                            className="mr-1"
                                            size={18}
                                            color={EKARI.dim}
                                        />

                                        <select
                                            className="h-10 rounded-xl border px-2 bg-[#F6F7FB] text-xs md:text-sm"
                                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                            value={dobDay}
                                            onChange={(e) => setDobDay(e.target.value)}
                                        >
                                            <option value="">Day</option>
                                            {days.map((d) => (
                                                <option key={d} value={d}>
                                                    {parseInt(d, 10)}
                                                </option>
                                            ))}
                                        </select>

                                        <select
                                            className="h-10 rounded-xl border px-2 bg-[#F6F7FB] text-xs md:text-sm"
                                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                            value={dobMonth}
                                            onChange={(e) => setDobMonth(e.target.value)}
                                        >
                                            <option value="">Month</option>
                                            {months.map((m) => (
                                                <option key={m.value} value={m.value}>
                                                    {m.label}
                                                </option>
                                            ))}
                                        </select>

                                        <select
                                            className="h-10 rounded-xl border px-2 bg-[#F6F7FB] text-xs md:text-sm"
                                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                            value={dobYear}
                                            onChange={(e) => setDobYear(e.target.value)}
                                        >
                                            <option value="">Year</option>
                                            {years.map((y) => (
                                                <option key={y} value={y}>
                                                    {y}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                                        <span style={{ color: EKARI.dim }}>Quick select:</span>
                                        {quickDecades.map((d) => (
                                            <button
                                                key={d.label}
                                                type="button"
                                                onClick={() => handleDecadeClick(d.year)}
                                                className="rounded-full border px-2 py-1 font-semibold"
                                                style={{
                                                    borderColor: EKARI.hair,
                                                    background: "#fff",
                                                    color: EKARI.text,
                                                }}
                                            >
                                                {d.label}
                                            </button>
                                        ))}
                                    </div>

                                    {!!dobDate && !isAdult && (
                                        <div
                                            className="mt-1 text-xs"
                                            style={{ color: EKARI.dim }}
                                        >
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
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-2xl border px-4 py-4 md:px-5 md:py-5"
                                style={{
                                    borderColor: EKARI.hair,
                                    background: "#F9FAFB",
                                }}
                            >
                                <div
                                    className="text-sm md:text-base"
                                    style={{ color: EKARI.forest }}
                                >
                                    Pick what you care about in agriculture.
                                </div>

                                {taxonomyLoading && (
                                    <div
                                        className="mt-2 text-xs"
                                        style={{ color: EKARI.dim }}
                                    >
                                        Loading interest options…
                                    </div>
                                )}
                                {taxonomyError && (
                                    <div
                                        className="mt-2 text-xs"
                                        style={{ color: EKARI.danger }}
                                    >
                                        {taxonomyError}
                                    </div>
                                )}

                                <Field label="">
                                    <SmartPicker
                                        label="Interests"
                                        value={areaOfInterest}
                                        onChange={setAreaOfInterest}
                                        options={interestOptions}
                                        popular={[]}
                                        groups={interestGroupsForUI}
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
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-2xl border px-4 py-4 md:px-5 md:py-5"
                                style={{
                                    borderColor: EKARI.hair,
                                    background: "#F9FAFB",
                                }}
                            >
                                <div
                                    className="text-sm md:text-base"
                                    style={{ color: EKARI.forest }}
                                >
                                    Tell us your role(s) in the value chain.
                                </div>

                                {taxonomyLoading && (
                                    <div
                                        className="mt-2 text-xs"
                                        style={{ color: EKARI.dim }}
                                    >
                                        Loading role options…
                                    </div>
                                )}
                                {taxonomyError && (
                                    <div
                                        className="mt-2 text-xs"
                                        style={{ color: EKARI.danger }}
                                    >
                                        {taxonomyError}
                                    </div>
                                )}

                                <Field label="">
                                    <SmartPicker
                                        label="Roles"
                                        value={roles}
                                        onChange={setRoles}
                                        options={roleOptions}
                                        popular={[]}
                                        groups={roleGroupsForUI}
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

                    {/* STEP 4 — Location */}
                    {step === 4 && (
                        <>
                            <StepHeader title="Location" />
                            <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-2xl border px-4 py-4 md:px-5 md:py-5"
                                style={{
                                    borderColor: EKARI.hair,
                                    background: "#F9FAFB",
                                }}
                            >
                                <div
                                    className="text-sm"
                                    style={{ color: EKARI.subtext }}
                                >
                                    We’ll show nearby markets and services.
                                </div>

                                {/* Device location summary */}
                                <div
                                    className="mt-3 flex items-center rounded-xl border p-3 bg-white"
                                    style={{ borderColor: EKARI.hair }}
                                >
                                    <IoLocationOutline size={18} color={EKARI.dim} />
                                    <div className="ml-2 flex-1">
                                        {locStatus === "ready" && coords ? (
                                            <>
                                                <div
                                                    className="font-bold text-sm"
                                                    style={{ color: EKARI.text }}
                                                >
                                                    {place || "Location captured"}
                                                </div>
                                                <div
                                                    className="text-xs"
                                                    style={{ color: EKARI.subtext }}
                                                >
                                                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                                                </div>
                                            </>
                                        ) : locStatus === "denied" ? (
                                            <div
                                                className="font-bold text-sm"
                                                style={{ color: EKARI.danger }}
                                            >
                                                Permission denied. You can continue without it.
                                            </div>
                                        ) : (
                                            <div
                                                className="font-bold text-sm"
                                                style={{ color: EKARI.text }}
                                            >
                                                Detect your location for smarter suggestions.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Tabs: Search vs Map */}
                                <div className="mt-4 flex gap-2">
                                    <button
                                        className="rounded-full px-3 py-1.5 text-xs md:text-sm font-bold border"
                                        style={{
                                            borderColor:
                                                locTab === "search" ? EKARI.forest : EKARI.hair,
                                            background:
                                                locTab === "search" ? EKARI.forest : "#fff",
                                            color: locTab === "search" ? "#fff" : EKARI.text,
                                        }}
                                        onClick={() => setLocTab("search")}
                                    >
                                        Search by address
                                    </button>
                                    <button
                                        className="rounded-full px-3 py-1.5 text-xs md:text-sm font-bold border"
                                        style={{
                                            borderColor:
                                                locTab === "map" ? EKARI.forest : EKARI.hair,
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
                                            <div
                                                className="text-sm"
                                                style={{ color: EKARI.dim }}
                                            >
                                                Loading Google Places…
                                            </div>
                                        ) : loadError ? (
                                            <div
                                                className="text-sm"
                                                style={{ color: EKARI.danger }}
                                            >
                                                Failed to load Google API. Check your
                                                NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 w-full">
                                                <Autocomplete
                                                    onLoad={onAutocompleteLoad}
                                                    onPlaceChanged={onPlaceChanged}
                                                >
                                                    <input
                                                        ref={autocompleteInputRef}
                                                        placeholder="Search an address"
                                                        className="h-11 w-full rounded-xl border px-3 bg-[#F6F7FB] outline-none text-sm"
                                                        style={{
                                                            borderColor: EKARI.hair,
                                                            color: EKARI.text,
                                                        }}
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
                                            <div
                                                className="text-sm"
                                                style={{ color: EKARI.dim }}
                                            >
                                                Loading Google Map…
                                            </div>
                                        ) : loadError ? (
                                            <div
                                                className="text-sm"
                                                style={{ color: EKARI.danger }}
                                            >
                                                Failed to load Google API. Check your
                                                NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
                                            </div>
                                        ) : (
                                            <div
                                                className="rounded-2xl overflow-hidden border bg-white"
                                                style={{ borderColor: EKARI.hair }}
                                            >
                                                <GoogleMap
                                                    mapContainerStyle={{
                                                        width: "100%",
                                                        height: 320,
                                                    }}
                                                    center={defaultCenter}
                                                    zoom={coords ? 14 : 11}
                                                    options={{
                                                        streetViewControl: false,
                                                        fullscreenControl: false,
                                                        zoomControl: true,
                                                    }}
                                                    onClick={async (e) => {
                                                        const lat = e.latLng?.lat();
                                                        const lng = e.latLng?.lng();
                                                        if (lat != null && lng != null) {
                                                            setCoords({ lat, lng });
                                                            setLocStatus("ready");
                                                            await updateAddressFromCoords(lat, lng);
                                                        }
                                                    }}
                                                >
                                                    {coords && (
                                                        <Marker
                                                            position={{
                                                                lat: coords.lat,
                                                                lng: coords.lng,
                                                            }}
                                                        />
                                                    )}
                                                </GoogleMap>
                                            </div>
                                        )}
                                        <div
                                            className="mt-2 text-xs"
                                            style={{ color: EKARI.dim }}
                                        >
                                            Tap anywhere on the map to drop a pin. We’ll try to
                                            label it automatically.
                                        </div>
                                        {resolvingAddress && (
                                            <div
                                                className="mt-1 text-xs"
                                                style={{ color: EKARI.dim }}
                                            >
                                                Resolving address…
                                            </div>
                                        )}
                                    </div>
                                )}

                                {errorMsg && (
                                    <div
                                        className="mt-3 text-center font-semibold"
                                        style={{ color: EKARI.danger }}
                                    >
                                        {errorMsg}
                                    </div>
                                )}

                                <FooterNav
                                    onBack={onBack}
                                    onNext={handleNext}
                                    disableBack={false}
                                    disableNext={false}
                                />
                            </motion.div>
                        </>
                    )}

                    {/* STEP 5 — Photo */}
                    {step === 5 && (
                        <>
                            <StepHeader title="Profile photo" />
                            <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-2xl border px-4 py-4 md:px-5 md:py-5"
                                style={{
                                    borderColor: EKARI.hair,
                                    background: "#F9FAFB",
                                }}
                            >
                                <div
                                    className="text-sm"
                                    style={{ color: EKARI.subtext }}
                                >
                                    Show your face or your farm/brand logo.
                                </div>

                                <div className="mt-4 flex flex-col items-center gap-3">
                                    <div
                                        className="flex items-center justify-center overflow-hidden"
                                        style={{
                                            width: 128,
                                            height: 128,
                                            borderRadius: 999,
                                            background:
                                                "conic-gradient(from 140deg, #C79257, #233F39, #C79257)",
                                            padding: 3,
                                        }}
                                    >
                                        <div
                                            className="w-full h-full rounded-full bg-[#F6F7FB] flex items-center justify-center border"
                                            style={{ borderColor: EKARI.hair }}
                                        >
                                            {previewUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={previewUrl}
                                                    alt="avatar preview"
                                                    className="w-full h-full object-cover rounded-full"
                                                />
                                            ) : (
                                                <IoPersonCircleOutline size={96} color={EKARI.dim} />
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap justify-center gap-2">
                                        <label
                                            className="cursor-pointer rounded-full border px-3 py-2 flex items-center gap-2 text-xs md:text-sm font-bold"
                                            style={{
                                                background: "#fff",
                                                borderColor: EKARI.hair,
                                                color: EKARI.text,
                                            }}
                                        >
                                            <IoImagesOutline size={16} />
                                            <span>Choose photo</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={onPickFile}
                                            />
                                        </label>

                                        <label
                                            className="cursor-pointer rounded-full border px-3 py-2 flex items-center gap-2 text-xs md:text-sm font-bold"
                                            style={{
                                                background: "#fff",
                                                borderColor: EKARI.hair,
                                                color: EKARI.text,
                                            }}
                                        >
                                            <IoCameraOutline size={16} />
                                            <span>Take photo</span>
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
                                    disableNext={
                                        !(
                                            !!user &&
                                            !uploading &&
                                            !saving &&
                                            !authLoading
                                        )
                                    }
                                    nextLabel={saving ? "Finishing…" : "Finish"}
                                />

                                {errorMsg && (
                                    <div
                                        className="mt-3 text-center font-semibold"
                                        style={{ color: EKARI.danger }}
                                    >
                                        {errorMsg}
                                    </div>
                                )}
                            </motion.div>
                        </>
                    )}
                </motion.div>
            </div>
        </main>
    );
}
