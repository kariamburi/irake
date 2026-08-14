"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
    writeBatch,
    type Timestamp,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import {
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    ChevronRight,
    CircleDollarSign,
    Clock3,
    Loader2,
    MapPin,
    MessageCircle,
    Phone,
    RefreshCcw,
    UserRound,
    Video,
    XCircle,
} from "lucide-react";

import { app, db } from "@/lib/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/app/components/AppShell";

type BookingStatus =
    | "pending"
    | "accepted"
    | "confirmed"
    | "declined"
    | "completed"
    | "cancelled";

type PaymentStatus = "not_required" | "unpaid" | "pending" | "paid" | "refunded";

type ExpertCurrency = "KES" | "USD";
type ExpertFeeType = "fixed" | "starting_from" | "free";

type ExpertCoordinates = {
    latitude: number;
    longitude: number;
    geohash?: string | null;
};

type ExpertPlace = {
    placeId?: string | null;
    label?: string;
    countryCode?: string;
    country?: string;
    region?: string;
    city?: string;
    locality?: string;
    coordinates?: ExpertCoordinates | null;
    timezone?: string | null;
};

type ExpertBooking = {
    id: string;
    expertId: string;
    expertName?: string;
    expertHandle?: string;
    expertPhotoURL?: string;
    expertHeadline?: string;
    expertPrimaryLocation?: ExpertPlace | null;
    expertServiceCoverage?: {
        offersOnlineServices?: boolean;
        offersPhysicalVisits?: boolean;
        onlineCoverage?: "local" | "country" | "worldwide";
        serviceAreas?: Array<{ label?: string }>;
    } | null;
    clientId: string;
    clientName?: string;
    clientPhotoURL?: string;
    consultationMethod: string;
    consultationDate: string;
    consultationTime: string;
    consultationDurationMinutes?: number;
    scheduledStart?: Timestamp | Date | null;
    scheduledStartIso?: string | null;
    clientTimezone?: string | null;
    expertTimezone?: string | null;
    topic: string;
    message: string;
    visitLocation?: string | null;
    visitContactPhone?: string | null;
    fee: number;
    feeType?: ExpertFeeType;
    currency: ExpertCurrency;
    pricingSnapshot?: {
        fee?: number;
        feeType?: ExpertFeeType;
        currency?: ExpertCurrency;
        physicalVisitFeeFrom?: number | null;
        consultationDurationMinutes?: number | null;
    } | null;
    status: BookingStatus;
    paymentStatus: PaymentStatus;
    createdAt?: Timestamp | null;
    updatedAt?: Timestamp | null;
    cancelledAt?: Timestamp | null;
    cancellationReason?: string;
    paymentReference?: string | null;
    paymentCheckoutId?: string | null;
    paidAt?: Timestamp | null;
};

type FilterKey =
    | "all"
    | "pending"
    | "accepted"
    | "confirmed"
    | "completed"
    | "declined"
    | "cancelled";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "accepted", label: "Accepted" },
    { key: "confirmed", label: "Confirmed" },
    { key: "completed", label: "Completed" },
    { key: "declined", label: "Declined" },
    { key: "cancelled", label: "Cancelled" },
];

const STATUS_META: Record<
    BookingStatus,
    { label: string; className: string; icon: typeof Clock3 }
> = {
    pending: {
        label: "Pending approval",
        className: "border-amber-200 bg-amber-50 text-amber-700",
        icon: Clock3,
    },
    accepted: {
        label: "Accepted",
        className: "border-blue-200 bg-blue-50 text-blue-700",
        icon: CheckCircle2,
    },
    confirmed: {
        label: "Confirmed",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
        icon: CheckCircle2,
    },
    completed: {
        label: "Completed",
        className: "border-slate-200 bg-slate-100 text-slate-700",
        icon: CheckCircle2,
    },
    declined: {
        label: "Declined",
        className: "border-rose-200 bg-rose-50 text-rose-700",
        icon: XCircle,
    },
    cancelled: {
        label: "Cancelled",
        className: "border-slate-200 bg-slate-50 text-slate-600",
        icon: XCircle,
    },
};

function formatMoney(amount: number, currency: ExpertCurrency = "KES") {
    try {
        return new Intl.NumberFormat(currency === "KES" ? "en-KE" : "en-US", {
            style: "currency",
            currency,
            maximumFractionDigits: currency === "KES" ? 0 : 2,
        }).format(Number(amount || 0));
    } catch {
        return `${currency} ${Number(amount || 0).toLocaleString()}`;
    }
}

function formatMethod(method: string) {
    return String(method || "")
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatTimezone(timezone?: string | null) {
    return timezone?.trim() || "Local time";
}

function formatDate(dateValue: string) {
    if (!dateValue) return "Date not set";
    const parsed = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return dateValue;

    return new Intl.DateTimeFormat("en-KE", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(parsed);
}

function formatTime(timeValue: string) {
    if (!timeValue) return "Time not set";
    const [hours, minutes] = timeValue.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return timeValue;

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    return new Intl.DateTimeFormat("en-KE", {
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
}

function methodIcon(method: string) {
    const value = method.toLowerCase();
    if (value.includes("video") || value.includes("zoom") || value.includes("meet")) return Video;
    if (value.includes("phone") || value.includes("call")) return Phone;
    if (value.includes("chat") || value.includes("message") || value.includes("whatsapp")) return MessageCircle;
    if (value.includes("physical") || value.includes("office") || value.includes("in-person") || value.includes("visit")) return MapPin;
    return UserRound;
}

function getInitials(name?: string) {
    if (!name?.trim()) return "EX";
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("");
}

function normalizeStatus(value: unknown): BookingStatus {
    const supported: BookingStatus[] = [
        "pending",
        "accepted",
        "confirmed",
        "declined",
        "completed",
        "cancelled",
    ];
    return supported.includes(value as BookingStatus) ? (value as BookingStatus) : "pending";
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
    const supported: PaymentStatus[] = [
        "not_required",
        "unpaid",
        "pending",
        "paid",
        "refunded",
    ];
    return supported.includes(value as PaymentStatus)
        ? (value as PaymentStatus)
        : "unpaid";
}


function useMediaQuery(queryString: string) {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const mediaQuery = window.matchMedia(queryString);
        const updateMatch = () => setMatches(mediaQuery.matches);

        updateMatch();
        mediaQuery.addEventListener?.("change", updateMatch);

        return () => {
            mediaQuery.removeEventListener?.("change", updateMatch);
        };
    }, [queryString]);

    return matches;
}

function useIsMobile() {
    return useMediaQuery("(max-width: 1023px)");
}


function SafeExpertAvatar({
    src,
    alt,
    size = 58,
}: {
    src?: string | null;
    alt: string;
    size?: number;
}) {
    const [failed, setFailed] = useState(false);

    useEffect(() => {
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
                    <UserRound
                        style={{
                            width: size * 0.46,
                            height: size * 0.46,
                        }}
                    />
                </div>
            )}
        </div>
    );
}

export default function ClientBookingsPage() {
    const router = useRouter();
    const isMobile = useIsMobile();
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [bookings, setBookings] = useState<ExpertBooking[]>([]);
    const [bookingsLoading, setBookingsLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
    const [error, setError] = useState("");
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [payingId, setPayingId] = useState<string | null>(null);

    useEffect(() => {
        const auth = getAuth();
        return onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthLoading(false);
            if (!currentUser) {
                setBookings([]);
                setBookingsLoading(false);
            }
        });
    }, []);

    useEffect(() => {
        if (!user?.uid) return;

        setBookingsLoading(true);
        setError("");

        const bookingsQuery = query(
            collection(db, "expertBookings"),
            where("clientId", "==", user.uid),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(
            bookingsQuery,
            (snapshot) => {
                const rows = snapshot.docs.map((item) => {
                    const data = item.data();
                    return {
                        id: item.id,
                        ...data,
                        status: normalizeStatus(data.status),
                        paymentStatus: normalizePaymentStatus(data.paymentStatus),
                        fee: Number(data.fee || data.pricingSnapshot?.fee || 0),
                        feeType:
                            data.feeType === "free" ||
                                data.feeType === "starting_from"
                                ? data.feeType
                                : "fixed",
                        currency: data.currency === "USD" ? "USD" : "KES",
                    } as ExpertBooking;
                });

                setBookings(rows);

                const unreadDocuments = snapshot.docs.filter(
                    (bookingDocument) =>
                        bookingDocument.data().clientUnread === true
                );

                if (unreadDocuments.length > 0) {
                    const batch = writeBatch(db);

                    unreadDocuments.forEach((bookingDocument) => {
                        batch.update(bookingDocument.ref, {
                            clientUnread: false,
                            clientReadAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                        });
                    });

                    void batch.commit().catch((badgeError) => {
                        console.error(
                            "CLEAR_CLIENT_BOOKING_BADGES_FAILED",
                            badgeError
                        );
                    });
                }

                setBookingsLoading(false);
            },
            (snapshotError) => {
                console.error("Unable to load client bookings:", snapshotError);
                if (snapshotError.message.toLowerCase().includes("index")) {
                    setError("This bookings query needs a Firestore index for clientId and createdAt.");
                } else if (snapshotError.code === "permission-denied") {
                    setError("You do not have permission to view these bookings. Check your Firestore rules.");
                } else {
                    setError("We could not load your consultation bookings.");
                }
                setBookingsLoading(false);
            }
        );

        return unsubscribe;
    }, [user?.uid]);

    const filteredBookings = useMemo(() => {
        if (activeFilter === "all") return bookings;
        return bookings.filter((booking) => booking.status === activeFilter);
    }, [activeFilter, bookings]);

    const counts = useMemo(() => {
        const result: Record<FilterKey, number> = {
            all: bookings.length,
            pending: 0,
            accepted: 0,
            confirmed: 0,
            completed: 0,
            declined: 0,
            cancelled: 0,
        };

        for (const booking of bookings) result[booking.status] += 1;
        return result;
    }, [bookings]);

    async function cancelBooking(booking: ExpertBooking) {
        if (!user?.uid) {
            router.push(`/login?next=${encodeURIComponent("/account/bookings")}`);
            return;
        }

        if (!["pending", "accepted"].includes(booking.status)) return;

        const confirmed = window.confirm(
            "Cancel this consultation request? This action cannot be reversed from this page."
        );
        if (!confirmed) return;

        setCancellingId(booking.id);
        setError("");

        try {
            await updateDoc(doc(db, "expertBookings", booking.id), {
                status: "cancelled",
                cancellationReason: "Cancelled by client",
                cancelledBy: user.uid,
                cancelledAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        } catch (cancelError) {
            console.error("Unable to cancel booking:", cancelError);
            setError("The booking could not be cancelled. Please try again.");
        } finally {
            setCancellingId(null);
        }
    }

    async function startConsultationPayment(
        booking: ExpertBooking
    ) {
        if (!user?.uid) {
            router.push(
                `/login?next=${encodeURIComponent("/account/bookings")}`
            );
            return;
        }

        if (booking.clientId !== user.uid) {
            setError(
                "You cannot pay for a consultation that does not belong to your account."
            );
            return;
        }

        if (booking.status !== "accepted") {
            setError(
                "This consultation must be accepted by the expert before payment."
            );
            return;
        }

        if (booking.fee <= 0 || booking.paymentStatus === "not_required") {
            setError("No payment is required for this consultation.");
            return;
        }

        if (booking.paymentStatus === "paid") {
            setError("This consultation has already been paid.");
            return;
        }

        try {
            setPayingId(booking.id);
            setError("");

            const functions = getFunctions(
                app,
                "us-central1"
            );

            const createExpertConsultationCheckout =
                httpsCallable<
                    {
                        bookingId: string;
                        source: "web" | "mobile";
                    },
                    {
                        checkoutUrl: string;
                        checkoutId: string;
                    }
                >(
                    functions,
                    "createExpertConsultationCheckout"
                );

            const result =
                await createExpertConsultationCheckout({
                    bookingId: booking.id,
                    source: "web",
                });

            const checkoutUrl =
                result.data.checkoutUrl;

            if (!checkoutUrl) {
                throw new Error(
                    "The payment gateway did not return a checkout URL."
                );
            }

            window.location.href = checkoutUrl;
        } catch (paymentError: any) {
            console.error(
                "Unable to start consultation payment:",
                paymentError
            );

            setError(
                paymentError?.message ||
                "We could not start the consultation payment. Please try again."
            );

            setPayingId(null);
        }
    }

    function openExpertProfile(booking: ExpertBooking) {
        if (booking.expertHandle) {
            router.push(`/${encodeURIComponent(booking.expertHandle.replace(/^@/, ""))}`);
            return;
        }
        router.push(`/book-expert/${encodeURIComponent(booking.expertId)}`);
    }

    if (authLoading) {
        const loader = (
            <FullPageLoader />
        );

        return isMobile ? (
            loader
        ) : (
            <AppShell>
                {loader}
            </AppShell>
        );
    }

    if (!user) {
        const signedOutContent = (
            <main className="grid min-h-[100svh] place-items-center bg-[#F8F7F2] px-4 py-10">
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
                        <CalendarDays className="h-6 w-6" />
                    </div>

                    <h2 className="mt-4 text-[18px] font-black text-slate-900">
                        Sign in to view your consultations
                    </h2>

                    <p className="mt-2 text-[12px] font-medium leading-5 text-slate-500">
                        Your expert consultation requests, payments and confirmed sessions will appear here.
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                `/login?next=${encodeURIComponent(
                                    "/account/bookings"
                                )}`
                            )
                        }
                        className="mt-5 h-10 rounded-xl bg-[#173C2E] px-5 text-[11px] font-black text-white transition hover:-translate-y-0.5 hover:bg-[#214C3A]"
                    >
                        Sign in
                    </button>
                </motion.div>
            </main>
        );

        return isMobile ? (
            signedOutContent
        ) : (
            <AppShell>
                {signedOutContent}
            </AppShell>
        );
    }

    const pendingCount =
        counts.pending;

    const upcomingCount =
        counts.accepted +
        counts.confirmed;

    const paidCount =
        bookings.filter(
            (booking) =>
                booking.paymentStatus ===
                "paid"
        ).length;

    const pageContent = (
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
                                router.back()
                            }
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-white transition hover:bg-white/[0.11] active:scale-95"
                            aria-label="Go back"
                        >
                            <ArrowLeft className="h-4.5 w-4.5" />
                        </button>

                        <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#F39A22]">
                                ekari Expert
                            </div>

                            <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <h1 className="text-[24px] font-black tracking-[-0.035em] md:text-[28px]">
                                        My consultations
                                    </h1>

                                    <p className="mt-1 max-w-2xl text-[11px] font-medium leading-5 text-white/50 md:text-[12px]">
                                        Track expert requests, payments, confirmed sessions and consultation history.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        router.push(
                                            "/ekari-experts"
                                        )
                                    }
                                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#F39A22] px-4 text-[10px] font-black text-white transition hover:-translate-y-0.5 hover:bg-[#E98C12]"
                                >
                                    Find an expert
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.header>

            {/* FILTER BAR */}
            <div className="shrink-0 border-b border-[#DDD8CC] bg-[#FBFAF6]">
                <div className="mx-auto flex max-w-[1180px] items-center gap-1 overflow-x-auto px-3 no-scrollbar sm:px-4 md:px-6">
                    {FILTERS.map(
                        (filterItem) => {
                            const selected =
                                activeFilter ===
                                filterItem.key;

                            return (
                                <button
                                    key={
                                        filterItem.key
                                    }
                                    type="button"
                                    onClick={() =>
                                        setActiveFilter(
                                            filterItem.key
                                        )
                                    }
                                    className={[
                                        "relative inline-flex h-12 shrink-0 items-center gap-1.5 px-3",
                                        "text-[11px] font-black transition-colors",
                                        selected
                                            ? "text-[#173C2E]"
                                            : "text-slate-400 hover:text-slate-700",
                                    ].join(
                                        " "
                                    )}
                                >
                                    {
                                        filterItem.label
                                    }

                                    {counts[
                                        filterItem
                                            .key
                                    ] > 0 ? (
                                        <span
                                            className={[
                                                "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[9px]",
                                                selected
                                                    ? "bg-[#F39A22] text-white"
                                                    : "bg-[#EFECE5] text-slate-500",
                                            ].join(
                                                " "
                                            )}
                                        >
                                            {counts[
                                                filterItem
                                                    .key
                                            ] > 99
                                                ? "99+"
                                                : counts[
                                                filterItem
                                                    .key
                                                ]}
                                        </span>
                                    ) : null}

                                    {selected ? (
                                        <motion.span
                                            layoutId="client-booking-filter"
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
                    <section className="min-w-0">
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
                                    className="mb-4 flex items-start gap-3 rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700"
                                >
                                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />

                                    <div>
                                        <p className="font-black">
                                            Unable to complete that action
                                        </p>

                                        <p className="mt-0.5 font-medium">
                                            {error}
                                        </p>
                                    </div>
                                </motion.div>
                            ) : null}
                        </AnimatePresence>

                        {bookingsLoading ? (
                            <div className="grid gap-3">
                                {[1, 2, 3].map(
                                    (item) => (
                                        <div
                                            key={
                                                item
                                            }
                                            className="h-[260px] animate-pulse rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6]"
                                        />
                                    )
                                )}
                            </div>
                        ) : filteredBookings.length ===
                            0 ? (
                            <EmptyState
                                activeFilter={
                                    activeFilter
                                }
                                onBrowse={() =>
                                    router.push(
                                        "/ekari-experts"
                                    )
                                }
                            />
                        ) : (
                            <motion.div
                                key={
                                    activeFilter
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
                                    duration: 0.18,
                                }}
                                className="space-y-3"
                            >
                                <AnimatePresence
                                    initial={false}
                                >
                                    {filteredBookings.map(
                                        (
                                            booking
                                        ) => (
                                            <BookingCard
                                                key={
                                                    booking.id
                                                }
                                                booking={
                                                    booking
                                                }
                                                cancelling={
                                                    cancellingId ===
                                                    booking.id
                                                }
                                                paying={
                                                    payingId ===
                                                    booking.id
                                                }
                                                onCancel={() =>
                                                    cancelBooking(
                                                        booking
                                                    )
                                                }
                                                onOpenExpert={() =>
                                                    openExpertProfile(
                                                        booking
                                                    )
                                                }
                                                onOpenBooking={() =>
                                                    router.push(
                                                        `/account/bookings/${encodeURIComponent(
                                                            booking.id
                                                        )}`
                                                    )
                                                }
                                                onPay={() =>
                                                    startConsultationPayment(
                                                        booking
                                                    )
                                                }
                                            />
                                        )
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </section>

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
                                Consultation overview
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2">
                                <MiniStat
                                    label="Pending"
                                    value={
                                        pendingCount
                                    }
                                    tone="amber"
                                />

                                <MiniStat
                                    label="Upcoming"
                                    value={
                                        upcomingCount
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
                            <div className="flex items-center gap-3">
                                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E8ECE8] text-[#173C2E]">
                                    <CircleDollarSign className="h-4 w-4" />
                                </span>

                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
                                        Payments
                                    </div>

                                    <div className="mt-0.5 text-[13px] font-black text-slate-800">
                                        {
                                            paidCount
                                        }{" "}
                                        paid consultation
                                        {paidCount ===
                                            1
                                            ? ""
                                            : "s"}
                                    </div>
                                </div>
                            </div>

                            <p className="mt-3 text-[10px] font-medium leading-4 text-slate-400">
                                Payment becomes available after an expert accepts a paid consultation request.
                            </p>
                        </section>

                        <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
                            <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
                                Booking flow
                            </div>

                            <div className="mt-3 space-y-2.5 text-[10px] font-semibold text-slate-500">
                                <FlowRow
                                    label="Request sent"
                                    active
                                />

                                <FlowRow
                                    label="Expert accepts"
                                    active={
                                        counts.accepted +
                                        counts.confirmed +
                                        counts.completed >
                                        0
                                    }
                                />

                                <FlowRow
                                    label="Payment / confirmation"
                                    active={
                                        paidCount > 0 ||
                                        counts.confirmed >
                                        0
                                    }
                                />

                                <FlowRow
                                    label="Consultation completed"
                                    active={
                                        counts.completed >
                                        0
                                    }
                                />
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
                                            "/ekari-experts"
                                        )
                                    }
                                    className="flex h-9 w-full items-center justify-between rounded-xl px-2.5 text-left text-[10px] font-black text-slate-600 transition hover:bg-[#EEF3EE] hover:text-[#173C2E]"
                                >
                                    Browse experts
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </button>

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
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </section>
                    </motion.aside>
                </div>
            </main>
        </div>
    );

    return isMobile ? (
        pageContent
    ) : (
        <AppShell>
            {pageContent}
        </AppShell>
    );
}


function BookingCard({
    booking,
    cancelling,
    paying,
    onCancel,
    onOpenExpert,
    onOpenBooking,
    onPay,
}: {
    booking: ExpertBooking;
    cancelling: boolean;
    paying: boolean;
    onCancel: () => void;
    onOpenExpert: () => void;
    onOpenBooking: () => void;
    onPay: () => void;
}) {
    const statusMeta =
        STATUS_META[booking.status];

    const StatusIcon =
        statusMeta.icon;

    const MethodIcon =
        methodIcon(
            booking.consultationMethod
        );

    const canCancel =
        ["pending", "accepted"].includes(
            booking.status
        );

    const showPayButton =
        booking.status === "accepted" &&
        booking.fee > 0 &&
        ![
            "paid",
            "not_required",
        ].includes(
            booking.paymentStatus
        );

    const feeText =
        booking.feeType === "free" ||
            booking.fee <= 0
            ? "Free"
            : booking.feeType ===
                "starting_from"
                ? `From ${formatMoney(
                    booking.fee,
                    booking.currency
                )}`
                : formatMoney(
                    booking.fee,
                    booking.currency
                );

    return (
        <motion.article
            layout
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
                duration: 0.18,
            }}
            className="overflow-hidden rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] shadow-[0_10px_28px_rgba(15,23,42,0.025)]"
        >
            <div className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                        <button
                            type="button"
                            onClick={
                                onOpenExpert
                            }
                            className="shrink-0"
                            aria-label="Open expert profile"
                        >
                            <SafeExpertAvatar
                                src={
                                    booking.expertPhotoURL
                                }
                                alt={
                                    booking.expertName ||
                                    "Expert"
                                }
                                size={52}
                            />
                        </button>

                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={
                                        onOpenExpert
                                    }
                                    className="max-w-full truncate text-left text-[14px] font-black text-slate-900 hover:underline"
                                >
                                    {booking.expertName ||
                                        "Ekari expert"}
                                </button>

                                <span
                                    className={[
                                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1",
                                        "text-[9px] font-black",
                                        statusMeta.className,
                                    ].join(
                                        " "
                                    )}
                                >
                                    <StatusIcon className="h-3 w-3" />
                                    {
                                        statusMeta.label
                                    }
                                </span>
                            </div>

                            {booking.expertHeadline ? (
                                <p className="mt-1 line-clamp-1 text-[10px] font-medium text-slate-400">
                                    {
                                        booking.expertHeadline
                                    }
                                </p>
                            ) : null}

                            <h2 className="mt-2 text-[13px] font-black text-slate-800">
                                {booking.topic ||
                                    "Expert consultation"}
                            </h2>
                        </div>
                    </div>

                    <div className="shrink-0 rounded-[14px] bg-[#F3F1EB] px-3 py-2.5 sm:min-w-[150px] sm:text-right">
                        <p className="text-[8px] font-black uppercase tracking-[0.08em] text-slate-400">
                            Consultation fee
                        </p>

                        <p className="mt-1 text-[17px] font-black tracking-[-0.03em] text-[#173C2E]">
                            {feeText}
                        </p>

                        <PaymentBadge
                            status={
                                booking.paymentStatus
                            }
                        />
                    </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <InfoTile
                        icon={
                            CalendarDays
                        }
                        label="Date"
                        value={formatDate(
                            booking.consultationDate
                        )}
                    />

                    <InfoTile
                        icon={Clock3}
                        label="Time"
                        value={formatTime(
                            booking.consultationTime
                        )}
                    />

                    <InfoTile
                        icon={MethodIcon}
                        label="Method"
                        value={formatMethod(
                            booking.consultationMethod ||
                            "Not specified"
                        )}
                    />

                    <InfoTile
                        icon={
                            CircleDollarSign
                        }
                        label="Payment"
                        value={
                            booking.paymentStatus ===
                                "not_required"
                                ? "Not required"
                                : booking.paymentStatus ===
                                    "paid"
                                    ? "Paid"
                                    : booking.paymentStatus ===
                                        "pending"
                                        ? "Processing"
                                        : booking.paymentStatus ===
                                            "refunded"
                                            ? "Refunded"
                                            : "Not paid"
                        }
                    />
                </div>

                {booking.consultationMethod ===
                    "physical" &&
                    booking.visitLocation ? (
                    <div className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50 p-3.5">
                        <div className="flex items-start gap-3">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />

                            <div className="min-w-0">
                                <p className="text-[9px] font-black uppercase tracking-[0.08em] text-amber-700">
                                    Visit location
                                </p>

                                <p className="mt-1 text-[11px] font-black leading-5 text-slate-800">
                                    {
                                        booking.visitLocation
                                    }
                                </p>

                                {booking.visitContactPhone ? (
                                    <p className="mt-1 text-[10px] font-medium text-slate-500">
                                        Contact:{" "}
                                        {
                                            booking.visitContactPhone
                                        }
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    </div>
                ) : null}

                {(booking.expertTimezone ||
                    booking.clientTimezone) ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-semibold text-slate-400">
                        {booking.expertTimezone ? (
                            <span className="rounded-full bg-[#F3F1EB] px-2.5 py-1">
                                Expert timezone:{" "}
                                {formatTimezone(
                                    booking.expertTimezone
                                )}
                            </span>
                        ) : null}

                        {booking.clientTimezone ? (
                            <span className="rounded-full bg-[#F3F1EB] px-2.5 py-1">
                                Your timezone:{" "}
                                {formatTimezone(
                                    booking.clientTimezone
                                )}
                            </span>
                        ) : null}
                    </div>
                ) : null}

                {booking.message ? (
                    <div className="mt-4 rounded-[14px] bg-[#F3F1EB] px-4 py-3">
                        <p className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
                            Your message
                        </p>

                        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-[11px] font-medium leading-5 text-slate-600">
                            {
                                booking.message
                            }
                        </p>
                    </div>
                ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-[#E5E0D6] bg-[#F8F7F2] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <button
                    type="button"
                    onClick={onOpenExpert}
                    className="inline-flex items-center gap-1.5 text-[10px] font-black text-[#173C2E] hover:underline"
                >
                    View expert profile
                    <ChevronRight className="h-3.5 w-3.5" />
                </button>

                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    {canCancel ? (
                        <motion.button
                            whileTap={{
                                scale: 0.97,
                            }}
                            type="button"
                            onClick={
                                onCancel
                            }
                            disabled={
                                cancelling
                            }
                            className="inline-flex h-9 items-center justify-center rounded-xl border border-rose-200 bg-white px-3 text-[10px] font-black text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {cancelling ? (
                                <>
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    Cancelling…
                                </>
                            ) : (
                                "Cancel request"
                            )}
                        </motion.button>
                    ) : null}

                    {showPayButton ? (
                        <motion.button
                            whileTap={{
                                scale: 0.97,
                            }}
                            type="button"
                            onClick={onPay}
                            disabled={paying}
                            className="inline-flex h-9 items-center justify-center rounded-xl bg-[#F39A22] px-4 text-[10px] font-black text-white transition hover:-translate-y-0.5 hover:bg-[#E98C12] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {paying ? (
                                <>
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    Starting payment…
                                </>
                            ) : booking.paymentStatus ===
                                "pending" ? (
                                "Continue payment"
                            ) : (
                                "Pay consultation"
                            )}
                        </motion.button>
                    ) : (
                        <motion.button
                            whileTap={{
                                scale: 0.97,
                            }}
                            type="button"
                            onClick={
                                onOpenBooking
                            }
                            className="inline-flex h-9 items-center justify-center rounded-xl bg-[#173C2E] px-4 text-[10px] font-black text-white transition hover:-translate-y-0.5 hover:bg-[#214C3A]"
                        >
                            View details
                        </motion.button>
                    )}
                </div>
            </div>
        </motion.article>
    );
}

function InfoTile({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof CalendarDays;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-[13px] bg-[#F3F1EB] px-3 py-3">
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.07em] text-slate-400">
                <Icon className="h-3.5 w-3.5 text-[#F39A22]" />
                {label}
            </div>

            <p className="mt-1 truncate text-[11px] font-black text-slate-700">
                {value}
            </p>
        </div>
    );
}

function PaymentBadge({
    status,
}: {
    status: PaymentStatus;
}) {
    const styles: Record<
        PaymentStatus,
        string
    > = {
        not_required:
            "border-emerald-200 bg-emerald-50 text-emerald-700",
        unpaid:
            "border-slate-200 bg-white text-slate-600",
        pending:
            "border-amber-200 bg-amber-50 text-amber-700",
        paid:
            "border-emerald-200 bg-emerald-50 text-emerald-700",
        refunded:
            "border-purple-200 bg-purple-50 text-purple-700",
    };

    const labels: Record<
        PaymentStatus,
        string
    > = {
        not_required:
            "No payment required",
        unpaid: "Unpaid",
        pending:
            "Payment pending",
        paid: "Paid",
        refunded: "Refunded",
    };

    return (
        <span
            className={[
                "mt-1.5 inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black",
                styles[status],
            ].join(" ")}
        >
            {labels[status]}
        </span>
    );
}

function EmptyState({
    activeFilter,
    onBrowse,
}: {
    activeFilter: FilterKey;
    onBrowse: () => void;
}) {
    return (
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
                {activeFilter ===
                    "all" ? (
                    <CalendarDays className="h-6 w-6" />
                ) : (
                    <RefreshCcw className="h-6 w-6" />
                )}
            </div>

            <h2 className="mt-4 text-[15px] font-black text-slate-900">
                {activeFilter ===
                    "all"
                    ? "No consultations yet"
                    : `No ${activeFilter} consultations`}
            </h2>

            <p className="mx-auto mt-1 max-w-md text-[12px] font-medium leading-5 text-slate-400">
                {activeFilter ===
                    "all"
                    ? "Browse ekariExperts and request a consultation from a specialist who matches your needs."
                    : "Bookings matching this status will appear here when available."}
            </p>

            {activeFilter ===
                "all" ? (
                <button
                    type="button"
                    onClick={onBrowse}
                    className="mt-5 h-10 rounded-xl bg-[#173C2E] px-5 text-[10px] font-black text-white transition hover:-translate-y-0.5 hover:bg-[#214C3A]"
                >
                    Browse experts
                </button>
            ) : null}
        </motion.div>
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

function FlowRow({
    label,
    active,
}: {
    label: string;
    active: boolean;
}) {
    return (
        <div className="flex items-center gap-2">
            <span
                className={[
                    "grid h-4 w-4 shrink-0 place-items-center rounded-full",
                    active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-400",
                ].join(" ")}
            >
                {active ? (
                    <CheckCircle2 className="h-2.5 w-2.5" />
                ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
            </span>

            <span
                className={
                    active
                        ? "text-slate-600"
                        : "text-slate-400"
                }
            >
                {label}
            </span>
        </div>
    );
}

function FullPageLoader() {
    return (
        <main className="grid min-h-[100svh] place-items-center bg-[#F8F7F2]">
            <div className="text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#173C2E]" />

                <p className="mt-3 text-[11px] font-semibold text-slate-400">
                    Preparing your consultations…
                </p>
            </div>
        </main>
    );
}