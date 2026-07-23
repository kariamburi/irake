"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getAuth,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react";

type ScreenState =
  | "verifying"
  | "success"
  | "error";

export default function ExpertPaymentCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reference =
    searchParams.get("reference") ||
    searchParams.get("trxref") ||
    "";

  const [state, setState] =
    useState<ScreenState>("verifying");
  const [message, setMessage] = useState(
    "Confirming your consultation payment…"
  );
  const [bookingId, setBookingId] = useState("");
  const started = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      getAuth(),
      async (user: User | null) => {
        if (started.current) return;

        if (!user) {
          setState("error");
          setMessage(
            "Please sign in again to verify this payment."
          );
          return;
        }

        if (!reference) {
          setState("error");
          setMessage(
            "The payment reference is missing."
          );
          return;
        }

        started.current = true;

        try {
          const idToken = await user.getIdToken();

          const response = await fetch(
            "/api/expert-bookings/verify",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ reference }),
            }
          );

          const result = (await response.json()) as {
            ok: boolean;
            message?: string;
            bookingId?: string;
          };

          if (!response.ok || !result.ok) {
            throw new Error(
              result.message ||
                "Payment verification failed."
            );
          }

          setBookingId(result.bookingId || "");
          setState("success");
          setMessage(
            "Payment confirmed. Your consultation is now booked."
          );
        } catch (error) {
          setState("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to verify payment."
          );
        }
      }
    );

    return unsubscribe;
  }, [reference]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f5] px-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {state === "verifying" && (
          <Loader2 className="mx-auto h-14 w-14 animate-spin text-[#233f39]" />
        )}

        {state === "success" && (
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
        )}

        {state === "error" && (
          <XCircle className="mx-auto h-14 w-14 text-rose-600" />
        )}

        <h1 className="mt-5 text-2xl font-bold text-slate-950">
          {state === "verifying"
            ? "Verifying payment"
            : state === "success"
              ? "Consultation confirmed"
              : "Verification problem"}
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          {message}
        </p>

        {state === "success" && bookingId && (
          <button
            onClick={() =>
              router.replace(
                `/account/bookings/${bookingId}`
              )
            }
            className="mt-7 h-12 w-full rounded-xl bg-[#233f39] text-sm font-bold text-white"
          >
            View consultation
          </button>
        )}

        {state === "error" && (
          <button
            onClick={() =>
              router.replace("/account/bookings")
            }
            className="mt-7 h-12 w-full rounded-xl bg-[#233f39] text-sm font-bold text-white"
          >
            Return to bookings
          </button>
        )}
      </div>
    </main>
  );
}
