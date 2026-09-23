"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    IoArrowForwardOutline,
    IoEyeOffOutline,
    IoEyeOutline,
    IoLockClosedOutline,
    IoMailOutline,
    IoPeopleOutline,
    IoShieldCheckmarkOutline,
    IoSparklesOutline,
} from "react-icons/io5";
import {
    createUserWithEmailAndPassword,
    deleteUser,
    signInWithPopup,
} from "firebase/auth";
import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
} from "firebase/firestore";

import { db, getAuthSafe } from "@/lib/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useAuth } from "@/app/hooks/useAuth";

const EKARI = {
    forest: "#173C2E",
    leaf: "#214C3A",
    gold: "#c69258",
    sand: "#F8F7F2",
    hair: "#DDD8CC",
    text: "#0F172A",
    dim: "#64748B",
    subtext: "#64748B",
    danger: "#B42318",
};

const splitName = (name?: string | null) => {
    const clean = String(name || "").trim();

    if (!clean) {
        return {
            firstName: "",
            surname: "",
        };
    }

    const parts = clean.split(/\s+/);

    return {
        firstName: parts[0] || "",
        surname: parts.slice(1).join(" ") || "",
    };
};

async function saveAuthProviderProfile({
    uid,
    email,
    displayName,
    photoURL,
    provider,
}: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
    provider: "google" | "email";
}) {
    const { firstName, surname } = splitName(displayName);

    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? (snap.data() as any) : {};

    await setDoc(
        ref,
        {
            email: email || existing.email || null,
            authProvider: provider,
            providerDisplayName:
                displayName || existing.providerDisplayName || null,
            providerPhotoURL:
                photoURL || existing.providerPhotoURL || null,

            ...(firstName && !existing.firstName ? { firstName } : {}),
            ...(surname && !existing.surname ? { surname } : {}),
            ...(photoURL && !existing.photoURL ? { photoURL } : {}),

            createdFromAuth: true,
            onboarded: existing.onboarded === true,
            isSuspended: existing.isSuspended === true,
            isDeactivated: existing.isDeactivated === true,
            updatedAt: serverTimestamp(),
            ...(!snap.exists() ? { createdAt: serverTimestamp() } : {}),
        },
        { merge: true }
    );
}

export default function SignupPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const [authBundle, setAuthBundle] = useState<{
        auth: any;
        googleProvider: any;
    } | null>(null);

    const [consent, setConsent] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [loadingGoogle, setLoadingGoogle] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const [successMsg, setSuccessMsg] = useState("");
    const [emailStep, setEmailStep] =
        useState<"details" | "otp">("details");
    const [otp, setOtp] = useState("");
    const [otpSending, setOtpSending] = useState(false);
    const [otpVerifying, setOtpVerifying] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);

    useEffect(() => {
        if (resendCountdown <= 0) return;

        const timer = window.setInterval(() => {
            setResendCountdown((value) =>
                Math.max(value - 1, 0)
            );
        }, 1000);

        return () => window.clearInterval(timer);
    }, [resendCountdown]);

    useEffect(() => {
        let alive = true;

        (async () => {
            try {
                const bundle = await getAuthSafe();

                if (!alive) return;

                if (bundle) {
                    setAuthBundle({
                        auth: bundle.auth,
                        googleProvider: bundle.googleProvider,
                    });
                } else {
                    setAuthBundle(null);
                }
            } catch (error) {
                console.error("getAuthSafe error:", error);

                if (alive) {
                    setAuthBundle(null);
                }
            }
        })();

        return () => {
            alive = false;
        };
    }, []);

    const isValidEmail = useMemo(
        () => /\S+@\S+\.\S+/.test(email.trim()),
        [email]
    );

    const isValid = useMemo(
        () =>
            isValidEmail &&
            password.length >= 6 &&
            confirm === password &&
            consent,
        [isValidEmail, password, confirm, consent]
    );

    const disableAll =
        loading ||
        loadingGoogle ||
        otpSending ||
        otpVerifying ||
        authLoading ||
        !authBundle;

    const mapAuthError = (err: any) => {
        switch (err?.code) {
            case "auth/email-already-in-use":
                return "Email already in use.";

            case "auth/invalid-email":
                return "Invalid email address.";

            case "auth/weak-password":
                return "Password is too weak.";

            case "auth/network-request-failed":
                return "Network error. Please check your connection.";

            case "auth/popup-closed-by-user":
                return "Popup closed before completing sign up.";

            case "auth/account-exists-with-different-credential":
                return "An account already exists with a different sign-in method.";

            default:
                return err?.message || "Something went wrong.";
        }
    };

    const isProfileComplete = (data: any) => {
        return (
            data?.onboarded === true &&
            !!data?.handle &&
            !!data?.firstName &&
            !!data?.surname &&
            !!data?.dob &&
            !!data?.gender &&
            Array.isArray(data?.areaOfInterest) &&
            data.areaOfInterest.length > 0 &&
            Array.isArray(data?.roles) &&
            data.roles.length > 0
        );
    };

    const resolveDestination = async (uid: string) => {
        try {
            const snap = await getDoc(doc(db, "users", uid));

            if (!snap.exists()) {
                return "/onboarding";
            }

            const data = snap.data();

            if (!isProfileComplete(data)) {
                return "/onboarding";
            }

            return "/";
        } catch (error) {
            console.error("resolveDestination error:", error);
            return "/onboarding";
        }
    };

    useEffect(() => {
        if (
            authLoading ||
            loading ||
            loadingGoogle ||
            otpSending ||
            otpVerifying ||
            !user
        ) return;

        let alive = true;

        (async () => {
            const dest = await resolveDestination(user.uid);

            if (!alive) return;

            router.replace(dest);
        })();

        return () => {
            alive = false;
        };

        // We intentionally react to the authenticated user state here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        user,
        authLoading,
        router,
        loading,
        loadingGoogle,
        otpSending,
        otpVerifying,
    ]);

    const mapOtpError = (err: any) => {
        const code = String(err?.code || "");
        const message = String(err?.message || "");

        if (
            code.includes("resource-exhausted") ||
            message.toLowerCase().includes("too many")
        ) {
            return "Too many verification attempts. Please wait before trying again.";
        }

        if (code.includes("already-exists")) {
            return "An account already exists with this email. Please log in instead.";
        }

        if (message.toLowerCase().includes("expired")) {
            return "This verification code has expired. Please request a new code.";
        }

        if (
            message.toLowerCase().includes("incorrect") ||
            message.toLowerCase().includes("invalid")
        ) {
            return "The verification code is incorrect.";
        }

        return (
            message ||
            "Unable to verify your email. Please try again."
        );
    };

    const requestSignupOtp = async (
        isResend = false
    ) => {
        if (
            !isValid ||
            disableAll
        ) {
            return;
        }

        if (
            isResend &&
            resendCountdown > 0
        ) {
            return;
        }

        setOtpSending(true);
        setErrorMsg("");
        setSuccessMsg("");

        try {
            const fn = httpsCallable(
                getFunctions(),
                "requestSignupOtp"
            );

            const response =
                await fn({
                    email:
                        email
                            .trim()
                            .toLowerCase(),
                });

            const data =
                (response.data as any) ||
                {};

            if (
                data?.success === false
            ) {
                throw new Error(
                    data?.message ||
                    "Unable to send verification code."
                );
            }

            setOtp("");
            setResendCountdown(
                Number(
                    data?.resendAfterSeconds ||
                    60
                )
            );
            setEmailStep("otp");
            setSuccessMsg(
                `We sent a 6-digit verification code to ${email
                    .trim()
                    .toLowerCase()}.`
            );
        } catch (err: any) {
            setErrorMsg(
                mapOtpError(err)
            );
        } finally {
            setOtpSending(false);
        }
    };

    const verifyOtpAndCreateAccount =
        async () => {
            const finalOtp =
                otp
                    .replace(/\D/g, "")
                    .slice(0, 6);

            if (
                !/^\d{6}$/.test(finalOtp) ||
                disableAll ||
                !authBundle
            ) {
                return;
            }

            const { auth } = authBundle;
            let createdUser: any = null;
            let finalized = false;

            setOtpVerifying(true);
            setErrorMsg("");
            setSuccessMsg("");

            try {
                const normalizedEmail =
                    email
                        .trim()
                        .toLowerCase();

                const verifyFn =
                    httpsCallable(
                        getFunctions(),
                        "verifySignupOtp"
                    );

                const verifyResponse =
                    await verifyFn({
                        email: normalizedEmail,
                        code: finalOtp,
                    });

                const verifyData =
                    (verifyResponse.data as any) ||
                    {};

                if (
                    verifyData?.verified !== true ||
                    !verifyData?.signupToken
                ) {
                    throw new Error(
                        "The verification code is incorrect."
                    );
                }

                const signupToken =
                    String(
                        verifyData.signupToken
                    );

                setLoading(true);

                const cred =
                    await createUserWithEmailAndPassword(
                        auth,
                        normalizedEmail,
                        password
                    );

                createdUser =
                    cred.user;

                const finalizeFn =
                    httpsCallable(
                        getFunctions(),
                        "finalizeSignupOtp"
                    );

                const finalizeResponse =
                    await finalizeFn({
                        email: normalizedEmail,
                        signupToken,
                    });

                const finalizeData =
                    (finalizeResponse.data as any) ||
                    {};

                if (
                    finalizeData?.verified !== true ||
                    finalizeData?.success !== true
                ) {
                    throw new Error(
                        "Unable to complete email verification."
                    );
                }

                finalized = true;

                await saveAuthProviderProfile({
                    uid:
                        cred.user.uid,
                    email:
                        cred.user.email ||
                        normalizedEmail,
                    displayName:
                        cred.user.displayName,
                    photoURL:
                        cred.user.photoURL,
                    provider:
                        "email",
                });

                const dest =
                    await resolveDestination(
                        cred.user.uid
                    );

                router.replace(dest);
            } catch (err: any) {
                if (
                    createdUser &&
                    !finalized
                ) {
                    try {
                        await deleteUser(
                            createdUser
                        );
                    } catch (
                    cleanupErr
                    ) {
                        console.error(
                            "Signup cleanup failed:",
                            cleanupErr
                        );

                        try {
                            await auth.signOut();
                        } catch { }
                    }
                }

                const code =
                    String(
                        err?.code || ""
                    );

                setErrorMsg(
                    code.startsWith("auth/")
                        ? mapAuthError(err)
                        : mapOtpError(err)
                );
            } finally {
                setOtpVerifying(false);
                setLoading(false);
            }
        };

    const changeEmail = () => {
        if (disableAll) {
            return;
        }

        setEmailStep("details");
        setOtp("");
        setErrorMsg("");
        setSuccessMsg("");
        setResendCountdown(0);
    };

    const continueWithGoogle = async () => {
        if (
            !consent ||
            loadingGoogle ||
            loading ||
            authLoading ||
            !authBundle
        ) {
            return;
        }

        const { auth, googleProvider } = authBundle;

        setLoadingGoogle(true);
        setErrorMsg("");

        try {
            const cred = await signInWithPopup(
                auth,
                googleProvider
            );

            const u = cred.user;

            if (!u) {
                setErrorMsg("Something went wrong. Please try again.");
                return;
            }

            await saveAuthProviderProfile({
                uid: u.uid,
                email: u.email,
                displayName: u.displayName,
                photoURL: u.photoURL,
                provider: "google",
            });

            const dest = await resolveDestination(u.uid);
            router.replace(dest);
        } catch (err: any) {
            setErrorMsg(mapAuthError(err));
        } finally {
            setLoadingGoogle(false);
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
                        transition={{
                            duration: 0.24,
                            ease: "easeOut",
                        }}
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


                        </div>

                        <div className="flex flex-1 flex-col justify-center py-8 lg:py-10">
                            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-white/65">
                                <IoSparklesOutline
                                    size={12}
                                    className="text-[#c69258]"
                                />
                                Join ekarihub
                            </div>

                            <h1 className="mt-5 max-w-[470px] text-[30px] font-black leading-[1.06] tracking-[-0.045em] sm:text-[36px] xl:text-[42px]">
                                Create your ekarihub account.
                            </h1>

                            <p className="mt-4 max-w-[470px] text-[14px] font-medium leading-5 text-white/60 sm:text-[15px]">
                                Join the community and access ekarihub tools in one place.
                            </p>

                            <div className="mt-6 space-y-4">
                                <FeatureRow
                                    icon={<IoPeopleOutline size={18} />}
                                    title="Join the community"
                                    description="Connect with farmers, experts and agripreneurs."
                                />

                                <FeatureRow
                                    icon={<IoSparklesOutline size={18} />}
                                    title="Access more"
                                    description="Use markets, experts, AI and other ekarihub tools."
                                />
                                <Link
                                    href="/login"
                                    className="inline-flex h-9 items-center rounded-xl border border-white/12 bg-white/[0.06] px-3 text-[11px] font-black text-white/70 transition hover:bg-white/[0.11]"
                                >
                                    Log in
                                </Link>
                            </div>

                        </div>
                    </motion.div>
                </section>

                {/* =========================================================
                    RIGHT SIDE
                ========================================================= */}
                <section className="relative flex h-full  overflow-y-auto overflow-x-hidden flex-col bg-[#F8F7F2] px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 xl:px-14">
                    <div className="pointer-events-none absolute -right-32 -top-28 h-80 w-80 rounded-full bg-[#173C2E]/[0.025]" />
                    <div className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-[#c69258]/[0.035]" />

                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                            duration: 0.24,
                            ease: "easeOut",
                        }}
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
                                className="inline-flex h-9 items-center rounded-xl border border-[#DDD8CC] bg-[#FBFAF6] px-3 text-[11px] font-black text-[#173C2E]"
                            >
                                Log in
                            </Link>
                        </div>

                        <div className="flex flex-1 flex-col justify-center py-3 lg:py-8">
                            <div className="text-[11px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                                Create account
                            </div>

                            <h2 className="mt-1 text-[25px] font-black tracking-[-0.035em] text-slate-900 sm:text-[29px]">
                                Join ekarihub.
                            </h2>

                            <p className="mt-2 max-w-[480px] text-[14px] font-medium leading-5 text-slate-500">
                                {authLoading
                                    ? "Checking your current session…"
                                    : "Continue with Google or email."}
                            </p>

                            {/* Consent */}
                            <div className="mt-5 rounded-[16px] border border-[#DDD8CC] bg-[#FBFAF6] p-4">
                                <div className="flex items-start gap-3">
                                    <input
                                        id="consent"
                                        type="checkbox"
                                        checked={consent}
                                        onChange={(e) =>
                                            setConsent(e.target.checked)
                                        }
                                        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-[#CFC8BA] accent-[#173C2E]"
                                        disabled={disableAll}
                                    />

                                    <div className="min-w-0 flex-1">
                                        <label
                                            htmlFor="consent"
                                            className="block cursor-pointer text-[14px] font-black text-slate-800"
                                        >
                                            I agree to the account terms
                                        </label>

                                        <p className="mt-1 text-[13px] font-medium leading-5 text-slate-500">
                                            By creating an account, you agree to our{" "}
                                            <Link
                                                href="/terms"
                                                className="font-black text-[#173C2E] transition hover:text-[#c69258]"
                                            >
                                                Terms
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

                                        <details className="mt-3 rounded-xl border border-[#E5E0D6] bg-white px-3 py-2.5 text-[12px] font-medium leading-5 text-slate-500">
                                            <summary className="cursor-pointer text-[13px] font-black text-[#173C2E]">
                                                Community Guidelines
                                            </summary>

                                            <div className="mt-2 space-y-1">
                                                <p>By using ekarihub, you agree not to post or share:</p>

                                                <ul className="list-disc space-y-1 pl-5">
                                                    <li>Abusive, hateful, or violent content</li>
                                                    <li>Sexual or explicit content</li>
                                                    <li>Fraudulent or misleading content</li>
                                                    <li>Illegal goods or services</li>
                                                </ul>

                                                <p className="pt-1 font-black text-rose-600">
                                                    Violations may result in account suspension or removal.
                                                </p>
                                            </div>
                                        </details>
                                    </div>
                                </div>
                            </div>

                            {/* Google */}
                            <button
                                type="button"
                                onClick={() => void continueWithGoogle()}
                                disabled={!consent || disableAll}
                                className="group mt-4 flex w-full items-center gap-3 rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 text-left transition-all duration-200 hover:border-[#CBC4B7] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-white shadow-[0_5px_15px_rgba(15,23,42,0.04)]">
                                    <Image
                                        src="/google-logo.png"
                                        width={19}
                                        height={19}
                                        alt="Google"
                                    />
                                </span>

                                <span className="min-w-0 flex-1 overflow-hidden">
                                    <span className="block text-[15px] font-black text-slate-800">
                                        {loadingGoogle
                                            ? "Continuing with Google…"
                                            : "Continue with Google"}
                                    </span>

                                    <span className="mt-1 block text-[13px] font-medium leading-5 text-slate-500">
                                        Continue with Google.
                                    </span>
                                </span>

                                {loadingGoogle ? (
                                    <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-[#173C2E]" />
                                ) : (
                                    <IoArrowForwardOutline
                                        size={16}
                                        className="shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-[#173C2E]"
                                    />
                                )}
                            </button>

                            <div className="my-4 flex items-center gap-3">
                                <div className="h-px flex-1 bg-[#E5E0D6]" />

                                <span className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-300">
                                    or
                                </span>

                                <div className="h-px flex-1 bg-[#E5E0D6]" />
                            </div>

                            {emailStep === "details" ? (
                                <>
                                    {/* Email */}
                                    <div className="flex h-12 items-center rounded-[14px] border border-[#D9D3C7] bg-white px-3 transition-all focus-within:border-[#173C2E]/50 focus-within:ring-4 focus-within:ring-[#173C2E]/5">
                                        <IoMailOutline
                                            className="mr-2 shrink-0 text-slate-400"
                                            size={17}
                                        />

                                        <input
                                            type="email"
                                            inputMode="email"
                                            autoComplete="email"
                                            placeholder="Email address"
                                            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-slate-800 outline-none placeholder:text-slate-400"
                                            value={email}
                                            onChange={(e) =>
                                                setEmail(e.target.value)
                                            }
                                            aria-label="Email"
                                            disabled={disableAll}
                                        />
                                    </div>

                                    {/* Password */}
                                    <div className="mt-3 flex h-12 items-center rounded-[14px] border border-[#D9D3C7] bg-white px-3 transition-all focus-within:border-[#173C2E]/50 focus-within:ring-4 focus-within:ring-[#173C2E]/5">
                                        <IoLockClosedOutline
                                            className="mr-2 shrink-0 text-slate-400"
                                            size={17}
                                        />

                                        <input
                                            type={
                                                showPassword
                                                    ? "text"
                                                    : "password"
                                            }
                                            autoComplete="new-password"
                                            placeholder="Password"
                                            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-slate-800 outline-none placeholder:text-slate-400"
                                            value={password}
                                            onChange={(e) =>
                                                setPassword(e.target.value)
                                            }
                                            aria-label="Password"
                                            disabled={disableAll}
                                        />

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowPassword(
                                                    (value) =>
                                                        !value
                                                )
                                            }
                                            className="ml-2 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-[#F3F1EB] hover:text-[#173C2E]"
                                            aria-label={
                                                showPassword
                                                    ? "Hide password"
                                                    : "Show password"
                                            }
                                            disabled={disableAll}
                                        >
                                            {showPassword ? (
                                                <IoEyeOffOutline size={17} />
                                            ) : (
                                                <IoEyeOutline size={17} />
                                            )}
                                        </button>
                                    </div>

                                    {/* Confirm password */}
                                    <div className="mt-3 flex h-12 items-center rounded-[14px] border border-[#D9D3C7] bg-white px-3 transition-all focus-within:border-[#173C2E]/50 focus-within:ring-4 focus-within:ring-[#173C2E]/5">
                                        <IoShieldCheckmarkOutline
                                            className="mr-2 shrink-0 text-slate-400"
                                            size={17}
                                        />

                                        <input
                                            type={
                                                showPassword
                                                    ? "text"
                                                    : "password"
                                            }
                                            autoComplete="new-password"
                                            placeholder="Confirm password"
                                            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-slate-800 outline-none placeholder:text-slate-400"
                                            value={confirm}
                                            onChange={(e) =>
                                                setConfirm(e.target.value)
                                            }
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    void requestSignupOtp(false);
                                                }
                                            }}
                                            aria-label="Confirm password"
                                            disabled={disableAll}
                                        />
                                    </div>

                                    <div className="mt-2 space-y-1 text-[12px] font-semibold text-slate-500">
                                        {!isValidEmail &&
                                            email.length > 0 ? (
                                            <p>Enter a valid email address.</p>
                                        ) : null}

                                        {password.length > 0 &&
                                            password.length < 6 ? (
                                            <p>Password must be at least 6 characters.</p>
                                        ) : null}

                                        {confirm.length > 0 &&
                                            confirm !== password ? (
                                            <p>Passwords must match.</p>
                                        ) : null}

                                        {!consent ? (
                                            <p>Please accept the terms to continue.</p>
                                        ) : null}
                                    </div>

                                    {!!errorMsg ? (
                                        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] font-semibold leading-5 text-rose-700">
                                            {errorMsg}
                                        </div>
                                    ) : null}

                                    <button
                                        type="button"
                                        onClick={() => void requestSignupOtp(false)}
                                        disabled={!isValid || disableAll}
                                        className="mt-4 flex h-12 w-full items-center justify-center rounded-[14px] bg-[#173C2E] px-4 text-[13px] font-black text-white transition hover:bg-[#214C3A] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {otpSending ? (
                                            <span className="inline-flex items-center gap-2">
                                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                                Sending code…
                                            </span>
                                        ) : (
                                            "Send verification code"
                                        )}
                                    </button>
                                </>
                            ) : (
                                <div>
                                    <div className="rounded-[16px] border border-[#DDD8CC] bg-[#FBFAF6] p-4">
                                        <div className="text-[11px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                                            Verify your email
                                        </div>

                                        <div className="mt-1 text-[17px] font-black text-slate-900">
                                            Enter the 6-digit code
                                        </div>

                                        <p className="mt-1 text-[13px] font-medium leading-5 text-slate-500">
                                            We sent a verification code to{" "}
                                            <span className="font-black text-slate-700">
                                                {email.trim().toLowerCase()}
                                            </span>
                                        </p>
                                    </div>

                                    {!!successMsg ? (
                                        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] font-semibold leading-5 text-emerald-700">
                                            {successMsg}
                                        </div>
                                    ) : null}

                                    <div className="mt-3 flex h-14 items-center rounded-[14px] border border-[#D9D3C7] bg-white px-3 transition-all focus-within:border-[#173C2E]/50 focus-within:ring-4 focus-within:ring-[#173C2E]/5">
                                        <IoShieldCheckmarkOutline
                                            className="mr-2 shrink-0 text-slate-400"
                                            size={18}
                                        />

                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            placeholder="000000"
                                            className="min-w-0 flex-1 bg-transparent text-center text-[22px] font-black tracking-[0.35em] text-slate-900 outline-none placeholder:text-slate-300"
                                            value={otp}
                                            onChange={(e) =>
                                                setOtp(
                                                    e.target.value
                                                        .replace(/\D/g, "")
                                                        .slice(0, 6)
                                                )
                                            }
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    void verifyOtpAndCreateAccount();
                                                }
                                            }}
                                            maxLength={6}
                                            disabled={disableAll}
                                            aria-label="Verification code"
                                            autoFocus
                                        />
                                    </div>

                                    <p className="mt-2 text-[12px] font-semibold text-slate-400">
                                        Enter the code exactly as shown in your email.
                                    </p>

                                    {!!errorMsg ? (
                                        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] font-semibold leading-5 text-rose-700">
                                            {errorMsg}
                                        </div>
                                    ) : null}

                                    <button
                                        type="button"
                                        onClick={() => void verifyOtpAndCreateAccount()}
                                        disabled={!/^\d{6}$/.test(otp) || disableAll}
                                        className="mt-4 flex h-12 w-full items-center justify-center rounded-[14px] bg-[#173C2E] px-4 text-[13px] font-black text-white transition hover:bg-[#214C3A] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {otpVerifying || loading ? (
                                            <span className="inline-flex items-center gap-2">
                                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                                Verifying…
                                            </span>
                                        ) : (
                                            "Verify & create account"
                                        )}
                                    </button>

                                    <div className="mt-3 flex items-center justify-between gap-3">
                                        <button
                                            type="button"
                                            onClick={changeEmail}
                                            disabled={disableAll}
                                            className="text-[12px] font-black text-[#173C2E] disabled:opacity-50"
                                        >
                                            Change email
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => void requestSignupOtp(true)}
                                            disabled={resendCountdown > 0 || disableAll}
                                            className="text-[12px] font-black text-[#173C2E] disabled:opacity-40"
                                        >
                                            {resendCountdown > 0
                                                ? `Resend in ${resendCountdown}s`
                                                : "Resend code"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="pt-4">
                            <div className="flex items-center justify-center gap-1 text-[13px]">
                                <span className="font-medium text-slate-400">
                                    Already a member?
                                </span>

                                <Link
                                    href="/login"
                                    className="inline-flex items-center gap-1 font-black text-[#173C2E] transition hover:text-[#c69258]"
                                >
                                    Log in
                                    <IoArrowForwardOutline size={12} />
                                </Link>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">

                                <Link
                                    href="/terms"
                                    className="text-[12px] font-bold text-slate-400 transition hover:text-[#173C2E]"
                                >
                                    Terms
                                </Link>

                                <Link
                                    href="/privacy"
                                    className="text-[12px] font-bold text-slate-400 transition hover:text-[#173C2E]"
                                >
                                    Privacy
                                </Link>
                            </div>

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
                <div className="text-[15px] font-black text-white">
                    {title}
                </div>

                <p className="mt-1 max-w-[390px] text-[14px] font-medium leading-5 text-white/55">
                    {description}
                </p>
            </div>
        </div>
    );
}