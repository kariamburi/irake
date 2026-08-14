"use client";

import React, {
    useEffect,
    useMemo,
    useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    AnimatePresence,
    motion,
} from "framer-motion";
import {
    IoArrowForwardOutline,
    IoChevronDown,
    IoChevronUp,
    IoEyeOffOutline,
    IoEyeOutline,
    IoLeafOutline,
    IoLockClosedOutline,
    IoMailOutline,
    IoPeopleOutline,
    IoPersonAddOutline,
    IoPhonePortraitOutline,
    IoShieldCheckmarkOutline,
    IoSparklesOutline,
} from "react-icons/io5";
import {
    signInWithEmailAndPassword,
    signInWithPopup,
} from "firebase/auth";
import {
    doc,
    getDoc,
} from "firebase/firestore";

import {
    db,
    getAuthSafe,
} from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";

const EKARI = {
    forest: "#173C2E",
    leaf: "#214C3A",
    gold: "#F39A22",
    sand: "#F8F7F2",
    card: "#FBFAF6",
    text: "#0F172A",
    dim: "#64748B",
    hair: "#DDD8CC",
    subtext: "#64748B",
    danger: "#B42318",
};

export default function LoginPage() {
    const router = useRouter();
    const {
        user,
        loading: authLoading,
    } = useAuth();

    const [
        safeNext,
        setSafeNext,
    ] =
        useState<
            string | null
        >(null);

    useEffect(() => {
        if (
            typeof window ===
            "undefined"
        ) {
            return;
        }

        const sp =
            new URLSearchParams(
                window.location.search
            );

        const nextParam =
            sp.get("next");

        if (
            nextParam &&
            nextParam.startsWith("/")
        ) {
            setSafeNext(
                nextParam
            );
        } else {
            setSafeNext(null);
        }
    }, []);

    const [
        authBundle,
        setAuthBundle,
    ] =
        useState<{
            auth: any;
            googleProvider: any;
        } | null>(null);

    useEffect(() => {
        let alive = true;

        (async () => {
            try {
                const bundle =
                    await getAuthSafe();

                if (!alive) {
                    return;
                }

                setAuthBundle(
                    bundle
                );
            } catch (
            error
            ) {
                console.error(
                    "getAuthSafe error:",
                    error
                );

                if (alive) {
                    setAuthBundle(
                        null
                    );
                }
            }
        })();

        return () => {
            alive = false;
        };
    }, []);

    const [
        emailOpen,
        setEmailOpen,
    ] =
        useState(false);

    const [
        email,
        setEmail,
    ] =
        useState("");

    const [
        password,
        setPassword,
    ] =
        useState("");

    const [
        showPassword,
        setShowPassword,
    ] =
        useState(false);

    const [
        loadingEmail,
        setLoadingEmail,
    ] =
        useState(false);

    const [
        loadingGoogle,
        setLoadingGoogle,
    ] =
        useState(false);

    const [
        errorMsg,
        setErrorMsg,
    ] =
        useState("");

    const [
        postAuthChecking,
        setPostAuthChecking,
    ] =
        useState(false);

    const disableAll =
        authLoading ||
        loadingEmail ||
        loadingGoogle ||
        postAuthChecking ||
        !authBundle;

    const isValid =
        useMemo(
            () =>
                /\S+@\S+\.\S+/.test(
                    email.trim()
                ) &&
                password.length >=
                6,
            [
                email,
                password,
            ]
        );

    const mapAuthError = (
        err: any
    ) => {
        switch (
        err?.code
        ) {
            case "auth/invalid-credential":
            case "auth/wrong-password":
            case "auth/user-not-found":
                return "Invalid email or password.";

            case "auth/network-request-failed":
                return "Network error. Please check your connection.";

            case "auth/too-many-requests":
                return "Too many attempts. Try again later.";

            case "auth/popup-closed-by-user":
                return "Popup closed before completing sign in.";

            case "auth/account-exists-with-different-credential":
                return "An account already exists with a different sign-in method.";

            default:
                return (
                    err?.message ||
                    "Something went wrong."
                );
        }
    };

    const isProfileComplete = (
        data: any
    ) => {
        return (
            data?.onboarded ===
            true &&
            !!data?.handle &&
            !!data?.firstName &&
            !!data?.surname &&
            !!data?.dob &&
            !!data?.gender &&
            Array.isArray(
                data?.areaOfInterest
            ) &&
            data.areaOfInterest
                .length > 0 &&
            Array.isArray(
                data?.roles
            ) &&
            data.roles.length >
            0
        );
    };

    const resolveDestination =
        async (
            uid: string
        ) => {
            try {
                const snap =
                    await getDoc(
                        doc(
                            db,
                            "users",
                            uid
                        )
                    );

                if (
                    !snap.exists()
                ) {
                    return "/onboarding";
                }

                const data =
                    snap.data();

                if (
                    !isProfileComplete(
                        data
                    )
                ) {
                    return "/onboarding";
                }

                return (
                    safeNext ||
                    "/"
                );
            } catch {
                return "/onboarding";
            }
        };

    useEffect(() => {
        if (
            authLoading ||
            postAuthChecking ||
            !user
        ) {
            return;
        }

        let alive = true;

        (async () => {
            const dest =
                await resolveDestination(
                    user.uid
                );

            if (!alive) {
                return;
            }

            router.replace(
                dest
            );
        })();

        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        user,
        authLoading,
        postAuthChecking,
        safeNext,
    ]);

    const handleLoginEmail =
        async () => {
            if (
                !isValid ||
                loadingEmail ||
                authLoading ||
                !authBundle
            ) {
                return;
            }

            const {
                auth,
            } = authBundle;

            setErrorMsg("");
            setLoadingEmail(
                true
            );
            setPostAuthChecking(
                true
            );

            try {
                const cred =
                    await signInWithEmailAndPassword(
                        auth,
                        email.trim(),
                        password
                    );

                const uid =
                    cred.user
                        ?.uid;

                if (!uid) {
                    setErrorMsg(
                        "Something went wrong. Please try again."
                    );
                    return;
                }

                const dest =
                    await resolveDestination(
                        uid
                    );

                router.replace(
                    dest
                );
            } catch (
            err: any
            ) {
                setErrorMsg(
                    mapAuthError(
                        err
                    )
                );
            } finally {
                setPostAuthChecking(
                    false
                );
                setLoadingEmail(
                    false
                );
            }
        };

    const continueWithPhone =
        () => {
            router.push(
                "/phone-login"
            );
        };

    const continueWithGoogle =
        async () => {
            if (
                loadingGoogle ||
                authLoading ||
                !authBundle
            ) {
                return;
            }

            const {
                auth,
                googleProvider,
            } = authBundle;

            setErrorMsg("");
            setLoadingGoogle(
                true
            );
            setPostAuthChecking(
                true
            );

            try {
                const cred =
                    await signInWithPopup(
                        auth,
                        googleProvider
                    );

                const uid =
                    cred.user
                        ?.uid;

                if (!uid) {
                    setErrorMsg(
                        "Something went wrong. Please try again."
                    );
                    return;
                }

                const dest =
                    await resolveDestination(
                        uid
                    );

                router.replace(
                    dest
                );
            } catch (
            err: any
            ) {
                setErrorMsg(
                    mapAuthError(
                        err
                    )
                );
            } finally {
                setPostAuthChecking(
                    false
                );
                setLoadingGoogle(
                    false
                );
            }
        };

    const onForgotPassword =
        () => {
            router.push(
                "/forgot-password"
            );
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
                        initial={{
                            opacity: 0,
                            y: 8,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                        }}
                        transition={{
                            duration: 0.24,
                            ease: "easeOut",
                        }}
                        className="relative mx-auto flex h-full w-full max-w-[560px] flex-col"
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
                                href="/getstarted"
                                className="inline-flex h-9 items-center rounded-xl border border-white/12 bg-white/[0.06] px-3 text-[9px] font-black text-white/70 transition hover:bg-white/[0.11]"
                            >
                                Get started
                            </Link>
                        </div>

                        <div className="flex flex-1 flex-col justify-center py-8 lg:py-10">


                            <h1 className="mt-5 max-w-[470px] text-[30px] font-black leading-[1.06] tracking-[-0.045em] sm:text-[36px] xl:text-[42px]">
                                Continue building your agribusiness journey.
                            </h1>

                            <p className="mt-4 max-w-[470px] text-[11px] font-medium leading-5 text-white/55 sm:text-[12px]">
                                Sign back in to your ekarihub account and continue connecting, learning, trading and growing across the ecosystem.
                            </p>

                            <div className="mt-7 space-y-5">
                                <div className="flex items-start gap-3">
                                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border border-white/10 bg-white/[0.07] text-[#F39A22]">
                                        <IoPeopleOutline size={18} />
                                    </div>

                                    <div>
                                        <div className="text-[12px] font-black text-white">
                                            Reconnect with your community
                                        </div>
                                        <p className="mt-1 max-w-[390px] text-[10px] font-medium leading-[18px] text-white/50">
                                            Return to your network, conversations, followers and the people building across agribusiness.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border border-white/10 bg-white/[0.07] text-[#F39A22]">
                                        <IoLeafOutline size={18} />
                                    </div>

                                    <div>
                                        <div className="text-[12px] font-black text-white">
                                            Continue your deeds
                                        </div>
                                        <p className="mt-1 max-w-[390px] text-[10px] font-medium leading-[18px] text-white/50">
                                            Pick up where you left off, share progress and keep building your trusted presence.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border border-white/10 bg-white/[0.07] text-[#F39A22]">
                                        <IoSparklesOutline size={18} />
                                    </div>

                                    <div>
                                        <div className="text-[12px] font-black text-white">
                                            Access your tools
                                        </div>
                                        <p className="mt-1 max-w-[390px] text-[10px] font-medium leading-[18px] text-white/50">
                                            Open ekariMarket, experts, Studio, weather, AI and the rest of your personalized ekarihub experience.
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

                {/* RIGHT */}
                <section className="relative flex h-full  overflow-y-auto overflow-x-hidden flex-col bg-[#F8F7F2] px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 xl:px-14">
                    <div className="pointer-events-none absolute -right-32 -top-28 h-80 w-80 rounded-full bg-[#173C2E]/[0.025]" />

                    <div className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-[#F39A22]/[0.035]" />

                    <motion.div
                        initial={{
                            opacity: 0,
                            y: 8,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                        }}
                        transition={{
                            duration: 0.24,
                            ease: "easeOut",
                        }}
                        className="relative mx-auto flex h-full w-full max-w-[560px] flex-1 flex-col"
                    >
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
                                href="/getstarted"
                                className="inline-flex h-9 items-center rounded-xl border border-[#DDD8CC] bg-[#FBFAF6] px-3 text-[9px] font-black text-[#173C2E]"
                            >
                                Get started
                            </Link>
                        </div>

                        <div className="flex flex-1 flex-col justify-center py-3 lg:py-8">
                            <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
                                Account access
                            </div>

                            <h2 className="mt-1 text-[25px] font-black tracking-[-0.035em] text-slate-900 sm:text-[29px]">
                                Log in to ekarihub.
                            </h2>

                            <p className="mt-2 max-w-[480px] text-[10px] font-medium leading-5 text-slate-500">
                                {authLoading
                                    ? "Checking your current session…"
                                    : "Choose the sign-in method that works best for you."}
                            </p>

                            <button
                                type="button"
                                onClick={
                                    continueWithPhone
                                }
                                disabled={
                                    disableAll
                                }
                                className="group mt-6 flex w-full items-center gap-3 rounded-[18px] bg-[#173C2E] p-4 text-left text-white shadow-[0_12px_28px_rgba(23,60,46,0.14)] transition-all duration-200 hover:bg-[#214C3A] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-white/[0.09] text-[#F39A22]">
                                    <IoPhonePortraitOutline size={20} />
                                </span>

                                <span className="min-w-0 flex-1">
                                    <span className="block text-[12px] font-black">
                                        Continue with phone number
                                    </span>
                                    <span className="mt-1 block text-[9px] font-medium leading-4 text-white/50">
                                        Use the phone number linked to your account.
                                    </span>
                                </span>

                                <IoArrowForwardOutline
                                    size={16}
                                    className="shrink-0 text-white/45 transition-transform duration-200 group-hover:translate-x-1"
                                />
                            </button>

                            <button
                                type="button"
                                onClick={
                                    continueWithGoogle
                                }
                                disabled={
                                    disableAll
                                }
                                className="group mt-3 flex w-full items-center gap-3 rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 text-left transition-all duration-200 hover:border-[#CBC4B7] hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-white shadow-[0_5px_15px_rgba(15,23,42,0.04)]">
                                    <Image
                                        src="/google-logo.png"
                                        width={19}
                                        height={19}
                                        alt="Google"
                                    />
                                </span>

                                <span className="min-w-0 flex-1">
                                    <span className="block text-[12px] font-black text-slate-800">
                                        {loadingGoogle
                                            ? "Continuing with Google…"
                                            : "Continue with Google"}
                                    </span>

                                    <span className="mt-1 block text-[9px] font-medium leading-4 text-slate-400">
                                        Sign in securely with your Google account.
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

                            <button
                                type="button"
                                onClick={() =>
                                    setEmailOpen(
                                        (value) =>
                                            !value
                                    )
                                }
                                disabled={
                                    disableAll
                                }
                                className="flex h-11 w-full items-center justify-between rounded-[15px] border border-[#DDD8CC] bg-[#FBFAF6] px-4 text-[10px] font-black text-[#173C2E] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <span>
                                    {emailOpen
                                        ? "Hide email login"
                                        : "Log in with email"}
                                </span>

                                {emailOpen ? (
                                    <IoChevronUp size={16} />
                                ) : (
                                    <IoChevronDown size={16} />
                                )}
                            </button>

                            <AnimatePresence initial={false}>
                                {emailOpen ? (
                                    <motion.div
                                        key="email-login"
                                        initial={{
                                            opacity: 0,
                                            height: 0,
                                        }}
                                        animate={{
                                            opacity: 1,
                                            height: "auto",
                                        }}
                                        exit={{
                                            opacity: 0,
                                            height: 0,
                                        }}
                                        transition={{
                                            duration: 0.18,
                                            ease: "easeOut",
                                        }}
                                        className="overflow-hidden"
                                    >
                                        <div className="pt-3">
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
                                                    value={
                                                        email
                                                    }
                                                    onChange={(
                                                        e
                                                    ) =>
                                                        setEmail(
                                                            e.target
                                                                .value
                                                        )
                                                    }
                                                    aria-label="Email"
                                                    disabled={
                                                        disableAll
                                                    }
                                                />
                                            </div>

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
                                                    autoComplete="current-password"
                                                    placeholder="Password"
                                                    className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                                                    value={
                                                        password
                                                    }
                                                    onChange={(
                                                        e
                                                    ) =>
                                                        setPassword(
                                                            e.target
                                                                .value
                                                        )
                                                    }
                                                    onKeyDown={(
                                                        e
                                                    ) => {
                                                        if (
                                                            e.key ===
                                                            "Enter"
                                                        ) {
                                                            void handleLoginEmail();
                                                        }
                                                    }}
                                                    aria-label="Password"
                                                    disabled={
                                                        disableAll
                                                    }
                                                />

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setShowPassword(
                                                            (
                                                                value
                                                            ) =>
                                                                !value
                                                        )
                                                    }
                                                    className="ml-2 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-[#F3F1EB] hover:text-[#173C2E]"
                                                    aria-label={
                                                        showPassword
                                                            ? "Hide password"
                                                            : "Show password"
                                                    }
                                                    disabled={
                                                        disableAll
                                                    }
                                                >
                                                    {showPassword ? (
                                                        <IoEyeOffOutline size={17} />
                                                    ) : (
                                                        <IoEyeOutline size={17} />
                                                    )}
                                                </button>
                                            </div>

                                            {!!errorMsg ? (
                                                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[10px] font-semibold leading-4 text-rose-700">
                                                    {errorMsg}
                                                </div>
                                            ) : null}

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    void handleLoginEmail()
                                                }
                                                disabled={
                                                    !isValid ||
                                                    disableAll
                                                }
                                                className="mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-[#173C2E] px-4 text-[10px] font-black text-white transition hover:bg-[#214C3A] disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {loadingEmail
                                                    ? "Logging in…"
                                                    : "Log in"}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={
                                                    onForgotPassword
                                                }
                                                disabled={
                                                    disableAll
                                                }
                                                className="mx-auto mt-3 block text-[9px] font-black text-slate-400 transition hover:text-[#173C2E] disabled:opacity-50"
                                            >
                                                Forgot your password?
                                            </button>
                                        </div>
                                    </motion.div>
                                ) : null}
                            </AnimatePresence>

                            {!emailOpen &&
                                !!errorMsg ? (
                                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[10px] font-semibold leading-4 text-rose-700">
                                    {errorMsg}
                                </div>
                            ) : null}

                            <div className="mt-5 rounded-[16px] border border-[#E5E0D6] bg-[#FBFAF6] px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <IoLockClosedOutline
                                        size={13}
                                        className="text-[#173C2E]"
                                    />
                                    <span className="text-[9px] font-black text-slate-600">
                                        Your account stays protected.
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-5">
                            <div className="flex items-center justify-center gap-1 text-[10px]">
                                <span className="font-medium text-slate-400">
                                    New here?
                                </span>

                                <Link
                                    href="/signup"
                                    className="inline-flex items-center gap-1 font-black text-[#173C2E] transition hover:text-[#F39A22]"
                                >
                                    Create an account
                                    <IoPersonAddOutline size={12} />
                                </Link>
                            </div>

                            <p className="mt-3 text-center text-[9px] font-medium leading-4 text-slate-400">
                                By continuing, you agree to ekarihub&apos;s{" "}
                                <Link
                                    href="/terms"
                                    className="font-black text-[#173C2E] transition hover:text-[#F39A22]"
                                >
                                    Terms
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

                            <div
                                style={{
                                    height:
                                        "env(safe-area-inset-bottom)",
                                }}
                            />
                        </div>
                    </motion.div>
                </section>
            </div>
        </main>
    );
}