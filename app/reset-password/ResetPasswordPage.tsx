"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  IoLockClosedOutline,
  IoEyeOutline,
  IoEyeOffOutline,
  IoCheckmarkCircle,
  IoChevronBack,
} from "react-icons/io5";
import {
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { getAuthSafe } from "@/lib/firebase";

const EKARI = {
  forest: "#233F39",
  leaf: "#1F3A34",
  gold: "#C79257",
  sand: "#FFFFFF",
  card: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
  hair: "#E5E7EB",
  subtext: "#5C6B66",
  danger: "#B42318",
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const mode = sp.get("mode");
  const oobCode = sp.get("oobCode");

  // Load Firebase auth safely (client-only)
  const [authBundle, setAuthBundle] = useState<{ auth: any } | null>(null);
  useEffect(() => {
    (async () => {
      const bundle = await getAuthSafe();
      if (bundle) setAuthBundle({ auth: bundle.auth });
    })();
  }, []);

  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [done, setDone] = useState(false);

  const disableAll = checking || loading || !authBundle;

  const pwRules = useMemo(() => {
    const v = pw.trim();
    return {
      len: v.length >= 8,
      num: /\d/.test(v),
      cap: /[A-Z]/.test(v),
    };
  }, [pw]);

  const canSubmit = useMemo(() => {
    return (
      !!oobCode &&
      mode === "resetPassword" &&
      pwRules.len &&
      pwRules.num &&
      pwRules.cap &&
      pw === pw2 &&
      pw.length > 0
    );
  }, [oobCode, mode, pwRules, pw, pw2]);

  useEffect(() => {
    (async () => {
      setErrorMsg("");
      if (!authBundle || !authBundle.auth) return;

      if (mode !== "resetPassword" || !oobCode) {
        setErrorMsg("Invalid reset link. Please request a new one.");
        setChecking(false);
        return;
      }

      try {
        const mail = await verifyPasswordResetCode(authBundle.auth, oobCode);
        setEmail(mail);
      } catch (e: any) {
        setErrorMsg("This reset link is invalid or has expired. Please request a new one.");
      } finally {
        setChecking(false);
      }
    })();
  }, [authBundle, mode, oobCode]);

  const mapAuthError = (err: any) => {
    switch (err?.code) {
      case "auth/expired-action-code":
        return "This reset link has expired. Please request a new one.";
      case "auth/invalid-action-code":
        return "This reset link is invalid. Please request a new one.";
      case "auth/weak-password":
        return "Choose a stronger password.";
      case "auth/network-request-failed":
        return "Network error. Check your connection.";
      default:
        return err?.message || "Could not reset password. Try again.";
    }
  };

  const handleReset = async () => {
    if (!canSubmit || disableAll) return;
    setLoading(true);
    setErrorMsg("");

    try {
      await confirmPasswordReset(authBundle!.auth, oobCode!, pw.trim());
      setDone(true);
      // Small UX: bounce to login after success
      setTimeout(() => router.push("/login"), 900);
    } catch (err: any) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen w-full flex flex-col justify-center px-5 items-center"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(35,63,57,0.12), transparent 55%), radial-gradient(circle at bottom right, rgba(199,146,87,0.16), #F3F4F6)",
      }}
    >
      <div className="w-full max-w-xl flex flex-col items-center gap-4">
        {/* Brand header */}
        <motion.div
          className="flex flex-col items-center gap-2 text-center"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 140,
            damping: 14,
            mass: 0.6,
            duration: 0.28,
          }}
        >
          <Image
            src="/ekarihub-logo.png"
            alt="ekarihub"
            width={320}
            height={86}
            priority
          />
          <p className="text-xs md:text-sm tracking-wide" style={{ color: EKARI.subtext }}>
            Create a new password
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          className="w-full rounded-3xl bg-white/90 backdrop-blur-xl shadow-[0_18px_60px_rgba(15,23,42,0.26)] border border-white/70 px-4 py-5 md:px-6 md:py-6 mt-2"
          initial={{ opacity: 0, y: 12, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {/* Title + helper */}
          <div className="flex flex-col gap-1 mb-3">
            <h1 className="font-black text-lg md:text-xl" style={{ color: EKARI.text }}>
              Reset password
            </h1>
            <p className="text-xs md:text-sm leading-5" style={{ color: EKARI.subtext }}>
              {email
                ? <>Resetting password for <span className="font-semibold">{email}</span></>
                : "Verify your reset link, then set a new password."}
            </p>
          </div>

          {/* State: checking */}
          {checking && (
            <p className="text-sm" style={{ color: EKARI.dim }}>
              Verifying reset link…
            </p>
          )}

          {/* Error */}
          {!!errorMsg && !done && (
            <p className="mt-3 text-center text-sm font-semibold" style={{ color: EKARI.danger }}>
              {errorMsg}
            </p>
          )}

          {/* Success */}
          {done && (
            <motion.div
              className="mt-3 rounded-xl border px-3 py-2.5 flex items-start gap-2"
              style={{ backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <IoCheckmarkCircle size={18} color="#10B981" />
              <div className="text-xs md:text-sm">
                <p className="font-semibold" style={{ color: "#065F46" }}>
                  Password updated.
                </p>
                <p className="mt-0.5" style={{ color: "#047857" }}>
                  Redirecting you to login…
                </p>
              </div>
            </motion.div>
          )}

          {/* Form */}
          {!checking && !done && !errorMsg && (
            <>
              {/* New password */}
              <label className="block text-xs font-semibold mb-1.5 mt-3">
                <span style={{ color: EKARI.dim }}>New password</span>
              </label>
              <div
                className="flex items-center rounded-xl border px-3 h-12 bg-[#F6F7FB]"
                style={{ borderColor: EKARI.hair }}
              >
                <IoLockClosedOutline className="mr-2" size={18} color={EKARI.dim} />
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="At least 8 chars"
                  className="w-full bg-transparent outline-none text-base"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleReset();
                  }}
                  disabled={disableAll}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="ml-2"
                  aria-label={showPw ? "Hide password" : "Show password"}
                  disabled={disableAll}
                >
                  {showPw ? (
                    <IoEyeOffOutline size={18} color={EKARI.dim} />
                  ) : (
                    <IoEyeOutline size={18} color={EKARI.dim} />
                  )}
                </button>
              </div>

              {/* Confirm password */}
              <label className="block text-xs font-semibold mb-1.5 mt-3">
                <span style={{ color: EKARI.dim }}>Confirm password</span>
              </label>
              <div
                className="flex items-center rounded-xl border px-3 h-12 bg-[#F6F7FB]"
                style={{ borderColor: EKARI.hair }}
              >
                <IoLockClosedOutline className="mr-2" size={18} color={EKARI.dim} />
                <input
                  type={showPw2 ? "text" : "password"}
                  placeholder="Re-type password"
                  className="w-full bg-transparent outline-none text-base"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleReset();
                  }}
                  disabled={disableAll}
                />
                <button
                  type="button"
                  onClick={() => setShowPw2((s) => !s)}
                  className="ml-2"
                  aria-label={showPw2 ? "Hide password" : "Show password"}
                  disabled={disableAll}
                >
                  {showPw2 ? (
                    <IoEyeOffOutline size={18} color={EKARI.dim} />
                  ) : (
                    <IoEyeOutline size={18} color={EKARI.dim} />
                  )}
                </button>
              </div>

              {/* Rules */}
              <div className="mt-3 rounded-xl border px-3 py-2.5" style={{ borderColor: EKARI.hair }}>
                <p className="text-xs font-semibold" style={{ color: EKARI.text }}>
                  Password requirements
                </p>
                <ul className="mt-1 text-xs leading-5" style={{ color: EKARI.subtext }}>
                  <li className={pwRules.len ? "font-semibold" : ""}>
                    • At least 8 characters
                  </li>
                  <li className={pwRules.cap ? "font-semibold" : ""}>
                    • Contains an uppercase letter
                  </li>
                  <li className={pwRules.num ? "font-semibold" : ""}>
                    • Contains a number
                  </li>
                  <li className={pw === pw2 && pw.length > 0 ? "font-semibold" : ""}>
                    • Passwords match
                  </li>
                </ul>
              </div>

              {/* Primary CTA */}
              <button
                onClick={handleReset}
                disabled={!canSubmit || disableAll}
                className="mt-4 w-full rounded-xl py-3 font-extrabold text-white active:scale-[0.98] transition"
                style={{
                  background: "linear-gradient(135deg, #C79257, #fbbf77)",
                  opacity: !canSubmit || disableAll ? 0.6 : 1,
                }}
              >
                {loading ? "Resetting..." : "Reset password"}
              </button>
            </>
          )}

          {/* Back */}
          <button
            onClick={() => router.back()}
            className="mx-auto mt-4 flex items-center gap-1 text-sm font-bold"
            style={{ color: EKARI.dim }}
            disabled={loading}
          >
            <IoChevronBack size={18} />
            Back
          </button>

          {/* Terms / Privacy */}
          <div className="mt-5 border-t pt-3 border-dashed" style={{ borderColor: EKARI.hair }}>
            <p className="text-[11px] md:text-xs leading-5 text-center" style={{ color: EKARI.text }}>
              By continuing, you agree to our{" "}
              <Link href="/terms" className="underline font-semibold" style={{ color: EKARI.forest }}>
                Terms and Conditions
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline font-semibold" style={{ color: EKARI.forest }}>
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </motion.div>

        <div className="h-2" />
      </div>
    </main>
  );
}
