// app/admin/wallets/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
  DocumentData,
  doc,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, app } from "@/lib/firebase";
import Link from "next/link";
import Image from "next/image";
import { ConfirmModalWithdraw } from "@/app/components/ConfirmModalWithdraw";

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  ink: "#111827",
  dim: "#6B7280",
  hair: "#E5E7EB",
  bgSoft: "#F3F4F6",
};

type WithdrawalStatus = "pending" | "approved" | "rejected";

/**
 * ✅ payout methods:
 * - mpesa = automated B2C (KES ONLY)
 * - bank = MANUAL deposit (use user preferred currency; no destinationId needed)
 * - manual = any other manual settlement (use user preferred currency)
 */
type PayoutMethod = "mpesa" | "bank";
type SettlementCurrency = "KES" | "USD";

type WithdrawalRequest = {
  id: string;
  creatorId: string;

  // ✅ stored in BASE currency (you said USD is base)
  amount: number; // minor units
  currency: string; // base currency stored in request, eg "USD"

  status: WithdrawalStatus;
  requestedAt?: any;
  processedAt?: any;
  processedBy?: string;

  payoutRef?: string | null;
  payoutMethod?: PayoutMethod | null;
  mpesaReceiptCode?: string | null;
  note?: string | null;

  payoutStatus?: "queued" | "success" | "failed" | "timeout" | null;

  settlementCurrency?: SettlementCurrency | null;

  destinationId?: string | null;

  feeMinor?: number | null;
  netMinor?: number | null;

  creatorSettlementSnapshot?: any;
};

type CreatorLite = {
  handle?: string | null;
  photoURL?: string | null;
  phone?: string | null;

  // ✅ UPDATED: include preferred currency
  settlement?: {
    enabled?: boolean;
    method?: "mpesa" | "bank";
    currency?: SettlementCurrency; // ✅ user preference currency for BANK/MANUAL (USD or KES)
    mpesa?: { phone?: string | null; accountName?: string | null };
    bank?: {
      bankName?: string | null;
      accountName?: string | null;
      accountNumber?: string | null;
      branchName?: string | null;
      payoutMode?: "manual" | string | null;
    };
  } | null;
};

type MpesaShortcodeState = {
  shortcode?: string | null;
  balanceKesMinor?: number;
  lastC2BAt?: any;
  lastB2CAt?: any;
  updatedAt?: any;
};

type MpesaC2BTopup = {
  id: string;
  transId?: string;
  amountKesMinor?: number;
  msisdn?: string | null;
  billRefNumber?: string | null;
  transTime?: string | null;
  businessShortCode?: string | null;
  createdAt?: any;
};

type MpesaB2CLog = {
  id: string;
  requestId?: string | null;
  creatorId?: string | null;
  phone?: string | null;
  amountKesMinor?: number;
  status?: "queued" | "success" | "failed" | "timeout" | string;
  mpesaReceipt?: string | null;
  resultCode?: number | null;
  resultDesc?: string | null;
  createdAt?: any;
  updatedAt?: any;
};

type FinanceSettings = {
  usdToKesRate?: number; // e.g. 130
};

function formatDate(v: any) {
  if (!v) return "";
  if (v.toDate) return v.toDate().toLocaleString();
  if (typeof v === "string") return v;
  return "";
}

function formatKesMinor(v?: number) {
  const n = typeof v === "number" ? v : 0;
  return `KSh ${(n / 100).toFixed(2)}`;
}

function formatMoneyMinor(currency: string, minor?: number) {
  const n = typeof minor === "number" ? minor : 0;
  const cur = String(currency || "").toUpperCase();
  const major = n / 100;

  if (cur === "KES") return `KSh ${major.toFixed(2)}`;
  if (cur === "USD") return `$${major.toFixed(2)}`;
  return `${cur} ${major.toFixed(2)}`;
}

function onlyCurrency(v: any): SettlementCurrency {
  const x = String(v || "").toUpperCase();
  return x === "KES" ? "KES" : "USD";
}

function normalizeMsisdnKE(input: string) {
  const raw = String(input || "").trim().replace(/\s+/g, "");
  if (!raw) return "";
  let x = raw;
  if (x.startsWith("+")) x = x.slice(1);

  if (/^0[71]\d{8}$/.test(x)) return "254" + x.slice(1);
  if (/^254[71]\d{8}$/.test(x)) return x;

  return "";
}

function cleanStr(v: any) {
  return String(v ?? "").trim().replace(/\s+/g, " ");
}

/** ✅ FX helpers (USD <-> KES) */
function convertUsdMinorToKesMinor(usdMinor: number, usdToKesRate: number) {
  const usdMajor = usdMinor / 100;
  const kesMajor = usdMajor * usdToKesRate;
  return Math.round(kesMajor * 100);
}
function convertKesMinorToUsdMinor(kesMinor: number, usdToKesRate: number) {
  const kesMajor = kesMinor / 100;
  const usdMajor = kesMajor / usdToKesRate;
  return Math.round(usdMajor * 100);
}
function convertMinor(
  amountMinor: number,
  fromCurrency: string,
  toCurrency: "USD" | "KES",
  usdToKesRate: number
) {
  const from = String(fromCurrency || "").toUpperCase();
  if (from === toCurrency) return amountMinor;

  if (from === "USD" && toCurrency === "KES") {
    return convertUsdMinorToKesMinor(amountMinor, usdToKesRate);
  }
  if (from === "KES" && toCurrency === "USD") {
    return convertKesMinorToUsdMinor(amountMinor, usdToKesRate);
  }

  // unknown -> no conversion
  return amountMinor;
}

/**
 * ✅ derive fee + net (in base currency of request)
 * - If backend sets feeMinor/netMinor, we use them.
 * - Else fallback fee=0, net=amount
 */
function deriveFeeNet(req?: WithdrawalRequest | null) {
  const requestedMinor = typeof req?.amount === "number" ? req!.amount : 0;
  const feeMinor = typeof req?.feeMinor === "number" ? req!.feeMinor! : 0;
  const netMinor =
    typeof req?.netMinor === "number"
      ? req!.netMinor!
      : Math.max(0, requestedMinor - feeMinor);
  return { requestedMinor, feeMinor, netMinor };
}

/** Small hook to load creator handle + avatar (and settlement) */
function useCreatorProfile(creatorId?: string): CreatorLite | null {
  const [profile, setProfile] = useState<CreatorLite | null>(null);

  useEffect(() => {
    if (!creatorId) {
      setProfile(null);
      return;
    }
    const ref = doc(db, "users", creatorId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() as any | undefined;
        if (!data) {
          setProfile(null);
          return;
        }
        setProfile({
          handle: data.handle ?? null,
          photoURL: data.photoURL ?? null,
          phone: data.phone ?? data.msisdn ?? data.mpesaPhone ?? null,
          settlement: data.settlement ?? null,
        });
      },
      () => setProfile(null)
    );
    return () => unsub();
  }, [creatorId]);

  return profile;
}

/** ✅ helper: extract settlement pref from snapshot (if present) */
function extractPrefFromSnapshot(snap: any): {
  enabled: boolean;
  method: "mpesa" | "bank";
  currency?: SettlementCurrency; // ✅ preferred currency for bank/manual
  mpesaPhone?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankBranchName?: string;
} {
  const enabled = !!snap?.enabled;
  const method =
    String(snap?.method || "mpesa").toLowerCase() === "bank" ? "bank" : "mpesa";

  const currency =
    snap?.currency != null ? onlyCurrency(snap.currency) : undefined;

  const mpesaPhone = cleanStr(snap?.mpesa?.phone || "");
  const bankName = cleanStr(snap?.bank?.bankName || "");
  const bankAccountName = cleanStr(snap?.bank?.accountName || "");
  const bankAccountNumber = cleanStr(snap?.bank?.accountNumber || "");
  const bankBranchName = cleanStr(snap?.bank?.branchName || "");

  return {
    enabled,
    method,
    currency,
    mpesaPhone: mpesaPhone || undefined,
    bankName: bankName || undefined,
    bankAccountName: bankAccountName || undefined,
    bankAccountNumber: bankAccountNumber || undefined,
    bankBranchName: bankBranchName || undefined,
  };
}

/**
 * ✅ MAIN RULE YOU ASKED FOR:
 * - If method is MPESA => settlement currency MUST be KES, and amount must be converted using FX rate.
 * - If method is BANK/MANUAL => use user's preferred currency (USD or KES). If USD => no conversion.
 */
function getPreferredSettlement(
  req: WithdrawalRequest,
  creator: CreatorLite | null,
  usdToKesRate: number
): {
  method: PayoutMethod;
  currency: SettlementCurrency;
  amountMinor: number; // in settlement currency
  hint: string; // text shown under amount
} {
  const baseCur = String(req.currency || "USD").toUpperCase();
  const baseAmountMinor = typeof req.amount === "number" ? req.amount : 0;

  const snapPref = extractPrefFromSnapshot(req.creatorSettlementSnapshot);
  const profileS = creator?.settlement;

  const enabled =
    req.creatorSettlementSnapshot != null
      ? snapPref.enabled
      : !!profileS?.enabled;

  const methodPref: PayoutMethod =
    enabled
      ? req.creatorSettlementSnapshot != null
        ? (snapPref.method as PayoutMethod)
        : (String(profileS?.method || "mpesa").toLowerCase() === "bank"
          ? "bank"
          : "mpesa")
      : "mpesa";

  // preferred currency applies to bank/manual only
  const prefCurrency: SettlementCurrency =
    req.creatorSettlementSnapshot != null
      ? snapPref.currency ?? "USD"
      : onlyCurrency(profileS?.currency ?? "USD");

  if (methodPref === "mpesa") {
    const kesMinor = convertMinor(baseAmountMinor, baseCur, "KES", usdToKesRate);
    return {
      method: "mpesa",
      currency: "KES",
      amountMinor: kesMinor,
      hint:
        baseCur === "KES"
          ? "MPESA settles in KES"
          : `MPESA settles in KES (FX @ ${usdToKesRate})`,
    };
  }

  // bank/manual: use preferred currency
  const settleCur = prefCurrency;
  const settleMinor = convertMinor(
    baseAmountMinor,
    baseCur,
    settleCur,
    usdToKesRate
  );

  return {
    method: "bank",
    currency: settleCur,
    amountMinor: settleMinor,
    hint:
      settleCur === baseCur
        ? `BANK settles in ${settleCur}`
        : `BANK settles in ${settleCur} (FX @ ${usdToKesRate})`,
  };
}

export default function AdminWalletsPage() {
  const [items, setItems] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupPhone, setTopupPhone] = useState("");
  const [mpesa, setMpesa] = useState<MpesaShortcodeState | null>(null);
  const [topups, setTopups] = useState<MpesaC2BTopup[]>([]);
  const [b2cLogs, setB2cLogs] = useState<MpesaB2CLog[]>([]);
  const [walletTab, setWalletTab] = useState<
    "withdrawals" | "topups" | "disbursements"
  >("withdrawals");

  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("pending");

  const [methodFilter, setMethodFilter] = useState<
    "all" | "mpesa" | "bank"
  >("all");

  const [search, setSearch] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmText, setConfirmText] = useState("Confirm");

  const [pendingReq, setPendingReq] = useState<WithdrawalRequest | null>(null);
  const [pendingDecision, setPendingDecision] = useState<
    "approve" | "reject" | null
  >(null);

  const [approveForm, setApproveForm] = useState<{
    payoutMethod: PayoutMethod;
    settlementCurrency: SettlementCurrency;
    destinationId: string;
    payoutRef: string;

    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
    bankBranchName: string;

    // ✅ new: store computed settlement amount (in settlement currency minor)
    settlementAmountMinor?: number;
    fxRateUsed?: number;
  }>({
    payoutMethod: "mpesa",
    settlementCurrency: "KES",
    destinationId: "",
    payoutRef: "",

    bankName: "",
    bankAccountName: "",
    bankAccountNumber: "",
    bankBranchName: "",
  });

  const [rejectNote, setRejectNote] = useState("");

  const [feedbackModal, setFeedbackModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const openFeedback = (title: string, message: string) => {
    setFeedbackModal({ title, message });
  };

  const [financeSettings, setFinanceSettings] =
    useState<FinanceSettings | null>(null);

  useEffect(() => {
    const ref = doc(db, "adminSettings", "finance");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = (snap.data() as FinanceSettings) || null;
        setFinanceSettings(data);
      },
      () => setFinanceSettings(null)
    );
    return () => unsub();
  }, []);

  const usdToKesRate = useMemo(() => {
    const v = financeSettings?.usdToKesRate;
    return typeof v === "number" && v > 0 ? v : 130;
  }, [financeSettings?.usdToKesRate]);

  // Listen shortcode balance
  useEffect(() => {
    const ref = doc(db, "adminSettings", "mpesa");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setMpesa(null);
          return;
        }
        const data = snap.data() as any;
        setMpesa({
          shortcode: data?.shortcode ?? null,
          balanceKesMinor:
            typeof data?.balanceKesMinor === "number" ? data.balanceKesMinor : 0,
          lastC2BAt: data?.lastC2BAt ?? null,
          lastB2CAt: data?.lastB2CAt ?? null,
          updatedAt: data?.updatedAt ?? null,
        });
      },
      (err) => {
        console.error("Error loading adminSettings/mpesa", err);
        setMpesa(null);
      }
    );
    return () => unsub();
  }, []);

  // Listen topups (C2B)
  useEffect(() => {
    const qy = query(
      collection(db, "mpesaC2B"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rows: MpesaC2BTopup[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as DocumentData),
        })) as any;
        setTopups(rows);
      },
      (err) => {
        console.error("Error loading mpesaC2B", err);
        setTopups([]);
      }
    );
    return () => unsub();
  }, []);

  // Listen B2C logs
  useEffect(() => {
    const qy = query(
      collection(db, "mpesaB2C"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rows: MpesaB2CLog[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as DocumentData),
        })) as any;
        setB2cLogs(rows);
      },
      (err) => {
        console.error("Error loading mpesaB2C", err);
        setB2cLogs([]);
      }
    );
    return () => unsub();
  }, []);

  // Withdrawals list
  useEffect(() => {
    const qy = query(
      collection(db, "withdrawalRequests"),
      orderBy("requestedAt", "desc"),
      limit(100)
    );
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rows: WithdrawalRequest[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as DocumentData),
        })) as any;
        setItems(rows);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading withdrawalRequests", err);
        setItems([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((req) => {
      if (statusFilter !== "all" && req.status !== statusFilter) return false;

      if (methodFilter !== "all") {
        const pm = (req.payoutMethod || "").toLowerCase();
        if (pm !== methodFilter) return false;
      }

      if (!q) return true;

      const snap = req.creatorSettlementSnapshot || {};
      const snapPref = extractPrefFromSnapshot(snap);

      const haystack =
        (req.creatorId || "").toLowerCase() +
        " " +
        (req.id || "").toLowerCase() +
        " " +
        (req.payoutRef || "").toLowerCase() +
        " " +
        (req.mpesaReceiptCode || "").toLowerCase() +
        " " +
        (req.payoutMethod || "").toLowerCase() +
        " " +
        (req.destinationId || "").toLowerCase() +
        " " +
        (snapPref.mpesaPhone || "").toLowerCase() +
        " " +
        (snapPref.bankName || "").toLowerCase() +
        " " +
        (snapPref.bankAccountName || "").toLowerCase() +
        " " +
        (snapPref.bankAccountNumber || "").toLowerCase() +
        " " +
        (snapPref.currency || "").toLowerCase();

      return haystack.includes(q);
    });
  }, [items, statusFilter, methodFilter, search]);

  const openApproveModal = (req: WithdrawalRequest, creator: CreatorLite | null) => {
    setPendingReq(req);
    setPendingDecision("approve");

    const snapPref = extractPrefFromSnapshot(req.creatorSettlementSnapshot);
    const profileS = creator?.settlement;

    const enabled =
      req.creatorSettlementSnapshot != null ? snapPref.enabled : !!profileS?.enabled;

    const methodPref: PayoutMethod =
      enabled
        ? req.creatorSettlementSnapshot != null
          ? (snapPref.method as PayoutMethod)
          : (String(profileS?.method || "mpesa").toLowerCase() === "bank"
            ? "bank"
            : "mpesa")
        : "mpesa";

    const prefCurrency: SettlementCurrency =
      req.creatorSettlementSnapshot != null
        ? snapPref.currency ?? "USD"
        : onlyCurrency(profileS?.currency ?? "USD");

    const mpesaPhone =
      req.creatorSettlementSnapshot != null
        ? snapPref.mpesaPhone || ""
        : String(profileS?.mpesa?.phone || "");

    const bankName =
      req.creatorSettlementSnapshot != null
        ? snapPref.bankName || ""
        : String(profileS?.bank?.bankName || "");

    const bankAccountName =
      req.creatorSettlementSnapshot != null
        ? snapPref.bankAccountName || ""
        : String(profileS?.bank?.accountName || "");

    const bankAccountNumber =
      req.creatorSettlementSnapshot != null
        ? snapPref.bankAccountNumber || ""
        : String(profileS?.bank?.accountNumber || "");

    const bankBranchName =
      req.creatorSettlementSnapshot != null
        ? snapPref.bankBranchName || ""
        : String(profileS?.bank?.branchName || "");

    // ✅ compute default settlement based on your rule
    const pref = getPreferredSettlement(req, creator, usdToKesRate);

    // destinationId only for mpesa phone
    const destinationId = pref.method === "mpesa" ? mpesaPhone : "";

    setApproveForm({
      payoutMethod: pref.method,
      settlementCurrency: pref.currency,
      destinationId,
      payoutRef: "",

      bankName,
      bankAccountName,
      bankAccountNumber,
      bankBranchName,

      settlementAmountMinor: pref.amountMinor,
      fxRateUsed: usdToKesRate,
    });

    setRejectNote("");

    const baseCur = String(req.currency || "USD").toUpperCase();
    const baseRequestedTxt = formatMoneyMinor(baseCur, req.amount);

    const prefLabel = enabled
      ? methodPref === "mpesa"
        ? `Preferred: MPESA (${mpesaPhone || "—"})`
        : `Preferred: BANK (${prefCurrency}) (manual)`
      : "Preferred: Not enabled";

    const settleTxt = formatMoneyMinor(pref.currency, pref.amountMinor);
    const fxLine =
      baseCur !== pref.currency
        ? `\nConverted: ${settleTxt} @ ${usdToKesRate}`
        : "";

    setConfirmTitle("Approve withdrawal");
    //setConfirmMessage(
    //  `Approve withdrawal of ${baseRequestedTxt} for creator ${req.creatorId}?\n\n` +
    //  `${prefLabel}\n\n` +
    // `Settlement method: ${pref.method.toUpperCase()}\n` +
    // `Settlement currency: ${pref.currency}\n` +
    // `Amount to settle: ${settleTxt}${fxLine}\n\n` +
    // `Choose payout method and details below.`
    //);
    setConfirmText("Approve");
    setConfirmOpen(true);
  };

  const openRejectModal = (req: WithdrawalRequest) => {
    const baseCur = String(req.currency || "USD").toUpperCase();
    setPendingReq(req);
    setPendingDecision("reject");

    setRejectNote("");
    setConfirmTitle("Reject withdrawal");
    setConfirmMessage(
      `Reject withdrawal of ${formatMoneyMinor(baseCur, req.amount)} for creator ${req.creatorId
      }?\n\nOptionally include a short reason.`
    );
    setConfirmText("Reject");
    setConfirmOpen(true);
  };

  const validateApproveForm = () => {
    if (pendingDecision !== "approve") return { ok: true as const };

    const m = approveForm.payoutMethod;

    if (m === "mpesa") {
      const phone = normalizeMsisdnKE(approveForm.destinationId);
      if (!phone) {
        return {
          ok: false as const,
          message: "M-Pesa requires a valid phone number (07.. / 01.. / 254..).",
        };
      }
    }

    if (m === "bank") {
      const bankName = cleanStr(approveForm.bankName);
      const accName = cleanStr(approveForm.bankAccountName);
      const accNo = cleanStr(approveForm.bankAccountNumber);

      if (!bankName || !accName || !accNo) {
        return {
          ok: false as const,
          message:
            "Bank (manual) requires Bank name, Account name, and Account number.",
        };
      }
    }

    return { ok: true as const };
  };

  const processDecision = async () => {
    if (!pendingReq || !pendingDecision) return;
    if (actionBusyId) return;

    const req = pendingReq;
    const decision = pendingDecision;

    const payoutMethod: PayoutMethod | undefined =
      decision === "approve" ? approveForm.payoutMethod : undefined;

    // ✅ Enforce your rule here:
    // - mpesa => KES
    // - bank/manual => user's chosen currency (defaulted to preference)
    const settlementCurrency: SettlementCurrency | undefined =
      decision === "approve"
        ? approveForm.payoutMethod === "mpesa"
          ? "KES"
          : approveForm.settlementCurrency
        : undefined;

    const destinationId: string | undefined =
      decision === "approve"
        ? approveForm.payoutMethod === "mpesa"
          ? normalizeMsisdnKE(approveForm.destinationId) || undefined
          : approveForm.destinationId.trim() || undefined
        : undefined;

    const payoutRef: string | undefined =
      decision === "approve" && approveForm.payoutRef.trim()
        ? approveForm.payoutRef.trim()
        : undefined;

    const note: string | undefined =
      decision === "reject" && rejectNote.trim()
        ? rejectNote.trim()
        : decision === "approve" && approveForm.payoutMethod === "bank"
          ? `BANK MANUAL: ${cleanStr(approveForm.bankName)} | ${cleanStr(
            approveForm.bankAccountName
          )} | ${cleanStr(approveForm.bankAccountNumber)}${cleanStr(approveForm.bankBranchName)
            ? ` | Branch: ${cleanStr(approveForm.bankBranchName)}`
            : ""
          }`
          : undefined;

    // ✅ compute settlement amount MINOR based on your rule (send to backend)
    const baseCur = String(req.currency || "USD").toUpperCase();
    const settleCur = settlementCurrency || "USD";
    const computedSettlementMinor = convertMinor(
      req.amount,
      baseCur,
      settleCur,
      usdToKesRate
    );

    try {
      setActionBusyId(`${req.id}:${decision}`);

      const functions = getFunctions(app, "us-central1");
      const processWithdrawalRequest = httpsCallable<
        {
          requestId: string;
          decision: "approve" | "reject";
          payoutMethod?: PayoutMethod;
          payoutRef?: string;
          note?: string;
          settlementCurrency?: SettlementCurrency;
          destinationId?: string;

          // ✅ NEW (safe extra fields):
          settlementAmountMinor?: number; // in settlementCurrency minor
          fxRateUsed?: number;

          bankDetails?: {
            bankName: string;
            accountName: string;
            accountNumber: string;
            branchName?: string;
            payoutMode: "manual";
          };
        },
        { ok: boolean }
      >(functions, "processWithdrawalRequest");

      await processWithdrawalRequest({
        requestId: req.id,
        decision,
        payoutMethod,
        payoutRef,
        note,
        settlementCurrency,
        destinationId,

        // ✅ IMPORTANT: this is what fixes MPESA payout amount (KES)
        settlementAmountMinor: decision === "approve" ? computedSettlementMinor : undefined,
        fxRateUsed: decision === "approve" ? usdToKesRate : undefined,

        bankDetails:
          decision === "approve" && approveForm.payoutMethod === "bank"
            ? {
              bankName: cleanStr(approveForm.bankName),
              accountName: cleanStr(approveForm.bankAccountName),
              accountNumber: cleanStr(approveForm.bankAccountNumber),
              branchName: cleanStr(approveForm.bankBranchName) || undefined,
              payoutMode: "manual",
            }
            : undefined,
      });

      setConfirmOpen(false);
      setPendingReq(null);
      setPendingDecision(null);
    } catch (err: any) {
      console.error("processWithdrawalRequest error", err);
      openFeedback(
        "Unable to process withdrawal",
        err?.message ||
        "Unable to process this withdrawal. Please check logs and try again."
      );
    } finally {
      setActionBusyId(null);
    }
  };

  const mpesaBalanceText = formatKesMinor(mpesa?.balanceKesMinor ?? 0);
  const lowBalance =
    typeof mpesa?.balanceKesMinor === "number" && mpesa.balanceKesMinor < 0;

  const approveValidation = validateApproveForm();

  const confirmDisabled =
    !!actionBusyId ||
    (pendingDecision === "approve" && approveValidation.ok === false);

  return (
    <>
      {/* Shortcode balance + tabs */}
      <div
        className="rounded-3xl bg-white/80 p-4 md:p-5 shadow-sm border mb-4"
        style={{ borderColor: EKARI.hair }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h2
              className="text-sm md:text-base font-extrabold"
              style={{ color: EKARI.ink }}
            >
              M-Pesa Shortcode Wallet
            </h2>
            <p className="text-xs" style={{ color: EKARI.dim }}>
              Realtime ledger balance (C2B adds, B2C subtracts on success).
            </p>
            <p className="text-[11px]" style={{ color: EKARI.dim }}>
              FX: 1 USD ≈ {usdToKesRate} KES
            </p>
          </div>

          <div className="flex flex-col md:items-end gap-1">
            <div className="text-xs" style={{ color: EKARI.dim }}>
              Shortcode:{" "}
              <span className="font-semibold" style={{ color: EKARI.ink }}>
                {mpesa?.shortcode || "—"}
              </span>
            </div>

            <div
              className="text-lg md:text-xl font-extrabold"
              style={{ color: EKARI.ink }}
            >
              {mpesaBalanceText}
            </div>
            <div className="text-[11px]" style={{ color: EKARI.dim }}>
              Last topup: {formatDate(mpesa?.lastC2BAt)}{" "}
              <span className="mx-1">•</span>
              Last payout: {formatDate(mpesa?.lastB2CAt)}
            </div>
            {lowBalance && (
              <div className="text-[11px] font-semibold text-red-600">
                Balance looks invalid (negative). Check ledger logic.
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setTopupAmount("");
                setTopupPhone("");
                setTopupOpen(true);
              }}
              className="mt-2 rounded-full px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:opacity-95"
              style={{ backgroundColor: EKARI.forest }}
            >
              + Top up via M-Pesa (STK Push)
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs">
            {(["withdrawals", "topups", "disbursements"] as const).map((t) => {
              const active = walletTab === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setWalletTab(t)}
                  className={[
                    "px-3 py-1 rounded-full font-semibold transition",
                    active ? "bg-white shadow-sm" : "text-slate-500 hover:bg-white/70",
                  ].join(" ")}
                  style={
                    active ? { color: EKARI.ink } : { color: "rgba(55,65,81,0.9)" }
                  }
                >
                  {t === "withdrawals"
                    ? "Withdrawals"
                    : t === "topups"
                      ? "C2B Topups"
                      : "B2C Disbursements"}
                </button>
              );
            })}
          </div>

          {walletTab === "withdrawals" && (
            <div className="flex flex-col gap-2 md:items-end">
              <div className="flex flex-col md:flex-row gap-2 md:items-center">
                <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs">
                  {(["pending", "approved", "rejected", "all"] as const).map((s) => {
                    const active = statusFilter === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatusFilter(s)}
                        className={[
                          "px-3 py-1 rounded-full font-semibold transition",
                          active ? "bg-white shadow-sm" : "text-slate-500 hover:bg-white/70",
                        ].join(" ")}
                        style={
                          active ? { color: EKARI.ink } : { color: "rgba(55,65,81,0.9)" }
                        }
                      >
                        {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    );
                  })}
                </div>

                <div className="inline-flex rounded-full bg-slate-300 p-1 text-xs">
                  {(["all", "mpesa", "bank"] as const).map((m) => {
                    const active = methodFilter === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMethodFilter(m)}
                        className={[
                          "px-3 py-1 rounded-full font-semibold transition",
                          active ? "bg-white shadow-sm" : "text-slate-500 hover:bg-white/70",
                        ].join(" ")}
                        style={
                          active ? { color: EKARI.ink } : { color: "rgba(55,65,81,0.9)" }
                        }
                      >
                        {m === "all" ? "All methods" : m.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <input
                type="text"
                placeholder="Search by creator UID, request ID, bank name, account…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full md:w-80 rounded-full border px-3 py-1.5 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                style={{ borderColor: EKARI.hair, color: EKARI.ink }}
              />
            </div>
          )}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div
        className="rounded-3xl bg-white/80 p-4 md:p-5 shadow-sm border space-y-4"
        style={{ borderColor: EKARI.hair }}
      >
        {walletTab === "withdrawals" ? (
          <>
            <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-lg md:text-xl font-extrabold" style={{ color: EKARI.ink }}>
                  Creator withdrawals
                </h1>
                <p className="text-xs md:text-sm" style={{ color: EKARI.dim }}>
                  ✅ M-Pesa settles in KES (converted from USD base). ✅ Bank uses user preferred currency.
                </p>
              </div>
            </header>

            {loading ? (
              <div className="flex items-center gap-2 py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-800 border-t-transparent" />
                <p className="text-xs" style={{ color: EKARI.dim }}>
                  Loading withdrawal requests…
                </p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-5 py-6 text-center">
                <p className="mb-1 text-sm font-extrabold" style={{ color: EKARI.ink }}>
                  No matching withdrawal requests
                </p>
                <p className="text-xs md:text-sm" style={{ color: EKARI.dim }}>
                  Try changing the status/method filter or search text.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: EKARI.hair }}>
                      <th className="py-2 pr-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                        Creator
                      </th>
                      <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                        Amount (settlement)
                      </th>
                      <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                      <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                        Requested
                      </th>
                      <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                        Payout ref / method
                      </th>
                      <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                        Processed
                      </th>
                      <th className="py-2 pl-3 text-right font-semibold text-xs uppercase tracking-wide text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((req) => {
                      const isPending = req.status === "pending";
                      const busyApprove = actionBusyId === `${req.id}:approve`;
                      const busyReject = actionBusyId === `${req.id}:reject`;

                      let statusColor = "#F97316";
                      let statusBg = "#FFEDD5";
                      if (req.status === "approved") {
                        statusColor = "#16A34A";
                        statusBg = "#DCFCE7";
                      }
                      if (req.status === "rejected") {
                        statusColor = "#DC2626";
                        statusBg = "#FEE2E2";
                      }

                      return (
                        <WithdrawalRow
                          key={req.id}
                          req={req}
                          usdToKesRate={usdToKesRate}
                          statusColor={statusColor}
                          statusBg={statusBg}
                          isPending={isPending}
                          busyApprove={busyApprove}
                          busyReject={busyReject}
                          onApprove={(r, c) => openApproveModal(r, c)}
                          onReject={() => openRejectModal(req)}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : walletTab === "topups" ? (
          <>
            <header className="flex flex-col gap-1">
              <h3 className="text-base font-extrabold" style={{ color: EKARI.ink }}>
                C2B Topups (Shortcode deposits)
              </h3>
              <p className="text-xs" style={{ color: EKARI.dim }}>
                Confirmed payments received on the shortcode (credits balance immediately).
              </p>
            </header>

            {topups.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-5 py-6 text-center">
                <p className="text-sm font-extrabold" style={{ color: EKARI.ink }}>
                  No topups yet
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: EKARI.hair }}>
                      <th className="py-2 pr-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                        Trans ID
                      </th>
                      <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                        Amount
                      </th>
                      <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                        Phone
                      </th>
                      <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                        Bill Ref
                      </th>
                      <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topups.map((t) => (
                      <tr key={t.id} className="border-b last:border-b-0" style={{ borderColor: EKARI.hair }}>
                        <td className="py-2 pr-3 font-mono text-xs" style={{ color: EKARI.ink }}>
                          {t.transId || t.id}
                        </td>
                        <td className="py-2 px-3 text-xs font-semibold" style={{ color: EKARI.ink }}>
                          {formatKesMinor(t.amountKesMinor)}
                        </td>
                        <td className="py-2 px-3 text-xs" style={{ color: EKARI.dim }}>
                          {t.msisdn || "—"}
                        </td>
                        <td className="py-2 px-3 text-xs" style={{ color: EKARI.dim }}>
                          {t.billRefNumber || "—"}
                        </td>
                        <td className="py-2 px-3 text-xs" style={{ color: EKARI.dim }}>
                          {formatDate(t.createdAt) || t.transTime || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            <header className="flex flex-col gap-1">
              <h3 className="text-base font-extrabold" style={{ color: EKARI.ink }}>
                B2C Disbursements (Withdraw payouts)
              </h3>
              <p className="text-xs" style={{ color: EKARI.dim }}>
                These are payouts sent via B2C. Balance is reduced only when result = success.
              </p>
            </header>

            {b2cLogs.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-5 py-6 text-center">
                <p className="text-sm font-extrabold" style={{ color: EKARI.ink }}>
                  No disbursements yet
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: EKARI.hair }}>
                      <th className="py-2 pr-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                      <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                        Amount
                      </th>
                      <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                        Phone
                      </th>
                      <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                        Receipt
                      </th>
                      <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                        Request / Ref
                      </th>
                      <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                        Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {b2cLogs.map((r) => {
                      const s = String(r.status || "queued").toLowerCase();
                      const badge =
                        s === "success"
                          ? { bg: "#DCFCE7", fg: "#16A34A" }
                          : s === "failed" || s === "timeout"
                            ? { bg: "#FEE2E2", fg: "#DC2626" }
                            : { bg: "#FFEDD5", fg: "#F97316" };

                      return (
                        <tr key={r.id} className="border-b last:border-b-0" style={{ borderColor: EKARI.hair }}>
                          <td className="py-2 pr-3">
                            <span
                              className="inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-semibold"
                              style={{ backgroundColor: badge.bg, color: badge.fg }}
                            >
                              {String(r.status || "queued").toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-xs font-semibold" style={{ color: EKARI.ink }}>
                            {formatKesMinor(r.amountKesMinor)}
                          </td>
                          <td className="py-2 px-3 text-xs" style={{ color: EKARI.dim }}>
                            {r.phone || "—"}
                          </td>
                          <td className="py-2 px-3 text-xs font-mono" style={{ color: EKARI.ink }}>
                            {r.mpesaReceipt || "—"}
                          </td>
                          <td className="py-2 px-3 text-xs" style={{ color: EKARI.dim }}>
                            <div className="flex flex-col">
                              {r.requestId ? (
                                <span className="font-mono text-[11px]">{r.requestId}</span>
                              ) : (
                                <span className="text-[11px] font-mono">{r.id}</span>
                              )}
                              {(r.resultDesc || r.resultCode !== undefined) && (
                                <span className="text-[10px] text-slate-500">
                                  {r.resultCode ?? ""} {r.resultDesc ?? ""}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-xs" style={{ color: EKARI.dim }}>
                            {formatDate(r.updatedAt) || formatDate(r.createdAt) || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Approve/Reject modal */}
      <ConfirmModalWithdraw
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        confirmText={confirmText}
        cancelText="Cancel"
        confirmDisabled={confirmDisabled}
        onCancel={() => {
          if (actionBusyId) return;
          setConfirmOpen(false);
          setPendingReq(null);
          setPendingDecision(null);
        }}
        onConfirm={() => {
          if (actionBusyId) return;
          void processDecision();
        }}
      >
        {pendingDecision === "approve" ? (
          <div className="space-y-4">
            {/* Top alert (only when needed) */}
            {!approveValidation.ok && (
              <div
                className="rounded-2xl border px-4 py-3 text-xs bg-red-50 text-red-700"
                style={{ borderColor: "#FCA5A5" }}
              >
                {approveValidation.message}
              </div>
            )}

            {/* Compact settlement summary */}
            {pendingReq && (
              <div
                className="rounded-3xl border bg-white p-4"
                style={{ borderColor: EKARI.hair }}
              >
                {(() => {
                  const { requestedMinor, feeMinor, netMinor } = deriveFeeNet(pendingReq);
                  const baseCur = String(pendingReq.currency || "USD").toUpperCase();

                  const settleCur: SettlementCurrency =
                    approveForm.payoutMethod === "mpesa" ? "KES" : approveForm.settlementCurrency;

                  const requestedSettleMinor = convertMinor(requestedMinor, baseCur, settleCur, usdToKesRate);
                  const feeSettleMinor = convertMinor(feeMinor, baseCur, settleCur, usdToKesRate);
                  const netSettleMinor = convertMinor(netMinor, baseCur, settleCur, usdToKesRate);

                  const showFx = baseCur !== settleCur;

                  return (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold text-slate-500">To settle</p>
                          <p className="text-xl md:text-2xl font-extrabold" style={{ color: EKARI.ink }}>
                            {formatMoneyMinor(settleCur, netSettleMinor)}
                          </p>

                          {showFx ? (
                            <p className="mt-1 text-[11px] text-slate-500">
                              Converted from {formatMoneyMinor(baseCur, requestedMinor)} @ {usdToKesRate}
                            </p>
                          ) : (
                            <p className="mt-1 text-[11px] text-slate-500">
                              Base: {formatMoneyMinor(baseCur, requestedMinor)}
                            </p>
                          )}
                        </div>

                        <span
                          className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold"
                          style={{
                            backgroundColor: approveForm.payoutMethod === "mpesa" ? "#ECFDF5" : "#EFF6FF",
                            color: approveForm.payoutMethod === "mpesa" ? "#047857" : "#1D4ED8",
                          }}
                        >
                          {approveForm.payoutMethod === "mpesa" ? "MPESA • KES" : `BANK • ${approveForm.settlementCurrency}`}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-[11px] text-slate-500">Requested</p>
                          <p className="text-sm font-extrabold text-slate-900">
                            {formatMoneyMinor(settleCur, requestedSettleMinor)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-[11px] text-slate-500">Fee</p>
                          <p className="text-sm font-extrabold text-slate-900">
                            {formatMoneyMinor(settleCur, feeSettleMinor)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Form sections */}
            <div className="rounded-3xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-extrabold" style={{ color: EKARI.ink }}>
                  Settlement method
                </p>
                <p className="text-[11px] text-slate-500">
                  {approveForm.payoutMethod === "mpesa" ? "Auto payout (B2C)" : "Manual deposit"}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Method */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Method</label>
                  <select
                    value={approveForm.payoutMethod}
                    onChange={(e) => {
                      const m = e.target.value as PayoutMethod;
                      setApproveForm((p) => ({
                        ...p,
                        payoutMethod: m,
                        settlementCurrency: m === "mpesa" ? "KES" : p.settlementCurrency,
                        destinationId: "",
                        payoutRef: "",
                      }));
                    }}
                    className="w-full rounded-2xl border px-3 py-2 text-sm bg-white"
                    style={{ borderColor: EKARI.hair }}
                  >
                    <option value="mpesa">M-Pesa (B2C • KES only)</option>
                    <option value="bank">Bank (Manual deposit)</option>
                  </select>
                </div>

                {/* Currency (only bank) */}
                {approveForm.payoutMethod === "bank" ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Settlement currency
                    </label>
                    <select
                      value={approveForm.settlementCurrency}
                      onChange={(e) =>
                        setApproveForm((p) => ({
                          ...p,
                          settlementCurrency: e.target.value as SettlementCurrency,
                        }))
                      }
                      className="w-full rounded-2xl border px-3 py-2 text-sm bg-white"
                      style={{ borderColor: EKARI.hair }}
                    >
                      <option value="USD">USD</option>
                      <option value="KES">KES</option>
                    </select>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-50 border px-3 py-2" style={{ borderColor: EKARI.hair }}>
                    <p className="text-[11px] font-bold text-slate-600">Settlement currency</p>
                    <p className="text-sm font-extrabold text-slate-900">KES</p>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="my-4 h-px bg-slate-100" />

              {/* Details */}
              {approveForm.payoutMethod === "mpesa" ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    M-Pesa phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={approveForm.destinationId}
                    onChange={(e) => setApproveForm((p) => ({ ...p, destinationId: e.target.value }))}
                    placeholder='e.g. 0712345678'
                    className="w-full rounded-2xl border px-3 py-2 text-sm"
                    style={{ borderColor: EKARI.hair }}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    This is the number that will receive the B2C payout.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Bank name <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={approveForm.bankName}
                      onChange={(e) => setApproveForm((p) => ({ ...p, bankName: e.target.value }))}
                      className="w-full rounded-2xl border px-3 py-2 text-sm"
                      style={{ borderColor: EKARI.hair }}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Account number <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={approveForm.bankAccountNumber}
                      onChange={(e) => setApproveForm((p) => ({ ...p, bankAccountNumber: e.target.value }))}
                      className="w-full rounded-2xl border px-3 py-2 text-sm"
                      style={{ borderColor: EKARI.hair }}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Account name <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={approveForm.bankAccountName}
                      onChange={(e) => setApproveForm((p) => ({ ...p, bankAccountName: e.target.value }))}
                      className="w-full rounded-2xl border px-3 py-2 text-sm"
                      style={{ borderColor: EKARI.hair }}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Branch (optional)
                    </label>
                    <input
                      value={approveForm.bankBranchName}
                      onChange={(e) => setApproveForm((p) => ({ ...p, bankBranchName: e.target.value }))}
                      className="w-full rounded-2xl border px-3 py-2 text-sm"
                      style={{ borderColor: EKARI.hair }}
                    />
                  </div>
                </div>
              )}

              {/* Optional reference */}
              <div className="mt-4">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Reference / Receipt (optional)
                </label>
                <input
                  value={approveForm.payoutRef}
                  onChange={(e) => setApproveForm((p) => ({ ...p, payoutRef: e.target.value }))}
                  className="w-full rounded-2xl border px-3 py-2 text-sm"
                  style={{ borderColor: EKARI.hair }}
                />
              </div>
            </div>
          </div>
        ) : pendingDecision === "reject" ? (
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Reject reason (optional)
            </label>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className="w-full rounded-2xl border px-3 py-2 text-sm min-h-[120px]"
              style={{ borderColor: EKARI.hair }}
            />
          </div>
        ) : null}
      </ConfirmModalWithdraw>
      <ConfirmModalWithdraw
        open={topupOpen}
        title="Top up shortcode wallet"
        message="Enter amount (KES) and a phone number to receive an STK push. After payment, the balance will update automatically via C2B confirmation."
        confirmText={topupBusy ? "Sending..." : "Send STK Push"}
        cancelText="Cancel"
        confirmDisabled={topupBusy}
        onCancel={() => {
          if (topupBusy) return;
          setTopupOpen(false);
        }}
        onConfirm={async () => {
          if (topupBusy) return;

          const amount = Number(topupAmount);
          const phone = normalizeMsisdnKE(topupPhone);

          if (!amount || amount <= 0) {
            openFeedback("Invalid amount", "Enter a valid amount in KES (e.g. 1000).");
            return;
          }
          if (!phone) {
            openFeedback("Invalid phone", "Enter a valid phone (07.. / 01.. / 254..).");
            return;
          }

          try {
            setTopupBusy(true);
            const functions = getFunctions(app, "us-central1");

            const adminStartC2BTopupStk = httpsCallable<
              { amount: number; phone: string; accountRef?: string },
              { ok: boolean; message?: string; checkoutRequestId?: string }
            >(functions, "adminStartC2BTopupStk");

            const r = await adminStartC2BTopupStk({
              amount: Math.round(amount),
              phone,
              accountRef: "EKARI_TOPUP",
            });

            setTopupOpen(false);
            openFeedback("STK sent", r.data?.message || "STK push sent. Ask the user to enter PIN.");
          } catch (err: any) {
            console.error(err);
            openFeedback("Topup failed", err?.message || "Unable to send STK push.");
          } finally {
            setTopupBusy(false);
          }
        }}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Amount (KES)</label>
            <input
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
              placeholder="e.g. 1000"
              type="number"
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: EKARI.hair }}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Phone to prompt (STK)</label>
            <input
              value={topupPhone}
              onChange={(e) => setTopupPhone(e.target.value)}
              placeholder='e.g. "0712345678"'
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: EKARI.hair }}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              The phone will receive the PIN prompt. Payment credits the shortcode wallet via C2B confirmation.
            </p>
          </div>
        </div>
      </ConfirmModalWithdraw>
      <ConfirmModalWithdraw
        open={!!feedbackModal}
        title={feedbackModal?.title || ""}
        message={feedbackModal?.message || ""}
        confirmText="OK"
        cancelText={null}
        onConfirm={() => setFeedbackModal(null)}
        onCancel={() => setFeedbackModal(null)}
      />
    </>
  );
}

function WithdrawalRow(props: {
  req: WithdrawalRequest;
  usdToKesRate: number;
  statusColor: string;
  statusBg: string;
  isPending: boolean;
  busyApprove: boolean;
  busyReject: boolean;
  onApprove: (req: WithdrawalRequest, creator: CreatorLite | null) => void;
  onReject: () => void;
}) {
  const {
    req,
    usdToKesRate,
    statusColor,
    statusBg,
    isPending,
    busyApprove,
    busyReject,
    onApprove,
    onReject,
  } = props;

  const creator = useCreatorProfile(req.creatorId);

  const displayHandle =
    creator?.handle && typeof creator.handle === "string" ? creator.handle : null;

  const initialId = req.creatorId?.slice(0, 6) || "creator";

  // ✅ show preference (prefer snapshot if present)
  const snapPref = extractPrefFromSnapshot(req.creatorSettlementSnapshot);
  const prefEnabled =
    req.creatorSettlementSnapshot != null
      ? snapPref.enabled
      : !!creator?.settlement?.enabled;

  const prefMethod =
    req.creatorSettlementSnapshot != null
      ? snapPref.method
      : (String(creator?.settlement?.method || "mpesa").toLowerCase() === "bank"
        ? "bank"
        : "mpesa");

  const prefCurrency =
    req.creatorSettlementSnapshot != null
      ? snapPref.currency ?? "USD"
      : onlyCurrency(creator?.settlement?.currency ?? "USD");

  // ✅ settlement display amount based on your rule
  const baseCur = String(req.currency || "USD").toUpperCase();
  const settleCur: SettlementCurrency =
    prefMethod === "mpesa" ? "KES" : prefCurrency;

  const settleMinor = convertMinor(req.amount, baseCur, settleCur, usdToKesRate);

  return (
    <tr className="border-b last:border-b-0" style={{ borderColor: EKARI.hair }}>
      <td className="py-2 pr-3 align-top">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
            {creator?.photoURL ? (
              <Image
                src={creator.photoURL}
                alt={displayHandle ?? initialId}
                width={32}
                height={32}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{initialId.toUpperCase()}</span>
            )}
          </div>

          <div className="flex flex-col">
            {displayHandle ? (
              <Link
                href={`/${displayHandle}`}
                className="text-xs font-semibold text-emerald-700 hover:underline"
              >
                {displayHandle}
              </Link>
            ) : (
              <span className="text-xs font-semibold text-slate-800">{initialId}…</span>
            )}

            <span className="text-[10px] text-slate-500" title={req.creatorId}>
              {req.creatorId.slice(0, 12)}…
            </span>

            {prefEnabled ? (
              <span className="mt-0.5 text-[10px] text-slate-500">
                Pref: {String(prefMethod).toUpperCase()}
                {prefMethod === "bank" ? ` • ${prefCurrency}` : ""}
              </span>
            ) : (
              <span className="mt-0.5 text-[10px] text-slate-400">Pref: —</span>
            )}
          </div>
        </div>
      </td>

      <td className="py-2 px-3 align-top">
        <div className="flex flex-col">
          <span className="font-semibold" style={{ color: EKARI.ink }}>
            {formatMoneyMinor(settleCur, settleMinor)}
          </span>

          {/* show base beneath if converted */}
          {baseCur !== settleCur && (
            <span className="text-[10px] text-slate-500">
              Base: {formatMoneyMinor(baseCur, req.amount)} @ {usdToKesRate}
            </span>
          )}
        </div>
      </td>

      <td className="py-2 px-3 align-top">
        <span
          className="inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-semibold"
          style={{ backgroundColor: statusBg, color: statusColor }}
        >
          {req.status.toUpperCase()}
        </span>
        {req.payoutStatus && (
          <div className="mt-1 text-[10px] text-slate-500">
            Payout: {String(req.payoutStatus).toUpperCase()}
          </div>
        )}
      </td>

      <td className="py-2 px-3 align-top">
        <span className="text-xs" style={{ color: EKARI.dim }}>
          {formatDate(req.requestedAt)}
        </span>
      </td>

      <td className="py-2 px-3 align-top">
        <div className="flex flex-col gap-0.5">
          {req.payoutRef && (
            <span className="text-xs font-mono" style={{ color: EKARI.ink }}>
              {req.payoutRef}
            </span>
          )}
          {req.mpesaReceiptCode && (
            <span className="text-xs font-mono" style={{ color: EKARI.ink }}>
              Receipt: {req.mpesaReceiptCode}
            </span>
          )}
          {req.payoutMethod && (
            <span className="text-[10px] text-slate-500">
              Method: {req.payoutMethod.toUpperCase()}
            </span>
          )}
          {req.settlementCurrency && (
            <span className="text-[10px] text-slate-500">
              Settle: {req.settlementCurrency}
            </span>
          )}
          {req.destinationId && (
            <span className="text-[10px] text-slate-500">Dest: {req.destinationId}</span>
          )}
          {req.note && <span className="text-[10px] text-slate-500">Note: {req.note}</span>}
        </div>
      </td>

      <td className="py-2 px-3 align-top">
        {req.processedAt ? (
          <span className="text-xs" style={{ color: EKARI.dim }}>
            {formatDate(req.processedAt)}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>

      <td className="py-2 pl-3 align-top text-right">
        {isPending ? (
          <div className="inline-flex gap-2">
            <button
              type="button"
              disabled={busyApprove}
              onClick={() => onApprove(req, creator)}
              className={[
                "rounded-full px-3 py-1 text-xs font-semibold",
                "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              {busyApprove ? "Approving…" : "Approve"}
            </button>
            <button
              type="button"
              disabled={busyReject}
              onClick={onReject}
              className={[
                "rounded-full px-3 py-1 text-xs font-semibold",
                "bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              {busyReject ? "Rejecting…" : "Reject"}
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400">Processed</span>
        )}
      </td>
    </tr>
  );
}