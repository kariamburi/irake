"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import {
    IoPersonCircleOutline,
    IoLogOutOutline,
    IoChevronForward,
} from "react-icons/io5";

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
    const [open, setOpen] = React.useState(false);
    const btnRef = React.useRef<HTMLButtonElement | null>(null);
    const menuRef = React.useRef<HTMLDivElement | null>(null);
    const { signOutUser } = useAuth();

    React.useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            const t = e.target as Node;
            if (!menuRef.current || !btnRef.current) return;
            if (menuRef.current.contains(t) || btnRef.current.contains(t)) return;
            setOpen(false);
        };

        const onEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };

        document.addEventListener("click", onDocClick);
        document.addEventListener("keydown", onEsc);

        return () => {
            document.removeEventListener("click", onDocClick);
            document.removeEventListener("keydown", onEsc);
        };
    }, []);

    React.useEffect(() => {
        setOpen(false);
    }, [pathname]);

    const gotoProfile = () => {
        setOpen(false);

        if (profileHref) {
            router.push(profileHref);
            return;
        }

        const cleanHandle = (handle || "").trim();
        if (!cleanHandle) return;

        router.push(cleanHandle.startsWith("@") ? `/${cleanHandle}` : `/@${cleanHandle}`);
    };

    const doLogout = async () => {
        setOpen(false);
        try {
            await signOutUser();
            router.refresh();
        } catch (e) {
            console.error("Logout failed:", e);
        }
    };

    const avatarSrc = photoURL || "/avatar-placeholder.png";
    const displayHandle = (handle || "").trim();
    const prettyHandle = displayHandle
        ? displayHandle.startsWith("@")
            ? displayHandle
            : `@${displayHandle}`
        : "@user";

    return (
        <div className={["relative", className || ""].join(" ")}>
            <button
                ref={btnRef}
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Open user menu"
                className={[
                    "group relative h-10 w-10 overflow-hidden rounded-full",
                    "border border-white/70 bg-white/95 shadow-[0_8px_24px_rgba(0,0,0,0.12)]",
                    "backdrop-blur-md transition-all duration-200",
                    "hover:scale-[1.03] hover:shadow-[0_12px_28px_rgba(0,0,0,0.16)]",
                    "active:scale-[0.97]",
                    open ? "ring-2 ring-[#C79257]/50" : "",
                ].join(" ")}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-[#C79257]/18 via-transparent to-[#233F39]/18" />
                <div className="relative flex h-full w-full items-center justify-center">
                    <div className="absolute inset-[2px] rounded-full bg-gradient-to-br from-[#C79257] via-[#d6a46f] to-[#233F39]" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={avatarSrc}
                        alt="Profile"
                        className="relative h-[34px] w-[34px] rounded-full border-2 border-white object-cover"
                    />
                </div>
            </button>

            <div
                ref={menuRef}
                role="menu"
                className={[
                    "absolute right-0 mt-3 w-[250px] origin-top-right overflow-hidden rounded-2xl",
                    "border border-white/60 bg-white backdrop-blur-xl",
                    "shadow-[0_20px_60px_rgba(0,0,0,0.20)]",
                    "transition-all duration-200",
                    open
                        ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                        : "pointer-events-none -translate-y-1 scale-95 opacity-0",
                    "z-[10000]",
                ].join(" ")}
            >
                <div className="relative">
                    <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-br from-[#233F39] via-[#2b4d45] to-[#C79257]" />
                    <div className="relative px-4 pb-3 pt-4">
                        <div className="flex items-center gap-3">
                            <div className="relative h-12 w-12 shrink-0 rounded-full p-[2px] bg-white/30">
                                <div className="absolute inset-0 rounded-full bg-white/15" />
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={avatarSrc}
                                    alt="Profile"
                                    className="relative h-full w-full rounded-full border-2 border-white object-cover"
                                />
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-white">
                                    {prettyHandle}
                                </div>
                                <div className="mt-0.5 text-[11px] text-white/80">
                                    Account menu
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-2 pb-2 pt-2">
                    <button
                        role="menuitem"
                        type="button"
                        onClick={gotoProfile}
                        className={[
                            "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left",
                            "transition-all duration-150",
                            "hover:bg-[#233F39]/6 active:scale-[0.99]",
                        ].join(" ")}
                    >
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#233F39]/8 text-[#233F39]">
                            <IoPersonCircleOutline className="h-5 w-5" aria-hidden="true" />
                        </span>

                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-[#233F39]">
                                View profile
                            </span>
                            <span className="block truncate text-[12px] text-[#233F39]/65">
                                Open your public profile
                            </span>
                        </span>

                        <IoChevronForward className="h-4 w-4 text-[#233F39]/45" />
                    </button>

                    <div className="mx-2 my-1 h-px bg-gradient-to-r from-transparent via-[#233F39]/10 to-transparent" />

                    <button
                        role="menuitem"
                        type="button"
                        onClick={doLogout}
                        className={[
                            "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left",
                            "transition-all duration-150",
                            "hover:bg-[#C79257]/10 active:scale-[0.99]",
                        ].join(" ")}
                    >
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#C79257]/14 text-[#233F39]">
                            <IoLogOutOutline className="h-5 w-5" aria-hidden="true" />
                        </span>

                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-[#233F39]">
                                Log out
                            </span>
                            <span className="block text-[12px] text-[#233F39]/65">
                                Sign out of your account
                            </span>
                        </span>

                        <IoChevronForward className="h-4 w-4 text-[#233F39]/45" />
                    </button>
                </div>
            </div>
        </div>
    );
}