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

  // Test tools state
  const [pushBusy, setPushBusy] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);

  const [emailBusy, setEmailBusy] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);
  const [emailTo, setEmailTo] = useState("");

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

  const handleTestPush = async () => {
    const auth = getAuth(app);
    const user = auth.currentUser;

    if (!user) {
      alert("Please log in first.");
      return;
    }

    try {
      setPushBusy(true);
      setPushResult(null);

      // ✅ refresh token in case admin claim was just added
      await user.getIdToken(true);

      const functions = getFunctions(app, "us-central1");
      const testPush = httpsCallable<
        {
          userId?: string;
          title?: string;
          body?: string;
          data?: Record<string, any>;
        },
        { ok: boolean; targetUserId: string }
      >(functions, "testPush");

      const res = await testPush({
        // userId: user.uid, // optional (your function defaults to self)
        title: "EkariHub FCM test ✅",
        body: `Sent from Admin Tool at ${new Date().toISOString()}`,
        data: {
          screen: "AdminClaimsTool",
          kind: "test_push",
        },
      });

      setPushResult(`✅ Push sent. targetUserId=${res.data.targetUserId}`);
    } catch (err: any) {
      console.error("testPush error", err);
      setPushResult(`❌ ${err?.code || ""} ${err?.message || "Failed to send push"}`);
      alert(err?.message || "Failed to send push");
    } finally {
      setPushBusy(false);
    }
  };

  const handleTestEmail = async () => {
    const auth = getAuth(app);
    const user = auth.currentUser;

    if (!user) {
      alert("Please log in first.");
      return;
    }

    const to = emailTo.trim();
    if (!to || !to.includes("@")) {
      alert("Enter a valid email address.");
      return;
    }

    try {
      setEmailBusy(true);
      setEmailResult(null);

      // ✅ refresh token in case admin claim was just added
      await user.getIdToken(true);

      const functions = getFunctions(app, "us-central1");
      const testEmail = httpsCallable<{ to: string }, { ok: boolean }>(
        functions,
        "testEmail"
      );

      const res = await testEmail({ to });

      setEmailResult(res.data.ok ? `✅ Email sent to ${to}` : "❌ Email not sent");
    } catch (err: any) {
      console.error("testEmail error", err);
      setEmailResult(`❌ ${err?.code || ""} ${err?.message || "Failed to send email"}`);
      alert(err?.message || "Failed to send email");
    } finally {
      setEmailBusy(false);
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
        <h1 className="text-xl font-extrabold" style={{ color: EKARI.text }}>
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

        {/* Divider */}
        <div className="pt-2">
          <div className="h-px w-full" style={{ backgroundColor: EKARI.hair }} />
        </div>

        <h2 className="text-sm font-extrabold" style={{ color: EKARI.text }}>
          Test Tools
        </h2>
        <p className="text-xs" style={{ color: "#6B7280" }}>
          These require <strong>admin=true</strong>. If you just granted the claim,
          the buttons will force-refresh your token automatically.
        </p>

        {/* Push test */}
        <button
          onClick={handleTestPush}
          disabled={pushBusy}
          className="w-full rounded-full py-2.5 text-sm font-bold border"
          style={{
            borderColor: EKARI.forest,
            color: EKARI.forest,
            backgroundColor: "transparent",
            opacity: pushBusy ? 0.7 : 1,
          }}
        >
          {pushBusy ? "Sending push…" : "Send test push"}
        </button>

        {pushResult && (
          <div className="mt-1 text-xs break-all" style={{ color: "#4B5563" }}>
            {pushResult}
          </div>
        )}

        {/* Email test */}
        <div className="space-y-2 pt-2">
          <input
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            placeholder="recipient@example.com"
            className="w-full border rounded-xl px-3 py-2 text-sm"
            style={{ borderColor: EKARI.hair }}
          />

          <button
            onClick={handleTestEmail}
            disabled={emailBusy}
            className="w-full rounded-full py-2.5 text-sm font-bold"
            style={{
              backgroundColor: EKARI.forest,
              color: EKARI.sand,
              opacity: emailBusy ? 0.7 : 1,
            }}
          >
            {emailBusy ? "Sending email…" : "Send test email"}
          </button>

          {emailResult && (
            <div className="mt-1 text-xs break-all" style={{ color: "#4B5563" }}>
              {emailResult}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
