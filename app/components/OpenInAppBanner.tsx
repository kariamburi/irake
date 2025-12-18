"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    ink: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
};

function isProbablyMobile(ua?: string) {
    if (!ua) return false;
    return /Android|iPhone|iPad|iPod/i.test(ua);
}

function getOS(ua?: string): "android" | "ios" | "other" {
    if (!ua) return "other";
    if (/Android/i.test(ua)) return "android";
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
    return "other";
}

type Props = {
    // the current canonical web url, e.g. https://ekarihub.com/paul or /paul/deed/123
    webUrl: string;
    // the deep link path, e.g. ekarihub://paul or ekarihub://paul/deed/123
    appUrl: string;

    // set these once you know them
    playStoreUrl?: string;
    appStoreUrl?: string;

    title?: string; // e.g. "Open in EkariHub"
    subtitle?: string; // e.g. "Get the best experience in the app."
};

export default function OpenInAppBanner({
    webUrl,
    appUrl,
    playStoreUrl = "https://play.google.com/store/apps/details?id=com.ekarihub.app",
    appStoreUrl = "https://apps.apple.com", // replace with your real App Store link later
    title = "Open in ekarihub App",
    subtitle = "Get the best experience in the app.",
}: Props) {
    const [visible, setVisible] = useState(false);
    const [showInstall, setShowInstall] = useState(false);
    const [exiting, setExiting] = useState(false);

    const ua = useMemo(
        () => (typeof navigator !== "undefined" ? navigator.userAgent : ""),
        []
    );
    const os = useMemo(() => getOS(ua), [ua]);
    const mobile = useMemo(() => isProbablyMobile(ua), [ua]);

    // Dismiss persistence (12 hours)
    useEffect(() => {
        if (!mobile) return;

        try {
            const key = "ekari:openInApp:dismissedUntil";
            const until = Number(localStorage.getItem(key) || "0");
            if (Date.now() < until) return;

            setVisible(true);
        } catch {
            setVisible(true);
        }
    }, [mobile]);

    const closeAnimated = useCallback(() => {
        setExiting(true);
        window.setTimeout(() => {
            setVisible(false);
            setExiting(false);
        }, 220); // match wrapper transition duration
    }, []);

    const dismiss = () => {
        closeAnimated();
        try {
            const key = "ekari:openInApp:dismissedUntil";
            const hours12 = 12 * 60 * 60 * 1000;
            localStorage.setItem(key, String(Date.now() + hours12));
        } catch { }
    };

    const tryOpenApp = () => {
        // Heuristic: if app didn’t open, show install buttons.
        // Works for in-app browsers that block deep links.
        setShowInstall(false);

        const started = Date.now();

        // If app opens, page typically becomes hidden/blurred.
        const onVis = () => {
            if (document.visibilityState === "hidden") {
                // app likely opened → animate out
                closeAnimated();
            }
        };
        document.addEventListener("visibilitychange", onVis, { once: true });

        // Attempt deep link
        window.location.href = appUrl;

        // After 900ms if we’re still here, show install options
        window.setTimeout(() => {
            const elapsed = Date.now() - started;
            if (document.visibilityState !== "hidden" && elapsed >= 800) {
                setShowInstall(true);
            }
        }, 900);
    };

    if (!visible) return null;

    const entering = visible && !exiting;

    return (
        <div
            style={{
                // ✅ floating fixed banner
                position: "fixed",
                top: 12,
                left: "50%",
                transform: `translateX(-50%) translateY(${entering ? "0px" : "-14px"})`,
                zIndex: 1000,

                width: "min(960px, calc(100vw - 24px))",
                borderRadius: 16,

                background: "rgba(255,255,255,0.92)",
                backdropFilter: "blur(10px)",
                border: `1px solid ${EKARI.hair}`,

                // ✅ elevation / shadow
                boxShadow:
                    "0 10px 25px rgba(0,0,0,0.12), 0 4px 10px rgba(0,0,0,0.08)",

                // ✅ entrance/exit animation
                opacity: entering ? 1 : 0,
                transition:
                    "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 220ms ease",
                willChange: "transform, opacity",
            }}
        >
            <div
                style={{
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                }}
            >
                {/* Logo circle */}
                <div
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        background: EKARI.forest,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: EKARI.sand,
                        fontWeight: 900,
                        flexShrink: 0,
                    }}
                >
                    E
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            fontWeight: 900,
                            color: EKARI.ink,
                            fontSize: 14,
                            lineHeight: "18px",
                        }}
                    >
                        {title}
                    </div>
                    <div style={{ color: EKARI.dim, fontSize: 12, lineHeight: "16px" }}>
                        {subtitle}
                    </div>

                    {/* ✅ Animated install section */}
                    <div
                        style={{
                            maxHeight: showInstall ? 120 : 0,
                            opacity: showInstall ? 1 : 0,
                            transform: showInstall ? "translateY(0)" : "translateY(-6px)",
                            overflow: "hidden",
                            transition:
                                "max-height 220ms ease, opacity 180ms ease, transform 180ms ease",
                        }}
                    >
                        {showInstall && (
                            <div
                                style={{
                                    marginTop: 8,
                                    display: "flex",
                                    gap: 8,
                                    flexWrap: "wrap",
                                }}
                            >
                                {os !== "ios" && (
                                    <a
                                        href={playStoreUrl}
                                        style={{
                                            textDecoration: "none",
                                            padding: "8px 10px",
                                            borderRadius: 10,
                                            background: "#111827",
                                            color: "white",
                                            fontWeight: 800,
                                            fontSize: 12,
                                        }}
                                    >
                                        Install on Google Play
                                    </a>
                                )}
                                {os !== "android" && (
                                    <a
                                        href={appStoreUrl}
                                        style={{
                                            textDecoration: "none",
                                            padding: "8px 10px",
                                            borderRadius: 10,
                                            background: "#111827",
                                            color: "white",
                                            fontWeight: 800,
                                            fontSize: 12,
                                        }}
                                    >
                                        Install on App Store
                                    </a>
                                )}
                                <a
                                    href={webUrl}
                                    style={{
                                        textDecoration: "none",
                                        padding: "8px 10px",
                                        borderRadius: 10,
                                        background: "transparent",
                                        border: `1px solid ${EKARI.hair}`,
                                        color: EKARI.ink,
                                        fontWeight: 800,
                                        fontSize: 12,
                                    }}
                                >
                                    Continue on web
                                </a>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                        onClick={tryOpenApp}
                        style={{
                            border: "none",
                            borderRadius: 12,
                            padding: "10px 12px",
                            background: `linear-gradient(135deg, ${EKARI.gold}, #fbbf77)`,
                            color: "white",
                            fontWeight: 900,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            transition: "transform 120ms ease, filter 120ms ease",
                        }}
                        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
                        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    >
                        Open
                    </button>

                    <button
                        onClick={dismiss}
                        aria-label="Dismiss"
                        style={{
                            border: `1px solid ${EKARI.hair}`,
                            borderRadius: 12,
                            padding: "10px 10px",
                            background: "transparent",
                            color: EKARI.dim,
                            fontWeight: 900,
                            cursor: "pointer",
                            transition: "transform 120ms ease, background 120ms ease",
                        }}
                        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
                        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    >
                        ✕
                    </button>
                </div>
            </div>
        </div>
    );
}
