"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    IoArrowForwardOutline,
    IoCheckmarkCircleOutline,
    IoEyeOffOutline,
    IoEyeOutline,
    IoLeafOutline,
    IoLockClosedOutline,
    IoMailOutline,
    IoPeopleOutline,
    IoShieldCheckmarkOutline,
    IoSparklesOutline,
} from "react-icons/io5";
import {
    createUserWithEmailAndPassword,
    signInWithPopup,
} from "firebase/auth";
import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
} from "firebase/firestore";

import { db, getAuthSafe } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";

const EKARI = {
    forest: "#173C2E",
    leaf: "#214C3A",
    gold: "#F39A22",
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
        if (authLoading || !user) return;

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
    }, [user, authLoading, router]);

    const handleSignup = async () => {
        if (
            !isValid ||
            loading ||
            loadingGoogle ||
            authLoading ||
            !authBundle
        ) {
            return;
        }

        const { auth } = authBundle;

        setLoading(true);
        setErrorMsg("");

        try {
            const cred = await createUserWithEmailAndPassword(
                auth,
                email.trim(),
                password
            );

            const u = cred.user;
            const uid = u?.uid;

            if (!uid) {
                setErrorMsg("Could not create account. Please try again.");
                return;
            }

            /*
             * Save the email-provider profile too.
             * This keeps the Firestore auth-profile structure consistent
             * with Google-created accounts.
             */
            await saveAuthProviderProfile({
                uid,
                email: u.email || email.trim(),
                displayName: u.displayName,
                photoURL: u.photoURL,
                provider: "email",
            });

            const dest = await resolveDestination(uid);
            router.replace(dest);
        } catch (err: any) {
            setErrorMsg(mapAuthError(err));
        } finally {
            setLoading(false);
        }
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
                    <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-[#F39A22]/[0.08]" />

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

                            <Link
                                href="/login"
                                className="inline-flex h-9 items-center rounded-xl border border-white/12 bg-white/[0.06] px-3 text-[9px] font-black text-white/70 transition hover:bg-white/[0.11]"
                            >
                                Log in
                            </Link>
                        </div>

                        <div className="flex flex-1 flex-col justify-center py-8 lg:py-10">
                            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/65">
                                <IoSparklesOutline
                                    size={12}
                                    className="text-[#F39A22]"
                                />
                                Join ekarihub
                            </div>

                            <h1 className="mt-5 max-w-[470px] text-[30px] font-black leading-[1.06] tracking-[-0.045em] sm:text-[36px] xl:text-[42px]">
                                Build your agribusiness presence from day one.
                            </h1>

                            <p className="mt-4 max-w-[470px] text-[11px] font-medium leading-5 text-white/55 sm:text-[12px]">
                                Create one account for deeds, marketplace,
                                experts, weather, ekari AI, Studio and the
                                wider agribusiness community.
                            </p>

                            <div className="mt-7 space-y-5">
                                <FeatureRow
                                    icon={<IoPeopleOutline size={18} />}
                                    title="Join the community"
                                    description="Connect with farmers, experts, buyers, sellers and people building across the agricultural value chain."
                                />

                                <FeatureRow
                                    icon={<IoLeafOutline size={18} />}
                                    title="Build a trusted profile"
                                    description="Tell your story, showcase your work and establish a credible presence across the ekarihub ecosystem."
                                />

                                <FeatureRow
                                    icon={<IoSparklesOutline size={18} />}
                                    title="Unlock more opportunities"
                                    description="Access markets, experts, AI guidance, weather intelligence, Studio tools and new partnerships."
                                />
                            </div>

                            <div className="mt-7 rounded-[17px] border border-white/10 bg-white/[0.055] p-4">
                                <div className="flex items-start gap-3">
                                    <IoShieldCheckmarkOutline
                                        size={18}
                                        className="mt-0.5 shrink-0 text-[#F39A22]"
                                    />

                                    <div>
                                        <div className="text-[10px] font-black text-white">
                                            One secure account
                                        </div>

                                        <p className="mt-1 text-[9px] font-medium leading-4 text-white/45">
                                            Your account gives you secure
                                            access to the complete ekarihub
                                            experience while keeping your
                                            identity and activity connected.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pb-1 text-[9px] font-semibold text-white/30">
                            Collaborate · Innovate · Cultivate
                        </div>
                    </motion.div>
                </section>

                {/* =========================================================
                    RIGHT SIDE
                ========================================================= */}
                <section className="relative flex h-full  overflow-y-auto overflow-x-hidden flex-col bg-[#F8F7F2] px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 xl:px-14">
                    <div className="pointer-events-none absolute -right-32 -top-28 h-80 w-80 rounded-full bg-[#173C2E]/[0.025]" />
                    <div className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-[#F39A22]/[0.035]" />

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
                                className="inline-flex h-9 items-center rounded-xl border border-[#DDD8CC] bg-[#FBFAF6] px-3 text-[9px] font-black text-[#173C2E]"
                            >
                                Log in
                            </Link>
                        </div>

                        <div className="flex flex-1 flex-col justify-center py-3 lg:py-8">
                            <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
                                Create account
                            </div>

                            <h2 className="mt-1 text-[25px] font-black tracking-[-0.035em] text-slate-900 sm:text-[29px]">
                                Join ekarihub.
                            </h2>

                            <p className="mt-2 max-w-[480px] text-[10px] font-medium leading-5 text-slate-500">
                                {authLoading
                                    ? "Checking your current session…"
                                    : "Create your account with Google or use your email and password."}
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
                                            className="block cursor-pointer text-[10px] font-black text-slate-700"
                                        >
                                            I agree to the account terms
                                        </label>

                                        <p className="mt-1 text-[9px] font-medium leading-4 text-slate-400">
                                            By creating an account, you agree
                                            to our{" "}
                                            <Link
                                                href="/terms"
                                                className="font-black text-[#173C2E] transition hover:text-[#F39A22]"
                                            >
                                                Terms and Conditions
                                            </Link>{" "}
                                            and{" "}
                                            <Link
                                                href="/privacy"
                                                className="font-black text-[#173C2E] transition hover:text-[#F39A22]"
                                            >
                                                Privacy Policy
                                            </Link>
                                            .
                                        </p>

                                        <details className="mt-3 rounded-xl border border-[#E5E0D6] bg-white px-3 py-2.5 text-[9px] font-medium leading-4 text-slate-500">
                                            <summary className="cursor-pointer font-black text-[#173C2E]">
                                                Community Guidelines
                                            </summary>

                                            <div className="mt-2">
                                                By using ekarihub, you agree
                                                not to post or share:
                                                <br />
                                                • Abusive, hateful, or violent
                                                content
                                                <br />
                                                • Sexual or explicit content
                                                <br />
                                                • Fraudulent or misleading
                                                content
                                                <br />
                                                • Illegal goods or services
                                                <br />
                                                <br />
                                                <span className="font-black text-rose-600">
                                                    Violation may result in
                                                    account suspension or
                                                    removal.
                                                </span>
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
                                    <span className="block text-[12px] font-black text-slate-800">
                                        {loadingGoogle
                                            ? "Continuing with Google…"
                                            : "Continue with Google"}
                                    </span>

                                    <span className="mt-1 block text-[9px] font-medium leading-4 text-slate-400">
                                        Create or continue with your Google
                                        account.
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

                            <div className="my-5 flex items-center gap-3">
                                <div className="h-px flex-1 bg-[#E5E0D6]" />

                                <span className="text-[8px] font-black uppercase tracking-[0.1em] text-slate-300">
                                    or use email
                                </span>

                                <div className="h-px flex-1 bg-[#E5E0D6]" />
                            </div>

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
                                    className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-slate-700 outline-none placeholder:text-slate-400"
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
                                    className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-slate-700 outline-none placeholder:text-slate-400"
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
                                        setShowPassword((value) => !value)
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
                                    className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                                    value={confirm}
                                    onChange={(e) =>
                                        setConfirm(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            void handleSignup();
                                        }
                                    }}
                                    aria-label="Confirm password"
                                    disabled={disableAll}
                                />
                            </div>

                            {/* Validation */}
                            <div className="mt-2 space-y-1 text-[9px] font-semibold text-slate-400">
                                {!isValidEmail && email.length > 0 ? (
                                    <p>Enter a valid email address.</p>
                                ) : null}

                                {password.length > 0 &&
                                    password.length < 6 ? (
                                    <p>
                                        Password must be at least 6 characters.
                                    </p>
                                ) : null}

                                {confirm.length > 0 &&
                                    confirm !== password ? (
                                    <p>Passwords must match.</p>
                                ) : null}

                                {!consent ? (
                                    <p>
                                        Please accept the terms to continue.
                                    </p>
                                ) : null}
                            </div>

                            {/* Error */}
                            {!!errorMsg ? (
                                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[10px] font-semibold leading-4 text-rose-700">
                                    {errorMsg}
                                </div>
                            ) : null}

                            {/* Create */}
                            <button
                                type="button"
                                onClick={() => void handleSignup()}
                                disabled={!isValid || disableAll}
                                className="mt-4 flex h-12 w-full items-center justify-center rounded-[14px] bg-[#173C2E] px-4 text-[10px] font-black text-white transition hover:bg-[#214C3A] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading ? (
                                    <span className="inline-flex items-center gap-2">
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                        Creating account…
                                    </span>
                                ) : (
                                    "Create account"
                                )}
                            </button>

                            <div className="mt-5 rounded-[16px] border border-[#E5E0D6] bg-[#FBFAF6] px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <IoCheckmarkCircleOutline
                                        size={13}
                                        className="text-[#173C2E]"
                                    />

                                    <span className="text-[9px] font-black text-slate-600">
                                        One account across ekarihub.
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="pt-5">
                            <div className="flex items-center justify-center gap-1 text-[10px]">
                                <span className="font-medium text-slate-400">
                                    Already a member?
                                </span>

                                <Link
                                    href="/login"
                                    className="inline-flex items-center gap-1 font-black text-[#173C2E] transition hover:text-[#F39A22]"
                                >
                                    Log in
                                    <IoArrowForwardOutline size={12} />
                                </Link>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                                <Link
                                    href="/about"
                                    className="text-[9px] font-bold text-slate-400 transition hover:text-[#173C2E]"
                                >
                                    About
                                </Link>

                                <Link
                                    href="/terms"
                                    className="text-[9px] font-bold text-slate-400 transition hover:text-[#173C2E]"
                                >
                                    Terms
                                </Link>

                                <Link
                                    href="/privacy"
                                    className="text-[9px] font-bold text-slate-400 transition hover:text-[#173C2E]"
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
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border border-white/10 bg-white/[0.07] text-[#F39A22]">
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