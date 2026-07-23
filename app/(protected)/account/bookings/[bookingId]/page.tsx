"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Loader2,
  MapPin,
  MessageCircle,
  ShieldCheck,
  UserRound,
  Video,
  XCircle,
} from "lucide-react";

import { db } from "@/lib/firebase";

type BookingStatus =
  | "pending"
  | "accepted"
  | "confirmed"
  | "declined"
  | "completed"
  | "cancelled";

type PaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "refunded";

type Booking = {
  id: string;
  expertId: string;
  expertName?: string;
  expertHandle?: string;
  expertPhotoURL?: string;
  expertHeadline?: string;
  clientId: string;
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
  paymentReference?: string;
  meetingUrl?: string;
  location?: string;
  createdAt?: Timestamp | null;
};

const STATUS_TEXT: Record<BookingStatus, string> = {
  pending: "Awaiting expert approval",
  accepted: "Accepted — payment required",
  confirmed: "Confirmed",
  declined: "Declined",
  completed: "Completed",
  cancelled: "Cancelled",
};

function money(amount: number, currency = "KES") {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function formatDate(value: string) {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-KE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date);
}

function formatTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-KE", {
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
}

export default function BookingDetailsPage() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = params.bookingId;

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(getAuth(), (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user?.uid || !bookingId) return;

    const unsubscribe = onSnapshot(
      doc(db, "expertBookings", bookingId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setBooking(null);
          setError("Booking not found.");
          setLoading(false);
          return;
        }

        const data = snapshot.data();

        if (data.clientId !== user.uid) {
          setBooking(null);
          setError("You cannot view this booking.");
          setLoading(false);
          return;
        }

        setBooking({
          id: snapshot.id,
          ...data,
          fee: Number(data.fee || 0),
          currency: data.currency || "KES",
        } as Booking);
        setLoading(false);
      },
      (snapshotError) => {
        console.error(snapshotError);
        setError("Unable to load this booking.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [bookingId, user?.uid]);

  useEffect(() => {
    if (
      searchParams.get("action") === "pay" &&
      booking?.status === "accepted" &&
      booking.paymentStatus !== "paid" &&
      !paying
    ) {
      void startPayment();
    }
    // Only react when the loaded booking becomes payable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id]);

  const methodIcon = useMemo(() => {
    const method =
      booking?.consultationMethod?.toLowerCase() || "";

    if (
      method.includes("video") ||
      method.includes("zoom") ||
      method.includes("meet")
    ) {
      return Video;
    }

    if (
      method.includes("physical") ||
      method.includes("office") ||
      method.includes("person")
    ) {
      return MapPin;
    }

    if (
      method.includes("chat") ||
      method.includes("message")
    ) {
      return MessageCircle;
    }

    return UserRound;
  }, [booking?.consultationMethod]);

  async function startPayment() {
    if (!user || !booking || paying) return;

    setPaying(true);
    setError("");

    try {
      const idToken = await user.getIdToken();

      const response = await fetch(
        "/api/expert-bookings/pay",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bookingId: booking.id,
          }),
        }
      );

      const result = (await response.json()) as {
        ok: boolean;
        message?: string;
        authorizationUrl?: string;
      };

      if (!response.ok || !result.authorizationUrl) {
        throw new Error(
          result.message || "Unable to start payment."
        );
      }

      window.location.assign(result.authorizationUrl);
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "Unable to start payment."
      );
      setPaying(false);
    }
  }

  async function cancelBooking() {
    if (
      !booking ||
      !["pending", "accepted"].includes(booking.status)
    ) {
      return;
    }

    if (
      !window.confirm(
        "Cancel this consultation request?"
      )
    ) {
      return;
    }

    setCancelling(true);
    setError("");

    try {
      await updateDoc(
        doc(db, "expertBookings", booking.id),
        {
          status: "cancelled",
          cancellationReason: "Cancelled by client",
          cancelledBy: user?.uid,
          cancelledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
    } catch {
      setError("Unable to cancel the booking.");
    } finally {
      setCancelling(false);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7f5]">
        <Loader2 className="h-9 w-9 animate-spin text-[#233f39]" />
      </main>
    );
  }

  if (!user) {
    router.replace(
      `/login?next=${encodeURIComponent(
        `/account/bookings/${bookingId}`
      )}`
    );
    return null;
  }

  if (!booking) {
    return (
      <main className="min-h-screen bg-[#f6f7f5] px-4 py-20">
        <div className="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm">
          <XCircle className="mx-auto h-12 w-12 text-rose-500" />
          <h1 className="mt-4 text-xl font-bold">
            Booking unavailable
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {error}
          </p>
          <button
            onClick={() => router.push("/account/bookings")}
            className="mt-6 rounded-xl bg-[#233f39] px-5 py-3 text-sm font-semibold text-white"
          >
            Return to bookings
          </button>
        </div>
      </main>
    );
  }

  const MethodIcon = methodIcon;
  const canPay =
    booking.status === "accepted" &&
    booking.paymentStatus !== "paid";
  const canCancel = ["pending", "accepted"].includes(
    booking.status
  );

  return (
    <main className="min-h-screen bg-[#f6f7f5] pb-20">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <button
            onClick={() => router.push("/account/bookings")}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
          >
            <ArrowLeft className="h-4 w-4" />
            My consultations
          </button>

          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {booking.expertPhotoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={booking.expertPhotoURL}
                  alt={booking.expertName || "Expert"}
                  className="h-16 w-16 rounded-2xl object-cover"
                />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#233f39] font-bold text-white">
                  EX
                </span>
              )}

              <div>
                <p className="text-sm font-semibold text-[#c79257]">
                  Expert consultation
                </p>
                <h1 className="text-2xl font-bold text-slate-950">
                  {booking.expertName || "Ekari expert"}
                </h1>
                {booking.expertHeadline && (
                  <p className="mt-1 text-sm text-slate-600">
                    {booking.expertHeadline}
                  </p>
                )}
              </div>
            </div>

            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
              <CheckCircle2 className="h-4 w-4" />
              {STATUS_TEXT[booking.status]}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-7 sm:px-6 lg:grid-cols-[1fr_330px]">
        <section className="space-y-6">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Consultation topic
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-950">
              {booking.topic}
            </h2>

            {booking.message && (
              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Your message
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {booking.message}
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Detail
              icon={CalendarDays}
              label="Date"
              value={formatDate(
                booking.consultationDate
              )}
            />
            <Detail
              icon={Clock3}
              label="Time"
              value={formatTime(
                booking.consultationTime
              )}
            />
            <Detail
              icon={MethodIcon}
              label="Method"
              value={booking.consultationMethod}
            />
            <Detail
              icon={CircleDollarSign}
              label="Fee"
              value={money(
                booking.fee,
                booking.currency
              )}
            />
          </div>

          {booking.status === "confirmed" &&
            booking.meetingUrl && (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
                <div className="flex items-start gap-3">
                  <Video className="mt-1 h-6 w-6 text-emerald-700" />
                  <div>
                    <h3 className="font-bold text-emerald-950">
                      Your meeting is ready
                    </h3>
                    <p className="mt-1 text-sm text-emerald-800">
                      Use this link at the scheduled time.
                    </p>
                    <a
                      href={booking.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      Join consultation
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            )}
        </section>

        <aside>
          <div className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-[#233f39]">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-sm font-semibold">
                Secure consultation payment
              </span>
            </div>

            <div className="mt-5 border-t border-slate-200 pt-5">
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">
                  Consultation fee
                </span>
                <span className="font-bold text-slate-950">
                  {money(booking.fee, booking.currency)}
                </span>
              </div>
              <div className="mt-3 flex justify-between">
                <span className="text-sm text-slate-600">
                  Payment
                </span>
                <span className="text-sm font-semibold capitalize text-slate-900">
                  {booking.paymentStatus}
                </span>
              </div>
            </div>

            {canPay && (
              <button
                onClick={startPayment}
                disabled={paying}
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#c79257] px-5 text-sm font-bold text-white transition hover:bg-[#b58149] disabled:opacity-60"
              >
                {paying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening Paystack…
                  </>
                ) : (
                  `Pay ${money(
                    booking.fee,
                    booking.currency
                  )}`
                )}
              </button>
            )}

            {booking.paymentStatus === "paid" && (
              <div className="mt-6 rounded-xl bg-emerald-50 p-3 text-center text-sm font-semibold text-emerald-700">
                Payment received
              </div>
            )}

            {canCancel && (
              <button
                onClick={cancelBooking}
                disabled={cancelling}
                className="mt-3 h-11 w-full rounded-xl border border-rose-200 text-sm font-semibold text-rose-700 disabled:opacity-60"
              >
                {cancelling
                  ? "Cancelling…"
                  : "Cancel consultation"}
              </button>
            )}

            {booking.expertHandle && (
              <button
                onClick={() =>
                  router.push(
                    `/${booking.expertHandle!.replace(/^@/, "")}`
                  )
                }
                className="mt-3 h-11 w-full rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
              >
                View expert profile
              </button>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <Icon className="h-5 w-5 text-[#233f39]" />
      <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-semibold text-slate-950">
        {value}
      </p>
    </div>
  );
}
