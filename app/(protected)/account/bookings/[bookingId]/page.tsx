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
  Globe2,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
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
  | "refunded"
  | "not_required";

type ConsultationMethod =
  | "phone"
  | "whatsapp"
  | "video"
  | "chat"
  | "physical";

type ExpertCurrency = "KES" | "USD";
type FeeType = "fixed" | "starting_from" | "free";

type ExpertCoordinates = {
  latitude: number;
  longitude: number;
  geohash?: string | null;
};

type ExpertPlace = {
  placeId: string | null;
  label: string;
  countryCode: string;
  country: string;
  region: string;
  city: string;
  locality: string;
  coordinates: ExpertCoordinates | null;
  timezone: string | null;
};

type ExpertServiceArea = {
  id: string;
  type: "country" | "region" | "city" | "radius";
  label: string;
  placeId: string | null;
  countryCode: string;
  country: string;
  region: string;
  city: string;
  center: ExpertCoordinates | null;
  radiusKm: number | null;
};

type ExpertServiceCoverage = {
  offersOnlineServices: boolean;
  offersPhysicalVisits: boolean;
  onlineCoverage: "local" | "country" | "worldwide";
  serviceAreas: ExpertServiceArea[];
};

type PricingSnapshot = {
  fee?: number;
  feeType?: FeeType;
  currency?: ExpertCurrency;
  physicalVisitFeeFrom?: number | null;
  consultationDurationMinutes?: number | null;
};

type Booking = {
  id: string;

  expertId: string;
  expertName?: string;
  expertHandle?: string;
  expertPhotoURL?: string;
  expertHeadline?: string;
  expertPrimaryLocation?: ExpertPlace | null;
  expertServiceCoverage?: ExpertServiceCoverage | null;

  clientId: string;
  clientName?: string;
  clientPhotoURL?: string;
  clientEmail?: string | null;

  consultationMethod: ConsultationMethod;
  consultationDate: string;
  consultationTime: string;
  consultationDurationMinutes?: number | null;

  scheduledStart?: Timestamp | Date | null;
  scheduledStartIso?: string | null;
  clientTimezone?: string | null;
  expertTimezone?: string | null;

  topic: string;
  message: string;

  visitLocation?: string | null;
  visitContactPhone?: string | null;

  fee: number;
  currency: ExpertCurrency;
  feeType: FeeType;
  pricingSnapshot?: PricingSnapshot | null;

  status: BookingStatus;
  paymentStatus: PaymentStatus;

  paymentReference?: string | null;
  paymentCheckoutId?: string | null;
  paidAt?: Timestamp | null;

  meetingUrl?: string | null;
  location?: string | null;

  cancellationReason?: string | null;
  cancelledAt?: Timestamp | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
};

const STATUS_TEXT: Record<BookingStatus, string> = {
  pending: "Awaiting expert approval",
  accepted: "Accepted",
  confirmed: "Confirmed",
  declined: "Declined",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PAYMENT_TEXT: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  pending: "Payment pending",
  paid: "Paid",
  refunded: "Refunded",
  not_required: "No payment required",
};

function normalizeStatus(value: unknown): BookingStatus {
  const supported: BookingStatus[] = [
    "pending",
    "accepted",
    "confirmed",
    "declined",
    "completed",
    "cancelled",
  ];

  return supported.includes(value as BookingStatus)
    ? (value as BookingStatus)
    : "pending";
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  const supported: PaymentStatus[] = [
    "unpaid",
    "pending",
    "paid",
    "refunded",
    "not_required",
  ];

  return supported.includes(value as PaymentStatus)
    ? (value as PaymentStatus)
    : "unpaid";
}

function normalizeMethod(value: unknown): ConsultationMethod {
  const supported: ConsultationMethod[] = [
    "phone",
    "whatsapp",
    "video",
    "chat",
    "physical",
  ];

  return supported.includes(value as ConsultationMethod)
    ? (value as ConsultationMethod)
    : "phone";
}

function normalizeCurrency(value: unknown): ExpertCurrency {
  return value === "USD" ? "USD" : "KES";
}

function normalizeFeeType(value: unknown): FeeType {
  return value === "starting_from" || value === "free"
    ? value
    : "fixed";
}

function money(amount: number, currency: ExpertCurrency = "KES") {
  const value = Number(amount || 0);

  try {
    return new Intl.NumberFormat(currency === "KES" ? "en-KE" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "KES" ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function formatFeeLabel(booking: Booking) {
  if (booking.feeType === "free" || booking.fee <= 0) {
    return "Free";
  }

  const formatted = money(booking.fee, booking.currency);
  return booking.feeType === "starting_from"
    ? `From ${formatted}`
    : formatted;
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
  if (!value) return "Not set";

  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;

  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return new Intl.DateTimeFormat("en-KE", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatMethod(value: ConsultationMethod) {
  const labels: Record<ConsultationMethod, string> = {
    phone: "Phone call",
    whatsapp: "WhatsApp",
    video: "Video consultation",
    chat: "Ekarihub chat",
    physical: "Physical visit",
  };

  return labels[value];
}

function getMethodIcon(method: ConsultationMethod) {
  switch (method) {
    case "video":
      return Video;
    case "physical":
      return MapPin;
    case "chat":
      return MessageCircle;
    case "phone":
      return Phone;
    case "whatsapp":
      return MessageCircle;
    default:
      return UserRound;
  }
}

function formatTimezone(value?: string | null) {
  return value?.trim() || "Not specified";
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

    setLoading(true);
    setError("");

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

        const currency = normalizeCurrency(
          data.currency ?? data.pricingSnapshot?.currency
        );

        const feeType = normalizeFeeType(
          data.feeType ?? data.pricingSnapshot?.feeType
        );

        const fee = Number(
          data.fee ?? data.pricingSnapshot?.fee ?? 0
        );

        setBooking({
          id: snapshot.id,
          ...data,
          consultationMethod: normalizeMethod(data.consultationMethod),
          status: normalizeStatus(data.status),
          paymentStatus: normalizePaymentStatus(data.paymentStatus),
          currency,
          feeType,
          fee: Number.isFinite(fee) ? fee : 0,
          consultationDurationMinutes:
            Number(
              data.consultationDurationMinutes ??
              data.pricingSnapshot?.consultationDurationMinutes ??
              0
            ) || null,
        } as Booking);

        setLoading(false);
      },
      (snapshotError) => {
        console.error("LOAD_BOOKING_DETAILS_FAILED", snapshotError);
        setError("Unable to load this booking.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [bookingId, user?.uid]);

  const paymentRequired = useMemo(() => {
    if (!booking) return false;

    return (
      booking.feeType !== "free" &&
      booking.fee > 0 &&
      booking.paymentStatus !== "not_required"
    );
  }, [booking]);

  const canPay =
    !!booking &&
    booking.status === "accepted" &&
    paymentRequired &&
    !["paid", "refunded"].includes(booking.paymentStatus);

  useEffect(() => {
    if (
      searchParams.get("action") === "pay" &&
      canPay &&
      !paying
    ) {
      void startPayment();
    }
    // Only react when the loaded booking becomes payable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id, canPay]);

  const MethodIcon = useMemo(
    () => getMethodIcon(booking?.consultationMethod || "phone"),
    [booking?.consultationMethod]
  );

  async function startPayment() {
    if (!user || !booking || paying) return;

    if (!paymentRequired) {
      setError("This consultation does not require payment.");
      return;
    }

    if (booking.status !== "accepted") {
      setError("The expert must accept this consultation before payment.");
      return;
    }

    if (booking.paymentStatus === "paid") {
      setError("This consultation has already been paid.");
      return;
    }

    setPaying(true);
    setError("");

    try {
      const idToken = await user.getIdToken();

      const response = await fetch("/api/expert-bookings/pay", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookingId: booking.id }),
      });

      const result = (await response.json()) as {
        ok: boolean;
        message?: string;
        authorizationUrl?: string;
      };

      if (!response.ok || !result.authorizationUrl) {
        throw new Error(result.message || "Unable to start payment.");
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
    if (!booking || !["pending", "accepted"].includes(booking.status)) {
      return;
    }

    if (!window.confirm("Cancel this consultation request?")) {
      return;
    }

    setCancelling(true);
    setError("");

    try {
      await updateDoc(doc(db, "expertBookings", booking.id), {
        status: "cancelled",
        cancellationReason: "Cancelled by client",
        cancelledBy: user?.uid,
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (cancelError) {
      console.error("CANCEL_BOOKING_FAILED", cancelError);
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
      `/login?next=${encodeURIComponent(`/account/bookings/${bookingId}`)}`
    );
    return null;
  }

  if (!booking) {
    return (
      <main className="min-h-screen bg-[#f6f7f5] px-4 py-20">
        <div className="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm">
          <XCircle className="mx-auto h-12 w-12 text-rose-500" />
          <h1 className="mt-4 text-xl font-bold">Booking unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button
            type="button"
            onClick={() => router.push("/account/bookings")}
            className="mt-6 rounded-xl bg-[#233f39] px-5 py-3 text-sm font-semibold text-white"
          >
            Return to bookings
          </button>
        </div>
      </main>
    );
  }

  const canCancel = ["pending", "accepted"].includes(booking.status);
  const locationLabel =
    booking.expertPrimaryLocation?.label || booking.location || "";
  const visitLocation = booking.visitLocation?.trim() || "";
  const serviceAreas =
    booking.expertServiceCoverage?.serviceAreas
      ?.map((area) => area.label)
      .filter(Boolean) || [];

  const statusLabel =
    booking.status === "accepted" && paymentRequired
      ? "Accepted — payment required"
      : booking.status === "accepted"
        ? "Accepted — no payment required"
        : STATUS_TEXT[booking.status];

  return (
    <main className="min-h-screen bg-[#f6f7f5] pb-20">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <button
            type="button"
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

              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#c79257]">
                  Expert consultation
                </p>
                <h1 className="truncate text-2xl font-bold text-slate-950">
                  {booking.expertName || "Ekari expert"}
                </h1>
                {booking.expertHeadline ? (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                    {booking.expertHeadline}
                  </p>
                ) : null}
              </div>
            </div>

            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
              <CheckCircle2 className="h-4 w-4" />
              {statusLabel}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-7 sm:px-6 lg:grid-cols-[1fr_330px]">
        <section className="space-y-6">
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Consultation topic
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-950">
              {booking.topic || "Expert consultation"}
            </h2>

            {booking.message ? (
              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Your message
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {booking.message}
                </p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Detail
              icon={CalendarDays}
              label="Date"
              value={formatDate(booking.consultationDate)}
            />
            <Detail
              icon={Clock3}
              label="Time"
              value={formatTime(booking.consultationTime)}
            />
            <Detail
              icon={MethodIcon}
              label="Method"
              value={formatMethod(booking.consultationMethod)}
            />
            <Detail
              icon={CircleDollarSign}
              label="Fee"
              value={formatFeeLabel(booking)}
            />
            {booking.consultationDurationMinutes ? (
              <Detail
                icon={Clock3}
                label="Duration"
                value={`${booking.consultationDurationMinutes} minutes`}
              />
            ) : null}
            <Detail
              icon={ShieldCheck}
              label="Payment"
              value={PAYMENT_TEXT[booking.paymentStatus]}
            />
          </div>

          {(booking.clientTimezone || booking.expertTimezone) ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <Globe2 className="mt-0.5 h-5 w-5 text-[#233f39]" />
                <div>
                  <h3 className="font-bold text-slate-950">Timezones</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Your timezone: {formatTimezone(booking.clientTimezone)}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Expert timezone: {formatTimezone(booking.expertTimezone)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {booking.consultationMethod === "physical" ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-6 w-6 text-amber-700" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-amber-950">
                    Physical visit details
                  </h3>

                  <div className="mt-4 space-y-3 text-sm text-amber-900">
                    <div>
                      <span className="font-semibold">Visit location:</span>{" "}
                      {visitLocation || "Not provided"}
                    </div>

                    {booking.visitContactPhone ? (
                      <div>
                        <span className="font-semibold">Contact phone:</span>{" "}
                        {booking.visitContactPhone}
                      </div>
                    ) : null}

                    {serviceAreas.length > 0 ? (
                      <div>
                        <span className="font-semibold">Expert service area:</span>{" "}
                        {serviceAreas.join(", ")}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {locationLabel ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 text-[#233f39]" />
                <div>
                  <h3 className="font-bold text-slate-950">
                    Expert service location
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {locationLabel}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {booking.status === "confirmed" && booking.meetingUrl ? (
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
          ) : null}

          {booking.cancellationReason ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Cancellation reason
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {booking.cancellationReason}
              </p>
            </div>
          ) : null}
        </section>

        <aside>
          <div className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-[#233f39]">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-sm font-semibold">
                Consultation payment
              </span>
            </div>

            <div className="mt-5 border-t border-slate-200 pt-5">
              <div className="flex justify-between gap-4">
                <span className="text-sm text-slate-600">
                  Consultation fee
                </span>
                <span className="text-right font-bold text-slate-950">
                  {formatFeeLabel(booking)}
                </span>
              </div>

              <div className="mt-3 flex justify-between gap-4">
                <span className="text-sm text-slate-600">Payment</span>
                <span className="text-right text-sm font-semibold text-slate-900">
                  {PAYMENT_TEXT[booking.paymentStatus]}
                </span>
              </div>

              {booking.paymentReference ? (
                <div className="mt-3 flex justify-between gap-4">
                  <span className="text-sm text-slate-600">Reference</span>
                  <span className="max-w-[170px] truncate text-right text-sm font-semibold text-slate-900">
                    {booking.paymentReference}
                  </span>
                </div>
              ) : null}
            </div>

            {canPay ? (
              <button
                type="button"
                onClick={startPayment}
                disabled={paying}
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#c79257] px-5 text-sm font-bold text-white transition hover:bg-[#b58149] disabled:opacity-60"
              >
                {paying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening payment…
                  </>
                ) : booking.paymentStatus === "pending" ? (
                  "Continue payment"
                ) : (
                  `Pay ${money(booking.fee, booking.currency)}`
                )}
              </button>
            ) : null}

            {booking.paymentStatus === "paid" ? (
              <div className="mt-6 rounded-xl bg-emerald-50 p-3 text-center text-sm font-semibold text-emerald-700">
                Payment received
              </div>
            ) : null}

            {booking.paymentStatus === "not_required" || !paymentRequired ? (
              <div className="mt-6 rounded-xl bg-slate-50 p-3 text-center text-sm font-semibold text-slate-700">
                No payment is required for this consultation.
              </div>
            ) : null}

            {canCancel ? (
              <button
                type="button"
                onClick={cancelBooking}
                disabled={cancelling}
                className="mt-3 h-11 w-full rounded-xl border border-rose-200 text-sm font-semibold text-rose-700 disabled:opacity-60"
              >
                {cancelling ? "Cancelling…" : "Cancel consultation"}
              </button>
            ) : null}

            {booking.expertHandle ? (
              <button
                type="button"
                onClick={() =>
                  router.push(`/${booking.expertHandle!.replace(/^@/, "")}`)
                }
                className="mt-3 h-11 w-full rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
              >
                View expert profile
              </button>
            ) : null}
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
      <p className="mt-1 break-words font-semibold text-slate-950">{value}</p>
    </div>
  );
}