"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  IoArrowBackOutline,
  IoArrowForwardOutline,
  IoCheckmarkCircle,
  IoEyeOffOutline,
  IoEyeOutline,
  IoLeafOutline,
  IoLockClosedOutline,
  IoShieldCheckmarkOutline,
  IoSparklesOutline,
} from "react-icons/io5";
import {
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { getAuthSafe } from "@/lib/firebase";

const EKARI = {
  forest: "#173C2E",
  gold: "#c69258",
  text: "#0F172A",
  dim: "#64748B",
  hair: "#DDD8CC",
  subtext: "#64748B",
  danger: "#B42318",
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const mode = sp.get("mode");
  const oobCode = sp.get("oobCode");

  const [authBundle, setAuthBundle] = useState<{ auth: any } | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadAuth() {
      try {
        const bundle = await getAuthSafe();

        if (!mounted) return;

        if (!bundle?.auth) {
          setErrorMsg(
            "Unable to load password reset. Please open this link in Google Chrome or request a new reset link."
          );
          setChecking(false);
          return;
        }

        setAuthBundle({ auth: bundle.auth });
      } catch (err) {
        console.log("Firebase auth load error:", err);

        if (!mounted) return;

        setErrorMsg(
          "Unable to load password reset. Please open this link in Google Chrome or request a new reset link."
        );
        setChecking(false);
      }
    }

    loadAuth();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function verifyLink() {
      try {
        setErrorMsg("");

        if (!authBundle?.auth) return;

        if (mode !== "resetPassword" || !oobCode) {
          setErrorMsg("Invalid reset link. Please request a new one.");
          setChecking(false);
          return;
        }

        const mail = await verifyPasswordResetCode(authBundle.auth, oobCode);

        if (!mounted) return;

        setEmail(mail);
      } catch (err) {
        console.log("Reset link verification error:", err);

        if (!mounted) return;

        setErrorMsg(
          "This reset link is invalid or has expired. Please request a new one."
        );
      } finally {
        if (mounted) setChecking(false);
      }
    }

    verifyLink();

    return () => {
      mounted = false;
    };
  }, [authBundle, mode, oobCode]);

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
    if (!canSubmit || disableAll || !authBundle?.auth || !oobCode) return;

    setLoading(true);
    setErrorMsg("");

    try {
      await confirmPasswordReset(authBundle.auth, oobCode, pw.trim());
      setDone(true);

      setTimeout(() => {
        router.push("/login");
      }, 900);
    } catch (err: any) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="h-[100svh] w-full overflow-hidden bg-[#F8F7F2]"
    >
      <div className="grid h-full w-full lg:grid-cols-[0.92fr_1.08fr]">
        {/* LEFT */}
        <section className="relative hidden overflow-hidden bg-[#173C2E] px-5 py-6 text-white lg:block lg:h-full lg:px-10 lg:py-10 xl:px-14">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.045]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.75) 18px 19px)",
            }}
          />

          <div className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full bg-white/[0.035]" />
          <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-[#c69258]/[0.08]" />

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="relative mx-auto flex h-full w-full min-w-0 max-w-[560px] flex-col"
          >
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/"
                aria-label="Go to ekarihub"
                className="inline-flex items-center"
              >
                <Image
                  src="/ekarihub-logo-green.png"
                  alt="ekarihub"
                  width={156}
                  height={44}
                  priority
                  className="h-auto w-[132px] object-contain"
                />
              </Link>

              <Link
                href="/login"
                className="inline-flex h-9 items-center rounded-xl border border-white/12 bg-white/[0.06] px-3 text-[9px] font-black text-white/70 transition hover:bg-white/[0.11]"
              >
                Back to login
              </Link>
            </div>

            <div className="flex flex-1 flex-col justify-center py-8 lg:py-10">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/65">
                <IoSparklesOutline
                  size={12}
                  className="text-[#c69258]"
                />
                Create new password
              </div>

              <h1 className="mt-5 max-w-[470px] text-[30px] font-black leading-[1.06] tracking-[-0.045em] sm:text-[36px] xl:text-[42px]">
                Secure your account with a fresh password.
              </h1>

              <p className="mt-4 max-w-[470px] text-[11px] font-medium leading-5 text-white/55 sm:text-[12px]">
                Choose a strong new password for your ekarihub account. Once updated, you&apos;ll return to login and continue normally.
              </p>

              <div className="mt-7 space-y-5">
                <FeatureRow
                  icon={<IoLockClosedOutline size={18} />}
                  title="Use a strong password"
                  description="Choose at least eight characters with an uppercase letter and a number."
                />

                <FeatureRow
                  icon={<IoShieldCheckmarkOutline size={18} />}
                  title="Protected reset flow"
                  description="The reset link is verified before ekarihub allows your password to change."
                />

                <FeatureRow
                  icon={<IoLeafOutline size={18} />}
                  title="Your profile stays intact"
                  description="Changing your password does not affect your profile, deeds, listings, messages or connections."
                />
              </div>


            </div>

            <div className="pb-1 text-[9px] font-semibold text-white/30">
              Collaborate · Innovate · Cultivate
            </div>
          </motion.div>
        </section>

        {/* RIGHT */}
        <section className="relative flex h-full  overflow-y-auto overflow-x-hidden flex-col bg-[#F8F7F2] px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 xl:px-14">
          <div className="pointer-events-none absolute -right-32 -top-28 h-80 w-80 rounded-full bg-[#173C2E]/[0.025]" />
          <div className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-[#c69258]/[0.035]" />

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="relative mx-auto flex h-full w-full min-w-0 max-w-[560px] flex-1 flex-col"
          >
            {/* Mobile header */}
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <Link
                href="/"
                aria-label="Go to ekarihub"
                className="inline-flex items-center"
              >
                <Image
                  src="/ekarihub-logo.png"
                  alt="ekarihub"
                  width={152}
                  height={44}
                  priority
                  className="h-auto w-[128px]"
                />
              </Link>

              <Link
                href="/login"
                className="inline-flex h-9 items-center rounded-xl border border-[#DDD8CC] bg-[#FBFAF6] px-3 text-[9px] font-black text-[#173C2E]"
              >
                Log in
              </Link>
            </div>

            <div className="flex flex-1 flex-col justify-center py-3 lg:py-8">
              <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                Password reset
              </div>

              <h2 className="mt-1 text-[25px] font-black tracking-[-0.035em] text-slate-900 sm:text-[29px]">
                Create a new password.
              </h2>

              <p className="mt-2 max-w-[480px] text-[10px] font-medium leading-5 text-slate-500">
                {email ? (
                  <>
                    Resetting password for{" "}
                    <span className="font-black text-slate-700">{email}</span>
                  </>
                ) : (
                  "We&apos;ll verify your reset link before allowing a new password."
                )}
              </p>

              {checking ? (
                <div className="mt-5 rounded-[15px] border border-[#E5E0D6] bg-[#FBFAF6] px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-[#173C2E]" />

                    <span className="text-[9px] font-black text-slate-500">
                      Verifying reset link...
                    </span>
                  </div>
                </div>
              ) : null}

              {!!errorMsg && !done ? (
                <div className="mt-5 rounded-[15px] border border-rose-200 bg-rose-50 px-3.5 py-3">
                  <div className="text-[10px] font-black text-rose-700">
                    We couldn&apos;t verify this reset link.
                  </div>

                  <p className="mt-1 text-[9px] font-medium leading-4 text-rose-600">
                    {errorMsg}
                  </p>

                  <p className="mt-2 text-[8px] font-medium leading-4 text-rose-500">
                    If the link still fails, request a new password-reset email.
                  </p>

                  <Link
                    href="/forgot-password"
                    className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-[8px] font-black text-rose-700 transition hover:bg-rose-50"
                  >
                    Request new reset link
                    <IoArrowForwardOutline size={12} />
                  </Link>
                </div>
              ) : null}

              {done ? (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="mt-5 rounded-[15px] border border-emerald-200 bg-emerald-50 px-3.5 py-3"
                >
                  <div className="flex items-start gap-2.5">
                    <IoCheckmarkCircle
                      size={18}
                      className="mt-0.5 shrink-0 text-emerald-600"
                    />

                    <div>
                      <div className="text-[10px] font-black text-emerald-800">
                        Password updated
                      </div>

                      <p className="mt-1 text-[9px] font-medium leading-4 text-emerald-700">
                        Your new password has been saved. Redirecting you to login...
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : null}

              {!checking && !done && !errorMsg ? (
                <>
                  {/* New password */}
                  <div className="mt-6">
                    <label className="mb-1.5 block text-[10px] font-black text-slate-700">
                      New password
                    </label>

                    <div className="flex h-12 items-center rounded-[14px] border border-[#D9D3C7] bg-white px-3 transition-all focus-within:border-[#173C2E]/50 focus-within:ring-4 focus-within:ring-[#173C2E]/5">
                      <IoLockClosedOutline
                        className="mr-2 shrink-0 text-slate-400"
                        size={17}
                      />

                      <input
                        type={showPw ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                        value={pw}
                        onChange={(e) => setPw(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            void handleReset();
                          }
                        }}
                        disabled={disableAll}
                      />

                      <button
                        type="button"
                        onClick={() => setShowPw((s) => !s)}
                        className="ml-2 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-[#F3F1EB] hover:text-[#173C2E]"
                        aria-label={showPw ? "Hide password" : "Show password"}
                        disabled={disableAll}
                      >
                        {showPw ? (
                          <IoEyeOffOutline size={17} />
                        ) : (
                          <IoEyeOutline size={17} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm password */}
                  <div className="mt-3">
                    <label className="mb-1.5 block text-[10px] font-black text-slate-700">
                      Confirm password
                    </label>

                    <div className="flex h-12 items-center rounded-[14px] border border-[#D9D3C7] bg-white px-3 transition-all focus-within:border-[#173C2E]/50 focus-within:ring-4 focus-within:ring-[#173C2E]/5">
                      <IoLockClosedOutline
                        className="mr-2 shrink-0 text-slate-400"
                        size={17}
                      />

                      <input
                        type={showPw2 ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Re-type password"
                        className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                        value={pw2}
                        onChange={(e) => setPw2(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            void handleReset();
                          }
                        }}
                        disabled={disableAll}
                      />

                      <button
                        type="button"
                        onClick={() => setShowPw2((s) => !s)}
                        className="ml-2 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-[#F3F1EB] hover:text-[#173C2E]"
                        aria-label={showPw2 ? "Hide password" : "Show password"}
                        disabled={disableAll}
                      >
                        {showPw2 ? (
                          <IoEyeOffOutline size={17} />
                        ) : (
                          <IoEyeOutline size={17} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Rules */}
                  <div className="mt-4 rounded-[16px] border border-[#E5E0D6] bg-[#FBFAF6] px-4 py-3">
                    <div className="text-[9px] font-black text-slate-600">
                      Password requirements
                    </div>

                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <RuleItem
                        ok={pwRules.len}
                        label="At least 8 characters"
                      />

                      <RuleItem
                        ok={pwRules.cap}
                        label="Contains uppercase"
                      />

                      <RuleItem
                        ok={pwRules.num}
                        label="Contains a number"
                      />

                      <RuleItem
                        ok={pw === pw2 && pw.length > 0}
                        label="Passwords match"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleReset()}
                    disabled={!canSubmit || disableAll}
                    className="group mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#173C2E] px-4 text-[10px] font-black text-white shadow-[0_10px_24px_rgba(23,60,46,0.14)] transition hover:bg-[#214C3A] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                        Resetting password...
                      </>
                    ) : (
                      <>
                        Reset password
                        <IoArrowForwardOutline size={14} />
                      </>
                    )}
                  </button>
                </>
              ) : null}

              <button
                type="button"
                onClick={() => router.replace("/")}
                className="mx-auto mt-4 inline-flex h-9 items-center gap-1.5 px-3 text-[9px] font-black text-slate-400 transition hover:text-[#173C2E]"
                disabled={loading}
              >
                <IoArrowBackOutline size={13} />
                Home
              </button>
            </div>

            <div className="pt-5">
              <p className="text-center text-[9px] font-medium leading-4 text-slate-400">
                By continuing, you agree to our{" "}
                <Link
                  href="/terms"
                  className="font-black text-[#173C2E] transition hover:text-[#c69258]"
                >
                  Terms and Conditions
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="font-black text-[#173C2E] transition hover:text-[#c69258]"
                >
                  Privacy Policy
                </Link>
                .
              </p>

              <div
                style={{
                  height: "env(safe-area-inset-bottom)",
                }}
              />
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}

function FeatureRow({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border border-white/10 bg-white/[0.07] text-[#c69258]">
        {icon}
      </div>

      <div className="min-w-0">
        <div className="text-[12px] font-black text-white">
          {title}
        </div>

        <p className="mt-1 max-w-[390px] text-[10px] font-medium leading-[18px] text-white/50">
          {description}
        </p>
      </div>
    </div>
  );
}

function RuleItem({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={[
          "grid h-5 w-5 shrink-0 place-items-center rounded-full",
          ok
            ? "bg-emerald-100 text-emerald-700"
            : "bg-slate-100 text-slate-300",
        ].join(" ")}
      >
        <IoCheckmarkCircle size={13} />
      </span>

      <span
        className={[
          "text-[8px] font-bold",
          ok ? "text-emerald-700" : "text-slate-400",
        ].join(" ")}
      >
        {label}
      </span>
    </div>
  );
}