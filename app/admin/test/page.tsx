// app/admin/test/page.tsx
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

const CLOUD_BASE = "https://us-central1-ekarihub-aed5a.cloudfunctions.net"; // ✅ your cloud base

export default function AdminClaimsToolPage() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Test tools state
  const [pushBusy, setPushBusy] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);

  const [emailBusy, setEmailBusy] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);
  const [emailTo, setEmailTo] = useState("");

  // Backfill state
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);

  // ✅ NEW: Register M-Pesa C2B URLs
  const [mpesaBusy, setMpesaBusy] = useState(false);
  const [mpesaResult, setMpesaResult] = useState<string | null>(null);

  // ✅ NEW: B2C test
  const [b2cBusy, setB2cBusy] = useState(false);
  const [b2cResult, setB2cResult] = useState<string | null>(null);

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

      const res = await setUserAdminClaim({
        targetUid: user.uid,
        admin: true,
      });

      await user.getIdToken(true);

      setResult(`Admin claim set for UID: ${res.data.targetUid}. admin=${res.data.admin}`);
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

      await user.getIdToken(true);

      const functions = getFunctions(app, "us-central1");
      const testEmail = httpsCallable<{ to: string }, { ok: boolean }>(functions, "testEmail");

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

  // ✅ Backfill button handler (loops until done)
  const handleBackfillMarketListings = async () => {
    const auth = getAuth(app);
    const user = auth.currentUser;

    if (!user) {
      alert("Please log in first.");
      return;
    }

    try {
      setBackfillBusy(true);
      setBackfillResult(null);

      await user.getIdToken(true);

      const functions = getFunctions(app, "us-central1");
      const backfill = httpsCallable<
        { batchSize?: number },
        { ok?: boolean; done?: boolean; processed?: number; message?: string }
      >(functions, "backfillMarketListings");

      let done = false;
      let rounds = 0;
      let totalProcessed = 0;

      while (!done) {
        rounds += 1;

        const res: any = await backfill({ batchSize: 200 });

        const data = res?.data || {};
        const processed = Number(data.processed || 0);
        totalProcessed += processed;

        done = !!data.done;

        setBackfillResult(
          done
            ? `✅ Backfill done. rounds=${rounds}, totalProcessed=${totalProcessed}`
            : `⏳ Backfilling… rounds=${rounds}, lastProcessed=${processed}, totalProcessed=${totalProcessed}`
        );

        if (!done && processed === 0) {
          setBackfillResult(
            `⚠️ Backfill returned processed=0 but done=false. Stopping to avoid infinite loop. rounds=${rounds}`
          );
          break;
        }
      }
    } catch (err: any) {
      console.error("backfillMarketListings error", err);
      setBackfillResult(`❌ ${err?.code || ""} ${err?.message || "Failed to backfill"}`);
      alert(err?.message || "Failed to backfill");
    } finally {
      setBackfillBusy(false);
    }
  };

  // ✅ NEW: Register Mpesa C2B URLs (validation + confirmation)
  const handleRegisterMpesaC2BUrls = async () => {
    const auth = getAuth(app);
    const user = auth.currentUser;

    if (!user) {
      alert("Please log in first.");
      return;
    }

    try {
      setMpesaBusy(true);
      setMpesaResult(null);

      await user.getIdToken(true);

      const functions = getFunctions(app, "us-central1");

      const registerMpesaC2BUrls = httpsCallable<
        { validationUrl: string; confirmationUrl: string },
        { ok: boolean; message?: string; validationUrl?: string; confirmationUrl?: string }
      >(functions, "registerMpesaC2BUrls");

      const validationUrl = `${CLOUD_BASE}/ekariC2BValidation`;
      const confirmationUrl = `${CLOUD_BASE}/ekariC2BConfirmation`;

      const res = await registerMpesaC2BUrls({
        validationUrl,
        confirmationUrl,
      });

      setMpesaResult(
        res.data.ok
          ? `✅ Registered OK\nvalidationUrl=${validationUrl}\nconfirmationUrl=${confirmationUrl}`
          : `❌ Not registered: ${res.data.message || "unknown error"}`
      );
    } catch (err: any) {
      console.error("registerMpesaC2BUrls error", err);
      setMpesaResult(`❌ ${err?.code || ""} ${err?.message || "Failed to register URLs"}`);
      alert(err?.message || "Failed to register URLs");
    } finally {
      setMpesaBusy(false);
    }
  };

  // ✅ NEW: Test B2C (KES 10 → 0728820092)
  const handleTestB2C = async () => {
    const auth = getAuth(app);
    const user = auth.currentUser;

    if (!user) {
      alert("Please log in first.");
      return;
    }

    try {
      setB2cBusy(true);
      setB2cResult(null);

      await user.getIdToken(true);

      const functions = getFunctions(app, "us-central1");
      const testB2C = httpsCallable<{}, any>(functions, "testB2C");

      const res = await testB2C({});

      const data = res?.data || {};
      const phone = data.phone || "0728820092";
      const amountMinor = Number(data.amountKesMinor || 0);
      const amount = (amountMinor / 100).toFixed(2);

      const r = data.result || {};
      const lines = [
        `✅ B2C Test queued`,
        `Phone: ${phone}`,
        `Amount: KES ${amount}`,
        `LocalOriginatorConversationId: ${r.localOriginatorConversationId || "—"}`,
        `Daraja OriginatorConversationId: ${r.darajaOriginatorConversationId || "—"}`,
        `ConversationId: ${r.conversationId || "—"}`,
        `Response: ${r.responseCode || "—"} ${r.responseDescription || ""}`,
      ];

      setB2cResult(lines.join("\n"));
    } catch (err: any) {
      console.error("testB2C error", err);
      setB2cResult(`❌ ${err?.code || ""} ${err?.message || "B2C test failed"}`);
      alert(err?.message || "B2C test failed");
    } finally {
      setB2cBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F9FAFB" }}>
      <div
        className="max-w-md w-full rounded-2xl border shadow-sm p-6 space-y-4"
        style={{ backgroundColor: EKARI.sand, borderColor: EKARI.hair }}
      >
        {/*<h1 className="text-xl font-extrabold" style={{ color: EKARI.text }}>
          EKARI Admin Claim Tool
        </h1>

        <p className="text-sm" style={{ color: "#6B7280" }}>
          You must be logged in as a SUPER_ADMIN UID (hard-coded in Cloud Functions). Click the button below to grant{" "}
          <strong>admin=true</strong> to your own account.
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
          <div className="mt-2 text-xs break-all whitespace-pre-wrap" style={{ color: "#4B5563" }}>
            {result}
          </div>
        )}

        Divider 
        <div className="pt-2">
          <div className="h-px w-full" style={{ backgroundColor: EKARI.hair }} />
        </div>

    
        <h2 className="text-sm font-extrabold" style={{ color: EKARI.text }}>
          M-Pesa Setup
        </h2>
        <p className="text-xs" style={{ color: "#6B7280" }}>
          Registers your C2B <strong>Validation</strong> + <strong>Confirmation</strong> URLs using the callable{" "}
          <code>registerMpesaC2BUrls</code>.
        </p>

        <button
          onClick={handleRegisterMpesaC2BUrls}
          disabled={mpesaBusy}
          className="w-full rounded-full py-2.5 text-sm font-bold border"
          style={{
            borderColor: EKARI.forest,
            color: EKARI.forest,
            backgroundColor: "transparent",
            opacity: mpesaBusy ? 0.7 : 1,
          }}
        >
          {mpesaBusy ? "Registering…" : "Register M-Pesa C2B URLs"}
        </button>

        {mpesaResult && (
          <div className="mt-1 text-xs break-all whitespace-pre-wrap" style={{ color: "#4B5563" }}>
            {mpesaResult}
          </div>
        )}
*/}
        {/* Divider */}
        <div className="pt-2">
          <div className="h-px w-full" style={{ backgroundColor: EKARI.hair }} />
        </div>

        <h2 className="text-sm font-extrabold" style={{ color: EKARI.text }}>
          Test Tools
        </h2>
        <p className="text-xs" style={{ color: "#6B7280" }}>
          These require <strong>admin=true</strong>. If you just granted the claim, the buttons will force-refresh your
          token automatically.
        </p>

        {/* ✅ NEW: B2C test */}
        <button
          onClick={handleTestB2C}
          disabled={b2cBusy}
          className="w-full rounded-full py-2.5 text-sm font-bold"
          style={{
            backgroundColor: EKARI.forest,
            color: EKARI.sand,
            opacity: b2cBusy ? 0.7 : 1,
          }}
        >
          {b2cBusy ? "Testing B2C…" : "Test B2C (KES 10 → 0728820092)"}
        </button>

        {b2cResult && (
          <div className="mt-1 text-xs break-all whitespace-pre-wrap" style={{ color: "#4B5563" }}>
            {b2cResult}
          </div>
        )}

        {/* Push test 
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
          <div className="mt-1 text-xs break-all whitespace-pre-wrap" style={{ color: "#4B5563" }}>
            {pushResult}
          </div>
        )}
*/}
        {/* Email test 
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
            <div className="mt-1 text-xs break-all whitespace-pre-wrap" style={{ color: "#4B5563" }}>
              {emailResult}
            </div>
          )}
        </div>
*/}
        {/* Divider 
        <div className="pt-4">
          <div className="h-px w-full" style={{ backgroundColor: EKARI.hair }} />
        </div>

        <h2 className="text-sm font-extrabold" style={{ color: EKARI.text }}>
          Maintenance
        </h2>
        <p className="text-xs" style={{ color: "#6B7280" }}>
          Runs the <strong>backfillMarketListings</strong> callable in batches until it reports <code>done=true</code>.
        </p>

        <button
          onClick={handleBackfillMarketListings}
          disabled={backfillBusy}
          className="w-full rounded-full py-2.5 text-sm font-bold border"
          style={{
            borderColor: EKARI.forest,
            color: EKARI.forest,
            backgroundColor: "transparent",
            opacity: backfillBusy ? 0.7 : 1,
          }}
        >
          {backfillBusy ? "Backfilling…" : "Backfill Market Listings"}
        </button>

        {backfillResult && (
          <div className="mt-1 text-xs break-all whitespace-pre-wrap" style={{ color: "#4B5563" }}>
            {backfillResult}
          </div>
        )}*/}
      </div>
    </div>
  );
}