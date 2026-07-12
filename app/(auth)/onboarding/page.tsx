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
    IoCheckmark,
    IoSearchOutline,
    IoCloseOutline,
    IoChevronForwardOutline,
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
    getDoc,
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
type ReferralSource =
    | "facebook"
    | "instagram"
    | "tiktok"
    | "whatsapp"
    | "google"
    | "friend"
    | "field_agent"
    | "event"
    | "other";

const REFERRAL_SOURCES: { key: ReferralSource; label: string }[] = [
    { key: "facebook", label: "Facebook" },
    { key: "instagram", label: "Instagram" },
    { key: "tiktok", label: "TikTok" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "google", label: "Google" },
    { key: "friend", label: "Friend / Referral" },
    { key: "field_agent", label: "Field agent" },
    { key: "event", label: "Event / Training" },
    { key: "other", label: "Other" },
];
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
const POPULAR_INTERESTS = [
    "Maize",
    "Dairy Farming",
    "Poultry",
    "Vegetable Farming",
    "Livestock",
    "Agribusiness",
    "Irrigation",
    "Farm Inputs",
    "Market Access",
    "Organic Farming",
    "Agricultural Technology",
    "Farm Machinery",
];

const POPULAR_ROLES = [
    "Farmer",
    "Agribusiness Owner",
    "Buyer",
    "Seller",
    "Agronomist",
    "Veterinarian",
    "Extension Officer",
    "Input Supplier",
    "Aggregator",
    "Processor",
    "Exporter",
    "Student",
];
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
/* ---------------- SmartPicker ---------------- */

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
    groups?: {
        title: string;
        items: string[];
    }[];
};

function SmartPicker({
    label,
    value,
    onChange,
    options,
    popular = [],
    placeholder = "Search…",
    max = 6,
    ekari = {
        hair: "#E5E7EB",
        text: "#0F172A",
        forest: "#233F39",
        gold: "#C79257",
        dim: "#6B7280",
    },
    groups,
}: SmartPickerProps) {
    const [query, setQuery] = useState("");
    const [openModal, setOpenModal] = useState(false);

    const selectedSet = useMemo(
        () => new Set(value),
        [value]
    );

    const canAddMore = value.length < max;

    const normalizedGroups = useMemo(() => {
        if (groups?.length) {
            return groups.map((group) => ({
                title: group.title,
                items: Array.from(new Set(group.items)),
            }));
        }

        return [
            {
                title: "All",
                items: Array.from(new Set(options)),
            },
        ];
    }, [groups, options]);

    const popularOptions = useMemo(() => {
        const available = new Set(options);

        const requested = popular.filter((item) =>
            available.has(item)
        );

        if (requested.length > 0) {
            return Array.from(new Set(requested)).slice(0, 12);
        }

        return Array.from(new Set(options)).slice(0, 12);
    }, [popular, options]);

    const filteredGroups = useMemo(() => {
        const searchValue = query.trim().toLowerCase();

        if (!searchValue) {
            return normalizedGroups;
        }

        return normalizedGroups
            .map((group) => ({
                ...group,
                items: group.items.filter((item) =>
                    item.toLowerCase().includes(searchValue)
                ),
            }))
            .filter((group) => group.items.length > 0);
    }, [normalizedGroups, query]);

    function toggle(item: string) {
        if (selectedSet.has(item)) {
            onChange(value.filter((selected) => selected !== item));
            return;
        }

        if (!canAddMore) return;

        onChange([...value, item]);
    }

    function closeModal() {
        setOpenModal(false);
        setQuery("");
    }

    return (
        <div className="w-full">
            {/* Selection summary */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div
                        className="text-sm font-black"
                        style={{ color: ekari.text }}
                    >
                        Popular {label.toLowerCase()}
                    </div>

                    <div
                        className="mt-0.5 text-xs"
                        style={{ color: ekari.dim }}
                    >
                        Choose up to {max}
                    </div>
                </div>

                <div
                    className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-black"
                    style={{
                        borderColor:
                            value.length >= max
                                ? ekari.gold
                                : ekari.hair,
                        background:
                            value.length > 0
                                ? "rgba(199,146,87,0.10)"
                                : "#fff",
                        color:
                            value.length > 0
                                ? ekari.forest
                                : ekari.dim,
                    }}
                >
                    {value.length}/{max}
                </div>
            </div>

            {/* Selected items */}
            {value.length > 0 && (
                <div
                    className="mt-4 rounded-2xl border p-3"
                    style={{
                        borderColor: "rgba(199,146,87,0.25)",
                        background:
                            "linear-gradient(135deg, rgba(199,146,87,0.08), rgba(35,63,57,0.04))",
                    }}
                >
                    <div
                        className="mb-2 text-[11px] font-black uppercase tracking-[0.1em]"
                        style={{ color: ekari.dim }}
                    >
                        Your selections
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {value.map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => toggle(item)}
                                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-extrabold text-white transition active:scale-[0.98]"
                                style={{
                                    background: ekari.forest,
                                }}
                                aria-label={`Remove ${item}`}
                            >
                                <IoCheckmark size={14} />

                                <span>{item}</span>

                                <IoCloseOutline
                                    size={14}
                                    className="ml-0.5 opacity-80"
                                />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Popular choices */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {popularOptions.map((item) => {
                    const active = selectedSet.has(item);
                    const disabled = !active && !canAddMore;

                    return (
                        <button
                            key={item}
                            type="button"
                            onClick={() => toggle(item)}
                            disabled={disabled}
                            className="flex min-h-[48px] items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 text-left text-xs font-extrabold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
                            style={{
                                borderColor: active
                                    ? ekari.forest
                                    : ekari.hair,
                                background: active
                                    ? ekari.forest
                                    : "#fff",
                                color: active
                                    ? "#fff"
                                    : ekari.text,
                                boxShadow: active
                                    ? "0 10px 24px rgba(35,63,57,0.18)"
                                    : "0 5px 16px rgba(15,23,42,0.04)",
                            }}
                            aria-pressed={active}
                        >
                            <span className="line-clamp-2">
                                {item}
                            </span>

                            <span
                                className="grid h-6 w-6 shrink-0 place-items-center rounded-full border"
                                style={{
                                    borderColor: active
                                        ? "rgba(255,255,255,0.45)"
                                        : ekari.hair,
                                    background: active
                                        ? "rgba(255,255,255,0.14)"
                                        : "#F9FAFB",
                                }}
                            >
                                {active ? (
                                    <IoCheckmark size={14} />
                                ) : (
                                    <span
                                        className="text-base leading-none"
                                        style={{ color: ekari.dim }}
                                    >
                                        +
                                    </span>
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Browse all */}
            <button
                type="button"
                onClick={() => setOpenModal(true)}
                className="mt-4 flex h-12 w-full items-center justify-between rounded-2xl border bg-white px-4 text-sm font-extrabold transition hover:bg-gray-50 active:scale-[0.99]"
                style={{
                    borderColor: "rgba(199,146,87,0.28)",
                    color: ekari.forest,
                    boxShadow:
                        "0 10px 30px rgba(15,23,42,0.06)",
                }}
            >
                <span className="flex items-center gap-2">
                    <span
                        className="grid h-8 w-8 place-items-center rounded-xl"
                        style={{
                            background:
                                "rgba(199,146,87,0.12)",
                        }}
                    >
                        <IoSearchOutline size={17} />
                    </span>

                    Search or browse all
                </span>

                <IoChevronForwardOutline size={18} />
            </button>

            {!canAddMore && (
                <div
                    className="mt-3 rounded-xl px-3 py-2 text-center text-xs font-semibold"
                    style={{
                        background: "rgba(199,146,87,0.10)",
                        color: ekari.forest,
                    }}
                >
                    You have selected the maximum of {max}.
                    Remove one to choose another.
                </div>
            )}

            {/* Search modal */}
            {openModal && (
                <div className="fixed inset-0 z-[9999]">
                    <button
                        type="button"
                        aria-label="Close picker"
                        className="absolute inset-0 h-full w-full bg-black/45 backdrop-blur-[2px]"
                        onClick={closeModal}
                    />

                    <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[88dvh] w-full max-w-2xl overflow-hidden rounded-t-[28px] bg-white shadow-2xl md:bottom-auto md:left-1/2 md:top-1/2 md:w-[92vw] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[28px]">
                        {/* Handle on mobile */}
                        <div className="flex justify-center pt-2 md:hidden">
                            <div className="h-1.5 w-12 rounded-full bg-gray-300" />
                        </div>

                        {/* Modal header */}
                        <div
                            className="sticky top-0 z-20 border-b bg-white/95 px-4 pb-4 pt-3 backdrop-blur-xl md:px-6 md:pt-5"
                            style={{
                                borderColor: ekari.hair,
                            }}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div
                                        className="text-lg font-black"
                                        style={{ color: ekari.text }}
                                    >
                                        Choose {label.toLowerCase()}
                                    </div>

                                    <div
                                        className="mt-0.5 text-xs"
                                        style={{ color: ekari.dim }}
                                    >
                                        {value.length}/{max} selected
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="grid h-10 w-10 place-items-center rounded-full border bg-white"
                                    style={{
                                        borderColor: ekari.hair,
                                        color: ekari.text,
                                    }}
                                    aria-label="Close"
                                >
                                    <IoCloseOutline size={21} />
                                </button>
                            </div>

                            <div
                                className="mt-4 flex h-12 items-center gap-2 rounded-2xl border px-3"
                                style={{
                                    borderColor: ekari.hair,
                                    background: "#F8FAFC",
                                }}
                            >
                                <IoSearchOutline
                                    size={19}
                                    style={{ color: ekari.dim }}
                                />

                                <input
                                    autoFocus
                                    value={query}
                                    onChange={(event) =>
                                        setQuery(event.target.value)
                                    }
                                    className="h-full flex-1 bg-transparent text-sm font-semibold outline-none"
                                    style={{ color: ekari.text }}
                                    placeholder={placeholder}
                                />

                                {query && (
                                    <button
                                        type="button"
                                        onClick={() => setQuery("")}
                                        className="grid h-8 w-8 place-items-center rounded-full"
                                        aria-label="Clear search"
                                    >
                                        <IoCloseOutline
                                            size={18}
                                            style={{ color: ekari.dim }}
                                        />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Modal options */}
                        <div className="max-h-[calc(88dvh-160px)] overflow-y-auto px-4 py-4 md:px-6">
                            {filteredGroups.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div
                                        className="grid h-14 w-14 place-items-center rounded-2xl"
                                        style={{
                                            background:
                                                "rgba(199,146,87,0.12)",
                                            color: ekari.forest,
                                        }}
                                    >
                                        <IoSearchOutline size={24} />
                                    </div>

                                    <div
                                        className="mt-3 font-black"
                                        style={{ color: ekari.text }}
                                    >
                                        No results found
                                    </div>

                                    <div
                                        className="mt-1 text-sm"
                                        style={{ color: ekari.dim }}
                                    >
                                        Try another search term.
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {filteredGroups.map((group) => (
                                        <section key={group.title}>
                                            <div
                                                className="mb-3 text-xs font-black uppercase tracking-[0.1em]"
                                                style={{
                                                    color: ekari.dim,
                                                }}
                                            >
                                                {group.title}
                                            </div>

                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                {group.items.map(
                                                    (item) => {
                                                        const active =
                                                            selectedSet.has(
                                                                item
                                                            );

                                                        const disabled =
                                                            !active &&
                                                            !canAddMore;

                                                        return (
                                                            <button
                                                                key={item}
                                                                type="button"
                                                                onClick={() =>
                                                                    toggle(
                                                                        item
                                                                    )
                                                                }
                                                                disabled={
                                                                    disabled
                                                                }
                                                                className="flex min-h-[48px] items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-bold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                                                                style={{
                                                                    borderColor:
                                                                        active
                                                                            ? ekari.forest
                                                                            : ekari.hair,
                                                                    background:
                                                                        active
                                                                            ? "rgba(35,63,57,0.07)"
                                                                            : "#fff",
                                                                    color: active
                                                                        ? ekari.forest
                                                                        : ekari.text,
                                                                }}
                                                            >
                                                                <span>
                                                                    {item}
                                                                </span>

                                                                <span
                                                                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full border"
                                                                    style={{
                                                                        borderColor:
                                                                            active
                                                                                ? ekari.forest
                                                                                : ekari.hair,
                                                                        background:
                                                                            active
                                                                                ? ekari.forest
                                                                                : "#fff",
                                                                        color: active
                                                                            ? "#fff"
                                                                            : ekari.dim,
                                                                    }}
                                                                >
                                                                    {active ? (
                                                                        <IoCheckmark
                                                                            size={
                                                                                16
                                                                            }
                                                                        />
                                                                    ) : (
                                                                        "+"
                                                                    )}
                                                                </span>
                                                            </button>
                                                        );
                                                    }
                                                )}
                                            </div>
                                        </section>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal footer */}
                        <div
                            className="sticky bottom-0 border-t bg-white/95 p-4 backdrop-blur-xl md:px-6"
                            style={{
                                borderColor: ekari.hair,
                            }}
                        >
                            <button
                                type="button"
                                onClick={closeModal}
                                className="h-12 w-full rounded-2xl text-sm font-black text-white transition active:scale-[0.99]"
                                style={{
                                    background:
                                        "linear-gradient(135deg, #C79257, #233F39)",
                                    boxShadow:
                                        "0 12px 30px rgba(35,63,57,0.22)",
                                }}
                            >
                                Done · {value.length} selected
                            </button>
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
    // User must have a profile image before finishing onboarding
    const [authEmail, setAuthEmail] = useState<string | null>(null);
    const [existingPhotoURL, setExistingPhotoURL] = useState<string | null>(null);
    const [loadingAuthProfile, setLoadingAuthProfile] = useState(true);
    const [nameFromProvider, setNameFromProvider] = useState(false);
    const [referralSource, setReferralSource] = useState<ReferralSource | null>(null);
    // Guard: if auth resolved and no user → go to login
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace("/login");
        }
    }, [authLoading, user, router]);
    useEffect(() => {
        let cancelled = false;

        async function loadAuthProfile() {
            if (!user?.uid) {
                setLoadingAuthProfile(false);
                return;
            }

            try {
                const snap = await getDoc(doc(db, "users", user.uid));
                const data = snap.exists() ? (snap.data() as any) : {};

                if (cancelled) return;

                const providerName = data.providerDisplayName || user.displayName || "";
                const parts = String(providerName).trim().split(/\s+/);

                const providerFirstName = data.firstName || parts[0] || "";
                const providerSurname = data.surname || parts.slice(1).join(" ") || "";

                if (providerFirstName) setFirstName(providerFirstName);
                if (providerSurname) setSurname(providerSurname);

                setNameFromProvider(Boolean(providerFirstName || providerSurname));
                setAuthEmail(data.email || user.email || null);

                if (data.photoURL || data.providerPhotoURL || user.photoURL) {
                    setExistingPhotoURL(data.photoURL || data.providerPhotoURL || user.photoURL);
                }
            } finally {
                if (!cancelled) setLoadingAuthProfile(false);
            }
        }

        loadAuthProfile();

        return () => {
            cancelled = true;
        };
    }, [user?.uid]);
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
    const hasProfilePhoto = Boolean(file || existingPhotoURL || user?.photoURL);
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
            !loadingAuthProfile &&
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
        loadingAuthProfile,
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
    const onBack = async () => {
        if (step === 1) {
            try {
                await signOutUser(); // logout
            } catch (e) {
                console.log("Logout error:", e);
            }

            router.replace("/login");
            return;
        }

        setStep((s) => ((s - 1) as 1 | 2 | 3 | 4 | 5));
    };
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
        // ⛔ NEW: Require profile photo before saving
        if (!file && !user.photoURL) {
            setErrorMsg("Please upload or take a profile photo before finishing.");
            // make sure we are on step 5 just in case
            setStep(5);
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

        let photoURL = existingPhotoURL || user.photoURL || "";
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
                referralSource,
                referralSourceLabel:
                    REFERRAL_SOURCES.find((x) => x.key === referralSource)?.label ?? null,
                trafficSource: referralSource,
                createdAt: now,
                updatedAt: now,
                premiumUntil: null,
                isSuspended: false,
                isDeactivated: false,
                onboarded: true,
            };

            await setDoc(doc(db, "users", uid), userDoc, { merge: true });
            router.replace("/");
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
                                    {nameFromProvider ? (
                                        <div className="space-y-3">
                                            <div
                                                className="rounded-xl border px-3 py-3 text-sm"
                                                style={{ borderColor: EKARI.hair, background: "#F6F7FB" }}
                                            >
                                                <div className="font-bold" style={{ color: EKARI.text }}>
                                                    {firstName} {surname}
                                                </div>

                                                {authEmail && (
                                                    <div className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                                                        {authEmail}
                                                    </div>
                                                )}

                                                <div className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                                                    Name and email were provided by Google. You can complete missing details below.
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <input
                                                    value={firstName}
                                                    onChange={(e) => setFirstName(e.target.value)}
                                                    placeholder="First name"
                                                    className="rounded-xl border px-3 py-3 text-sm"
                                                    style={{ borderColor: EKARI.hair }}
                                                />

                                                <input
                                                    value={surname}
                                                    onChange={(e) => setSurname(e.target.value)}
                                                    placeholder="Surname"
                                                    className="rounded-xl border px-3 py-3 text-sm"
                                                    style={{ borderColor: EKARI.hair }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <input
                                                value={firstName}
                                                onChange={(e) => setFirstName(e.target.value)}
                                                placeholder="First name"
                                                className="rounded-xl border px-3 py-3 text-sm"
                                                style={{ borderColor: EKARI.hair }}
                                            />
                                            <input
                                                value={surname}
                                                onChange={(e) => setSurname(e.target.value)}
                                                placeholder="Surname"
                                                className="rounded-xl border px-3 py-3 text-sm"
                                                style={{ borderColor: EKARI.hair }}
                                            />
                                        </div>
                                    )}
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
                                    disableBack={false}   // ✅ allow click
                                    disableNext={!canNext1}
                                />
                            </motion.div>
                            {!canNext1 && (
                                <div className="mt-3 text-xs font-semibold" style={{ color: EKARI.danger }}>
                                    {!firstName.trim() ? "First name missing." :
                                        !surname.trim() ? "Surname missing." :
                                            !gender ? "Select gender." :
                                                !dobDate ? "Select date of birth." :
                                                    !isAdult ? "User must be 18+." :
                                                        handleAvailable !== true ? "Username must show OK before continuing." :
                                                            "Complete all required fields."}
                                </div>
                            )}
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
                                        popular={POPULAR_INTERESTS}
                                        groups={interestGroupsForUI}
                                        max={6}
                                        ekari={EKARI}
                                        placeholder="Search crops, livestock, technology…"
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
                                        popular={POPULAR_ROLES}
                                        groups={roleGroupsForUI}
                                        max={4}
                                        ekari={EKARI}
                                        placeholder="Search farmer, buyer, agronomist…"
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
                                    <div className="mt-2 text-xs text-center" style={{ color: EKARI.dim }}>
                                        A profile photo is required to finish onboarding.
                                    </div>
                                </div>
                                <Field
                                    label="How did you hear about ekarihub?"
                                    helper="This helps us know which channels are working."
                                >
                                    <div className="flex flex-wrap gap-2">
                                        {REFERRAL_SOURCES.map((item) => {
                                            const active = referralSource === item.key;

                                            return (
                                                <button
                                                    key={item.key}
                                                    type="button"
                                                    onClick={() => setReferralSource(item.key)}
                                                    className="rounded-full border px-3 py-2 text-xs font-bold"
                                                    style={{
                                                        borderColor: active ? EKARI.forest : EKARI.hair,
                                                        background: active ? EKARI.forest : "#fff",
                                                        color: active ? "#fff" : EKARI.text,
                                                    }}
                                                >
                                                    {item.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </Field>
                                <FooterNav
                                    onBack={onBack}
                                    onNext={handleNext}
                                    disableBack={false}
                                    disableNext={
                                        !(
                                            !!user &&
                                            !uploading &&
                                            !saving &&
                                            !authLoading &&
                                            hasProfilePhoto &&
                                            !!referralSource
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
