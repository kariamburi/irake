"use client";

import React, { useEffect, useMemo, useState } from "react";

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
    title = "Open in ekarihub",
    subtitle = "Get the best experience in the app.",
}: Props) {
    const [visible, setVisible] = useState(false);
    const [showInstall, setShowInstall] = useState(false);

    const ua = useMemo(() => (typeof navigator !== "undefined" ? navigator.userAgent : ""), []);
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

    const dismiss = () => {
        setVisible(false);
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
                // app likely opened → keep banner hidden
                setVisible(false);
            }
        };
        document.addEventListener("visibilitychange", onVis, { once: true });

        // Attempt deep link
        window.location.href = appUrl;

        // After 900ms if we’re still here, show install options
        window.setTimeout(() => {
            const elapsed = Date.now() - started;
            // If still visible on page, likely failed
            if (document.visibilityState !== "hidden" && elapsed >= 800) {
                setShowInstall(true);
            }
        }, 900);
    };

    if (!visible) return null;

    return (
        <div
            style={{
                position: "sticky",
                top: 0,
                zIndex: 50,
                background: "rgba(255,255,255,0.92)",
                backdropFilter: "blur(10px)",
                borderBottom: `1px solid ${EKARI.hair}`,
            }}
        >
            <div
                style={{
                    maxWidth: 960,
                    margin: "0 auto",
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
                    <div style={{ fontWeight: 900, color: EKARI.ink, fontSize: 14, lineHeight: "18px" }}>
                        {title}
                    </div>
                    <div style={{ color: EKARI.dim, fontSize: 12, lineHeight: "16px" }}>
                        {subtitle}
                    </div>

                    {showInstall && (
                        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                        }}
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
                        }}
                    >
                        ✕
                    </button>
                </div>
            </div>
        </div>
    );
}
