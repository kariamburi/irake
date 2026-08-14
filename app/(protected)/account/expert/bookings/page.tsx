"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
    collection,
    doc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
    writeBatch,
} from "firebase/firestore";
import {
    IoArrowBack,
    IoCalendarClearOutline,
    IoCheckmarkCircleOutline,
    IoCloseCircleOutline,
    IoHourglassOutline,
    IoPersonOutline,
    IoTimeOutline,
    IoCheckmarkOutline,
    IoFilterOutline,
    IoOpenOutline,
    IoShieldCheckmarkOutline,
    IoWalletOutline,
    IoBriefcaseOutline,
    IoCalendarOutline,
} from "react-icons/io5";
import { motion, AnimatePresence } from "framer-motion";

import AppShell from "@/app/components/AppShell";
import { useAuth } from "@/app/hooks/useAuth";
import { db } from "@/lib/firebase";

const EKARI = {
    forest: "#173C2E",
    forestSoft: "#214C3A",
    orange: "#F39A22",
    canvas: "#F8F7F2",
    paper: "#FBFAF6",
    text: "#111827",
    subtext: "#64748B",
    hair: "#DDD8CC",
    success: "#15803D",
    danger: "#B42318",
};

type BookingStatus =
    | "pending"
    | "accepted"
    | "declined"
    | "completed"
    | "cancelled";

type PaymentStatus =
    | "unpaid"
    | "pending"
    | "paid"
    | "refunded";

type ExpertBooking = {
    id: string;
    expertId: string;
    clientId: string;
    clientName: string;
    clientPhotoURL?: string | null;
    clientEmail?: string | null;
    consultationMethod: string;
    consultationDate: string;
    consultationTime: string;
    consultationDurationMinutes?: number | null;
    topic: string;
    message: string;
    fee: number;
    feeType?: "fixed" | "starting_from" | "free";
    currency: string;
    status: BookingStatus;
    paymentStatus: PaymentStatus;
    createdAt?: any;
    updatedAt?: any;
};

type FilterKey =
    | "all"
    | BookingStatus;

function titleCase(value: string) {
    return value
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (character) =>
            character.toUpperCase()
        );
}

function money(
    amount: number,
    currency = "KES"
) {
    return currency === "KES"
        ? `KSh ${Number(
            amount || 0
        ).toLocaleString("en-KE", {
            maximumFractionDigits: 0,
        })}`
        : `${currency} ${Number(
            amount || 0
        ).toLocaleString()}`;
}

function statusStyles(
    status: BookingStatus
) {
    if (status === "accepted") {
        return "border-blue-200 bg-blue-50 text-blue-700";
    }

    if (status === "completed") {
        return "border-green-200 bg-green-50 text-green-700";
    }

    if (status === "declined") {
        return "border-red-200 bg-red-50 text-red-700";
    }

    if (status === "cancelled") {
        return "border-slate-200 bg-slate-100 text-slate-600";
    }

    return "border-amber-200 bg-amber-50 text-amber-700";
}

function paymentStyles(
    status: PaymentStatus
) {
    if (status === "paid") {
        return "bg-emerald-50 text-emerald-700";
    }

    if (status === "pending") {
        return "bg-amber-50 text-amber-700";
    }

    if (status === "refunded") {
        return "bg-blue-50 text-blue-700";
    }

    return "bg-slate-100 text-slate-500";
}

function SafeClientAvatar({
    src,
    alt,
    size = 52,
}: {
    src?: string | null;
    alt: string;
    size?: number;
}) {
    const [failed, setFailed] =
        React.useState(false);

    React.useEffect(() => {
        setFailed(false);
    }, [src]);

    const hasImage =
        !!src?.trim() && !failed;

    return (
        <div
            className="relative shrink-0 overflow-hidden rounded-full border border-[#DDD8CC] bg-[#E8ECE8]"
            style={{
                width: size,
                height: size,
            }}
        >
            {hasImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={src || ""}
                    alt={alt}
                    className="h-full w-full object-cover"
                    onError={() =>
                        setFailed(true)
                    }
                />
            ) : (
                <div className="grid h-full w-full place-items-center bg-[#E8ECE8] text-[#173C2E]">
                    <IoPersonOutline
                        size={Math.round(
                            size * 0.48
                        )}
                    />
                </div>
            )}
        </div>
    );
}

export default function ExpertBookingsPage() {
    const router = useRouter();
    const { user } = useAuth();

    const [bookings, setBookings] =
        React.useState<
            ExpertBooking[]
        >([]);

    const [loading, setLoading] =
        React.useState(true);

    const [filter, setFilter] =
        React.useState<FilterKey>(
            "all"
        );

    const [updatingId, setUpdatingId] =
        React.useState<
            string | null
        >(null);

    const [error, setError] =
        React.useState("");

    React.useEffect(() => {
        if (!user?.uid) {
            setBookings([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const bookingsQuery = query(
            collection(
                db,
                "expertBookings"
            ),
            where(
                "expertId",
                "==",
                user.uid
            ),
            orderBy(
                "createdAt",
                "desc"
            )
        );

        const unsubscribe = onSnapshot(
            bookingsQuery,
            (snapshot) => {
                setBookings(
                    snapshot.docs.map(
                        (
                            bookingDocument
                        ) => ({
                            id:
                                bookingDocument.id,
                            ...(bookingDocument.data() as Omit<
                                ExpertBooking,
                                "id"
                            >),
                        })
                    )
                );

                setLoading(false);
            },
            (snapshotError) => {
                console.error(
                    "LOAD_EXPERT_BOOKINGS_FAILED",
                    snapshotError
                );

                setError(
                    snapshotError.message.includes(
                        "index"
                    )
                        ? "Firestore needs the expert bookings index. Open the index link shown in the browser console, create it, then reload this page."
                        : snapshotError.message ||
                        "Could not load consultation requests."
                );

                setLoading(false);
            }
        );

        return unsubscribe;
    }, [user?.uid]);

    async function clearExpertBookingBadges(
        expertId: string
    ): Promise<void> {
        const unreadQuery = query(
            collection(
                db,
                "expertBookings"
            ),
            where(
                "expertId",
                "==",
                expertId
            ),
            where(
                "expertUnread",
                "==",
                true
            )
        );

        const unreadSnapshot =
            await getDocs(
                unreadQuery
            );

        if (
            unreadSnapshot.empty
        ) {
            return;
        }

        const batch =
            writeBatch(db);

        unreadSnapshot.docs.forEach(
            (
                bookingDocument
            ) => {
                batch.update(
                    bookingDocument.ref,
                    {
                        expertUnread:
                            false,
                        expertReadAt:
                            serverTimestamp(),
                        updatedAt:
                            serverTimestamp(),
                    }
                );
            }
        );

        await batch.commit();
    }

    React.useEffect(() => {
        if (!user?.uid) {
            return;
        }

        void clearExpertBookingBadges(
            user.uid
        ).catch((error) => {
            console.error(
                "CLEAR_EXPERT_BOOKING_BADGES_FAILED",
                error
            );
        });
    }, [user?.uid]);

    const visibleBookings =
        React.useMemo(
            () =>
                filter === "all"
                    ? bookings
                    : bookings.filter(
                        (
                            booking
                        ) =>
                            booking.status ===
                            filter
                    ),
            [bookings, filter]
        );

    const counts =
        React.useMemo(() => {
            const result: Record<
                FilterKey,
                number
            > = {
                all: bookings.length,
                pending: 0,
                accepted: 0,
                declined: 0,
                completed: 0,
                cancelled: 0,
            };

            bookings.forEach(
                (booking) => {
                    result[
                        booking.status
                    ] += 1;
                }
            );

            return result;
        }, [bookings]);

    const paidCount =
        React.useMemo(
            () =>
                bookings.filter(
                    (booking) =>
                        booking.paymentStatus ===
                        "paid"
                ).length,
            [bookings]
        );

    const totalPaidValue =
        React.useMemo(
            () =>
                bookings
                    .filter(
                        (booking) =>
                            booking.paymentStatus ===
                            "paid" &&
                            booking.currency ===
                            "KES"
                    )
                    .reduce(
                        (
                            total,
                            booking
                        ) =>
                            total +
                            Number(
                                booking.fee ||
                                0
                            ),
                        0
                    ),
            [bookings]
        );

    async function updateStatus(
        booking: ExpertBooking,
        nextStatus: BookingStatus
    ) {
        if (
            !user?.uid ||
            booking.expertId !==
            user.uid ||
            updatingId
        ) {
            return;
        }

        const allowed =
            (booking.status ===
                "pending" &&
                [
                    "accepted",
                    "declined",
                ].includes(
                    nextStatus
                )) ||
            (booking.status ===
                "accepted" &&
                nextStatus ===
                "completed");

        if (!allowed) {
            setError(
                "That booking status change is not allowed."
            );
            return;
        }

        try {
            setUpdatingId(
                booking.id
            );

            setError("");

            await updateDoc(
                doc(
                    db,
                    "expertBookings",
                    booking.id
                ),
                {
                    status:
                        nextStatus,
                    updatedAt:
                        serverTimestamp(),
                    ...(nextStatus ===
                        "accepted"
                        ? {
                            acceptedAt:
                                serverTimestamp(),
                        }
                        : {}),
                    ...(nextStatus ===
                        "declined"
                        ? {
                            declinedAt:
                                serverTimestamp(),
                        }
                        : {}),
                    ...(nextStatus ===
                        "completed"
                        ? {
                            completedAt:
                                serverTimestamp(),
                        }
                        : {}),
                }
            );
        } catch (
        updateError: any
        ) {
            console.error(
                "UPDATE_EXPERT_BOOKING_FAILED",
                updateError
            );

            setError(
                updateError?.message ||
                "Could not update this booking."
            );
        } finally {
            setUpdatingId(null);
        }
    }

    if (!user) {
        return (
            <AppShell>
                <main className="grid h-full min-h-0 place-items-center overflow-y-auto bg-[#F8F7F2] px-4 py-10">
                    <motion.div
                        initial={{
                            opacity: 0,
                            y: 6,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                        }}
                        className="w-full max-w-md rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-7 text-center shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
                    >
                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#E8ECE8] text-[#173C2E]">
                            <IoPersonOutline
                                size={25}
                            />
                        </div>

                        <h1 className="mt-4 text-[18px] font-black text-slate-900">
                            Sign in required
                        </h1>

                        <p className="mt-2 text-[12px] font-medium leading-5 text-slate-500">
                            Sign in to manage your expert consultation requests.
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                router.push(
                                    "/login?redirect=/account/expert/bookings"
                                )
                            }
                            className="mt-5 h-10 rounded-xl bg-[#173C2E] px-5 text-[11px] font-black text-white transition hover:-translate-y-0.5 hover:bg-[#214C3A]"
                        >
                            Sign in
                        </button>
                    </motion.div>
                </main>
            </AppShell>
        );
    }

    const filters: FilterKey[] = [
        "all",
        "pending",
        "accepted",
        "completed",
        "declined",
        "cancelled",
    ];

    return (
        <AppShell>
            <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#F8F7F2]">
                {/* HERO */}
                <motion.header
                    initial={{
                        opacity: 0,
                        y: -6,
                    }}
                    animate={{
                        opacity: 1,
                        y: 0,
                    }}
                    transition={{
                        duration: 0.24,
                        ease: "easeOut",
                    }}
                    className="relative shrink-0 overflow-hidden bg-[#173C2E] text-white"
                >
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.07]"
                        style={{
                            backgroundImage:
                                "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.6) 18px 19px)",
                        }}
                    />

                    <div className="relative mx-auto max-w-[1180px] px-4 py-5 md:px-6 md:py-6">
                        <div className="flex items-start gap-3">
                            <button
                                type="button"
                                onClick={() =>
                                    router.push(
                                        "/account/expert"
                                    )
                                }
                                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-white transition hover:bg-white/[0.11] active:scale-95"
                                aria-label="Back to expert settings"
                            >
                                <IoArrowBack
                                    size={19}
                                />
                            </button>

                            <div className="min-w-0 flex-1">
                                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#F39A22]">
                                    ekari Expert
                                </div>

                                <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <h1 className="text-[24px] font-black tracking-[-0.035em] md:text-[28px]">
                                            Consultation requests
                                        </h1>

                                        <p className="mt-1 max-w-2xl text-[11px] font-medium leading-5 text-white/50 md:text-[12px]">
                                            Review client requests, manage consultations and keep bookings moving.
                                        </p>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-2">
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1.5 text-[10px] font-black text-amber-200">
                                            <span className="h-2 w-2 rounded-full bg-amber-300" />
                                            {counts.pending} pending
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.header>

                {/* FILTER BAR */}
                <div className="shrink-0 border-b border-[#DDD8CC] bg-[#FBFAF6]">
                    <div className="mx-auto flex max-w-[1180px] items-center gap-2 overflow-x-auto px-4 no-scrollbar md:px-6">
                        <div className="mr-1 hidden items-center gap-1.5 text-[10px] font-black text-slate-400 sm:flex">
                            <IoFilterOutline
                                size={13}
                            />
                            Filter
                        </div>

                        {filters.map(
                            (key) => {
                                const active =
                                    filter ===
                                    key;

                                return (
                                    <button
                                        key={
                                            key
                                        }
                                        type="button"
                                        onClick={() =>
                                            setFilter(
                                                key
                                            )
                                        }
                                        className={[
                                            "relative inline-flex h-12 shrink-0 items-center gap-1.5 px-3",
                                            "text-[11px] font-black transition-colors",
                                            active
                                                ? "text-[#173C2E]"
                                                : "text-slate-400 hover:text-slate-700",
                                        ].join(
                                            " "
                                        )}
                                    >
                                        {titleCase(
                                            key
                                        )}

                                        {counts[
                                            key
                                        ] >
                                            0 ? (
                                            <span
                                                className={[
                                                    "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[9px]",
                                                    active
                                                        ? "bg-[#F39A22] text-white"
                                                        : "bg-[#EFECE5] text-slate-500",
                                                ].join(
                                                    " "
                                                )}
                                            >
                                                {counts[
                                                    key
                                                ] >
                                                    99
                                                    ? "99+"
                                                    : counts[
                                                    key
                                                    ]}
                                            </span>
                                        ) : null}

                                        {active ? (
                                            <motion.span
                                                layoutId="expert-booking-filter"
                                                className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[#173C2E]"
                                                transition={{
                                                    type: "spring",
                                                    stiffness:
                                                        420,
                                                    damping:
                                                        34,
                                                }}
                                            />
                                        ) : null}
                                    </button>
                                );
                            }
                        )}
                    </div>
                </div>

                {/* SCROLLABLE WORKSPACE */}
                <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-[#F8F7F2] [-webkit-overflow-scrolling:touch]">
                    <div className="mx-auto grid max-w-[1180px] gap-5 px-3 py-4 sm:px-4 md:px-6 md:py-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
                        <div className="min-w-0">
                            <AnimatePresence mode="popLayout">
                                {error ? (
                                    <motion.div
                                        key="error"
                                        initial={{
                                            opacity: 0,
                                            y: -4,
                                        }}
                                        animate={{
                                            opacity: 1,
                                            y: 0,
                                        }}
                                        exit={{
                                            opacity: 0,
                                            y: -4,
                                        }}
                                        className="mb-4 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-700"
                                    >
                                        {error}
                                    </motion.div>
                                ) : null}
                            </AnimatePresence>

                            {loading ? (
                                <div className="grid gap-3">
                                    {[1, 2, 3].map(
                                        (
                                            item
                                        ) => (
                                            <div
                                                key={
                                                    item
                                                }
                                                className="h-[260px] animate-pulse rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6]"
                                            />
                                        )
                                    )}
                                </div>
                            ) : visibleBookings.length ===
                                0 ? (
                                <motion.div
                                    initial={{
                                        opacity: 0,
                                        y: 5,
                                    }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                    }}
                                    className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] px-6 py-16 text-center shadow-[0_10px_28px_rgba(15,23,42,0.025)]"
                                >
                                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#E8ECE8] text-[#173C2E]">
                                        <IoCalendarClearOutline
                                            size={
                                                25
                                            }
                                        />
                                    </div>

                                    <h2 className="mt-4 text-[15px] font-black text-slate-900">
                                        No{" "}
                                        {filter ===
                                            "all"
                                            ? "consultation requests"
                                            : `${filter} requests`}
                                    </h2>

                                    <p className="mt-1 text-[12px] font-medium text-slate-400">
                                        New bookings will appear here automatically.
                                    </p>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key={
                                        filter
                                    }
                                    initial={{
                                        opacity: 0,
                                        y: 4,
                                    }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                    }}
                                    transition={{
                                        duration:
                                            0.18,
                                    }}
                                    className="grid gap-3"
                                >
                                    <AnimatePresence
                                        initial={
                                            false
                                        }
                                    >
                                        {visibleBookings.map(
                                            (
                                                booking
                                            ) => {
                                                const busy =
                                                    updatingId ===
                                                    booking.id;

                                                const feeLabel =
                                                    booking.feeType ===
                                                        "free"
                                                        ? "Free"
                                                        : money(
                                                            booking.fee,
                                                            booking.currency
                                                        );

                                                return (
                                                    <motion.article
                                                        layout
                                                        key={
                                                            booking.id
                                                        }
                                                        initial={{
                                                            opacity: 0,
                                                            y: 5,
                                                        }}
                                                        animate={{
                                                            opacity: 1,
                                                            y: 0,
                                                        }}
                                                        exit={{
                                                            opacity: 0,
                                                            y: -4,
                                                        }}
                                                        transition={{
                                                            duration:
                                                                0.18,
                                                        }}
                                                        className="overflow-hidden rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] shadow-[0_10px_28px_rgba(15,23,42,0.025)]"
                                                    >
                                                        <div className="p-4 sm:p-5">
                                                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                                <div className="flex min-w-0 items-center gap-3">
                                                                    <SafeClientAvatar
                                                                        src={
                                                                            booking.clientPhotoURL
                                                                        }
                                                                        alt={
                                                                            booking.clientName ||
                                                                            "Client"
                                                                        }
                                                                        size={
                                                                            52
                                                                        }
                                                                    />

                                                                    <div className="min-w-0">
                                                                        <h2 className="truncate text-[14px] font-black text-slate-900">
                                                                            {booking.clientName ||
                                                                                "Ekarihub member"}
                                                                        </h2>

                                                                        <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">
                                                                            {booking.clientEmail ||
                                                                                "Consultation client"}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span
                                                                        className={`w-fit rounded-full border px-2.5 py-1 text-[9px] font-black ${statusStyles(
                                                                            booking.status
                                                                        )}`}
                                                                    >
                                                                        {titleCase(
                                                                            booking.status
                                                                        )}
                                                                    </span>

                                                                    <span
                                                                        className={`rounded-full px-2.5 py-1 text-[9px] font-black ${paymentStyles(
                                                                            booking.paymentStatus
                                                                        )}`}
                                                                    >
                                                                        {titleCase(
                                                                            booking.paymentStatus
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                                                <Info
                                                                    label="Date"
                                                                    value={
                                                                        booking.consultationDate
                                                                    }
                                                                    icon={
                                                                        <IoCalendarClearOutline
                                                                            size={
                                                                                14
                                                                            }
                                                                        />
                                                                    }
                                                                />

                                                                <Info
                                                                    label="Time"
                                                                    value={
                                                                        booking.consultationTime
                                                                    }
                                                                    icon={
                                                                        <IoTimeOutline
                                                                            size={
                                                                                14
                                                                            }
                                                                        />
                                                                    }
                                                                />

                                                                <Info
                                                                    label="Method"
                                                                    value={titleCase(
                                                                        booking.consultationMethod
                                                                    )}
                                                                    icon={
                                                                        <IoPersonOutline
                                                                            size={
                                                                                14
                                                                            }
                                                                        />
                                                                    }
                                                                />

                                                                <Info
                                                                    label="Fee"
                                                                    value={
                                                                        feeLabel
                                                                    }
                                                                    icon={
                                                                        <IoWalletOutline
                                                                            size={
                                                                                14
                                                                            }
                                                                        />
                                                                    }
                                                                />
                                                            </div>

                                                            <div className="mt-4 rounded-[14px] bg-[#F3F1EB] px-4 py-3">
                                                                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
                                                                    <IoBriefcaseOutline
                                                                        size={
                                                                            12
                                                                        }
                                                                        className="text-[#F39A22]"
                                                                    />
                                                                    Consultation topic
                                                                </div>

                                                                <p className="mt-1.5 text-[12px] font-black text-slate-800">
                                                                    {booking.topic ||
                                                                        "General consultation"}
                                                                </p>

                                                                {booking.message ? (
                                                                    <p className="mt-2 whitespace-pre-wrap text-[11px] font-medium leading-5 text-slate-500">
                                                                        {
                                                                            booking.message
                                                                        }
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col gap-3 border-t border-[#E5E0D6] bg-[#F8F7F2] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-400">
                                                                <span>
                                                                    Payment:{" "}
                                                                    <strong className="text-slate-600">
                                                                        {titleCase(
                                                                            booking.paymentStatus
                                                                        )}
                                                                    </strong>
                                                                </span>

                                                                {booking.consultationDurationMinutes ? (
                                                                    <span>
                                                                        {
                                                                            booking.consultationDurationMinutes
                                                                        }{" "}
                                                                        min
                                                                    </span>
                                                                ) : null}
                                                            </div>

                                                            <div className="flex flex-wrap gap-2">
                                                                {booking.status ===
                                                                    "pending" ? (
                                                                    <>
                                                                        <motion.button
                                                                            whileTap={{
                                                                                scale: 0.97,
                                                                            }}
                                                                            type="button"
                                                                            disabled={
                                                                                busy
                                                                            }
                                                                            onClick={() =>
                                                                                void updateStatus(
                                                                                    booking,
                                                                                    "declined"
                                                                                )
                                                                            }
                                                                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-[10px] font-black text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                                                                        >
                                                                            <IoCloseCircleOutline
                                                                                size={
                                                                                    14
                                                                                }
                                                                            />
                                                                            Decline
                                                                        </motion.button>

                                                                        <motion.button
                                                                            whileTap={{
                                                                                scale: 0.97,
                                                                            }}
                                                                            type="button"
                                                                            disabled={
                                                                                busy
                                                                            }
                                                                            onClick={() =>
                                                                                void updateStatus(
                                                                                    booking,
                                                                                    "accepted"
                                                                                )
                                                                            }
                                                                            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#173C2E] px-3 text-[10px] font-black text-white transition hover:-translate-y-0.5 hover:bg-[#214C3A] disabled:opacity-50"
                                                                        >
                                                                            <IoCheckmarkCircleOutline
                                                                                size={
                                                                                    14
                                                                                }
                                                                            />

                                                                            {busy
                                                                                ? "Updating…"
                                                                                : "Accept"}
                                                                        </motion.button>
                                                                    </>
                                                                ) : null}

                                                                {booking.status ===
                                                                    "accepted" ? (
                                                                    <motion.button
                                                                        whileTap={{
                                                                            scale: 0.97,
                                                                        }}
                                                                        type="button"
                                                                        disabled={
                                                                            busy
                                                                        }
                                                                        onClick={() =>
                                                                            void updateStatus(
                                                                                booking,
                                                                                "completed"
                                                                            )
                                                                        }
                                                                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-3 text-[10px] font-black text-white transition hover:-translate-y-0.5 hover:bg-emerald-800 disabled:opacity-50"
                                                                    >
                                                                        <IoCheckmarkCircleOutline
                                                                            size={
                                                                                14
                                                                            }
                                                                        />

                                                                        {busy
                                                                            ? "Updating…"
                                                                            : "Mark completed"}
                                                                    </motion.button>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </motion.article>
                                                );
                                            }
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            )}
                        </div>

                        {/* DESKTOP STATUS RAIL */}
                        <motion.aside
                            initial={{
                                opacity: 0,
                                x: 8,
                            }}
                            animate={{
                                opacity: 1,
                                x: 0,
                            }}
                            transition={{
                                duration: 0.24,
                                delay: 0.04,
                                ease: "easeOut",
                            }}
                            className="hidden space-y-3 xl:sticky xl:top-4 xl:block"
                        >
                            <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
                                <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
                                    Booking overview
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    <MiniStat
                                        label="Pending"
                                        value={
                                            counts.pending
                                        }
                                        tone="amber"
                                    />

                                    <MiniStat
                                        label="Accepted"
                                        value={
                                            counts.accepted
                                        }
                                        tone="blue"
                                    />

                                    <MiniStat
                                        label="Completed"
                                        value={
                                            counts.completed
                                        }
                                        tone="green"
                                    />

                                    <MiniStat
                                        label="All"
                                        value={
                                            counts.all
                                        }
                                        tone="slate"
                                    />
                                </div>
                            </section>

                            <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
                                <div className="flex items-center gap-2">
                                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E8ECE8] text-[#173C2E]">
                                        <IoWalletOutline
                                            size={
                                                17
                                            }
                                        />
                                    </span>

                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
                                            Paid bookings
                                        </div>

                                        <div className="mt-0.5 text-[13px] font-black text-slate-800">
                                            {
                                                paidCount
                                            }{" "}
                                            paid
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-3 rounded-xl bg-[#F3F1EB] px-3 py-3">
                                    <div className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
                                        KES value
                                    </div>

                                    <div className="mt-1 text-[19px] font-black tracking-[-0.03em] text-[#173C2E]">
                                        {money(
                                            totalPaidValue,
                                            "KES"
                                        )}
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
                                <div className="flex items-start gap-3">
                                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E8ECE8] text-[#173C2E]">
                                        <IoShieldCheckmarkOutline
                                            size={
                                                17
                                            }
                                        />
                                    </span>

                                    <div className="min-w-0">
                                        <div className="text-[12px] font-black text-slate-800">
                                            Booking workflow
                                        </div>

                                        <p className="mt-1 text-[10px] font-medium leading-4 text-slate-400">
                                            Pending requests can be accepted or declined. Accepted consultations can be marked completed.
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
                                <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
                                    Quick links
                                </div>

                                <div className="mt-2 space-y-1">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.push(
                                                "/account/expert"
                                            )
                                        }
                                        className="flex h-9 w-full items-center justify-between rounded-xl px-2.5 text-left text-[10px] font-black text-slate-600 transition hover:bg-[#EEF3EE] hover:text-[#173C2E]"
                                    >
                                        Expert settings
                                        <IoOpenOutline
                                            size={
                                                13
                                            }
                                        />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.push(
                                                "/account/bookings"
                                            )
                                        }
                                        className="flex h-9 w-full items-center justify-between rounded-xl px-2.5 text-left text-[10px] font-black text-slate-600 transition hover:bg-[#EEF3EE] hover:text-[#173C2E]"
                                    >
                                        My bookings
                                        <IoOpenOutline
                                            size={
                                                13
                                            }
                                        />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.push(
                                                "/ekari-experts"
                                            )
                                        }
                                        className="flex h-9 w-full items-center justify-between rounded-xl px-2.5 text-left text-[10px] font-black text-slate-600 transition hover:bg-[#EEF3EE] hover:text-[#173C2E]"
                                    >
                                        ekariExperts
                                        <IoOpenOutline
                                            size={
                                                13
                                            }
                                        />
                                    </button>
                                </div>
                            </section>
                        </motion.aside>
                    </div>
                </main>
            </div>
        </AppShell>
    );
}

function Info({
    label,
    value,
    icon,
}: {
    label: string;
    value: string;
    icon: React.ReactNode;
}) {
    return (
        <div className="rounded-xl bg-[#F3F1EB] px-3 py-3">
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.07em] text-slate-400">
                <span className="text-[#F39A22]">
                    {icon}
                </span>
                {label}
            </div>

            <p className="mt-1 truncate text-[11px] font-black text-slate-700">
                {value || "—"}
            </p>
        </div>
    );
}

function MiniStat({
    label,
    value,
    tone,
}: {
    label: string;
    value: number;
    tone:
    | "amber"
    | "blue"
    | "green"
    | "slate";
}) {
    const toneClass =
        tone === "amber"
            ? "bg-amber-50 text-amber-700"
            : tone === "blue"
                ? "bg-blue-50 text-blue-700"
                : tone === "green"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-600";

    return (
        <div
            className={`rounded-xl px-3 py-3 ${toneClass}`}
        >
            <div className="text-[20px] font-black leading-none">
                {value}
            </div>

            <div className="mt-1 text-[9px] font-black uppercase tracking-[0.07em] opacity-70">
                {label}
            </div>
        </div>
    );
}