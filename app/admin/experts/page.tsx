"use client";

import React, {
    useEffect,
    useMemo,
    useState,
} from "react";

import Link from "next/link";

import {
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    writeBatch,
} from "firebase/firestore";

import {
    IoAlertCircleOutline,
    IoCheckmarkCircleOutline,
    IoChevronBack,
    IoChevronForward,
    IoClose,
    IoCloseCircleOutline,
    IoEyeOutline,
    IoLocationOutline,
    IoPauseCircleOutline,
    IoPeopleOutline,
    IoSearch,
    IoShieldCheckmarkOutline,
    IoStarOutline,
} from "react-icons/io5";

import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import { ConfirmModal } from "@/app/components/ConfirmModal";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    white: "#FFFFFF",
    ink: "#111827",
    dim: "#6B7280",
    muted: "#94A3B8",
    hair: "#E5E7EB",
    soft: "#F8FAFC",
    success: "#15803D",
    successSoft: "#ECFDF3",
    warning: "#B45309",
    warningSoft: "#FFF7ED",
    danger: "#B42318",
    dangerSoft: "#FEF3F2",
};

type ExpertStatus =
    | "draft"
    | "active"
    | "paused"
    | "suspended";

type VerificationStatus =
    | "none"
    | "payment_pending"
    | "pending"
    | "approved"
    | "rejected"
    | "expired";

type ExpertCurrency =
    | "KES"
    | "USD";

type StatusFilter =
    | "all"
    | ExpertStatus;

type VerificationFilter =
    | "all"
    | "verified"
    | "pending"
    | "unverified";

type AdminExpert = {
    uid: string;
    displayName: string;
    handle: string;
    photoURL: string;
    headline: string;
    expertBio: string;

    status: ExpertStatus;
    isDiscoverable: boolean;
    acceptingBookings: boolean;

    verificationStatus:
    VerificationStatus;
    verified: boolean;
    verificationRole: string;
    verificationType:
    | "individual"
    | "business"
    | "company";

    organizationName: string;
    specialties: string[];
    languages: string[];
    consultationMethods: string[];

    locationLabel: string;
    country: string;
    region: string;
    city: string;

    pricing: {
        currency:
        ExpertCurrency;
        consultationFee:
        number;
        physicalVisitFeeFrom:
        number | null;
        feeType:
        | "fixed"
        | "starting_from"
        | "free";
        consultationDurationMinutes:
        number;
    };

    ratingAverage: number;
    ratingCount: number;
    completedConsultations: number;

    offersOnlineServices: boolean;
    offersPhysicalVisits: boolean;
    onlineCoverage:
    | "local"
    | "country"
    | "worldwide";

    suspendedReason: string;
};

type ConfirmState = {
    title: string;
    message: string;
    confirmText: string;
    onConfirm:
    () =>
        | void
        | Promise<void>;
} | null;

const PAGE_SIZE_OPTIONS = [
    10,
    20,
    50,
] as const;

function text(
    value: unknown
): string {
    return String(
        value || ""
    ).trim();
}

function numberValue(
    value: unknown
): number {
    const parsed =
        Number(value);

    return Number.isFinite(
        parsed
    )
        ? parsed
        : 0;
}

function normalizeStatus(
    value: unknown
): ExpertStatus {
    return value ===
        "active" ||
        value === "paused" ||
        value ===
        "suspended"
        ? value
        : "draft";
}

function normalizeVerificationStatus(
    value: unknown,
    verified: unknown
): VerificationStatus {
    if (
        value ===
        "payment_pending" ||
        value === "pending" ||
        value === "approved" ||
        value === "rejected" ||
        value === "expired"
    ) {
        return value;
    }

    return verified === true
        ? "approved"
        : "none";
}

function normalizeExpert(
    id: string,
    data: Record<
        string,
        any
    >
): AdminExpert {
    const verificationStatus =
        normalizeVerificationStatus(
            data.verificationStatus,
            data.verified
        );

    const location =
        data.primaryLocation ||
        {};

    const locationLabel =
        text(
            location.label
        ) ||
        [
            text(
                location.city
            ),
            text(
                location.region
            ),
            text(
                location.country
            ),
        ]
            .filter(Boolean)
            .join(", ");

    return {
        uid:
            text(data.uid) ||
            id,

        displayName:
            text(
                data.displayName
            ) ||
            [
                text(
                    data.firstName
                ),
                text(
                    data.surname
                ),
            ]
                .filter(Boolean)
                .join(" ") ||
            text(
                data.organizationName
            ) ||
            "Unnamed expert",

        handle:
            text(data.handle),

        photoURL:
            text(
                data.photoURL
            ),

        headline:
            text(
                data.headline
            ),

        expertBio:
            text(
                data.expertBio
            ),

        status:
            normalizeStatus(
                data.status
            ),

        isDiscoverable:
            data.isDiscoverable ===
            true,

        acceptingBookings:
            data.acceptingBookings !==
            false,

        verificationStatus,

        verified:
            verificationStatus ===
            "approved",

        verificationRole:
            text(
                data.verificationRole
            ),

        verificationType:
            data.verificationType ===
                "business" ||
                data.verificationType ===
                "company"
                ? data.verificationType
                : "individual",

        organizationName:
            text(
                data.organizationName
            ),

        specialties:
            Array.isArray(
                data.specialties
            )
                ? data.specialties
                    .map(text)
                    .filter(Boolean)
                : [],

        languages:
            Array.isArray(
                data.languages
            )
                ? data.languages
                    .map(text)
                    .filter(Boolean)
                : [],

        consultationMethods:
            Array.isArray(
                data.consultationMethods
            )
                ? data.consultationMethods
                    .map(text)
                    .filter(Boolean)
                : [],

        locationLabel,

        country:
            text(
                location.country
            ),

        region:
            text(
                location.region
            ),

        city:
            text(
                location.city
            ),

        pricing: {
            currency:
                data.pricing
                    ?.currency ===
                    "USD"
                    ? "USD"
                    : "KES",

            consultationFee:
                numberValue(
                    data.pricing
                        ?.consultationFee
                ),

            physicalVisitFeeFrom:
                data.pricing
                    ?.physicalVisitFeeFrom ==
                    null
                    ? null
                    : numberValue(
                        data.pricing
                            .physicalVisitFeeFrom
                    ),

            feeType:
                data.pricing
                    ?.feeType ===
                    "free" ||
                    data.pricing
                        ?.feeType ===
                    "starting_from"
                    ? data.pricing
                        .feeType
                    : "fixed",

            consultationDurationMinutes:
                numberValue(
                    data.pricing
                        ?.consultationDurationMinutes
                ),
        },

        ratingAverage:
            numberValue(
                data.rating
                    ?.average
            ),

        ratingCount:
            numberValue(
                data.rating
                    ?.count
            ),

        completedConsultations:
            numberValue(
                data.completedConsultations
            ),

        offersOnlineServices:
            data.serviceCoverage
                ?.offersOnlineServices !==
            false,

        offersPhysicalVisits:
            data.serviceCoverage
                ?.offersPhysicalVisits ===
            true,

        onlineCoverage:
            data.serviceCoverage
                ?.onlineCoverage ===
                "local" ||
                data.serviceCoverage
                    ?.onlineCoverage ===
                "country"
                ? data
                    .serviceCoverage
                    .onlineCoverage
                : "worldwide",

        suspendedReason:
            text(
                data.suspendedReason
            ),
    };
}

function formatMoney(
    amount: number,
    currency:
        ExpertCurrency
): string {
    try {
        return new Intl.NumberFormat(
            currency === "KES"
                ? "en-KE"
                : "en-US",
            {
                style: "currency",
                currency,
                maximumFractionDigits:
                    currency ===
                        "KES"
                        ? 0
                        : 2,
            }
        ).format(amount);
    } catch {
        return `${currency} ${amount.toLocaleString()}`;
    }
}

function feeLabel(
    expert: AdminExpert
): string {
    if (
        expert.pricing
            .feeType ===
        "free" ||
        expert.pricing
            .consultationFee ===
        0
    ) {
        return "Free";
    }

    const value =
        formatMoney(
            expert.pricing
                .consultationFee,
            expert.pricing
                .currency
        );

    return expert.pricing
        .feeType ===
        "starting_from"
        ? `From ${value}`
        : value;
}

function statusBadge(
    status: ExpertStatus
) {
    if (
        status === "active"
    ) {
        return {
            label: "Active",
            bg:
                EKARI.successSoft,
            color:
                EKARI.success,
        };
    }

    if (
        status === "paused"
    ) {
        return {
            label: "Paused",
            bg:
                EKARI.warningSoft,
            color:
                EKARI.warning,
        };
    }

    if (
        status ===
        "suspended"
    ) {
        return {
            label:
                "Suspended",
            bg:
                EKARI.dangerSoft,
            color:
                EKARI.danger,
        };
    }

    return {
        label: "Draft",
        bg: "#F1F5F9",
        color: "#475569",
    };
}

function verificationBadge(
    status:
        VerificationStatus
) {
    if (
        status ===
        "approved"
    ) {
        return {
            label:
                "Verified",
            bg:
                EKARI.successSoft,
            color:
                EKARI.success,
        };
    }

    if (
        status ===
        "pending" ||
        status ===
        "payment_pending"
    ) {
        return {
            label:
                status ===
                    "pending"
                    ? "Pending"
                    : "Payment pending",
            bg:
                EKARI.warningSoft,
            color:
                EKARI.warning,
        };
    }

    if (
        status ===
        "rejected" ||
        status ===
        "expired"
    ) {
        return {
            label:
                status ===
                    "expired"
                    ? "Expired"
                    : "Rejected",
            bg:
                EKARI.dangerSoft,
            color:
                EKARI.danger,
        };
    }

    return {
        label:
            "Unverified",
        bg: "#F1F5F9",
        color: "#475569",
    };
}

export default function AdminExpertsPage() {
    const { user } =
        useAuth();

    const [
        checkingAdmin,
        setCheckingAdmin,
    ] = useState(true);

    const [
        isAdmin,
        setIsAdmin,
    ] =
        useState(false);

    const [
        experts,
        setExperts,
    ] = useState<
        AdminExpert[]
    >([]);

    const [
        loading,
        setLoading,
    ] = useState(true);

    const [
        error,
        setError,
    ] = useState("");

    const [
        search,
        setSearch,
    ] = useState("");

    const [
        statusFilter,
        setStatusFilter,
    ] =
        useState<StatusFilter>(
            "all"
        );

    const [
        verificationFilter,
        setVerificationFilter,
    ] =
        useState<VerificationFilter>(
            "all"
        );

    const [
        acceptingOnly,
        setAcceptingOnly,
    ] = useState(false);

    const [
        currentPage,
        setCurrentPage,
    ] = useState(1);

    const [
        pageSize,
        setPageSize,
    ] = useState<
        (typeof PAGE_SIZE_OPTIONS)[number]
    >(10);

    const [
        selectedExpert,
        setSelectedExpert,
    ] =
        useState<AdminExpert | null>(
            null
        );

    const [
        busyUid,
        setBusyUid,
    ] = useState<
        string | null
    >(null);

    const [
        suspensionReason,
        setSuspensionReason,
    ] = useState("");

    const [
        confirmState,
        setConfirmState,
    ] =
        useState<ConfirmState>(
            null
        );

    const [
        feedback,
        setFeedback,
    ] = useState<
        string | null
    >(null);

    useEffect(() => {
        let cancelled =
            false;

        async function checkAdmin() {
            if (!user) {
                if (!cancelled) {
                    setIsAdmin(false);
                    setCheckingAdmin(
                        false
                    );
                }

                return;
            }

            try {
                const token =
                    await user.getIdTokenResult();

                if (!cancelled) {
                    setIsAdmin(
                        Boolean(
                            (
                                token.claims as any
                            )?.admin
                        )
                    );

                    setCheckingAdmin(
                        false
                    );
                }
            } catch (claimError) {
                console.error(
                    "ADMIN_EXPERTS_CLAIM_FAILED",
                    claimError
                );

                if (!cancelled) {
                    setIsAdmin(false);
                    setCheckingAdmin(
                        false
                    );
                }
            }
        }

        void checkAdmin();

        return () => {
            cancelled = true;
        };
    }, [user]);

    useEffect(() => {
        if (!isAdmin) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");

        const expertsQuery =
            query(
                collection(
                    db,
                    "publicExperts"
                ),
                orderBy(
                    "updatedAt",
                    "desc"
                )
            );

        return onSnapshot(
            expertsQuery,
            (snapshot) => {
                const next =
                    snapshot.docs.map(
                        (item) =>
                            normalizeExpert(
                                item.id,
                                item.data()
                            )
                    );

                setExperts(next);
                setLoading(false);

                setSelectedExpert(
                    (current) => {
                        if (!current) {
                            return null;
                        }

                        return (
                            next.find(
                                (expert) =>
                                    expert.uid ===
                                    current.uid
                            ) ||
                            null
                        );
                    }
                );
            },
            (
                listenerError
            ) => {
                console.error(
                    "ADMIN_EXPERTS_LISTENER_FAILED",
                    listenerError
                );

                setError(
                    listenerError.message ||
                    "Could not load experts."
                );

                setLoading(false);
            }
        );
    }, [isAdmin]);

    useEffect(() => {
        setCurrentPage(1);
    }, [
        search,
        statusFilter,
        verificationFilter,
        acceptingOnly,
        pageSize,
    ]);

    const filteredExperts =
        useMemo(() => {
            const term =
                search
                    .trim()
                    .toLowerCase();

            return experts.filter(
                (expert) => {
                    if (
                        statusFilter !==
                        "all" &&
                        expert.status !==
                        statusFilter
                    ) {
                        return false;
                    }

                    if (
                        verificationFilter ===
                        "verified" &&
                        !expert.verified
                    ) {
                        return false;
                    }

                    if (
                        verificationFilter ===
                        "pending" &&
                        expert.verificationStatus !==
                        "pending" &&
                        expert.verificationStatus !==
                        "payment_pending"
                    ) {
                        return false;
                    }

                    if (
                        verificationFilter ===
                        "unverified" &&
                        (
                            expert.verified ||
                            expert.verificationStatus ===
                            "pending" ||
                            expert.verificationStatus ===
                            "payment_pending"
                        )
                    ) {
                        return false;
                    }

                    if (
                        acceptingOnly &&
                        !expert.acceptingBookings
                    ) {
                        return false;
                    }

                    if (!term) {
                        return true;
                    }

                    return [
                        expert.displayName,
                        expert.handle,
                        expert.headline,
                        expert.verificationRole,
                        expert.organizationName,
                        expert.locationLabel,
                        expert.country,
                        expert.region,
                        expert.city,
                        ...expert.specialties,
                    ].some((value) =>
                        value
                            .toLowerCase()
                            .includes(term)
                    );
                }
            );
        }, [
            acceptingOnly,
            experts,
            search,
            statusFilter,
            verificationFilter,
        ]);

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                filteredExperts.length /
                pageSize
            )
        );

    useEffect(() => {
        if (
            currentPage >
            totalPages
        ) {
            setCurrentPage(
                totalPages
            );
        }
    }, [
        currentPage,
        totalPages,
    ]);

    const pageExperts =
        useMemo(() => {
            const start =
                (currentPage - 1) *
                pageSize;

            return filteredExperts.slice(
                start,
                start + pageSize
            );
        }, [
            currentPage,
            filteredExperts,
            pageSize,
        ]);

    const totals =
        useMemo(() => {
            return experts.reduce(
                (
                    result,
                    expert
                ) => {
                    result.total += 1;

                    if (
                        expert.status ===
                        "active"
                    ) {
                        result.active += 1;
                    }

                    if (
                        expert.verified
                    ) {
                        result.verified += 1;
                    }

                    if (
                        expert.acceptingBookings
                    ) {
                        result.accepting += 1;
                    }

                    return result;
                },
                {
                    total: 0,
                    active: 0,
                    verified: 0,
                    accepting: 0,
                }
            );
        }, [experts]);

    async function applyUpdates(
        expert: AdminExpert,
        updates: Record<
            string,
            unknown
        >
    ) {
        if (
            !user ||
            !isAdmin
        ) {
            return;
        }

        setBusyUid(
            expert.uid
        );

        try {
            const batch =
                writeBatch(db);

            const payload = {
                ...updates,

                updatedAt:
                    serverTimestamp(),

                adminUpdatedAt:
                    serverTimestamp(),

                adminUpdatedBy:
                    user.uid,
            };

            batch.set(
                doc(
                    db,
                    "publicExperts",
                    expert.uid
                ),
                payload,
                {
                    merge: true,
                }
            );

            batch.set(
                doc(
                    db,
                    "expertProfiles",
                    expert.uid
                ),
                payload,
                {
                    merge: true,
                }
            );

            await batch.commit();
        } catch (
        updateError
        ) {
            console.error(
                "ADMIN_EXPERT_UPDATE_FAILED",
                updateError
            );

            setFeedback(
                updateError instanceof
                    Error
                    ? updateError.message
                    : "Could not update this expert."
            );
        } finally {
            setBusyUid(null);
        }
    }

    function confirmActivate(
        expert: AdminExpert
    ) {
        setConfirmState({
            title:
                "Activate expert profile",

            message:
                `Make ${expert.displayName}'s profile active and discoverable?`,

            confirmText:
                "Activate",

            onConfirm:
                async () => {
                    setConfirmState(
                        null
                    );

                    await applyUpdates(
                        expert,
                        {
                            status:
                                "active",

                            isDiscoverable:
                                true,

                            suspendedAt:
                                null,

                            suspendedReason:
                                null,
                        }
                    );
                },
        });
    }

    function confirmPause(
        expert: AdminExpert
    ) {
        setConfirmState({
            title:
                "Pause expert profile",

            message:
                `Pause ${expert.displayName}'s profile? It will be hidden from expert discovery.`,

            confirmText:
                "Pause",

            onConfirm:
                async () => {
                    setConfirmState(
                        null
                    );

                    await applyUpdates(
                        expert,
                        {
                            status:
                                "paused",

                            isDiscoverable:
                                false,
                        }
                    );
                },
        });
    }

    function confirmSuspend(
        expert: AdminExpert
    ) {
        const reason =
            suspensionReason.trim();

        if (!reason) {
            setFeedback(
                "Enter a suspension reason first."
            );
            return;
        }

        setConfirmState({
            title:
                "Suspend expert profile",

            message:
                `Suspend ${expert.displayName}'s profile?\n\nReason: ${reason}`,

            confirmText:
                "Suspend",

            onConfirm:
                async () => {
                    setConfirmState(
                        null
                    );

                    await applyUpdates(
                        expert,
                        {
                            status:
                                "suspended",

                            isDiscoverable:
                                false,

                            acceptingBookings:
                                false,

                            suspendedAt:
                                serverTimestamp(),

                            suspendedReason:
                                reason,
                        }
                    );

                    setSuspensionReason(
                        ""
                    );
                },
        });
    }

    function openExpert(
        expert: AdminExpert
    ) {
        setSelectedExpert(
            expert
        );

        setSuspensionReason(
            expert.suspendedReason
        );
    }

    if (checkingAdmin) {
        return (
            <div className="rounded-3xl border bg-white p-8 text-center text-sm">
                Checking administrator access…
            </div>
        );
    }

    if (
        !user ||
        !isAdmin
    ) {
        return (
            <div className="mx-auto mt-10 max-w-xl rounded-3xl border bg-white p-8 text-center">
                <IoAlertCircleOutline
                    className="mx-auto"
                    size={34}
                    color={
                        EKARI.danger
                    }
                />

                <h1
                    className="mt-3 text-lg font-black"
                    style={{
                        color:
                            EKARI.ink,
                    }}
                >
                    Admin access required
                </h1>
            </div>
        );
    }

    const firstItem =
        filteredExperts.length ===
            0
            ? 0
            : (currentPage - 1) *
            pageSize +
            1;

    const lastItem =
        Math.min(
            currentPage *
            pageSize,
            filteredExperts.length
        );

    return (
        <>
            <div className="space-y-5">
                <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex items-center gap-3">
                        <span
                            className="grid h-11 w-11 place-items-center rounded-2xl"
                            style={{
                                backgroundColor:
                                    "rgba(35,63,57,0.10)",
                                color:
                                    EKARI.forest,
                            }}
                        >
                            <IoPeopleOutline
                                size={23}
                            />
                        </span>

                        <div>
                            <h1
                                className="text-xl font-black"
                                style={{
                                    color:
                                        EKARI.ink,
                                }}
                            >
                                Expert management
                            </h1>

                            <p
                                className="mt-1 text-sm"
                                style={{
                                    color:
                                        EKARI.dim,
                                }}
                            >
                                Review, publish, pause and suspend registered experts.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <Summary
                            label="All"
                            value={
                                totals.total
                            }
                        />

                        <Summary
                            label="Active"
                            value={
                                totals.active
                            }
                        />

                        <Summary
                            label="Verified"
                            value={
                                totals.verified
                            }
                        />

                        <Summary
                            label="Accepting"
                            value={
                                totals.accepting
                            }
                        />
                    </div>
                </header>

                <section
                    className="rounded-3xl border bg-white p-4"
                    style={{
                        borderColor:
                            EKARI.hair,
                    }}
                >
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
                        <label className="relative">
                            <IoSearch
                                className="absolute left-3 top-1/2 -translate-y-1/2"
                                size={17}
                                color={
                                    EKARI.muted
                                }
                            />

                            <input
                                value={
                                    search
                                }
                                onChange={(
                                    event
                                ) =>
                                    setSearch(
                                        event.target
                                            .value
                                    )
                                }
                                placeholder="Search name, handle, specialty or location…"
                                className="h-11 w-full rounded-2xl border bg-white pl-10 pr-4 text-sm outline-none"
                                style={{
                                    borderColor:
                                        EKARI.hair,
                                    color:
                                        EKARI.ink,
                                }}
                            />
                        </label>

                        <select
                            value={
                                statusFilter
                            }
                            onChange={(
                                event
                            ) =>
                                setStatusFilter(
                                    event.target
                                        .value as StatusFilter
                                )
                            }
                            className="h-11 rounded-2xl border bg-white px-3 text-sm font-semibold"
                            style={{
                                borderColor:
                                    EKARI.hair,
                            }}
                        >
                            <option value="all">
                                All statuses
                            </option>

                            <option value="active">
                                Active
                            </option>

                            <option value="draft">
                                Draft
                            </option>

                            <option value="paused">
                                Paused
                            </option>

                            <option value="suspended">
                                Suspended
                            </option>
                        </select>

                        <select
                            value={
                                verificationFilter
                            }
                            onChange={(
                                event
                            ) =>
                                setVerificationFilter(
                                    event.target
                                        .value as VerificationFilter
                                )
                            }
                            className="h-11 rounded-2xl border bg-white px-3 text-sm font-semibold"
                            style={{
                                borderColor:
                                    EKARI.hair,
                            }}
                        >
                            <option value="all">
                                All verification
                            </option>

                            <option value="verified">
                                Verified
                            </option>

                            <option value="pending">
                                Pending
                            </option>

                            <option value="unverified">
                                Unverified
                            </option>
                        </select>

                        <label
                            className="flex h-11 items-center gap-2 rounded-2xl border px-3 text-sm font-bold"
                            style={{
                                borderColor:
                                    EKARI.hair,
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={
                                    acceptingOnly
                                }
                                onChange={(
                                    event
                                ) =>
                                    setAcceptingOnly(
                                        event.target
                                            .checked
                                    )
                                }
                                className="h-4 w-4 accent-[#233F39]"
                            />

                            Accepting only
                        </label>
                    </div>
                </section>

                {error ? (
                    <div
                        className="rounded-2xl border p-4 text-sm"
                        style={{
                            borderColor:
                                "#FECACA",
                            backgroundColor:
                                EKARI.dangerSoft,
                            color:
                                EKARI.danger,
                        }}
                    >
                        {error}
                    </div>
                ) : null}

                <section
                    className="overflow-hidden rounded-3xl border bg-white"
                    style={{
                        borderColor:
                            EKARI.hair,
                    }}
                >
                    <div
                        className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                        style={{
                            borderColor:
                                EKARI.hair,
                        }}
                    >
                        <div>
                            <div className="text-sm font-black">
                                Registered experts
                            </div>

                            <div
                                className="mt-0.5 text-xs"
                                style={{
                                    color:
                                        EKARI.dim,
                                }}
                            >
                                Showing {firstItem}–{lastItem} of {filteredExperts.length}
                            </div>
                        </div>

                        <label className="flex items-center gap-2 text-xs font-bold">
                            Rows

                            <select
                                value={
                                    pageSize
                                }
                                onChange={(
                                    event
                                ) =>
                                    setPageSize(
                                        Number(
                                            event.target
                                                .value
                                        ) as
                                        (typeof PAGE_SIZE_OPTIONS)[number]
                                    )
                                }
                                className="h-9 rounded-xl border bg-white px-3"
                                style={{
                                    borderColor:
                                        EKARI.hair,
                                }}
                            >
                                {PAGE_SIZE_OPTIONS.map(
                                    (size) => (
                                        <option
                                            key={
                                                size
                                            }
                                            value={
                                                size
                                            }
                                        >
                                            {size}
                                        </option>
                                    )
                                )}
                            </select>
                        </label>
                    </div>

                    {loading ? (
                        <div className="p-10 text-center text-sm">
                            Loading experts…
                        </div>
                    ) : pageExperts.length ===
                        0 ? (
                        <div className="p-10 text-center text-sm">
                            No experts match the selected filters.
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-[980px] w-full border-collapse text-left">
                                    <thead
                                        style={{
                                            backgroundColor:
                                                EKARI.soft,
                                        }}
                                    >
                                        <tr>
                                            <Th>
                                                Expert
                                            </Th>

                                            <Th>
                                                Specialty
                                            </Th>

                                            <Th>
                                                Location
                                            </Th>

                                            <Th>
                                                Fee
                                            </Th>

                                            <Th>
                                                Status
                                            </Th>

                                            <Th>
                                                Verification
                                            </Th>

                                            <Th>
                                                Bookings
                                            </Th>

                                            <Th align="right">
                                                Action
                                            </Th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {pageExperts.map(
                                            (
                                                expert
                                            ) => {
                                                const state =
                                                    statusBadge(
                                                        expert.status
                                                    );

                                                const verification =
                                                    verificationBadge(
                                                        expert.verificationStatus
                                                    );

                                                return (
                                                    <tr
                                                        key={
                                                            expert.uid
                                                        }
                                                        className="border-t hover:bg-slate-50"
                                                        style={{
                                                            borderColor:
                                                                EKARI.hair,
                                                        }}
                                                    >
                                                        <Td>
                                                            <div className="flex items-center gap-3">
                                                                {expert.photoURL ? (
                                                                    <img
                                                                        src={
                                                                            expert.photoURL
                                                                        }
                                                                        alt={
                                                                            expert.displayName
                                                                        }
                                                                        className="h-11 w-11 rounded-xl border object-cover"
                                                                        style={{
                                                                            borderColor:
                                                                                EKARI.hair,
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <div
                                                                        className="grid h-11 w-11 place-items-center rounded-xl text-xs font-black text-white"
                                                                        style={{
                                                                            backgroundColor:
                                                                                EKARI.forest,
                                                                        }}
                                                                    >
                                                                        EX
                                                                    </div>
                                                                )}

                                                                <div className="min-w-0">
                                                                    <div className="max-w-[210px] truncate text-sm font-black">
                                                                        {expert.displayName}
                                                                    </div>

                                                                    <div
                                                                        className="mt-0.5 max-w-[210px] truncate text-[11px]"
                                                                        style={{
                                                                            color:
                                                                                EKARI.dim,
                                                                        }}
                                                                    >
                                                                        {expert.handle ||
                                                                            expert.uid}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </Td>

                                                        <Td>
                                                            <div className="max-w-[180px] truncate text-xs font-semibold">
                                                                {expert.specialties[0] ||
                                                                    expert.verificationRole ||
                                                                    "Not specified"}
                                                            </div>
                                                        </Td>

                                                        <Td>
                                                            <div className="flex max-w-[180px] items-center gap-1.5 text-xs">
                                                                <IoLocationOutline
                                                                    className="shrink-0"
                                                                    size={14}
                                                                    color={
                                                                        EKARI.dim
                                                                    }
                                                                />

                                                                <span className="truncate">
                                                                    {expert.locationLabel ||
                                                                        "Not specified"}
                                                                </span>
                                                            </div>
                                                        </Td>

                                                        <Td>
                                                            <span className="text-xs font-black">
                                                                {feeLabel(
                                                                    expert
                                                                )}
                                                            </span>
                                                        </Td>

                                                        <Td>
                                                            <Badge
                                                                label={
                                                                    state.label
                                                                }
                                                                background={
                                                                    state.bg
                                                                }
                                                                color={
                                                                    state.color
                                                                }
                                                            />
                                                        </Td>

                                                        <Td>
                                                            <Badge
                                                                label={
                                                                    verification.label
                                                                }
                                                                background={
                                                                    verification.bg
                                                                }
                                                                color={
                                                                    verification.color
                                                                }
                                                            />
                                                        </Td>

                                                        <Td>
                                                            <span
                                                                className={
                                                                    expert.acceptingBookings
                                                                        ? "text-xs font-black text-emerald-700"
                                                                        : "text-xs font-semibold text-slate-500"
                                                                }
                                                            >
                                                                {expert.acceptingBookings
                                                                    ? "Accepting"
                                                                    : "Closed"}
                                                            </span>
                                                        </Td>

                                                        <Td align="right">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    openExpert(
                                                                        expert
                                                                    )
                                                                }
                                                                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black text-white"
                                                                style={{
                                                                    backgroundColor:
                                                                        EKARI.forest,
                                                                }}
                                                            >
                                                                <IoEyeOutline
                                                                    size={15}
                                                                />

                                                                View
                                                            </button>
                                                        </Td>
                                                    </tr>
                                                );
                                            }
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div
                                className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                                style={{
                                    borderColor:
                                        EKARI.hair,
                                }}
                            >
                                <div
                                    className="text-xs"
                                    style={{
                                        color:
                                            EKARI.dim,
                                    }}
                                >
                                    Page {currentPage} of {totalPages}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        disabled={
                                            currentPage ===
                                            1
                                        }
                                        onClick={() =>
                                            setCurrentPage(
                                                (page) =>
                                                    Math.max(
                                                        1,
                                                        page - 1
                                                    )
                                            )
                                        }
                                        className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border px-3 text-xs font-black disabled:opacity-40"
                                        style={{
                                            borderColor:
                                                EKARI.hair,
                                        }}
                                    >
                                        <IoChevronBack
                                            size={15}
                                        />

                                        Previous
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            currentPage ===
                                            totalPages
                                        }
                                        onClick={() =>
                                            setCurrentPage(
                                                (page) =>
                                                    Math.min(
                                                        totalPages,
                                                        page + 1
                                                    )
                                            )
                                        }
                                        className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border px-3 text-xs font-black disabled:opacity-40"
                                        style={{
                                            borderColor:
                                                EKARI.hair,
                                        }}
                                    >
                                        Next

                                        <IoChevronForward
                                            size={15}
                                        />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </section>
            </div>

            {selectedExpert ? (
                <ExpertModal
                    expert={
                        selectedExpert
                    }
                    busy={
                        busyUid ===
                        selectedExpert.uid
                    }
                    suspensionReason={
                        suspensionReason
                    }
                    setSuspensionReason={
                        setSuspensionReason
                    }
                    onClose={() => {
                        setSelectedExpert(
                            null
                        );

                        setSuspensionReason(
                            ""
                        );
                    }}
                    onToggleBookings={() =>
                        void applyUpdates(
                            selectedExpert,
                            {
                                acceptingBookings:
                                    !selectedExpert.acceptingBookings,
                            }
                        )
                    }
                    onActivate={() =>
                        confirmActivate(
                            selectedExpert
                        )
                    }
                    onPause={() =>
                        confirmPause(
                            selectedExpert
                        )
                    }
                    onSuspend={() =>
                        confirmSuspend(
                            selectedExpert
                        )
                    }
                />
            ) : null}

            <ConfirmModal
                open={Boolean(
                    confirmState
                )}
                title={
                    confirmState?.title ||
                    ""
                }
                message={
                    confirmState?.message ||
                    ""
                }
                confirmText={
                    confirmState?.confirmText ||
                    "Confirm"
                }
                cancelText="Cancel"
                onConfirm={() =>
                    void confirmState?.onConfirm()
                }
                onCancel={() =>
                    setConfirmState(
                        null
                    )
                }
            />

            {feedback ? (
                <div className="fixed inset-0 z-[120] grid place-items-center bg-black/40 px-4">
                    <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
                        <h2 className="text-base font-black">
                            Unable to update expert
                        </h2>

                        <p
                            className="mt-2 text-sm leading-6"
                            style={{
                                color:
                                    EKARI.dim,
                            }}
                        >
                            {feedback}
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                setFeedback(
                                    null
                                )
                            }
                            className="mt-5 h-10 w-full rounded-xl text-sm font-black text-white"
                            style={{
                                backgroundColor:
                                    EKARI.forest,
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            ) : null}
        </>
    );
}

function ExpertModal({
    expert,
    busy,
    suspensionReason,
    setSuspensionReason,
    onClose,
    onToggleBookings,
    onActivate,
    onPause,
    onSuspend,
}: {
    expert: AdminExpert;
    busy: boolean;
    suspensionReason: string;
    setSuspensionReason:
    (value: string) => void;
    onClose: () => void;
    onToggleBookings:
    () => void;
    onActivate:
    () => void;
    onPause:
    () => void;
    onSuspend:
    () => void;
}) {
    const state =
        statusBadge(
            expert.status
        );

    const verification =
        verificationBadge(
            expert.verificationStatus
        );

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-3 py-5"
            onMouseDown={(
                event
            ) => {
                if (
                    event.target ===
                    event.currentTarget
                ) {
                    onClose();
                }
            }}
        >
            <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
                <div
                    className="flex items-center justify-between border-b px-5 py-4"
                    style={{
                        borderColor:
                            EKARI.hair,
                    }}
                >
                    <div>
                        <h2 className="text-lg font-black">
                            Expert details
                        </h2>

                        <p
                            className="mt-0.5 text-xs"
                            style={{
                                color:
                                    EKARI.dim,
                            }}
                        >
                            View profile information and moderation actions.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="grid h-10 w-10 place-items-center rounded-xl border"
                        style={{
                            borderColor:
                                EKARI.hair,
                        }}
                    >
                        <IoClose
                            size={21}
                        />
                    </button>
                </div>

                <div className="max-h-[calc(92vh-74px)] overflow-y-auto p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        {expert.photoURL ? (
                            <img
                                src={
                                    expert.photoURL
                                }
                                alt={
                                    expert.displayName
                                }
                                className="h-24 w-24 rounded-3xl border object-cover"
                                style={{
                                    borderColor:
                                        EKARI.hair,
                                }}
                            />
                        ) : (
                            <div
                                className="grid h-24 w-24 place-items-center rounded-3xl text-xl font-black text-white"
                                style={{
                                    backgroundColor:
                                        EKARI.forest,
                                }}
                            >
                                EX
                            </div>
                        )}

                        <div className="min-w-0 flex-1">
                            <h3 className="text-xl font-black">
                                {expert.displayName}
                            </h3>

                            <p
                                className="mt-1 text-sm"
                                style={{
                                    color:
                                        EKARI.dim,
                                }}
                            >
                                {expert.handle ||
                                    expert.uid}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                                <Badge
                                    label={
                                        state.label
                                    }
                                    background={
                                        state.bg
                                    }
                                    color={
                                        state.color
                                    }
                                />

                                <Badge
                                    label={
                                        verification.label
                                    }
                                    background={
                                        verification.bg
                                    }
                                    color={
                                        verification.color
                                    }
                                />

                                <Badge
                                    label={
                                        expert.acceptingBookings
                                            ? "Accepting bookings"
                                            : "Bookings closed"
                                    }
                                    background={
                                        expert.acceptingBookings
                                            ? EKARI.successSoft
                                            : "#F1F5F9"
                                    }
                                    color={
                                        expert.acceptingBookings
                                            ? EKARI.success
                                            : "#475569"
                                    }
                                />
                            </div>

                            {expert.headline ? (
                                <p className="mt-3 text-sm font-bold">
                                    {expert.headline}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Metric
                            icon={
                                <IoStarOutline />
                            }
                            label="Rating"
                            value={
                                expert.ratingCount
                                    ? `${expert.ratingAverage.toFixed(1)} (${expert.ratingCount})`
                                    : "New"
                            }
                        />

                        <Metric
                            icon={
                                <IoPeopleOutline />
                            }
                            label="Consultations"
                            value={String(
                                expert.completedConsultations
                            )}
                        />

                        <Metric
                            icon={
                                <IoLocationOutline />
                            }
                            label="Location"
                            value={
                                expert.locationLabel ||
                                "Not specified"
                            }
                        />

                        <Metric
                            icon={
                                <IoShieldCheckmarkOutline />
                            }
                            label="Fee"
                            value={feeLabel(
                                expert
                            )}
                        />
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        <InfoCard
                            title="Profile information"
                            rows={[
                                [
                                    "Role",
                                    expert.verificationRole ||
                                    "Not specified",
                                ],
                                [
                                    "Organization",
                                    expert.organizationName ||
                                    "Not specified",
                                ],
                                [
                                    "Profile visibility",
                                    expert.isDiscoverable
                                        ? "Discoverable"
                                        : "Hidden",
                                ],
                                [
                                    "Verification type",
                                    expert.verificationType,
                                ],
                            ]}
                        />

                        <InfoCard
                            title="Service availability"
                            rows={[
                                [
                                    "Online services",
                                    expert.offersOnlineServices
                                        ? "Yes"
                                        : "No",
                                ],
                                [
                                    "Online coverage",
                                    expert.onlineCoverage,
                                ],
                                [
                                    "Physical visits",
                                    expert.offersPhysicalVisits
                                        ? "Yes"
                                        : "No",
                                ],
                                [
                                    "Consultation duration",
                                    expert.pricing
                                        .consultationDurationMinutes
                                        ? `${expert.pricing.consultationDurationMinutes} minutes`
                                        : "Not specified",
                                ],
                            ]}
                        />
                    </div>

                    {expert.expertBio ? (
                        <section className="mt-5">
                            <h4 className="text-xs font-black uppercase tracking-wide">
                                About expert
                            </h4>

                            <p
                                className="mt-2 whitespace-pre-line text-sm leading-6"
                                style={{
                                    color:
                                        EKARI.dim,
                                }}
                            >
                                {expert.expertBio}
                            </p>
                        </section>
                    ) : null}

                    {expert.specialties.length ? (
                        <section className="mt-5">
                            <h4 className="text-xs font-black uppercase tracking-wide">
                                Specialties
                            </h4>

                            <div className="mt-2 flex flex-wrap gap-2">
                                {expert.specialties.map(
                                    (
                                        specialty
                                    ) => (
                                        <span
                                            key={
                                                specialty
                                            }
                                            className="rounded-full px-3 py-1.5 text-[11px] font-bold"
                                            style={{
                                                backgroundColor:
                                                    "rgba(35,63,57,0.08)",
                                                color:
                                                    EKARI.forest,
                                            }}
                                        >
                                            {specialty}
                                        </span>
                                    )
                                )}
                            </div>
                        </section>
                    ) : null}

                    <div
                        className="mt-6 flex flex-wrap gap-2 border-t pt-5"
                        style={{
                            borderColor:
                                EKARI.hair,
                        }}
                    >
                        <Link
                            href={
                                expert.handle
                                    ? `/${encodeURIComponent(
                                        expert.handle
                                    )}`
                                    : `/ekari-experts/${expert.uid}`
                            }
                            target="_blank"
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-black"
                            style={{
                                borderColor:
                                    EKARI.hair,
                                color:
                                    EKARI.forest,
                            }}
                        >
                            <IoEyeOutline
                                size={15}
                            />

                            Public profile
                        </Link>

                        <button
                            type="button"
                            disabled={busy}
                            onClick={
                                onToggleBookings
                            }
                            className="inline-flex h-10 items-center justify-center rounded-xl border px-4 text-xs font-black disabled:opacity-50"
                            style={{
                                borderColor:
                                    EKARI.hair,
                            }}
                        >
                            {expert.acceptingBookings
                                ? "Stop bookings"
                                : "Allow bookings"}
                        </button>

                        {expert.status ===
                            "active" ? (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={onPause}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-black disabled:opacity-50"
                                style={{
                                    borderColor:
                                        "#FED7AA",
                                    color:
                                        EKARI.warning,
                                    backgroundColor:
                                        EKARI.warningSoft,
                                }}
                            >
                                <IoPauseCircleOutline
                                    size={15}
                                />

                                Pause
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={
                                    onActivate
                                }
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black text-white disabled:opacity-50"
                                style={{
                                    backgroundColor:
                                        EKARI.forest,
                                }}
                            >
                                <IoCheckmarkCircleOutline
                                    size={15}
                                />

                                Activate
                            </button>
                        )}
                    </div>

                    <section
                        className="mt-5 rounded-2xl border p-4"
                        style={{
                            borderColor:
                                "#FECACA",
                            backgroundColor:
                                EKARI.dangerSoft,
                        }}
                    >
                        <div
                            className="flex items-center gap-2 text-xs font-black"
                            style={{
                                color:
                                    EKARI.danger,
                            }}
                        >
                            <IoCloseCircleOutline
                                size={17}
                            />

                            Suspend expert profile
                        </div>

                        <textarea
                            value={
                                suspensionReason
                            }
                            onChange={(
                                event
                            ) =>
                                setSuspensionReason(
                                    event.target
                                        .value
                                )
                            }
                            rows={3}
                            placeholder="Enter suspension reason…"
                            className="mt-3 w-full resize-none rounded-xl border bg-white px-3 py-2 text-xs outline-none"
                            style={{
                                borderColor:
                                    "#FECACA",
                            }}
                        />

                        <button
                            type="button"
                            disabled={
                                busy ||
                                !suspensionReason.trim()
                            }
                            onClick={
                                onSuspend
                            }
                            className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl text-xs font-black text-white disabled:opacity-50"
                            style={{
                                backgroundColor:
                                    EKARI.danger,
                            }}
                        >
                            Suspend expert
                        </button>
                    </section>
                </div>
            </div>
        </div>
    );
}

function Summary({
    label,
    value,
}: {
    label: string;
    value: number;
}) {
    return (
        <div
            className="rounded-2xl border bg-white px-3 py-2.5"
            style={{
                borderColor:
                    EKARI.hair,
            }}
        >
            <div className="text-lg font-black">
                {value.toLocaleString()}
            </div>

            <div
                className="text-[10px] font-bold uppercase tracking-wide"
                style={{
                    color:
                        EKARI.dim,
                }}
            >
                {label}
            </div>
        </div>
    );
}

function Metric({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div
            className="rounded-2xl border p-3"
            style={{
                borderColor:
                    EKARI.hair,
            }}
        >
            <div
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide"
                style={{
                    color:
                        EKARI.dim,
                }}
            >
                <span
                    style={{
                        color:
                            EKARI.forest,
                    }}
                >
                    {icon}
                </span>

                {label}
            </div>

            <div
                className="mt-2 truncate text-sm font-black"
                title={value}
            >
                {value}
            </div>
        </div>
    );
}

function InfoCard({
    title,
    rows,
}: {
    title: string;
    rows: Array<
        [string, string]
    >;
}) {
    return (
        <section
            className="rounded-2xl border p-4"
            style={{
                borderColor:
                    EKARI.hair,
            }}
        >
            <h4 className="text-xs font-black uppercase tracking-wide">
                {title}
            </h4>

            <div className="mt-3 space-y-3">
                {rows.map(
                    ([label, value]) => (
                        <div
                            key={label}
                            className="flex items-start justify-between gap-4 text-xs"
                        >
                            <span
                                style={{
                                    color:
                                        EKARI.dim,
                                }}
                            >
                                {label}
                            </span>

                            <strong className="text-right capitalize">
                                {value}
                            </strong>
                        </div>
                    )
                )}
            </div>
        </section>
    );
}

function Badge({
    label,
    background,
    color,
}: {
    label: string;
    background: string;
    color: string;
}) {
    return (
        <span
            className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-black"
            style={{
                backgroundColor:
                    background,
                color,
            }}
        >
            {label}
        </span>
    );
}

function Th({
    children,
    align = "left",
}: {
    children: React.ReactNode;
    align?: "left" | "right";
}) {
    return (
        <th
            className={[
                "px-4 py-3 text-[10px] font-black uppercase tracking-wide",
                align === "right"
                    ? "text-right"
                    : "text-left",
            ].join(" ")}
            style={{
                color:
                    EKARI.dim,
            }}
        >
            {children}
        </th>
    );
}

function Td({
    children,
    align = "left",
}: {
    children: React.ReactNode;
    align?: "left" | "right";
}) {
    return (
        <td
            className={[
                "px-4 py-3 align-middle",
                align === "right"
                    ? "text-right"
                    : "text-left",
            ].join(" ")}
        >
            {children}
        </td>
    );
}