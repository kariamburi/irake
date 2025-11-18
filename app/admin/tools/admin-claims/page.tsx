"use client";

import React, { useState } from "react";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";

const EKARI = {
  forest: "#233F39",
  sand: "#FFFFFF",
  text: "#0F172A",
  hair: "#E5E7EB",
};

export default function AdminClaimsToolPage() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleMakeMeAdmin = async () => {
    const auth = getAuth(app);
    const user = auth.currentUser;

    if (!user) {
      alert("Please log in first.");
      return;
    }

    try {
      setBusy(true);
      setResult(null);

      const functions = getFunctions(app, "us-central1");
      const setUserAdminClaim = httpsCallable<
        { targetUid: string; admin: boolean },
        { ok: boolean; targetUid: string; admin: boolean }
      >(functions, "setUserAdminClaim");

      // call your callable as SUPER_ADMIN
      const res = await setUserAdminClaim({
        targetUid: user.uid,
        admin: true,
      });

      // force token refresh so the claim appears immediately
      await user.getIdToken(true);

      setResult(
        `Admin claim set for UID: ${res.data.targetUid}. admin=${res.data.admin}`
      );
      alert("You are now admin. If things look weird, sign out and sign in again.");
    } catch (err: any) {
      console.error("setUserAdminClaim error", err);
      alert(err?.message || "Failed to set admin claim");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "#F9FAFB" }}
    >
      <div
        className="max-w-md w-full rounded-2xl border shadow-sm p-6 space-y-4"
        style={{ backgroundColor: EKARI.sand, borderColor: EKARI.hair }}
      >
        <h1
          className="text-xl font-extrabold"
          style={{ color: EKARI.text }}
        >
          EKARI Admin Claim Tool
        </h1>
        <p className="text-sm" style={{ color: "#6B7280" }}>
          You must be logged in as a SUPER_ADMIN UID (hard-coded in Cloud Functions).
          Click the button below to grant <strong>admin=true</strong> to your own
          account.
        </p>

        <button
          onClick={handleMakeMeAdmin}
          disabled={busy}
          className="w-full rounded-full py-2.5 text-sm font-bold"
          style={{
            backgroundColor: EKARI.forest,
            color: EKARI.sand,
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "Working…" : "Make me admin"}
        </button>

        {result && (
          <div className="mt-2 text-xs break-all" style={{ color: "#4B5563" }}>
            {result}
          </div>
        )}
      </div>
    </div>
  );
}
