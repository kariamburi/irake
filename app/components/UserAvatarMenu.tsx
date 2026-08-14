"use client";

import React from "react";
import {
    usePathname,
    useRouter,
} from "next/navigation";
import {
    IoChevronForward,
    IoLogOutOutline,
    IoPersonCircleOutline,
    IoPersonOutline,
} from "react-icons/io5";

import { useAuth } from "../hooks/useAuth";

type Props = {
    uid: string;
    photoURL?: string | null;
    handle?: string | null;
    className?: string;
    profileHref?: string;
};

export default function UserAvatarMenu({
    uid,
    photoURL,
    handle,
    className,
    profileHref,
}: Props) {
    const router = useRouter();
    const pathname = usePathname();

    const {
        signOutUser,
    } = useAuth();

    const [open, setOpen] =
        React.useState(false);

    const [
        imageFailed,
        setImageFailed,
    ] =
        React.useState(false);

    const btnRef =
        React.useRef<HTMLButtonElement | null>(
            null
        );

    const menuRef =
        React.useRef<HTMLDivElement | null>(
            null
        );

    React.useEffect(() => {
        setImageFailed(false);
    }, [photoURL]);

    React.useEffect(() => {
        const onDocClick = (
            event: MouseEvent
        ) => {
            const target =
                event.target as Node;

            if (
                !menuRef.current ||
                !btnRef.current
            ) {
                return;
            }

            if (
                menuRef.current.contains(
                    target
                ) ||
                btnRef.current.contains(
                    target
                )
            ) {
                return;
            }

            setOpen(false);
        };

        const onEscape = (
            event: KeyboardEvent
        ) => {
            if (
                event.key ===
                "Escape"
            ) {
                setOpen(false);
            }
        };

        document.addEventListener(
            "click",
            onDocClick
        );

        document.addEventListener(
            "keydown",
            onEscape
        );

        return () => {
            document.removeEventListener(
                "click",
                onDocClick
            );

            document.removeEventListener(
                "keydown",
                onEscape
            );
        };
    }, []);

    React.useEffect(() => {
        setOpen(false);
    }, [pathname]);

    const cleanHandle =
        (
            handle || ""
        ).trim();

    const prettyHandle =
        cleanHandle
            ? cleanHandle.startsWith(
                "@"
            )
                ? cleanHandle
                : `@${cleanHandle}`
            : "@user";

    const showPhoto =
        !!photoURL?.trim() &&
        !imageFailed;

    const gotoProfile = () => {
        setOpen(false);

        if (profileHref) {
            router.push(
                profileHref
            );
            return;
        }

        if (!cleanHandle) {
            return;
        }

        router.push(
            cleanHandle.startsWith(
                "@"
            )
                ? `/${cleanHandle}`
                : `/@${cleanHandle}`
        );
    };

    const doLogout =
        async () => {
            setOpen(false);

            try {
                await signOutUser();

                router.push("/");
                router.refresh();
            } catch (error) {
                console.error(
                    "Logout failed:",
                    error
                );
            }
        };

    const Avatar = ({
        size = 38,
    }: {
        size?: number;
    }) => (
        <div
            className={[
                "relative shrink-0 overflow-hidden rounded-full",
                "border border-white/15",
                "bg-white/[0.08]",
            ].join(" ")}
            style={{
                width: size,
                height: size,
            }}
        >
            {showPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={
                        photoURL!
                    }
                    alt={
                        prettyHandle
                    }
                    className="h-full w-full object-cover"
                    onError={() =>
                        setImageFailed(
                            true
                        )
                    }
                />
            ) : (
                <div className="grid h-full w-full place-items-center text-white/80">
                    <IoPersonOutline
                        size={
                            Math.round(
                                size *
                                0.48
                            )
                        }
                    />
                </div>
            )}
        </div>
    );

    return (
        <div
            className={[
                "relative w-full",
                className || "",
            ].join(" ")}
        >
            {/* Logged-in account row */}
            <button
                ref={btnRef}
                type="button"
                onClick={() =>
                    setOpen(
                        (
                            current
                        ) =>
                            !current
                    )
                }
                aria-haspopup="menu"
                aria-expanded={
                    open
                }
                aria-label="Open account menu"
                className={[
                    "group flex w-full items-center gap-3",
                    "rounded-[14px] px-2.5 py-2",
                    "text-left",
                    "transition-all duration-200",
                    open
                        ? "bg-white/[0.10]"
                        : "hover:bg-white/[0.06]",
                ].join(" ")}
            >
                <Avatar
                    size={38}
                />

                <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-black text-white">
                        {
                            prettyHandle
                        }
                    </div>

                    <div className="mt-1 flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-30" />

                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                        </span>

                        <span className="text-[9px] font-semibold text-white/45">
                            Signed in
                        </span>
                    </div>
                </div>

                <IoChevronForward
                    size={14}
                    className={[
                        "shrink-0 text-white/30",
                        "transition-transform duration-200",
                        open
                            ? "-rotate-90"
                            : "rotate-0",
                    ].join(
                        " "
                    )}
                />
            </button>

            {/* Popup menu - opens upward */}
            <div
                ref={menuRef}
                role="menu"
                className={[
                    "absolute bottom-[calc(100%+10px)] left-0 right-0",
                    "z-[10000]",
                    "origin-bottom",
                    "overflow-hidden rounded-[16px]",
                    "border border-[#DDD8CC]",
                    "bg-[#FBFAF6]",
                    "shadow-[0_18px_48px_rgba(0,0,0,0.28)]",
                    "transition-all duration-200 ease-out",
                    open
                        ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                        : "pointer-events-none translate-y-1 scale-[0.97] opacity-0",
                ].join(" ")}
            >
                {/* Account summary */}
                <div className="relative overflow-hidden bg-[#173C2E] px-3.5 py-3">
                    <div className="pointer-events-none absolute -right-7 -top-8 h-24 w-24 rounded-full bg-white/[0.04]" />

                    <div className="relative flex items-center gap-3">
                        <Avatar
                            size={44}
                        />

                        <div className="min-w-0 flex-1">
                            <div className="truncate text-[12px] font-black text-white">
                                {
                                    prettyHandle
                                }
                            </div>

                            <div className="mt-1 flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

                                <span className="text-[9px] font-semibold text-white/50">
                                    Signed in to
                                    ekarihub
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-2">
                    {/* Profile */}
                    <button
                        role="menuitem"
                        type="button"
                        onClick={
                            gotoProfile
                        }
                        className={[
                            "group flex w-full items-center gap-3",
                            "rounded-xl px-2.5 py-2.5",
                            "text-left",
                            "transition-all duration-150",
                            "hover:bg-[#EEF3EE]",
                            "active:scale-[0.99]",
                        ].join(" ")}
                    >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E8ECE8] text-[#173C2E]">
                            <IoPersonCircleOutline
                                size={
                                    18
                                }
                            />
                        </span>

                        <span className="min-w-0 flex-1">
                            <span className="block text-[10px] font-black text-slate-800">
                                View
                                profile
                            </span>

                            <span className="mt-0.5 block truncate text-[9px] font-medium text-slate-400">
                                Open your
                                public
                                profile
                            </span>
                        </span>

                        <IoChevronForward
                            size={
                                13
                            }
                            className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#173C2E]"
                        />
                    </button>

                    <div className="mx-2 my-1 h-px bg-[#EEEAE2]" />

                    {/* Logout */}
                    <button
                        role="menuitem"
                        type="button"
                        onClick={
                            doLogout
                        }
                        className={[
                            "group flex w-full items-center gap-3",
                            "rounded-xl px-2.5 py-2.5",
                            "text-left",
                            "transition-all duration-150",
                            "hover:bg-rose-50",
                            "active:scale-[0.99]",
                        ].join(" ")}
                    >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600">
                            <IoLogOutOutline
                                size={
                                    17
                                }
                            />
                        </span>

                        <span className="min-w-0 flex-1">
                            <span className="block text-[10px] font-black text-slate-800">
                                Log out
                            </span>

                            <span className="mt-0.5 block text-[9px] font-medium text-slate-400">
                                Sign out
                                of your
                                account
                            </span>
                        </span>

                        <IoChevronForward
                            size={
                                13
                            }
                            className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-rose-500"
                        />
                    </button>
                </div>
            </div>
        </div>
    );
}