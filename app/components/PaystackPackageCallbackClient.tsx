"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    IoCheckmarkCircleOutline,
    IoTimeOutline,
    IoCloseCircleOutline,
    IoArrowBackCircleOutline,
} from "react-icons/io5";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    ink: "#111827",
    dim: "#6B7280",
    hair: "#E5E7EB",
};

type CheckoutStatus = "pending" | "succeeded" | "failed";

type PackageCheckoutDoc = {
    packageId: string;
    packageName?: string;
    sellerId?: string | null;
    status: CheckoutStatus;

    billingCycle?: "monthly" | "yearly";

    // amounts are in minor units (like Paystack)
    amount?: number;
    currency?: string;

    paidAmount?: number;
    paidCurrency?: string;
    paidAt?: any;

    gatewayError?: string;

    // optional
    gatewayRef?: string;
};

function moneyFromMinor(minor: number, currency: string) {
    const major = (minor || 0) / 100;
    // KES usually no decimals in display, but Paystack is still minor units => keep 2 for consistency
    return `${currency.toUpperCase()} ${major.toFixed(2)}`;
}

export default function PaystackPackageCallbackClient() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const checkoutId = searchParams.get("checkoutId");

    const [loading, setLoading] = useState(true);
    const [checkout, setCheckout] = useState<(PackageCheckoutDoc & { id: string }) | null>(null);
    const [error, setError] = useState<string | null>(null);

    // optionally show package name even if doc doesn’t store it
    const [pkgName, setPkgName] = useState<string | null>(null);

    useEffect(() => {
        if (!checkoutId) {
            setError("Missing checkout reference.");
            setLoading(false);
            return;
        }

        setLoading(true);
        const ref = doc(db, "packageCheckouts", checkoutId);

        const unsub = onSnapshot(
            ref,
            async (snap) => {
                if (!snap.exists()) {
                    setError("We couldn't find this checkout.");
                    setCheckout(null);
                    setLoading(false);
                    return;
                }

                const data = snap.data() as PackageCheckoutDoc;
                const merged = { id: snap.id, ...data };
                setCheckout(merged);
                setLoading(false);

                // If packageName not stored, fetch package doc for nicer UI
                const effectiveName = data.packageName;
                if (effectiveName) {
                    setPkgName(effectiveName);
                    return;
                }

                if (data.packageId) {
                    try {
                        const pSnap = await getDoc(doc(db, "packages", data.packageId));
                        if (pSnap.exists()) {
                            const p = pSnap.data() as any;
                            setPkgName(String(p?.name || "Your plan"));
                        } else {
                            setPkgName("Your plan");
                        }
                    } catch {
                        setPkgName("Your plan");
                    }
                }
            },
            (err) => {
                console.error("Error loading package callback doc", err);
                setError("Something went wrong while loading your checkout.");
                setLoading(false);
            }
        );

        return () => unsub();
    }, [checkoutId]);

    const goSeller = () => {
        router.push("/seller/dashboard"); // change if your route differs
    };

    const moneyLine = useMemo(() => {
        const minor = checkout?.paidAmount ?? checkout?.amount ?? 0;
        const cur = (checkout?.paidCurrency || checkout?.currency || "KES").toUpperCase();
        return moneyFromMinor(minor, cur);
    }, [checkout]);

    let statusIcon = <IoTimeOutline size={40} color={EKARI.dim} />;
    let statusTitle = "Processing your plan…";
    let statusMessage =
        "We’re confirming your payment with our gateway. This page will update automatically.";

    if (checkout?.status === "succeeded") {
        statusIcon = <IoCheckmarkCircleOutline size={48} color={EKARI.forest} />;
        statusTitle = "Plan activated ✅";
        statusMessage = `Your subscription has been updated${pkgName ? ` to ${pkgName}` : ""}.`;
    } else if (checkout?.status === "failed") {
        statusIcon = <IoCloseCircleOutline size={48} color="#DC2626" />;
        statusTitle = "Payment not completed";
        statusMessage =
            checkout.gatewayError ||
            "We couldn’t complete your payment. You can try again from the packages screen.";
    }

    return (
        <div
            style={{
                minHeight: "100vh",
                backgroundColor: EKARI.sand,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: "480px",
                    backgroundColor: "#FFFFFF",
                    borderRadius: "24px",
                    border: `1px solid ${EKARI.hair}`,
                    padding: "24px 20px",
                    boxShadow: "0 18px 40px rgba(15,23,42,0.12)",
                }}
            >
                {/* Header */}
                <div style={{ marginBottom: "16px", textAlign: "center" }}>
                    <h1
                        style={{
                            margin: 0,
                            fontSize: "22px",
                            fontWeight: 800,
                            color: EKARI.ink,
                        }}
                    >
                        ekarihub Packages
                    </h1>
                    <p style={{ marginTop: "4px", fontSize: "13px", color: EKARI.dim }}>
                        Secure plan checkout
                    </p>
                </div>

                {/* Loading */}
                {loading && !error && (
                    <div
                        style={{
                            padding: "24px 8px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "12px",
                        }}
                    >
                        <IoTimeOutline size={40} color={EKARI.dim} />
                        <p style={{ margin: 0, fontSize: "14px", color: EKARI.dim, textAlign: "center" }}>
                            We’re confirming your payment…
                        </p>
                    </div>
                )}

                {/* Error state */}
                {error && !loading && (
                    <div style={{ padding: "20px 8px", textAlign: "center" }}>
                        <IoCloseCircleOutline size={40} color="#DC2626" />
                        <h2
                            style={{
                                marginTop: "12px",
                                marginBottom: "8px",
                                fontSize: "18px",
                                fontWeight: 700,
                                color: EKARI.ink,
                            }}
                        >
                            Something went wrong
                        </h2>
                        <p style={{ margin: 0, fontSize: "14px", color: EKARI.dim }}>
                            {error}
                        </p>
                        <button
                            onClick={goSeller}
                            style={{
                                marginTop: "16px",
                                width: "100%",
                                borderRadius: "999px",
                                border: "none",
                                padding: "10px 16px",
                                backgroundColor: EKARI.forest,
                                color: "#fff",
                                fontWeight: 700,
                                fontSize: "14px",
                                cursor: "pointer",
                            }}
                        >
                            Back to seller dashboard
                        </button>
                    </div>
                )}

                {/* Status state */}
                {!loading && !error && checkout && (
                    <div>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: "10px",
                                paddingBottom: "16px",
                            }}
                        >
                            {statusIcon}
                            <h2
                                style={{
                                    margin: 0,
                                    fontSize: "18px",
                                    fontWeight: 800,
                                    color: EKARI.ink,
                                    textAlign: "center",
                                }}
                            >
                                {statusTitle}
                            </h2>
                            <p style={{ margin: 0, fontSize: "14px", color: EKARI.dim, textAlign: "center" }}>
                                {statusMessage}
                            </p>
                        </div>

                        {/* Amount card */}
                        <div
                            style={{
                                borderRadius: "18px",
                                border: `1px solid ${EKARI.hair}`,
                                backgroundColor: "#F9FAFB",
                                padding: "14px 14px 12px",
                                marginBottom: "12px",
                            }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span
                                    style={{
                                        fontSize: "12px",
                                        fontWeight: 600,
                                        color: EKARI.dim,
                                        textTransform: "uppercase",
                                    }}
                                >
                                    Total paid
                                </span>
                                <span style={{ fontSize: "16px", fontWeight: 800, color: EKARI.ink }}>
                                    {moneyLine}
                                </span>
                            </div>

                            <p style={{ marginTop: "6px", fontSize: "11px", color: EKARI.dim }}>
                                Billing: {(checkout.billingCycle || "monthly").toUpperCase()}
                            </p>
                        </div>

                        {/* Meta info */}
                        <div
                            style={{
                                borderRadius: "16px",
                                border: `1px solid ${EKARI.hair}`,
                                padding: "10px 12px",
                                fontSize: "12px",
                                color: EKARI.dim,
                                marginBottom: "14px",
                            }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span>Checkout ID</span>
                                <span style={{ fontFamily: "monospace" }}>{checkout.id}</span>
                            </div>

                            {checkout.gatewayRef ? (
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                                    <span>Reference</span>
                                    <span style={{ fontFamily: "monospace" }}>{checkout.gatewayRef}</span>
                                </div>
                            ) : null}

                            {checkout.paidAt?.toDate && (
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                                    <span>Paid at</span>
                                    <span>{checkout.paidAt.toDate().toLocaleString()}</span>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <Link
                                href="/seller/dashboard"
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "6px",
                                    width: "100%",
                                    borderRadius: "999px",
                                    padding: "10px 16px",
                                    border: "none",
                                    backgroundColor: EKARI.forest,
                                    color: "#fff",
                                    fontWeight: 700,
                                    fontSize: "14px",
                                    textDecoration: "none",
                                }}
                            >
                                <IoArrowBackCircleOutline size={18} />
                                <span>Back to dashboard</span>
                            </Link>

                            <button
                                onClick={() => router.push("/")}
                                style={{
                                    width: "100%",
                                    borderRadius: "999px",
                                    border: `1px solid ${EKARI.hair}`,
                                    padding: "10px 16px",
                                    backgroundColor: "#FFFFFF",
                                    color: EKARI.ink,
                                    fontWeight: 600,
                                    fontSize: "14px",
                                    cursor: "pointer",
                                }}
                            >
                                Go to ekarihub home
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
