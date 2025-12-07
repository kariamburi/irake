"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import { IoPersonCircleOutline, IoLogOutOutline } from "react-icons/io5";
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

    // close on outside / ESC
    React.useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            const t = e.target as Node;
            if (!menuRef.current || !btnRef.current) return;
            if (menuRef.current.contains(t) || btnRef.current.contains(t)) return;
            setOpen(false);
        };
        const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        document.addEventListener("click", onDocClick);
        document.addEventListener("keydown", onEsc);
        return () => {
            document.removeEventListener("click", onDocClick);
            document.removeEventListener("keydown", onEsc);
        };
    }, []);

    // close when route changes
    React.useEffect(() => setOpen(false), [pathname]);

    const gotoProfile = () => {
        setOpen(false);
        router.push(`/${handle}`);
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

    return (
        <div className={["relative", className || ""].join(" ")}>
            {/* Avatar button (TikTok-ish, compact) */}
            <button
                ref={btnRef}
                onClick={() => setOpen(v => !v)}
                aria-haspopup="menu"
                aria-expanded={open}
                className="
          h-10 w-10 rounded-full overflow-hidden
          border border-gray-200 bg-white text-[#233F39]
          shadow-sm hover:shadow-md transition
          active:scale-[.98]
        "
            >
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#C79257] to-[#233F39]" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={avatarSrc || "/avatar-placeholder.png"}
                        alt="Profile"
                        className="relative h-8 w-8 rounded-full border-2 border-white object-cover"
                    />
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}

            </button>

            {/* Menu */}
            <div
                ref={menuRef}
                role="menu"
                className={[
                    "absolute right-0 mt-2 w-48 rounded-xl border bg-white shadow-xl",
                    "origin-top-right transition transform",
                    open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none",
                    "z-50",
                ].join(" ")}
            >
                <div className="py-1">
                    <button
                        role="menuitem"
                        onClick={gotoProfile}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[#233F39] hover:bg-gray-50"
                    >
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100">
                            <IoPersonCircleOutline className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span>View profile</span>
                    </button>

                    <div className="my-1 h-px bg-gray-100" />

                    <button
                        role="menuitem"
                        onClick={doLogout}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[#233F39] hover:bg-gray-50"
                    >
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100">
                            <IoLogOutOutline className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span>Log out</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
