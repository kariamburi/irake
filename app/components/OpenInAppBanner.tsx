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

/** Builds an Android intent:// URL that triggers Chrome's “Continue to …?” prompt (TikTok-like). */
function buildAndroidIntentUrl(params: {
    appUrl: string; // ekarihub://@handle/deed/123 OR ekarihub://@handle OR ekarihub://
    fallbackUrl: string; // web url fallback (or play store)
    packageName: string; // com.ekarihub.app
}) {
    const { appUrl, fallbackUrl, packageName } = params;

    let scheme = "ekarihub";
    let path = ""; // intent://<path>

    try {
        const u = new URL(appUrl);

        scheme = u.protocol.replace(":", "") || scheme;

        // For ekarihub://@paul/deed/123
        // URL parsing: hostname="@paul", pathname="/deed/123"
        // We want path="@paul/deed/123"
        const hostPart = u.hostname ? u.hostname : "";
        const pathPart = u.pathname ? u.pathname : "";
        const queryPart = u.search ? u.search : "";

        path = `${hostPart}${pathPart}${queryPart}`.replace(/^\/+/, "");
    } catch {
        // If parsing fails, best effort: strip scheme
        path = String(appUrl)
            .replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "")
            .replace(/^\/+/, "");
    }

    // Avoid empty path (some devices behave better with at least one segment)
    if (!path) path = "";

    // intent://<path>#Intent;scheme=<scheme>;package=<pkg>;S.browser_fallback_url=<encoded>;end
    return (
        `intent://${path}#Intent;scheme=${scheme};package=${packageName};` +
        `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`
    );
}

function openEkariApp(params: {
    os: "android" | "ios" | "other";
    appUrl: string;
    webUrl: string;
    playStoreUrl: string;
    appStoreUrl: string;
    packageName: string;
    onLikelyOpened?: () => void;
    onLikelyFailed?: () => void;
}) {
    const {
        os,
        appUrl,
        webUrl,
        playStoreUrl,
        appStoreUrl,
        packageName,
        onLikelyOpened,
        onLikelyFailed,
    } = params;

    const started = Date.now();
    let didHide = false;

    const onVis = () => {
        if (document.visibilityState === "hidden") {
            didHide = true;
            onLikelyOpened?.();
        }
    };
    document.addEventListener("visibilitychange", onVis, { once: true });

    // ✅ Android (TikTok-like system prompt in Chrome)
    if (os === "android") {
        const intentUrl = buildAndroidIntentUrl({
            appUrl,
            fallbackUrl: webUrl || playStoreUrl,
            packageName,
        });

        window.location.href = intentUrl;

        window.setTimeout(() => {
            const elapsed = Date.now() - started;
            if (!didHide && document.visibilityState !== "hidden" && elapsed >= 900) {
                onLikelyFailed?.();
            }
        }, 1100);

        return;
    }

    // ✅ iOS: deep link (may show prompt depending on browser)
    if (os === "ios") {
        window.location.href = appUrl;

        window.setTimeout(() => {
            const elapsed = Date.now() - started;
            if (!didHide && document.visibilityState !== "hidden" && elapsed >= 900) {
                // In iOS, if it didn't open, go to App Store (or web if you prefer)
                if (appStoreUrl) window.location.href = appStoreUrl;
                else if (webUrl) window.location.href = webUrl;
                onLikelyFailed?.();
            }
        }, 1100);

        return;
    }

    // Other platforms: continue web
    if (webUrl) window.location.href = webUrl;
}

type Props = {
    // the current canonical web url, e.g. https://ekarihub.com/@paul or https://ekarihub.com/@paul/deed/123
    webUrl: string;
    // the deep link url, e.g. ekarihub://@paul or ekarihub://@paul/deed/123 (matches your RN linking config)
    appUrl: string;

    playStoreUrl?: string;
    appStoreUrl?: string;

    title?: string;
    subtitle?: string;

    /** Android package name used in intent:// */
    androidPackageName?: string;

    /** Show bottom-right sticky pill like TikTok */
    showStickyButton?: boolean;
};

export default function OpenInAppBanner({
    webUrl,
    appUrl,
    playStoreUrl = "https://play.google.com/store/apps/details?id=com.ekarihub.app",
    appStoreUrl = "https://apps.apple.com", // replace with your real App Store link later
    title = "Continue to ekarihub?",
    subtitle = "This site wants to open the ekariHub app",
    androidPackageName = "com.ekarihub.app",
    showStickyButton = true,
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
        }, 220);
    }, []);

    const dismiss = () => {
        closeAnimated();
        try {
            const key = "ekari:openInApp:dismissedUntil";
            const hours12 = 12 * 60 * 60 * 1000;
            localStorage.setItem(key, String(Date.now() + hours12));
        } catch { }
    };

    const tryOpenApp = useCallback(() => {
        setShowInstall(false);

        // ✅ triggers Android “Continue to …?” prompt via intent:// (TikTok-like)
        openEkariApp({
            os,
            appUrl,
            webUrl,
            playStoreUrl,
            appStoreUrl,
            packageName: androidPackageName,
            onLikelyOpened: () => closeAnimated(),
            onLikelyFailed: () => setShowInstall(true),
        });
    }, [
        os,
        appUrl,
        webUrl,
        playStoreUrl,
        appStoreUrl,
        androidPackageName,
        closeAnimated,
    ]);

    if (!visible) return null;

    const entering = visible && !exiting;

    return (
        <>
            {/* ✅ TikTok-like top prompt bar */}
            <div
                style={{
                    position: "fixed",
                    top: `calc(10px + env(safe-area-inset-top))`,
                    left: "50%",
                    transform: `translateX(-50%) translateY(${entering ? "0px" : "-14px"})`,
                    zIndex: 1000,

                    width: "min(960px, calc(100vw - 20px))",
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.92)",
                    backdropFilter: "blur(10px)",
                    border: `1px solid ${EKARI.hair}`,
                    boxShadow: "0 10px 25px rgba(0,0,0,0.12), 0 4px 10px rgba(0,0,0,0.08)",

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
                    {/* Logo */}
                    <div
                        style={{
                            width: 34,
                            height: 34,
                            borderRadius: 12,
                            background: EKARI.forest,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            overflow: "hidden",
                        }}
                        aria-hidden
                    >
                        <img
                            src="/ekarihub-favicon-logo-green.png"
                            alt="EkariHub"
                            style={{
                                width: 22,
                                height: 22,
                                objectFit: "contain",
                            }}
                        />
                    </div>


                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                            style={{
                                fontWeight: 900,
                                color: EKARI.ink,
                                fontSize: 13,
                                lineHeight: "17px",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {title}
                        </div>
                        <div
                            style={{
                                color: EKARI.dim,
                                fontSize: 12,
                                lineHeight: "16px",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {subtitle}
                        </div>

                        {/* Animated install section */}
                        <div
                            style={{
                                maxHeight: showInstall ? 140 : 0,
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
                            onMouseDown={(e) =>
                                (e.currentTarget.style.transform = "scale(0.98)")
                            }
                            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.transform = "scale(1)")
                            }
                        >
                            Continue
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
                            onMouseDown={(e) =>
                                (e.currentTarget.style.transform = "scale(0.98)")
                            }
                            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.transform = "scale(1)")
                            }
                        >
                            ✕
                        </button>
                    </div>
                </div>
            </div>

            {/* ✅ TikTok-like sticky "Open app" pill button */}
            {showStickyButton && (
                <button
                    onClick={tryOpenApp}
                    style={{
                        position: "fixed",
                        right: 50,
                        bottom: `calc(70px + env(safe-area-inset-bottom))`,
                        zIndex: 1000,
                        borderRadius: 999,
                        padding: "6px 10px",
                        background: "rgba(255,255,255,0.16)",
                        color: "white",
                        fontWeight: 400,
                        border: "1px solid rgba(255,255,255,0.18)",
                        backdropFilter: "blur(10px)",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
                        cursor: "pointer",
                    }}
                    aria-label="Open ekarihub app"
                >
                    Open app
                </button>
            )}
        </>
    );
}
