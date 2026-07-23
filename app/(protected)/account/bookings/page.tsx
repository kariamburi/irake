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
    RefreshCcw,
    UserRound,
    Video,
    XCircle,
} from "lucide-react";

import { app, db } from "@/lib/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import AppShell from "@/app/components/AppShell";

type BookingStatus =
    | "pending"
    | "accepted"
    | "confirmed"
    | "declined"
    | "completed"
    | "cancelled";

type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded";

type ExpertBooking = {
    id: string;
    expertId: string;
    expertName?: string;
    expertHandle?: string;
    expertPhotoURL?: string;
    expertHeadline?: string;
    clientId: string;
    clientName?: string;
    clientPhotoURL?: string;
    consultationMethod: string;
    consultationDate: string;
    consultationTime: string;
    consultationDurationMinutes?: number;
    topic: string;
    message: string;
    fee: number;
    currency: string;
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

function formatMoney(amount: number, currency = "KES") {
    try {
        return new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
        }).format(Number(amount || 0));
    } catch {
        return `${currency} ${Number(amount || 0).toLocaleString()}`;
    }
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
    if (value.includes("chat") || value.includes("message")) return MessageCircle;
    if (value.includes("physical") || value.includes("office") || value.includes("in-person")) return MapPin;
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
    const supported: PaymentStatus[] = ["unpaid", "pending", "paid", "refunded"];
    return supported.includes(value as PaymentStatus) ? (value as PaymentStatus) : "unpaid";
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
                        fee: Number(data.fee || 0),
                        currency: data.currency || "KES",
                    } as ExpertBooking;
                });

                setBookings(rows);
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
        const loader = <FullPageLoader />;

        return isMobile ? loader : (
            <AppShell>
                {loader}
            </AppShell>
        );
    }

    if (!user) {
        const signedOutContent = (
            <main className="min-h-[100svh] bg-[#f6f7f5]">
                {isMobile ? (
                    <header
                        className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xl"
                        style={{ paddingTop: "env(safe-area-inset-top)" }}
                    >
                        <div className="flex h-14 items-center px-3">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-slate-700"
                                aria-label="Go back"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>

                            <h1 className="flex-1 pr-10 text-center text-base font-bold text-slate-950">
                                My consultations
                            </h1>
                        </div>
                    </header>
                ) : null}

                <div className="px-4 py-12 sm:py-16">
                    <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-8">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#233f39]/10 text-[#233f39]">
                            <CalendarDays className="h-7 w-7" />
                        </div>

                        <h2 className="mt-5 text-2xl font-bold text-slate-950">
                            Sign in to view your bookings
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            Your expert consultation requests and confirmed sessions will appear here.
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                router.push(
                                    `/login?next=${encodeURIComponent("/account/bookings")}`
                                )
                            }
                            className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-[#233f39] px-6 text-sm font-semibold text-white transition hover:bg-[#1b312c]"
                        >
                            Sign in
                        </button>
                    </div>
                </div>
            </main>
        );

        return isMobile ? signedOutContent : (
            <AppShell>
                {signedOutContent}
            </AppShell>
        );
    }

    const pageContent = (
        <main className="min-h-[100svh] bg-[#f6f7f5] w-full pb-20">
            {isMobile ? (
                <header
                    className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xl"
                    style={{ paddingTop: "env(safe-area-inset-top)" }}
                >
                    <div className="flex h-14 items-center gap-2 px-3">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                            aria-label="Go back"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>

                        <div className="min-w-0 flex-1 text-center">
                            <h1 className="truncate text-base font-bold text-slate-950">
                                My consultations
                            </h1>
                        </div>

                        <button
                            type="button"
                            onClick={() => router.push("/ekari-experts")}
                            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-[#233f39] px-3 text-xs font-semibold text-white"
                        >
                            Find expert
                        </button>
                    </div>
                </header>
            ) : (
                <section className="border-b border-slate-200 bg-white">
                    <div className="mx-auto max-w-6xl px-6 py-7 lg:px-8">
                        <div className="flex items-end justify-between gap-6">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#c79257]">
                                    EkariExperts
                                </p>

                                <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
                                    My consultations
                                </h1>

                                <p className="mt-2 max-w-2xl text-base leading-6 text-slate-600">
                                    Track your consultation requests, payments and upcoming sessions.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => router.push("/ekari-experts")}
                                className="inline-flex h-11 items-center justify-center rounded-xl border border-[#233f39] px-5 text-sm font-semibold text-[#233f39] transition hover:bg-[#233f39] hover:text-white"
                            >
                                Find an expert
                            </button>
                        </div>
                    </div>
                </section>
            )}

            <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
                <div className="overflow-x-auto pb-2">
                    <div className="flex min-w-max gap-2">
                        {FILTERS.map((filter) => {
                            const selected = activeFilter === filter.key;
                            return (
                                <button
                                    key={filter.key}
                                    type="button"
                                    onClick={() => setActiveFilter(filter.key)}
                                    className={[
                                        "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
                                        selected
                                            ? "border-[#233f39] bg-[#233f39] text-white"
                                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950",
                                    ].join(" ")}
                                >
                                    {filter.label}
                                    <span className={[
                                        "rounded-full px-2 py-0.5 text-xs",
                                        selected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500",
                                    ].join(" ")}>
                                        {counts[filter.key]}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {error ? (
                    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                        <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
                        <div className="flex-1">
                            <p className="font-semibold">Unable to complete that action</p>
                            <p className="mt-1">{error}</p>
                        </div>
                    </div>
                ) : null}

                {bookingsLoading ? (
                    <div className="flex min-h-[360px] items-center justify-center">
                        <div className="text-center">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#233f39]" />
                            <p className="mt-3 text-sm text-slate-600">Loading your consultations…</p>
                        </div>
                    </div>
                ) : filteredBookings.length === 0 ? (
                    <EmptyState activeFilter={activeFilter} onBrowse={() => router.push("/ekari-experts")} />
                ) : (
                    <div className="mt-5 space-y-4">
                        {filteredBookings.map((booking) => (
                            <BookingCard
                                key={booking.id}
                                booking={booking}
                                cancelling={cancellingId === booking.id}
                                paying={payingId === booking.id}
                                onCancel={() => cancelBooking(booking)}
                                onOpenExpert={() => openExpertProfile(booking)}
                                onOpenBooking={() => router.push(`/account/bookings/${encodeURIComponent(booking.id)}`)}
                                onPay={() => startConsultationPayment(booking)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </main>
    );

    return isMobile ? pageContent : (
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
    const statusMeta = STATUS_META[booking.status];
    const StatusIcon = statusMeta.icon;
    const MethodIcon = methodIcon(booking.consultationMethod);
    const canCancel = ["pending", "accepted"].includes(booking.status);
    const showPayButton = booking.status === "accepted" && booking.paymentStatus !== "paid";

    return (
        <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 gap-4">
                        <button type="button" onClick={onOpenExpert} className="shrink-0" aria-label="Open expert profile">
                            {booking.expertPhotoURL ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={booking.expertPhotoURL}
                                    alt={booking.expertName || "Expert"}
                                    className="h-14 w-14 rounded-2xl object-cover ring-1 ring-slate-200 sm:h-16 sm:w-16"
                                />
                            ) : (
                                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#233f39] text-sm font-bold text-white sm:h-16 sm:w-16">
                                    {getInitials(booking.expertName)}
                                </span>
                            )}
                        </button>

                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <button type="button" onClick={onOpenExpert} className="truncate text-left text-lg font-bold text-slate-950 hover:underline">
                                    {booking.expertName || "Ekari expert"}
                                </button>
                                <span className={["inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold", statusMeta.className].join(" ")}>
                                    <StatusIcon className="h-3.5 w-3.5" /> {statusMeta.label}
                                </span>
                            </div>

                            {booking.expertHeadline ? (
                                <p className="mt-1 line-clamp-1 text-sm text-slate-500">{booking.expertHeadline}</p>
                            ) : null}

                            <h2 className="mt-3 text-base font-semibold text-slate-900">{booking.topic || "Expert consultation"}</h2>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-3 lg:text-right">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Consultation fee</p>
                        <p className="mt-1 text-xl font-bold text-slate-950">{formatMoney(booking.fee, booking.currency)}</p>
                        <PaymentBadge status={booking.paymentStatus} />
                    </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <InfoTile icon={CalendarDays} label="Date" value={formatDate(booking.consultationDate)} />
                    <InfoTile icon={Clock3} label="Time" value={formatTime(booking.consultationTime)} />
                    <InfoTile icon={MethodIcon} label="Method" value={booking.consultationMethod || "Not specified"} />
                    <InfoTile
                        icon={CircleDollarSign}
                        label="Payment"
                        value={
                            booking.paymentStatus === "paid"
                                ? "Paid"
                                : booking.paymentStatus === "pending"
                                    ? "Processing"
                                    : booking.paymentStatus === "refunded"
                                        ? "Refunded"
                                        : "Not paid"
                        }
                    />
                </div>

                {booking.message ? (
                    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your message</p>
                        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{booking.message}</p>
                    </div>
                ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <button type="button" onClick={onOpenExpert} className="inline-flex items-center gap-2 text-sm font-semibold text-[#233f39] hover:underline">
                    View expert profile <ChevronRight className="h-4 w-4" />
                </button>

                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    {canCancel ? (
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={cancelling}
                            className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {cancelling ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cancelling…</>
                            ) : (
                                "Cancel request"
                            )}
                        </button>
                    ) : null}

                    {showPayButton ? (
                        <button
                            type="button"
                            onClick={onPay}
                            disabled={paying}
                            className="inline-flex h-10 items-center justify-center rounded-xl bg-[#c79257] px-5 text-sm font-semibold text-white transition hover:bg-[#b58149] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {paying ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Starting payment…
                                </>
                            ) : booking.paymentStatus === "pending" ? (
                                "Continue payment"
                            ) : (
                                "Pay consultation"
                            )}
                        </button>
                    ) : (
                        <button type="button" onClick={onOpenBooking} className="inline-flex h-10 items-center justify-center rounded-xl bg-[#233f39] px-5 text-sm font-semibold text-white transition hover:bg-[#1b312c]">
                            View details
                        </button>
                    )}
                </div>
            </div>
        </article>
    );
}

function InfoTile({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#233f39]/10 text-[#233f39]">
                <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{value}</p>
            </div>
        </div>
    );
}

function PaymentBadge({ status }: { status: PaymentStatus }) {
    const styles: Record<PaymentStatus, string> = {
        unpaid: "border-slate-200 bg-white text-slate-600",
        pending: "border-amber-200 bg-amber-50 text-amber-700",
        paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
        refunded: "border-purple-200 bg-purple-50 text-purple-700",
    };
    const labels: Record<PaymentStatus, string> = {
        unpaid: "Unpaid",
        pending: "Payment pending",
        paid: "Paid",
        refunded: "Refunded",
    };

    return <span className={["mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", styles[status]].join(" ")}>{labels[status]}</span>;
}

function EmptyState({ activeFilter, onBrowse }: { activeFilter: FilterKey; onBrowse: () => void }) {
    return (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#233f39]/10 text-[#233f39]">
                {activeFilter === "all" ? <CalendarDays className="h-8 w-8" /> : <RefreshCcw className="h-8 w-8" />}
            </div>
            <h2 className="mt-5 text-xl font-bold text-slate-950">
                {activeFilter === "all" ? "No consultations yet" : `No ${activeFilter} consultations`}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                {activeFilter === "all"
                    ? "Browse EkariExperts and request a consultation from a specialist who matches your needs."
                    : "Bookings matching this status will appear here when available."}
            </p>
            {activeFilter === "all" ? (
                <button type="button" onClick={onBrowse} className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#233f39] px-5 text-sm font-semibold text-white transition hover:bg-[#1b312c]">
                    Browse experts
                </button>
            ) : null}
        </div>
    );
}

function FullPageLoader() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-[#f6f7f5]">
            <div className="text-center">
                <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#233f39]" />
                <p className="mt-3 text-sm font-medium text-slate-600">Preparing your bookings…</p>
            </div>
        </main>
    );
}