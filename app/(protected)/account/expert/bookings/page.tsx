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
} from "react-icons/io5";

import AppShell from "@/app/components/AppShell";
import { useAuth } from "@/app/hooks/useAuth";
import { db } from "@/lib/firebase";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    text: "#111827",
    subtext: "#6B7280",
    hair: "#E5E7EB",
    success: "#15803D",
    danger: "#B42318",
};

type BookingStatus =
    | "pending"
    | "accepted"
    | "declined"
    | "completed"
    | "cancelled";

type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded";

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

type FilterKey = "all" | BookingStatus;

function titleCase(value: string) {
    return value
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function money(amount: number, currency = "KES") {
    return currency === "KES"
        ? `KSh ${Number(amount || 0).toLocaleString("en-KE", {
            maximumFractionDigits: 0,
        })}`
        : `${currency} ${Number(amount || 0).toLocaleString()}`;
}

function statusStyles(status: BookingStatus) {
    if (status === "accepted") return "border-blue-200 bg-blue-50 text-blue-700";
    if (status === "completed") return "border-green-200 bg-green-50 text-green-700";
    if (status === "declined") return "border-red-200 bg-red-50 text-red-700";
    if (status === "cancelled") return "border-slate-200 bg-slate-100 text-slate-600";
    return "border-amber-200 bg-amber-50 text-amber-700";
}

export default function ExpertBookingsPage() {
    const router = useRouter();
    const { user } = useAuth();

    const [bookings, setBookings] = React.useState<ExpertBooking[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [filter, setFilter] = React.useState<FilterKey>("all");
    const [updatingId, setUpdatingId] = React.useState<string | null>(null);
    const [error, setError] = React.useState("");

    React.useEffect(() => {
        if (!user?.uid) {
            setBookings([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const bookingsQuery = query(
            collection(db, "expertBookings"),
            where("expertId", "==", user.uid),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(
            bookingsQuery,
            (snapshot) => {
                setBookings(
                    snapshot.docs.map((bookingDocument) => ({
                        id: bookingDocument.id,
                        ...(bookingDocument.data() as Omit<ExpertBooking, "id">),
                    }))
                );
                setLoading(false);
            },
            (snapshotError) => {
                console.error("LOAD_EXPERT_BOOKINGS_FAILED", snapshotError);
                setError(
                    snapshotError.message.includes("index")
                        ? "Firestore needs the expert bookings index. Open the index link shown in the browser console, create it, then reload this page."
                        : snapshotError.message || "Could not load consultation requests."
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
            collection(db, "expertBookings"),
            where("expertId", "==", expertId),
            where("expertUnread", "==", true)
        );

        const unreadSnapshot = await getDocs(
            unreadQuery
        );

        if (unreadSnapshot.empty) {
            return;
        }

        const batch = writeBatch(db);

        unreadSnapshot.docs.forEach(
            (bookingDocument) => {
                batch.update(
                    bookingDocument.ref,
                    {
                        expertUnread: false,
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

    const visibleBookings = React.useMemo(
        () =>
            filter === "all"
                ? bookings
                : bookings.filter((booking) => booking.status === filter),
        [bookings, filter]
    );

    const counts = React.useMemo(() => {
        const result: Record<FilterKey, number> = {
            all: bookings.length,
            pending: 0,
            accepted: 0,
            declined: 0,
            completed: 0,
            cancelled: 0,
        };

        bookings.forEach((booking) => {
            result[booking.status] += 1;
        });

        return result;
    }, [bookings]);

    async function updateStatus(booking: ExpertBooking, nextStatus: BookingStatus) {
        if (!user?.uid || booking.expertId !== user.uid || updatingId) return;

        const allowed =
            (booking.status === "pending" && ["accepted", "declined"].includes(nextStatus)) ||
            (booking.status === "accepted" && nextStatus === "completed");

        if (!allowed) {
            setError("That booking status change is not allowed.");
            return;
        }

        try {
            setUpdatingId(booking.id);
            setError("");

            await updateDoc(doc(db, "expertBookings", booking.id), {
                status: nextStatus,
                updatedAt: serverTimestamp(),
                ...(nextStatus === "accepted" ? { acceptedAt: serverTimestamp() } : {}),
                ...(nextStatus === "declined" ? { declinedAt: serverTimestamp() } : {}),
                ...(nextStatus === "completed" ? { completedAt: serverTimestamp() } : {}),
            });
        } catch (updateError: any) {
            console.error("UPDATE_EXPERT_BOOKING_FAILED", updateError);
            setError(updateError?.message || "Could not update this booking.");
        } finally {
            setUpdatingId(null);
        }
    }

    if (!user) {
        return (
            <AppShell>
                <main className="min-h-screen bg-slate-50 w-full px-4 py-10">
                    <div className="mx-auto max-w-lg rounded-[28px] border bg-white p-8 text-center">
                        <IoPersonOutline className="mx-auto" size={48} style={{ color: EKARI.gold }} />
                        <h1 className="mt-4 text-xl font-black" style={{ color: EKARI.text }}>
                            Sign in required
                        </h1>
                        <p className="mt-2 text-sm" style={{ color: EKARI.subtext }}>
                            Sign in to manage your expert consultation requests.
                        </p>
                        <button
                            type="button"
                            onClick={() => router.push("/login?redirect=/account/expert/bookings")}
                            className="mt-6 rounded-2xl px-5 py-3 text-sm font-black text-white"
                            style={{ backgroundColor: EKARI.forest }}
                        >
                            Sign in
                        </button>
                    </div>
                </main>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <main className="min-h-screen bg-slate-50 w-full px-3 py-5 md:px-6 md:py-8">
                <div className="mx-auto max-w-6xl">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <button
                                type="button"
                                onClick={() => router.push("/account/expert")}
                                className="mb-3 inline-flex items-center gap-2 text-sm font-bold"
                                style={{ color: EKARI.subtext }}
                            >
                                <IoArrowBack size={17} /> Expert settings
                            </button>
                            <h1 className="text-2xl font-black md:text-3xl" style={{ color: EKARI.text }}>
                                Consultation requests
                            </h1>
                            <p className="mt-1 text-sm" style={{ color: EKARI.subtext }}>
                                Accept, decline, and complete expert bookings.
                            </p>
                        </div>

                        <div className="rounded-2xl border bg-white px-4 py-3 text-sm" style={{ borderColor: EKARI.hair }}>
                            <span style={{ color: EKARI.subtext }}>Pending requests: </span>
                            <strong style={{ color: EKARI.text }}>{counts.pending}</strong>
                        </div>
                    </div>

                    <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
                        {(["all", "pending", "accepted", "completed", "declined", "cancelled"] as FilterKey[]).map(
                            (key) => {
                                const active = filter === key;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setFilter(key)}
                                        className="shrink-0 rounded-full border px-4 py-2 text-xs font-black transition"
                                        style={{
                                            borderColor: active ? EKARI.forest : EKARI.hair,
                                            backgroundColor: active ? EKARI.forest : "white",
                                            color: active ? "white" : EKARI.text,
                                        }}
                                    >
                                        {titleCase(key)} ({counts[key]})
                                    </button>
                                );
                            }
                        )}
                    </div>

                    {error ? (
                        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    ) : null}

                    {loading ? (
                        <div className="mt-5 grid gap-4">
                            {[1, 2, 3].map((item) => (
                                <div key={item} className="h-52 animate-pulse rounded-[24px] border bg-white" />
                            ))}
                        </div>
                    ) : visibleBookings.length === 0 ? (
                        <div className="mt-5 rounded-[28px] border bg-white px-6 py-16 text-center" style={{ borderColor: EKARI.hair }}>
                            <IoCalendarClearOutline className="mx-auto" size={48} style={{ color: EKARI.gold }} />
                            <h2 className="mt-4 text-lg font-black" style={{ color: EKARI.text }}>
                                No {filter === "all" ? "consultation requests" : filter + " requests"}
                            </h2>
                            <p className="mt-2 text-sm" style={{ color: EKARI.subtext }}>
                                New bookings will appear here automatically.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-5 grid gap-4">
                            {visibleBookings.map((booking) => {
                                const busy = updatingId === booking.id;
                                const feeLabel = booking.feeType === "free" ? "Free" : money(booking.fee, booking.currency);

                                return (
                                    <article
                                        key={booking.id}
                                        className="rounded-[24px] border bg-white p-5 shadow-sm"
                                        style={{ borderColor: EKARI.hair }}
                                    >
                                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <img
                                                    src={booking.clientPhotoURL || "/avatar-placeholder.png"}
                                                    alt={booking.clientName || "Client"}
                                                    className="h-14 w-14 shrink-0 rounded-2xl border object-cover"
                                                    style={{ borderColor: EKARI.hair }}
                                                />
                                                <div className="min-w-0">
                                                    <h2 className="truncate text-base font-black" style={{ color: EKARI.text }}>
                                                        {booking.clientName || "Ekarihub member"}
                                                    </h2>
                                                    <p className="mt-1 truncate text-xs" style={{ color: EKARI.subtext }}>
                                                        {booking.clientEmail || "Consultation client"}
                                                    </p>
                                                </div>
                                            </div>

                                            <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black ${statusStyles(booking.status)}`}>
                                                {titleCase(booking.status)}
                                            </span>
                                        </div>

                                        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                            <Info label="Date" value={booking.consultationDate} icon={<IoCalendarClearOutline size={16} />} />
                                            <Info label="Time" value={booking.consultationTime} icon={<IoTimeOutline size={16} />} />
                                            <Info label="Method" value={titleCase(booking.consultationMethod)} icon={<IoPersonOutline size={16} />} />
                                            <Info label="Fee" value={feeLabel} icon={<IoHourglassOutline size={16} />} />
                                        </div>

                                        <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: EKARI.hair, backgroundColor: "#FAFAFA" }}>
                                            <p className="text-xs font-bold" style={{ color: EKARI.subtext }}>
                                                Consultation topic
                                            </p>
                                            <p className="mt-1 text-sm font-black" style={{ color: EKARI.text }}>
                                                {booking.topic}
                                            </p>
                                            {booking.message ? (
                                                <p className="mt-3 whitespace-pre-wrap text-sm leading-6" style={{ color: EKARI.subtext }}>
                                                    {booking.message}
                                                </p>
                                            ) : null}
                                        </div>

                                        <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: EKARI.hair }}>
                                            <p className="text-xs" style={{ color: EKARI.subtext }}>
                                                Payment: <strong>{titleCase(booking.paymentStatus)}</strong>
                                            </p>

                                            <div className="flex flex-wrap gap-2">
                                                {booking.status === "pending" ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            disabled={busy}
                                                            onClick={() => void updateStatus(booking, "declined")}
                                                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-black text-red-700 disabled:opacity-50"
                                                        >
                                                            <IoCloseCircleOutline size={17} /> Decline
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={busy}
                                                            onClick={() => void updateStatus(booking, "accepted")}
                                                            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
                                                            style={{ backgroundColor: EKARI.forest }}
                                                        >
                                                            <IoCheckmarkCircleOutline size={17} />
                                                            {busy ? "Updating…" : "Accept"}
                                                        </button>
                                                    </>
                                                ) : null}

                                                {booking.status === "accepted" ? (
                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        onClick={() => void updateStatus(booking, "completed")}
                                                        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
                                                        style={{ backgroundColor: EKARI.success }}
                                                    >
                                                        <IoCheckmarkCircleOutline size={17} />
                                                        {busy ? "Updating…" : "Mark completed"}
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
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
        <div className="rounded-2xl border p-3" style={{ borderColor: EKARI.hair }}>
            <div className="flex items-center gap-2 text-xs font-bold" style={{ color: EKARI.subtext }}>
                {icon} {label}
            </div>
            <p className="mt-1 truncate text-sm font-black" style={{ color: EKARI.text }}>
                {value || "—"}
            </p>
        </div>
    );
}