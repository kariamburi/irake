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

import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/app/components/AppShell";
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
          onError={() => setFailed(true)}
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
      <AppShell>
        <main className="grid h-full min-h-0 place-items-center bg-[#F8F7F2]">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#173C2E]" />
            <p className="mt-3 text-[11px] font-semibold text-slate-400">
              Loading consultation…
            </p>
          </div>
        </main>
      </AppShell>
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
      <AppShell>
        <main className="grid h-full min-h-0 place-items-center overflow-y-auto bg-[#F8F7F2] px-4 py-10">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-7 text-center shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
          >
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-rose-50 text-rose-600">
              <XCircle className="h-6 w-6" />
            </div>

            <h1 className="mt-4 text-[18px] font-black text-slate-900">
              Booking unavailable
            </h1>

            <p className="mt-2 text-[12px] font-medium leading-5 text-slate-500">
              {error}
            </p>

            <button
              type="button"
              onClick={() => router.push("/account/bookings")}
              className="mt-5 h-10 rounded-xl bg-[#173C2E] px-5 text-[11px] font-black text-white transition hover:-translate-y-0.5 hover:bg-[#214C3A]"
            >
              Return to bookings
            </button>
          </motion.div>
        </main>
      </AppShell>
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
    <AppShell>
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#F8F7F2]">
        {/* HERO */}
        <motion.header
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
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
                  router.push("/account/bookings")
                }
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-white transition hover:bg-white/[0.11] active:scale-95"
                aria-label="Back to consultations"
              >
                <ArrowLeft className="h-4.5 w-4.5" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#F39A22]">
                  ekari Expert
                </div>

                <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <SafeExpertAvatar
                      src={booking.expertPhotoURL}
                      alt={booking.expertName || "Expert"}
                      size={56}
                    />

                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-white/40">
                        Expert consultation
                      </p>

                      <h1 className="mt-0.5 truncate text-[22px] font-black tracking-[-0.03em] md:text-[26px]">
                        {booking.expertName || "Ekari expert"}
                      </h1>

                      {booking.expertHeadline ? (
                        <p className="mt-1 line-clamp-2 max-w-2xl text-[11px] font-medium leading-5 text-white/50">
                          {booking.expertHeadline}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <span
                    className={[
                      "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5",
                      "text-[10px] font-black",
                      booking.status === "completed"
                        ? "bg-emerald-400/15 text-emerald-200"
                        : booking.status === "declined" ||
                          booking.status === "cancelled"
                          ? "bg-rose-400/15 text-rose-200"
                          : booking.status === "confirmed"
                            ? "bg-blue-400/15 text-blue-200"
                            : "bg-amber-400/15 text-amber-200",
                    ].join(" ")}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {statusLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        {/* SCROLLABLE WORKSPACE */}
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-[#F8F7F2] [-webkit-overflow-scrolling:touch]">
          <div className="mx-auto grid max-w-[1180px] gap-5 px-3 py-4 sm:px-4 md:px-6 md:py-5 xl:grid-cols-[minmax(0,1fr)_310px] xl:items-start">
            <section className="min-w-0 space-y-4">
              <AnimatePresence mode="popLayout">
                {error ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-700"
                  >
                    {error}
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* TOPIC */}
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)] sm:p-5"
              >
                <div className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                  Consultation topic
                </div>

                <h2 className="mt-1.5 text-[18px] font-black tracking-[-0.02em] text-slate-900">
                  {booking.topic || "Expert consultation"}
                </h2>

                {booking.message ? (
                  <div className="mt-4 rounded-[14px] bg-[#F3F1EB] px-4 py-3">
                    <div className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
                      Your message
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-[11px] font-medium leading-5 text-slate-600">
                      {booking.message}
                    </p>
                  </div>
                ) : null}
              </motion.div>

              {/* CORE DETAILS */}
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.2,
                  delay: 0.03,
                }}
                className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
              >
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
                  value={formatMethod(
                    booking.consultationMethod
                  )}
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
                  value={
                    PAYMENT_TEXT[
                    booking.paymentStatus
                    ]
                  }
                />
              </motion.div>

              {/* TIMEZONES */}
              {(booking.clientTimezone ||
                booking.expertTimezone) ? (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    delay: 0.05,
                  }}
                  className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)] sm:p-5"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E8ECE8] text-[#173C2E]">
                      <Globe2 className="h-4 w-4" />
                    </span>

                    <div>
                      <h3 className="text-[12px] font-black text-slate-900">
                        Timezones
                      </h3>

                      <p className="mt-2 text-[11px] font-medium text-slate-500">
                        Your timezone:{" "}
                        <strong className="text-slate-700">
                          {formatTimezone(
                            booking.clientTimezone
                          )}
                        </strong>
                      </p>

                      <p className="mt-1 text-[11px] font-medium text-slate-500">
                        Expert timezone:{" "}
                        <strong className="text-slate-700">
                          {formatTimezone(
                            booking.expertTimezone
                          )}
                        </strong>
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : null}

              {/* PHYSICAL VISIT */}
              {booking.consultationMethod ===
                "physical" ? (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    delay: 0.07,
                  }}
                  className="rounded-[18px] border border-amber-200 bg-amber-50 p-4 sm:p-5"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
                      <MapPin className="h-4 w-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-[12px] font-black text-amber-950">
                        Physical visit details
                      </h3>

                      <div className="mt-3 space-y-2 text-[11px] font-medium leading-5 text-amber-900">
                        <div>
                          <span className="font-black">
                            Visit location:
                          </span>{" "}
                          {visitLocation ||
                            "Not provided"}
                        </div>

                        {booking.visitContactPhone ? (
                          <div>
                            <span className="font-black">
                              Contact phone:
                            </span>{" "}
                            {
                              booking.visitContactPhone
                            }
                          </div>
                        ) : null}

                        {serviceAreas.length > 0 ? (
                          <div>
                            <span className="font-black">
                              Expert service area:
                            </span>{" "}
                            {serviceAreas.join(", ")}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : null}

              {/* EXPERT LOCATION */}
              {locationLabel ? (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    delay: 0.08,
                  }}
                  className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)] sm:p-5"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E8ECE8] text-[#173C2E]">
                      <MapPin className="h-4 w-4" />
                    </span>

                    <div>
                      <h3 className="text-[12px] font-black text-slate-900">
                        Expert service location
                      </h3>

                      <p className="mt-2 text-[11px] font-medium leading-5 text-slate-500">
                        {locationLabel}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : null}

              {/* MEETING */}
              {booking.status === "confirmed" &&
                booking.meetingUrl ? (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    delay: 0.09,
                  }}
                  className="rounded-[18px] border border-emerald-200 bg-emerald-50 p-4 sm:p-5"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                      <Video className="h-4 w-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-[12px] font-black text-emerald-950">
                        Your meeting is ready
                      </h3>

                      <p className="mt-1 text-[11px] font-medium text-emerald-800">
                        Use this link at the scheduled time.
                      </p>

                      <a
                        href={booking.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-[10px] font-black text-white transition hover:-translate-y-0.5 hover:bg-emerald-800"
                      >
                        Join consultation
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              ) : null}

              {/* CANCELLATION */}
              {booking.cancellationReason ? (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)] sm:p-5"
                >
                  <div className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                    Cancellation reason
                  </div>

                  <p className="mt-2 text-[11px] font-medium leading-5 text-slate-600">
                    {booking.cancellationReason}
                  </p>
                </motion.div>
              ) : null}
            </section>

            {/* PAYMENT / ACTION RAIL */}
            <motion.aside
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.24,
                delay: 0.04,
                ease: "easeOut",
              }}
              className="space-y-3 xl:sticky xl:top-4"
            >
              <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E8ECE8] text-[#173C2E]">
                    <ShieldCheck className="h-4 w-4" />
                  </span>

                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
                      Consultation payment
                    </div>

                    <div className="mt-0.5 text-[13px] font-black text-slate-800">
                      {
                        PAYMENT_TEXT[
                        booking.paymentStatus
                        ]
                      }
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-3 border-t border-[#E4DED2] pt-4 text-[11px]">
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-semibold text-slate-400">
                      Consultation fee
                    </span>

                    <span className="text-right font-black text-slate-800">
                      {formatFeeLabel(booking)}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <span className="font-semibold text-slate-400">
                      Payment
                    </span>

                    <span className="text-right font-black text-slate-700">
                      {
                        PAYMENT_TEXT[
                        booking.paymentStatus
                        ]
                      }
                    </span>
                  </div>

                  {booking.paymentReference ? (
                    <div className="flex items-start justify-between gap-4">
                      <span className="font-semibold text-slate-400">
                        Reference
                      </span>

                      <span className="max-w-[170px] truncate text-right font-black text-slate-700">
                        {booking.paymentReference}
                      </span>
                    </div>
                  ) : null}
                </div>

                {canPay ? (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={startPayment}
                    disabled={paying}
                    className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#F39A22] px-5 text-[11px] font-black text-white transition hover:-translate-y-0.5 hover:bg-[#E98C12] disabled:opacity-60"
                  >
                    {paying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Opening payment…
                      </>
                    ) : booking.paymentStatus ===
                      "pending" ? (
                      "Continue payment"
                    ) : (
                      `Pay ${money(
                        booking.fee,
                        booking.currency
                      )}`
                    )}
                  </motion.button>
                ) : null}

                {booking.paymentStatus ===
                  "paid" ? (
                  <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-center text-[10px] font-black text-emerald-700">
                    Payment received
                  </div>
                ) : null}

                {booking.paymentStatus ===
                  "not_required" ||
                  !paymentRequired ? (
                  <div className="mt-4 rounded-xl bg-slate-100 p-3 text-center text-[10px] font-black text-slate-600">
                    No payment is required for this consultation.
                  </div>
                ) : null}

                {canCancel ? (
                  <button
                    type="button"
                    onClick={cancelBooking}
                    disabled={cancelling}
                    className="mt-3 h-10 w-full rounded-xl border border-rose-200 bg-white text-[10px] font-black text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                  >
                    {cancelling
                      ? "Cancelling…"
                      : "Cancel consultation"}
                  </button>
                ) : null}
              </section>

              <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
                <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
                  Booking status
                </div>

                <div className="mt-3 flex items-start gap-3">
                  <span
                    className={[
                      "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                      booking.status === "completed"
                        ? "bg-emerald-100 text-emerald-700"
                        : booking.status === "declined" ||
                          booking.status === "cancelled"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-700",
                    ].join(" ")}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </span>

                  <div className="min-w-0">
                    <div className="text-[12px] font-black text-slate-800">
                      {statusLabel}
                    </div>

                    <p className="mt-1 text-[10px] font-medium leading-4 text-slate-400">
                      Booking ID: {booking.id}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
                <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
                  Quick links
                </div>

                <div className="mt-2 space-y-1">
                  {booking.expertHandle ? (
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/${booking.expertHandle!.replace(
                            /^@/,
                            ""
                          )}`
                        )
                      }
                      className="flex h-9 w-full items-center justify-between rounded-xl px-2.5 text-left text-[10px] font-black text-slate-600 transition hover:bg-[#EEF3EE] hover:text-[#173C2E]"
                    >
                      View expert profile
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() =>
                      router.push("/account/bookings")
                    }
                    className="flex h-9 w-full items-center justify-between rounded-xl px-2.5 text-left text-[10px] font-black text-slate-600 transition hover:bg-[#EEF3EE] hover:text-[#173C2E]"
                  >
                    My consultations
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      router.push("/ekari-experts")
                    }
                    className="flex h-9 w-full items-center justify-between rounded-xl px-2.5 text-left text-[10px] font-black text-slate-600 transition hover:bg-[#EEF3EE] hover:text-[#173C2E]"
                  >
                    Browse experts
                    <ExternalLink className="h-3.5 w-3.5" />
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
    <div className="rounded-[14px] border border-[#DDD8CC] bg-[#FBFAF6] px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.02)]">
      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
        <Icon className="h-3.5 w-3.5 text-[#F39A22]" />
        {label}
      </div>

      <p className="mt-1.5 break-words text-[11px] font-black leading-5 text-slate-700">
        {value}
      </p>
    </div>
  );
}