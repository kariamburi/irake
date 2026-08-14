"use client";

import React, { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getAuth, onIdTokenChanged, User as FirebaseUser } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

import { app, db } from "@/lib/firebase";
import AppShell from "@/app/components/AppShell";
import { ConfirmModal } from "@/app/components/ConfirmModal";
import { createPortal } from "react-dom";
import {
  IoArrowBack,
  IoBagHandleOutline,
  IoCheckmarkCircleOutline,
  IoCloseOutline,
  IoFlashOutline,
  IoGridOutline,
  IoInformationCircleOutline,
  IoRocketOutline,
  IoStarOutline,
  IoWalletOutline,
} from "react-icons/io5";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

const EKARI = {
  forest: "#173C2E",
  forestSoft: "#214C3A",
  gold: "#F39A22",
  sand: "#F8F7F2",
  paper: "#FBFAF6",
  text: "#0F172A",
  dim: "#64748B",
  hair: "#DDD8CC",
};

type PreferredCurrency = "USD" | "KES";
type BillingCycle = "monthly" | "yearly";
type PayMethod = "wallet" | "paystack";

type FinanceSettings = {
  usdToKesRate?: number; // e.g. 130
};

type WalletDoc = {
  pendingBalance?: number; // USD minor (cents)
};

type PackageDoc = {
  id: string;
  name: string;
  target: string;
  priceMonthlyUsd: number;
  yearlyDiscountPct?: number;
  priceYearlyUsd: number;
  activeListingsLimit: number | null;
  recommended?: boolean;
  priorityRanking: boolean;
  topOfSearch: boolean;
  verifiedBadge: boolean;
  storefront: boolean;
  analyticsLevel: "none" | "basic" | "advanced";
  monthlyBoostCredits: number;
  weeklyFeaturedCredits: number;
  status: "active" | "disabled";
  features: string[];
  sortOrder: number;
};

type SellerSubscription = {
  packageId: string;
  billingCycle: BillingCycle;
  status: "active" | "trialing" | "expired" | "canceled";
  currentPeriodEnd?: any;
  packageName?: string;
  // ✅ new canonical
  credits?: {
    boostMonthKey?: string;
    featuredWeekKey?: string;
    boostCreditsRemaining?: number;
    featuredCreditsRemaining?: number;
  };

  // (optional legacy)
  boostCreditsRemaining?: number;
  featuredCreditsRemaining?: number;
};


type FeedbackModalState =
  | { title: string; message: string; closeOnConfirm?: boolean }
  | null;

/* ===================== helpers ===================== */

function usd(n: number | null | undefined) {
  if (typeof n !== "number") return "—";
  return `$${n.toLocaleString("en-US")}`;
}
function kes(n: number | null | undefined) {
  if (typeof n !== "number") return "—";
  return `KSh ${Math.round(n).toLocaleString("en-KE")}`;
}
function cap(n: number) {
  return Number.isFinite(n) ? n : 0;
}

function useMediaQuery(queryStr: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(queryStr);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [queryStr]);
  return matches;
}
function useIsDesktop() {
  return useMediaQuery("(min-width: 1024px)");
}
function useIsMobile() {
  return useMediaQuery("(max-width: 1023px)");
}
function getSubEndMs(sub: SellerSubscription | null | undefined) {
  return (
    (sub as any)?.currentPeriodEnd?.toMillis?.() ??
    (sub as any)?.current_period_end?.toMillis?.() ??
    (sub as any)?.endAt?.toMillis?.() ??
    0
  );
}

function isSubCurrentlyActive(sub: SellerSubscription | null | undefined) {
  if (!sub) return false;

  const status = String(sub.status || "").toLowerCase();
  const statusOk = status === "active" || status === "trialing";
  const endMs = getSubEndMs(sub);

  return statusOk && endMs > Date.now();
}

function getDisplayPlanStatus(sub: SellerSubscription | null | undefined) {
  if (!sub) return "inactive";

  const status = String(sub.status || "").toLowerCase();
  const endMs = getSubEndMs(sub);

  if ((status === "active" || status === "trialing") && endMs > Date.now()) {
    return status;
  }

  if (status === "canceled") return "canceled";
  if (status === "expired") return "expired";

  if ((status === "active" || status === "trialing") && endMs <= Date.now()) {
    return "expired";
  }

  return status || "inactive";
}
function tierPill(name: string) {
  const n = (name || "").toLowerCase();
  if (n.includes("silver")) return { bg: "#F3F4F6", fg: "#111827", ring: "#E5E7EB" };
  if (n.includes("gold")) return { bg: "#FFF7ED", fg: "#9A3412", ring: "#FED7AA" };
  if (n.includes("platinum")) return { bg: "#EEF2FF", fg: "#3730A3", ring: "#C7D2FE" };
  return { bg: "#F8FAFC", fg: "#0F172A", ring: "#E2E8F0" };
}

function badgeClasses(kind: string) {
  if (kind === "active") return "bg-emerald-50 text-emerald-800";
  if (kind === "trialing") return "bg-blue-50 text-blue-800";
  if (kind === "expired") return "bg-amber-50 text-amber-800";
  if (kind === "canceled") return "bg-rose-50 text-rose-800";
  return "bg-gray-100 text-gray-700";
}
function fmtAnalytics(a: PackageDoc["analyticsLevel"]) {
  if (a === "none") return "No analytics";
  if (a === "basic") return "Basic analytics";
  return "Advanced analytics";
}

function pickAccent(name: string) {
  const n = (name || "").toLowerCase();
  if (n.includes("platinum")) return { accent: "#4F46E5", soft: "#EEF2FF", ring: "#C7D2FE" };
  if (n.includes("gold")) return { accent: EKARI.gold, soft: "#FFF7ED", ring: "#FED7AA" };
  if (n.includes("silver")) return { accent: "#64748B", soft: "#F1F5F9", ring: "#E2E8F0" };
  return { accent: EKARI.forest, soft: "#ECFDF5", ring: "#BBF7D0" };
}

function checkIcon(color: string) {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full"
      style={{ background: `${color}1A` }}
      aria-hidden="true"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path
          d="M20 6L9 17l-5-5"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/* ===================== toggles ===================== */

function BillingToggle({
  value,
  onChange,
  yearlySaveText,
}: {
  value: BillingCycle;
  onChange: (v: BillingCycle) => void;
  yearlySaveText?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-[#D9D3C7] bg-[#FBFAF6] p-1">
      {(["monthly", "yearly"] as BillingCycle[]).map((option) => {
        const active = value === option;

        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={[
              "rounded-lg px-3 py-2 text-[10px] font-black transition-all",
              active
                ? "bg-[#173C2E] text-white shadow-sm"
                : "text-slate-500 hover:bg-[#F3F1EB] hover:text-slate-800",
            ].join(" ")}
          >
            {option === "monthly" ? "Monthly" : "Yearly"}
          </button>
        );
      })}

      {yearlySaveText ? (
        <span className="ml-1 hidden rounded-full bg-[#FFF4E3] px-2 py-1 text-[9px] font-black text-[#9A5A08] sm:inline-flex">
          {yearlySaveText}
        </span>
      ) : null}
    </div>
  );
}

function CurrencyToggle({
  value,
  onChange,
}: {
  value: PreferredCurrency;
  onChange: (v: PreferredCurrency) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-[#D9D3C7] bg-[#FBFAF6] p-1">
      {(["KES", "USD"] as PreferredCurrency[]).map((option) => {
        const active = value === option;

        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={[
              "rounded-lg px-3 py-2 text-[10px] font-black transition-all",
              active
                ? "bg-[#173C2E] text-white shadow-sm"
                : "text-slate-500 hover:bg-[#F3F1EB] hover:text-slate-800",
            ].join(" ")}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

/* ===================== mobile full screen plan picker ===================== */

function MobilePlanPicker({
  open,
  onClose,
  packages,
  currentPackageId,
  billing,
  onBillingChange,
  currency,
  onCurrencyChange,
  rate,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  packages: PackageDoc[];
  currentPackageId: string | null | undefined;
  billing: BillingCycle;
  onBillingChange: (v: BillingCycle) => void;
  currency: PreferredCurrency;
  onCurrencyChange: (v: PreferredCurrency) => void;
  rate: number;
  onSelect: (pkgId: string) => void;
}) {
  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex flex-col bg-[#F8F7F2]"
    >
      <div
        className="shrink-0 border-b border-[#DDD8CC] bg-[#FBFAF6] px-4 pb-3"
        style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
              Seller packages
            </div>

            <h2 className="mt-1 text-[18px] font-black tracking-[-0.025em] text-slate-900">
              Choose a plan
            </h2>

            <p className="mt-1 text-[10px] font-medium text-slate-400">
              Compare limits, visibility and seller growth tools.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[#D9D3C7] bg-white text-slate-600"
            aria-label="Close plan picker"
          >
            <IoCloseOutline size={17} />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <BillingToggle
            value={billing}
            onChange={onBillingChange}
          />

          <CurrencyToggle
            value={currency}
            onChange={onCurrencyChange}
          />

          <span className="ml-auto text-[9px] font-black text-slate-400">
            {packages.length} plans
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="grid gap-4">
          {packages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              p={pkg}
              isCurrent={pkg.id === currentPackageId}
              billing={billing}
              currency={currency}
              rate={rate}
              onChoose={() => onSelect(pkg.id)}
            />
          ))}
        </div>

        <div style={{ height: "env(safe-area-inset-bottom)" }} />
      </div>
    </motion.div>
  );
}

/* ===================== checkout modal (wallet / paystack) ===================== */

function PlanCheckoutDialogWeb({
  open,
  onClose,
  pkg,
  billing,
  currency,
  rate,
}: {
  open: boolean;
  onClose: () => void;
  pkg: PackageDoc | null;
  billing: BillingCycle;
  currency: PreferredCurrency;
  rate: number;
}) {
  const [loading, setLoading] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod>("paystack");
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletDoc | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>(null);

  useEffect(() => {
    const auth = getAuth(app);
    const unsub = onIdTokenChanged(auth, (u) => setAuthUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authUid) {
      setWallet(null);
      return;
    }
    const ref = doc(db, "wallets", authUid);
    const unsub = onSnapshot(
      ref,
      (snap) => setWallet((snap.data() as WalletDoc) || null),
      () => setWallet(null)
    );
    return () => unsub();
  }, [authUid]);

  const priceUsdMajor = useMemo(() => {
    if (!pkg) return 0;
    return billing === "yearly" ? pkg.priceYearlyUsd : pkg.priceMonthlyUsd;
  }, [pkg, billing]);

  const displayMajor = useMemo(() => {
    if (currency === "USD") return priceUsdMajor;
    return priceUsdMajor * rate;
  }, [priceUsdMajor, currency, rate]);

  const walletUsdMajor = useMemo(
    () => (wallet?.pendingBalance != null ? wallet.pendingBalance / 100 : 0),
    [wallet?.pendingBalance]
  );

  const hasWallet = authUid != null && walletUsdMajor > 0;

  const canUseWallet = useMemo(() => {
    if (!hasWallet) return false;
    if (!pkg) return false;
    return priceUsdMajor <= walletUsdMajor; // wallet is USD-based
  }, [hasWallet, pkg, priceUsdMajor, walletUsdMajor]);

  if (!open || !pkg) return null;

  const handleCheckout = async () => {
    const auth = getAuth(app);
    if (!auth.currentUser) {
      setFeedbackModal({
        title: "Sign in required",
        message: "Please sign in to purchase a plan.",
      });
      return;
    }

    try {
      setLoading(true);

      const functions = getFunctions(app, "us-central1");

      if (payMethod === "wallet") {
        if (!canUseWallet) {
          setFeedbackModal({
            title: "Insufficient wallet balance",
            message:
              "Your wallet balance is not enough for this plan. Choose Paystack or top up your wallet.",
          });
          setLoading(false);
          return;
        }

        const purchasePackageFromWallet = httpsCallable<
          { packageId: string; billingCycle: BillingCycle },
          { ok: boolean; message?: string }
        >(functions, "purchasePackageFromWallet");

        const res = await purchasePackageFromWallet({
          packageId: pkg.id,
          billingCycle: billing,
        });

        if (!res.data.ok) {
          setFeedbackModal({
            title: "Wallet purchase failed",
            message: res.data.message || "We could not complete the wallet purchase. Try again shortly.",
          });
          setLoading(false);
          return;
        }

        setFeedbackModal({
          title: "Plan activated ✅",
          message: "Your subscription was updated successfully.",
          closeOnConfirm: true,
        });
        setLoading(false);
        return;
      }

      const createPackageCheckout = httpsCallable<
        {
          packageId: string;
          billingCycle: BillingCycle;
          currency: PreferredCurrency; // "USD" | "KES"
          source?: "web" | "mobile";
        },
        { checkoutUrl: string; checkoutId?: string }
      >(functions, "createPackageCheckout");

      const res = await createPackageCheckout({
        packageId: pkg.id,
        billingCycle: billing,
        currency,
        source: "web",
      });

      const url = res.data.checkoutUrl;
      if (!url) {
        setFeedbackModal({
          title: "Unable to start checkout",
          message: "We could not start the payment checkout. Try again.",
        });
        setLoading(false);
        return;
      }

      onClose();
      window.location.href = url;
    } catch (err: any) {
      console.error("Package checkout error", err);
      setFeedbackModal({
        title: "Checkout error",
        message: err?.message || "We were unable to start checkout. Please try again shortly.",
      });
      setLoading(false);
    }
  };

  return createPortal(<>
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={() => !loading && onClose()} />
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="w-full max-w-[620px] rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] px-4 pb-5 pt-4 shadow-2xl sm:px-5">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D9D3C7]" />

          <div className="mb-3 flex items-start gap-3">
            <div className="flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
                Upgrade plan
              </p>
              <h2 className="mt-1 text-[18px] font-black tracking-[-0.025em] text-slate-900">
                {pkg.name} — {billing === "yearly" ? "Yearly" : "Monthly"}
              </h2>
              <p className="mt-1 text-xs text-gray-500">{pkg.target}</p>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-xl border border-[#D9D3C7] bg-white text-slate-600 transition hover:bg-[#F3F1EB] disabled:opacity-40"
            >
              ✕
            </button>
          </div>

          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="inline-flex rounded-full bg-slate-100 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setPayMethod("wallet")}
                className={`px-3 py-1 rounded-full font-semibold transition ${payMethod === "wallet" ? "bg-white shadow-sm text-emerald-900" : "text-slate-600"
                  }`}
              >
                From wallet
              </button>
              <button
                type="button"
                onClick={() => setPayMethod("paystack")}
                className={`px-3 py-1 rounded-full font-semibold transition ${payMethod === "paystack" ? "bg-white shadow-sm text-emerald-900" : "text-slate-600"
                  }`}
              >
                Paystack
              </button>
            </div>
          </div>

          {payMethod === "wallet" && (
            <div className="mb-3 rounded-2xl bg-slate-50 px-3 py-2">
              {authUid ? (
                <>
                  <p className="text-[11px] text-gray-600">
                    Wallet balance: <span className="font-semibold">USD {walletUsdMajor.toFixed(2)}</span>
                  </p>
                  {!hasWallet && (
                    <p className="mt-0.5 text-[10px] text-red-500">Your wallet is empty.</p>
                  )}
                  {hasWallet && !canUseWallet && (
                    <p className="mt-0.5 text-[10px] text-red-500">
                      Wallet balance is lower than this plan price.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-gray-600">Sign in to pay from your ekarihub wallet.</p>
              )}
            </div>
          )}

          <div className="rounded-2xl border p-3" style={{ borderColor: EKARI.hair }}>
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-gray-500">Total</div>
              <div className="text-sm font-extrabold" style={{ color: EKARI.text }}>
                {currency === "USD" ? usd(displayMajor) : kes(displayMajor)}{" "}
                <span className="text-xs font-bold text-gray-500">
                  {billing === "yearly" ? "/yr" : "/mo"}
                </span>
              </div>
            </div>
            {billing === "yearly" && pkg.yearlyDiscountPct ? (
              <div className="mt-1 text-[11px]" style={{ color: EKARI.dim }}>
                Includes {pkg.yearlyDiscountPct}% yearly savings.
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading || (payMethod === "wallet" && !canUseWallet)}
            className={[
              "mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-sm transition",
              "bg-[#173C2E] hover:-translate-y-0.5 hover:bg-[#214C3A]",
              (loading || (payMethod === "wallet" && !canUseWallet)) && "opacity-60 cursor-not-allowed",
            ].join(" ")}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Processing…
              </span>
            ) : (
              <>
                ✨ <span>{payMethod === "wallet" ? "Pay from wallet" : "Continue to Paystack"}</span>
              </>
            )}
          </button>

          <p className="mt-2 text-center text-[10px] text-gray-500">
            Payments are processed securely. You can change or cancel later.
          </p>
        </div>
      </div>
    </div>

    <ConfirmModal
      open={!!feedbackModal}
      title={feedbackModal?.title || ""}
      message={feedbackModal?.message || ""}
      confirmText="OK"
      cancelText="Close"
      onConfirm={() => {
        if (feedbackModal?.closeOnConfirm) onClose();
        setFeedbackModal(null);
      }}
      onCancel={() => setFeedbackModal(null)}
    /></>
    ,
    document.body
  )
}



/* ===================== main page ===================== */

export default function SellerDashboardPage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();
  const [packages, setPackages] = useState<PackageDoc[]>([]);
  const [sub, setSub] = useState<SellerSubscription | null>(null);
  const [activePkg, setActivePkg] = useState<PackageDoc | null>(null);

  const [loading, setLoading] = useState(true);
  const isDesktop = useIsDesktop();
  const isMobile = useIsMobile();

  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [currency, setCurrency] = useState<PreferredCurrency>("KES");

  const [finance, setFinance] = useState<FinanceSettings | null>(null);
  const effectiveRate = useMemo(() => {
    const r = finance?.usdToKesRate;
    return typeof r === "number" && r > 0 ? r : 130;
  }, [finance?.usdToKesRate]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutPkg, setCheckoutPkg] = useState<PackageDoc | null>(null);

  // finance settings
  useEffect(() => {
    const ref = doc(db, "adminSettings", "finance");
    const unsub = onSnapshot(
      ref,
      (snap) => setFinance((snap.data() as FinanceSettings) || null),
      (err) => {
        console.error("finance settings error", err);
        setFinance(null);
      }
    );
    return () => unsub();
  }, []);

  // auth
  useEffect(() => {
    const auth = getAuth(app);
    const unsub = onIdTokenChanged(auth, (u) => {
      setUser(u || null);
      setCheckingAuth(false);
    });
    return () => unsub();
  }, []);

  // keep billing in sync with subscription
  useEffect(() => {
    if (sub?.billingCycle) setBilling(sub.billingCycle);
  }, [sub?.billingCycle]);

  // load packages
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const qy = query(
          collection(db, "packages"),
          where("status", "==", "active"),
          orderBy("sortOrder", "asc")
        );
        const snap = await getDocs(qy);
        if (cancelled) return;

        const items: PackageDoc[] = snap.docs.map((d) => {
          const x = d.data() as any;
          return {
            id: d.id,
            name: String(x.name || "Untitled"),
            target: String(x.target || ""),
            priceMonthlyUsd: typeof x.priceMonthlyUsd === "number" ? x.priceMonthlyUsd : 0,
            yearlyDiscountPct: typeof x.yearlyDiscountPct === "number" ? x.yearlyDiscountPct : 0,
            priceYearlyUsd: typeof x.priceYearlyUsd === "number" ? x.priceYearlyUsd : 0,
            activeListingsLimit: typeof x.activeListingsLimit === "number" ? x.activeListingsLimit : null,
            recommended: !!x.recommended,
            priorityRanking: !!x.priorityRanking,
            topOfSearch: !!x.topOfSearch,
            verifiedBadge: !!x.verifiedBadge,
            storefront: !!x.storefront,
            analyticsLevel: (x.analyticsLevel || "none") as PackageDoc["analyticsLevel"],
            monthlyBoostCredits: typeof x.monthlyBoostCredits === "number" ? x.monthlyBoostCredits : 0,
            weeklyFeaturedCredits: typeof x.weeklyFeaturedCredits === "number" ? x.weeklyFeaturedCredits : 0,
            status: (x.status || "active") as any,
            features: Array.isArray(x.features) ? x.features.map(String) : [],
            sortOrder: typeof x.sortOrder === "number" ? x.sortOrder : 10,
          };
        });

        setPackages(items);
      } catch (e) {
        console.error("SellerDashboard packages error", e);
        setPackages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // subscription
  useEffect(() => {
    if (!user) {
      setSub(null);
      return;
    }
    const ref = doc(db, "sellerSubscriptions", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => setSub(snap.exists() ? (snap.data() as any) : null),
      (err) => {
        console.error("sellerSubscriptions snapshot error", err);
        setSub(null);
      }
    );
    return () => unsub();
  }, [user]);

  // load current package doc
  useEffect(() => {
    if (!sub?.packageId) {
      setActivePkg(null);
      return;
    }

    const found = packages.find((p) => p.id === sub.packageId);
    if (found) {
      setActivePkg(found);
      return;
    }

    (async () => {
      try {
        const pSnap = await getDoc(doc(db, "packages", sub.packageId));
        setActivePkg(pSnap.exists() ? ({ id: pSnap.id, ...(pSnap.data() as any) } as any) : null);
      } catch (e) {
        console.error("Load active package error", e);
        setActivePkg(null);
      }
    })();
  }, [sub?.packageId, packages]);

  const computed = useMemo(() => {
    const subActiveNow = isSubCurrentlyActive(sub);
    const pkg = subActiveNow ? activePkg : null;

    const activeListings =
      typeof (sub as any)?.activeListingsCount === "number"
        ? Math.max(0, Number((sub as any).activeListingsCount))
        : 0;

    const limit = subActiveNow ? (pkg?.activeListingsLimit ?? null) : 3;
    const remainingSlots = limit === null ? null : Math.max(0, limit - activeListings);

    const boostsTotal = pkg?.monthlyBoostCredits ?? 0;
    const featuredTotal = pkg?.weeklyFeaturedCredits ?? 0;

    const boostsLeft = subActiveNow
      ? (
        typeof sub?.credits?.boostCreditsRemaining === "number"
          ? sub.credits.boostCreditsRemaining
          : typeof (sub as any)?.boostCreditsRemaining === "number"
            ? (sub as any).boostCreditsRemaining
            : boostsTotal
      )
      : 0;

    const featuredLeft = subActiveNow
      ? (
        typeof sub?.credits?.featuredCreditsRemaining === "number"
          ? sub.credits.featuredCreditsRemaining
          : typeof (sub as any)?.featuredCreditsRemaining === "number"
            ? (sub as any).featuredCreditsRemaining
            : featuredTotal
      )
      : 0;

    const nearLimit =
      typeof limit === "number" && limit > 0
        ? activeListings / limit >= 0.8
        : false;

    return {
      pkg,
      subActiveNow,
      planName: subActiveNow ? (pkg?.name ?? "Paid plan") : (activePkg?.name ?? sub?.packageName ?? "Free"),
      planStatus: getDisplayPlanStatus(sub),
      billingCycle: sub?.billingCycle ?? "monthly",
      activeListings,
      limit,
      remainingSlots,
      boostsLeft: Math.max(0, boostsLeft),
      featuredLeft: Math.max(0, featuredLeft),
      nearLimit,
      expiresAtMs: getSubEndMs(sub),
    };
  }, [activePkg, sub]);

  if (checkingAuth) {
    return <div className="p-6 text-sm" style={{ color: EKARI.dim }}>Loading…</div>;
  }

  if (!user) {
    return (
      <div className="p-6">
        <div className="max-w-md rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: EKARI.hair }}>
          <div className="text-lg font-extrabold" style={{ color: EKARI.text }}>
            Sign in required
          </div>
          <p className="mt-2 text-sm" style={{ color: EKARI.dim }}>
            Please sign in to view your seller dashboard.
          </p>
        </div>
      </div>
    );
  }

  const pill = tierPill(computed.planName);
  const currentPackageId = sub?.packageId ?? null;

  const openCheckoutFor = (pkgId: string) => {
    const p = packages.find((x) => x.id === pkgId) || null;
    setCheckoutPkg(p);
    setCheckoutOpen(true);
  };

  const Header = (
    <motion.header
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="relative shrink-0 overflow-hidden bg-[#173C2E] text-white"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.6) 18px 19px)",
        }}
      />

      <div className="relative mx-auto max-w-[1220px] px-4 py-5 md:px-6 md:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-white transition hover:bg-white/[0.11] active:scale-95"
              aria-label="Go back"
            >
              <IoArrowBack size={19} />
            </button>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#F39A22]">
                ekariMarket seller
              </div>

              <h1 className="mt-1 text-[24px] font-black tracking-[-0.035em] md:text-[28px]">
                Seller packages
              </h1>

              <p className="mt-1 max-w-2xl text-[11px] font-medium leading-5 text-white/50 md:text-[12px]">
                Manage listing capacity, boosts, featured placement, storefront tools and seller growth benefits.
              </p>
              {computed.expiresAtMs > 0 ? (
                <div className="mt-3 text-[9px] font-semibold text-white/35">
                  {computed.billingCycle === "yearly" ? "Yearly" : "Monthly"} billing
                  {" · "}current period ends{" "}
                  {new Date(computed.expiresAtMs).toLocaleDateString()}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-black"
              style={{
                background: pill.bg,
                color: pill.fg,
                borderColor: pill.ring,
              }}
            >
              {computed.planName}
            </span>

            <span
              className={`rounded-full px-2.5 py-1 text-[9px] font-black ${badgeClasses(
                computed.planStatus
              )}`}
            >
              {computed.planStatus}
            </span>
          </div>
        </div>


      </div>
    </motion.header>
  );

  const TopCards = (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card
        icon={<IoGridOutline size={17} />}
        title="Active listings"
        value={
          computed.limit === null
            ? `${computed.activeListings} / ∞`
            : `${computed.activeListings} / ${computed.limit}`
        }
        hint={
          computed.remainingSlots === null
            ? "Unlimited listing capacity"
            : `${computed.remainingSlots} slots remaining`
        }
      />

      <Card
        icon={<IoRocketOutline size={17} />}
        title="Boosts this month"
        value={`${computed.boostsLeft}`}
        hint="Use boosts to improve listing visibility"
      />

      <Card
        icon={<IoStarOutline size={17} />}
        title="Featured this week"
        value={`${computed.featuredLeft}`}
        hint="Premium placement credits available"
      />
    </div>
  );

  const MainContent = (
    <div className="space-y-4">
      {computed.nearLimit ? (
        <motion.div
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <IoInformationCircleOutline
            size={17}
            className="mt-0.5 shrink-0 text-amber-700"
          />

          <div>
            <div className="text-[11px] font-black text-amber-900">
              You’re close to your listing limit
            </div>

            <p className="mt-0.5 text-[10px] font-medium leading-4 text-amber-800">
              Upgrade your package to create more active marketplace listings.
            </p>
          </div>
        </motion.div>
      ) : null}

      <motion.section
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)] sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
              Current plan
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-black text-slate-900">
                {computed.planName}
              </h2>

              <span
                className={`rounded-full px-2 py-0.5 text-[8px] font-black ${badgeClasses(
                  computed.planStatus
                )}`}
              >
                {computed.planStatus}
              </span>
            </div>

            <p className="mt-1 text-[10px] font-medium text-slate-400">
              Benefits are loaded directly from your active package configuration.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              isMobile
                ? setPickerOpen(true)
                : document
                  .getElementById("packages")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  })
            }
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[#173C2E] px-4 text-[10px] font-black text-white transition hover:-translate-y-0.5 hover:bg-[#214C3A]"
          >
            {computed.subActiveNow ? "Change plan" : "Choose plan"}
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Perk
            label="Listings limit"
            value={
              computed.pkg?.activeListingsLimit === null
                ? "Unlimited"
                : String(computed.pkg?.activeListingsLimit ?? "Free tier")
            }
          />

          <Perk
            label="Analytics"
            value={fmtAnalytics(
              computed.pkg?.analyticsLevel ?? "none"
            )}
          />

          <Perk
            label="Priority ranking"
            value={computed.pkg?.priorityRanking ? "Included" : "Not included"}
          />

          <Perk
            label="Top of search"
            value={computed.pkg?.topOfSearch ? "Included" : "Not included"}
          />

          <Perk
            label="Verified seller badge"
            value={computed.pkg?.verifiedBadge ? "Included" : "Not included"}
          />

          <Perk
            label="Storefront"
            value={computed.pkg?.storefront ? "Included" : "Not included"}
          />
        </div>

        {computed.pkg?.features?.length ? (
          <div className="mt-4 border-t border-[#E4DED2] pt-4">
            <div className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
              Included features
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {computed.pkg.features.map((feature, index) => (
                <span
                  key={`${feature}-${index}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#DDD8CC] bg-white px-2.5 py-1 text-[9px] font-bold text-slate-600"
                >
                  <IoCheckmarkCircleOutline
                    size={11}
                    className="text-emerald-600"
                  />
                  {feature}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </motion.section>

      <motion.section
        id="packages"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.03 }}
        className="overflow-hidden rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] shadow-[0_10px_28px_rgba(15,23,42,0.025)]"
      >
        <div className="border-b border-[#E4DED2] px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
                Plans
              </div>

              <h2 className="mt-1 text-[16px] font-black text-slate-900">
                Compare seller packages
              </h2>

              <p className="mt-1 text-[10px] font-medium text-slate-400">
                Choose a package based on listing volume and growth tools.
              </p>
            </div>

            <div className="hidden flex-wrap items-center gap-2 md:flex">
              <BillingToggle
                value={billing}
                onChange={setBilling}
                yearlySaveText="Save with yearly"
              />

              <CurrencyToggle
                value={currency}
                onChange={setCurrency}
              />
            </div>

            {isMobile ? (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="h-9 rounded-xl bg-[#173C2E] px-3 text-[10px] font-black text-white"
              >
                Compare plans
              </button>
            ) : null}
          </div>
        </div>

        <div className="bg-[#F8F7F2] p-4 sm:p-5">
          {packages.length ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {packages.map((pkg) => {
                const isCurrent =
                  computed.subActiveNow &&
                  pkg.id === sub?.packageId;

                return (
                  <PackageCard
                    key={pkg.id}
                    p={pkg}
                    isCurrent={isCurrent}
                    billing={billing}
                    currency={currency}
                    rate={effectiveRate}
                    onChoose={() =>
                      openCheckoutFor(pkg.id)
                    }
                  />
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-[240px] place-items-center text-center">
              <div>
                <IoBagHandleOutline
                  size={28}
                  className="mx-auto text-slate-300"
                />

                <div className="mt-3 text-[13px] font-black text-slate-700">
                  No seller packages available
                </div>

                <p className="mt-1 text-[10px] font-medium text-slate-400">
                  Active packages will appear here.
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );

  const RightRail = (
    <motion.aside
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.24,
        delay: 0.04,
        ease: "easeOut",
      }}
      className="hidden space-y-3 xl:sticky xl:top-4 xl:block"
    >
      <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
        <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
          Subscription
        </div>

        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <div className="text-[16px] font-black text-slate-900">
              {computed.planName}
            </div>

            <div className="mt-1 text-[10px] font-semibold capitalize text-slate-400">
              {computed.billingCycle} billing
            </div>
          </div>

          <span
            className={`rounded-full px-2 py-1 text-[8px] font-black ${badgeClasses(
              computed.planStatus
            )}`}
          >
            {computed.planStatus}
          </span>
        </div>

        {computed.expiresAtMs > 0 ? (
          <div className="mt-3 rounded-xl bg-[#F3F1EB] px-3 py-3">
            <div className="text-[8px] font-black uppercase tracking-[0.08em] text-slate-400">
              Current period ends
            </div>

            <div className="mt-1 text-[11px] font-black text-slate-700">
              {new Date(
                computed.expiresAtMs
              ).toLocaleDateString()}
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E8ECE8] text-[#173C2E]">
            <IoGridOutline size={17} />
          </span>

          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
              Listing capacity
            </div>

            <div className="mt-0.5 text-[13px] font-black text-slate-800">
              {computed.limit === null
                ? `${computed.activeListings} active`
                : `${computed.activeListings} of ${computed.limit}`}
            </div>
          </div>
        </div>

        {computed.limit !== null ? (
          <>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EAE6DD]">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min(
                    100,
                    computed.limit > 0
                      ? (computed.activeListings /
                        computed.limit) *
                      100
                      : 0
                  )}%`,
                }}
                transition={{
                  duration: 0.4,
                  ease: "easeOut",
                }}
                className={[
                  "h-full rounded-full",
                  computed.nearLimit
                    ? "bg-[#F39A22]"
                    : "bg-[#173C2E]",
                ].join(" ")}
              />
            </div>

            <p className="mt-2 text-[9px] font-semibold text-slate-400">
              {computed.remainingSlots} listing slots remaining
            </p>
          </>
        ) : (
          <p className="mt-3 text-[9px] font-semibold text-emerald-700">
            Unlimited listing capacity
          </p>
        )}
      </section>

      <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
        <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
          Growth credits
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-[#F3F1EB] px-3 py-3">
            <IoRocketOutline
              size={15}
              className="text-[#F39A22]"
            />

            <div className="mt-2 text-[19px] font-black text-[#173C2E]">
              {computed.boostsLeft}
            </div>

            <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-slate-400">
              Boosts
            </div>
          </div>

          <div className="rounded-xl bg-[#F3F1EB] px-3 py-3">
            <IoStarOutline
              size={15}
              className="text-[#F39A22]"
            />

            <div className="mt-2 text-[19px] font-black text-[#173C2E]">
              {computed.featuredLeft}
            </div>

            <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-slate-400">
              Featured
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FFF4E3] text-[#F39A22]">
            <IoWalletOutline size={17} />
          </span>

          <div>
            <div className="text-[12px] font-black text-slate-800">
              Flexible checkout
            </div>

            <p className="mt-1 text-[10px] font-medium leading-4 text-slate-400">
              Eligible purchases can use your ekarihub wallet or secure Paystack checkout.
            </p>
          </div>
        </div>
      </section>
    </motion.aside>
  );

  const LoadingState = (
    <div className="grid min-h-[420px] place-items-center">
      <div className="text-center">
        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-[#D1CCC0] border-t-[#173C2E]" />

        <p className="mt-3 text-[10px] font-semibold text-slate-400">
          Loading seller packages…
        </p>
      </div>
    </div>
  );

  if (loading) {
    const loadingPage = (
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F8F7F2]">
        {Header}

        <main className="min-h-0 flex-1 overflow-y-auto">
          {LoadingState}
        </main>
      </div>
    );

    return isMobile ? (
      <div className="fixed inset-0">
        {loadingPage}
      </div>
    ) : (
      <AppShell>
        {loadingPage}
      </AppShell>
    );
  }

  const Content = (
    <>
      <div className="mx-auto grid max-w-[1220px] gap-5 px-3 py-4 sm:px-4 md:px-6 md:py-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <section className="min-w-0 space-y-4">
          {TopCards}
          {MainContent}
        </section>

        {RightRail}
      </div>

      <AnimatePresence>
        {pickerOpen ? (
          <MobilePlanPicker
            open={pickerOpen}
            onClose={() =>
              setPickerOpen(false)
            }
            packages={packages}
            currentPackageId={
              computed.subActiveNow
                ? currentPackageId
                : null
            }
            billing={billing}
            onBillingChange={setBilling}
            currency={currency}
            onCurrencyChange={setCurrency}
            rate={effectiveRate}
            onSelect={(pkgId) => {
              setPickerOpen(false);
              openCheckoutFor(pkgId);
            }}
          />
        ) : null}
      </AnimatePresence>

      <PlanCheckoutDialogWeb
        open={checkoutOpen}
        onClose={() =>
          setCheckoutOpen(false)
        }
        pkg={checkoutPkg}
        billing={billing}
        currency={currency}
        rate={effectiveRate}
      />
    </>
  );

  const pagemobile = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F8F7F2]">
      {Header}

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        {Content}
      </main>
    </div>
  );
  const page = (
    <div className="h-full min-h-0 overflow-y-auto bg-[#F8F7F2]">
      {Header}

      <main className="min-h-0 flex-1">
        {Content}
      </main>
    </div>
  );
  return isMobile ? (
    <div className="fixed inset-0">
      {pagemobile}
    </div>
  ) : (
    <AppShell>
      {page}
    </AppShell>
  );
}

/* ===================== small ui ===================== */

function Card({
  icon,
  title,
  value,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
            {title}
          </div>

          <div className="mt-1 text-[24px] font-black tracking-[-0.04em] text-[#173C2E]">
            {value}
          </div>
        </div>

        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E8ECE8] text-[#173C2E]">
          {icon}
        </span>
      </div>

      <div className="mt-2 text-[10px] font-medium leading-4 text-slate-400">
        {hint}
      </div>
    </motion.div>
  );
}

function Perk({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const positive =
    value === "Included" ||
    value === "Unlimited" ||
    value === "Advanced analytics" ||
    value === "Basic analytics";

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E4DED2] bg-white px-3 py-2.5">
      <span className="text-[10px] font-semibold text-slate-400">
        {label}
      </span>

      <span
        className={[
          "text-right text-[10px] font-black",
          positive
            ? "text-[#173C2E]"
            : "text-slate-600",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

/* ===================== premium PackageCard (FULL) ===================== */

function PackageCard({
  p,
  isCurrent,
  onChoose,
  billing,
  currency,
  rate,
}: {
  p: PackageDoc;
  isCurrent: boolean;
  onChoose: () => void;
  billing: BillingCycle;
  currency: PreferredCurrency;
  rate: number;
}) {
  const t = tierPill(p.name);
  const a = pickAccent(p.name);

  const perks = [
    p.priorityRanking ? "Priority ranking" : null,
    p.topOfSearch ? "Top of search" : null,
    p.verifiedBadge ? "Verified seller badge" : null,
    p.storefront ? "Storefront" : null,
    p.analyticsLevel !== "none" ? fmtAnalytics(p.analyticsLevel) : null,
    p.monthlyBoostCredits > 0 ? `${p.monthlyBoostCredits} boosts / month` : null,
    p.weeklyFeaturedCredits > 0 ? `${p.weeklyFeaturedCredits} featured / week` : null,
  ].filter(Boolean) as string[];

  const topFeatures = (p.features || []).slice(0, 4);

  const priceUsd = billing === "yearly" ? p.priceYearlyUsd : p.priceMonthlyUsd;
  const display = currency === "USD" ? priceUsd : priceUsd * rate;
  const unit = billing === "yearly" ? "/yr" : "/mo";
  const priceText = currency === "USD" ? usd(display) : kes(display);

  return (
    <div className="relative">
      <div
        className={clsx("pointer-events-none absolute -inset-0.5 rounded-[20px] opacity-0 blur-xl transition-opacity", "group-hover:opacity-100")}
        style={{
          background: `radial-gradient(80% 80% at 20% 10%, ${a.accent}33 0%, transparent 60%)`,
        }}
      />

      <div
        className={clsx(
          "group relative rounded-[18px] border bg-[#FBFAF6] p-4 transition-all duration-200",
          "hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(15,23,42,0.09)]"
        )}
        style={{
          borderColor: isCurrent ? a.ring : EKARI.hair,
          boxShadow: isCurrent ? "0 12px 30px rgba(15,23,42,0.06)" : "0 8px 20px rgba(15,23,42,0.03)",
        }}
      >
        {isCurrent ? (
          <div className="absolute -top-2 right-4">
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-extrabold border"
              style={{ background: a.soft, color: a.accent, borderColor: a.ring }}
            >
              Current plan
            </span>
          </div>
        ) : null}

        {p.recommended ? (
          <div className="absolute -top-2 left-4">
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-extrabold border"
              style={{ background: "#FFF7ED", color: "#9A3412", borderColor: "#FED7AA" }}
            >
              Most popular
            </span>
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-2">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold border"
            style={{ background: t.bg, color: t.fg, borderColor: t.ring }}
          >
            {p.name}
          </span>

          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border"
            style={{ borderColor: EKARI.hair, background: "#fff" }}
            aria-hidden="true"
            title="Package"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
                stroke={a.accent}
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path d="M3.3 7.7 12 12.5l8.7-4.8" stroke={a.accent} strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M12 22V12.5" stroke={a.accent} strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </span>
        </div>

        <div className="mt-2 text-xs text-gray-500 line-clamp-2">{p.target}</div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold text-gray-500">
              {billing === "yearly" ? "Yearly" : "Monthly"} • {currency}
            </div>

            <div className="mt-1 text-2xl font-extrabold" style={{ color: EKARI.text }}>
              {priceText}
              <span className="ml-1 text-xs font-bold text-gray-500">{unit}</span>
            </div>

            {billing === "yearly" && p.yearlyDiscountPct ? (
              <div className="mt-1 text-[11px]" style={{ color: EKARI.dim }}>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold border"
                  style={{ borderColor: a.ring, background: a.soft, color: a.accent }}
                >
                  Save {p.yearlyDiscountPct}%
                </span>
              </div>
            ) : (
              <div className="mt-1 text-[11px]" style={{ color: EKARI.dim }}>
                USD {p.priceYearlyUsd} /yr
                {p.yearlyDiscountPct ? <span className="ml-1">({p.yearlyDiscountPct}% off)</span> : null}
              </div>
            )}
          </div>

          <div className="text-right">
            <div className="text-[11px] font-semibold text-gray-500">Listings</div>
            <div className="mt-1 text-sm font-extrabold" style={{ color: EKARI.text }}>
              {p.activeListingsLimit === null ? "Unlimited" : p.activeListingsLimit}
            </div>
            <div className="mt-1 text-[11px]" style={{ color: EKARI.dim }}>
              capacity
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          <div className="flex flex-wrap gap-1.5">
            {perks.slice(0, 4).map((x, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border"
                style={{ borderColor: EKARI.hair, color: EKARI.text, background: "#fff" }}
              >
                {x}
              </span>
            ))}
          </div>

          {topFeatures.length ? (
            <div className="mt-1 space-y-2">
              {topFeatures.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-[12px]" style={{ color: EKARI.text }}>
                  {checkIcon(a.accent)}
                  <div className="leading-snug text-gray-700">{f}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={onChoose}
            disabled={isCurrent}
            className={clsx("h-10 w-full rounded-xl px-3 text-[10px] font-black transition", "disabled:opacity-60")}
            style={{
              background: isCurrent ? "#fff" : a.accent,
              color: isCurrent ? EKARI.dim : "#fff",
              border: `1px solid ${isCurrent ? EKARI.hair : a.accent}`,
              boxShadow: isCurrent ? "none" : "0 8px 18px rgba(15,23,42,0.08)",
            }}
          >
            {isCurrent ? "You’re on this plan" : "Choose plan"}
          </button>

          {!isCurrent ? (
            <div className="mt-2 text-center text-[11px]" style={{ color: EKARI.dim }}>
              Upgrade anytime • Cancel anytime
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}