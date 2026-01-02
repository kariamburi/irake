// app/donations/paystack-callback/PaystackCallbackClient.tsx
"use client";

import React, { useEffect, useState } from "react";
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

type DonationStatus = "pending" | "succeeded" | "failed";

type DonationDoc = {
    deedId: string;
    handle: string;
    creatorId: string;
    donorId?: string | null;
    status: DonationStatus;
    amount?: number; // minor units
    currency?: string; // e.g. "KES"
    paidAmount?: number; // minor units
    paidCurrency?: string;
    paidAt?: any;
    gatewayError?: string;
};

export default function PaystackCallbackClient() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const donationId = searchParams.get("donationId");

    const [loading, setLoading] = useState(true);
    const [donation, setDonation] =
        useState<(DonationDoc & { id: string }) | null>(null);
    const [creatorName, setCreatorName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!donationId) {
            setError("Missing uplift reference.");
            setLoading(false);
            return;
        }

        setLoading(true);
        const ref = doc(db, "donations", donationId);

        const unsub = onSnapshot(
            ref,
            async (snap) => {
                if (!snap.exists()) {
                    setError("We couldn't find this uplift.");
                    setDonation(null);
                    setLoading(false);
                    return;
                }

                const data = snap.data() as DonationDoc;
                const merged: DonationDoc & { id: string } = {
                    id: snap.id,
                    ...data,
                };
                setDonation(merged);
                setLoading(false);

                // Load creator name
                if (data.creatorId) {
                    try {
                        const userSnap = await getDoc(doc(db, "users", data.creatorId));
                        if (userSnap.exists()) {
                            const u = userSnap.data() as any;
                            const nameFromFields =
                                [u.firstName, u.lastName].filter(Boolean).join(" ") ||
                                u.handle ||
                                u.username;
                            setCreatorName(nameFromFields || "this creator");
                        } else {
                            setCreatorName("this creator");
                        }
                    } catch {
                        setCreatorName("this creator");
                    }
                }
            },
            (err) => {
                console.error("Error loading uplift callback doc", err);
                setError("Something went wrong while loading your uplift.");
                setLoading(false);
            }
        );

        return () => unsub();
    }, [donationId]);

    const goHome = () => {
        router.push("/");
    };

    const amountMinor = donation?.paidAmount ?? donation?.amount ?? 0;
    const amountMajor = amountMinor / 100;
    const currency = (
        donation?.paidCurrency ||
        donation?.currency ||
        "KES"
    ).toUpperCase();

    let statusIcon = <IoTimeOutline size={40} color={EKARI.dim} />;
    let statusTitle = "Processing your uplift…";
    let statusMessage =
        "We’re confirming your payment with our gateway. This page will update automatically.";

    if (donation?.status === "succeeded") {
        statusIcon = <IoCheckmarkCircleOutline size={48} color={EKARI.forest} />;
        statusTitle = "Thank you for your uplift!";
        statusMessage = `Your uplift has been received${creatorName ? ` by ${creatorName}` : ""
            }.`;
    } else if (donation?.status === "failed") {
        statusIcon = <IoCloseCircleOutline size={48} color="#DC2626" />;
        statusTitle = "Payment not completed";
        statusMessage =
            donation.gatewayError ||
            "We couldn’t complete your payment. You can try again from the deed screen.";
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
                        ekarihub Uplift
                    </h1>
                    <p
                        style={{
                            marginTop: "4px",
                            fontSize: "13px",
                            color: EKARI.dim,
                        }}
                    >
                        Secure tip & uplift checkout
                    </p>
                </div>

                {/* Loader */}
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
                        <p
                            style={{
                                margin: 0,
                                fontSize: "14px",
                                color: EKARI.dim,
                                textAlign: "center",
                            }}
                        >
                            We’re confirming your payment…
                        </p>
                    </div>
                )}

                {/* Error state */}
                {error && !loading && (
                    <div
                        style={{
                            padding: "20px 8px",
                            textAlign: "center",
                        }}
                    >
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
                        <p
                            style={{
                                margin: 0,
                                fontSize: "14px",
                                color: EKARI.dim,
                            }}
                        >
                            {error}
                        </p>
                        <button
                            onClick={goHome}
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
                            Back to ekarihub
                        </button>
                    </div>
                )}

                {/* Success / Pending / Failed state */}
                {!loading && !error && donation && (
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
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: "14px",
                                    color: EKARI.dim,
                                    textAlign: "center",
                                }}
                            >
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
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: "12px",
                                        fontWeight: 600,
                                        color: EKARI.dim,
                                        textTransform: "uppercase",
                                    }}
                                >
                                    Uplift amount
                                </span>
                                <span
                                    style={{
                                        fontSize: "16px",
                                        fontWeight: 800,
                                        color: EKARI.ink,
                                    }}
                                >
                                    {currency} {amountMajor.toFixed(2)}
                                </span>
                            </div>
                            <p
                                style={{
                                    marginTop: "6px",
                                    fontSize: "11px",
                                    color: EKARI.dim,
                                }}
                            >
                                90% goes to the creator, 10% supports ekarihub operations.
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
                            <div
                                style={{ display: "flex", justifyContent: "space-between" }}
                            >
                                <span>Uplift ID</span>
                                <span style={{ fontFamily: "monospace" }}>{donation.id}</span>
                            </div>
                            {donation.deedId && (
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        marginTop: "4px",
                                    }}
                                >
                                    <span>Deed ID</span>
                                    <span style={{ fontFamily: "monospace" }}>
                                        {donation.deedId}
                                    </span>
                                </div>
                            )}
                            {donation.paidAt?.toDate && (
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        marginTop: "4px",
                                    }}
                                >
                                    <span>Paid at</span>
                                    <span>{donation.paidAt.toDate().toLocaleString()}</span>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div
                            style={{ display: "flex", flexDirection: "column", gap: "8px" }}
                        >
                            {donation.deedId && (
                                <Link
                                    href={`/${donation.handle}/deed/${donation.deedId}`}
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
                                    <span>Back to deed</span>
                                </Link>
                            )}

                            <button
                                onClick={goHome}
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
