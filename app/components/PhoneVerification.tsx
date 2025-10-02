"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from "firebase/auth";

declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier;
  }
}

export default function PhoneVerification({
  onVerified,
}: {
  onVerified: (phone: string) => void;
}) {
  const [countryCode, setCountryCode] = useState("+254");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !window.recaptchaVerifier) {
      const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: () => { },
        "expired-callback": () => {
          console.warn("reCAPTCHA expired");
        },
      });

      verifier.render().then(() => {
        window.recaptchaVerifier = verifier;
      });
    }
  }, []);

  const sendOtp = async () => {
    setError("");
    const fullPhone = `${countryCode}${phone.trim()}`;

    if (!phone.match(/^\d{7,12}$/)) {
      setError("Enter a valid phone number.");
      return;
    }

    if (!window.recaptchaVerifier) {
      setError("reCAPTCHA is not ready. Please try again.");
      return;
    }

    setLoading(true);
    try {
      const result = await signInWithPhoneNumber(
        auth,
        fullPhone,
        window.recaptchaVerifier
      );
      setConfirmResult(result);
    } catch (err: any) {
      console.log(err);
      setError("Failed to send OTP. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!confirmResult) return;
    setError("");
    setLoading(true);
    try {
      const res = await confirmResult.confirm(otp);
      onVerified(res.user.phoneNumber || "");
    } catch (err: any) {
      console.error(err);
      setError("Invalid OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      {!confirmResult ? (
        <div className="flex flex-col md:flex-row gap-2 w-full">
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="border px-2 py-2 rounded w-full md:w-auto"
          >
            <option value="+254">Kenya (+254)</option>
            <option value="+255">Tanzania (+255)</option>
            <option value="+256">Uganda (+256)</option>
            <option value="+250">Rwanda (+250)</option>
          </select>

          <input
            className="border px-2 py-2 rounded w-full"
            placeholder="712345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <button
            onClick={() => {
              if (!loading) sendOtp();
            }}
            className="w-full md:w-[180px] bg-gradient-to-br from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500 text-white font-semibold rounded py-2 transition-all"
          >
            {loading ? "Sending..." : "Send OTP"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-2 w-full">
          <input
            className="border px-2 py-2 rounded w-full"
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          <button
            onClick={() => {
              if (!loading) verifyOtp();
            }}
            className="w-full md:w-[180px] bg-gradient-to-br from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500 text-white font-semibold rounded py-2 transition-all"
          >
            {loading ? "Verifying..." : "Verify OTP"}
          </button>
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div id="recaptcha-container" />
    </div>
  );
}
