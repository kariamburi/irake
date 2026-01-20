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

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
  hair: "#E5E7EB",
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
    <div className="inline-flex items-center gap-2 rounded-2xl border bg-white p-1" style={{ borderColor: EKARI.hair }}>
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className="rounded-xl px-3 py-2 text-xs font-extrabold"
        style={{
          background: value === "monthly" ? EKARI.forest : "transparent",
          color: value === "monthly" ? "#fff" : EKARI.text,
        }}
      >
        Monthly
      </button>

      <button
        type="button"
        onClick={() => onChange("yearly")}
        className="rounded-xl px-3 py-2 text-xs font-extrabold"
        style={{
          background: value === "yearly" ? EKARI.forest : "transparent",
          color: value === "yearly" ? "#fff" : EKARI.text,
        }}
      >
        Yearly
      </button>

      {yearlySaveText ? (
        <span
          className="hidden sm:inline-flex ml-1 rounded-full px-2 py-1 text-[10px] font-extrabold border"
          style={{ borderColor: EKARI.hair, color: EKARI.dim }}
        >
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
    <div className="inline-flex items-center gap-2 rounded-2xl border bg-white p-1" style={{ borderColor: EKARI.hair }}>
      <button
        type="button"
        onClick={() => onChange("USD")}
        className="rounded-xl px-3 py-2 text-xs font-extrabold"
        style={{
          background: value === "USD" ? EKARI.forest : "transparent",
          color: value === "USD" ? "#fff" : EKARI.text,
        }}
      >
        USD
      </button>

      <button
        type="button"
        onClick={() => onChange("KES")}
        className="rounded-xl px-3 py-2 text-xs font-extrabold"
        style={{
          background: value === "KES" ? EKARI.forest : "transparent",
          color: value === "KES" ? "#fff" : EKARI.text,
        }}
      >
        KES
      </button>
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
    <div className="fixed inset-0 z-[70] bg-white flex flex-col">
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: EKARI.hair }}>
        <div>
          <div className="text-sm font-extrabold" style={{ color: EKARI.text }}>
            Choose a plan
          </div>
          <div className="text-xs" style={{ color: EKARI.dim }}>
            Switch billing + currency, then pick.
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-3 py-2 text-xs font-extrabold border"
          style={{ borderColor: EKARI.hair, color: EKARI.text }}
        >
          Close
        </button>
      </div>

      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BillingToggle value={billing} onChange={onBillingChange} />
          <CurrencyToggle value={currency} onChange={onCurrencyChange} />
        </div>

        <div className="text-[11px]" style={{ color: EKARI.dim }}>
          {packages.length} plans
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="grid gap-4">
          {packages.map((p) => {
            const isCurrent = p.id === currentPackageId;
            return (
              <PackageCard
                key={p.id}
                p={p}
                isCurrent={isCurrent}
                billing={billing}
                currency={currency}
                rate={rate}
                onChoose={() => onSelect(p.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
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
      <div className="absolute inset-0 bg-black/40" onClick={() => !loading && onClose()} />
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="w-full max-w-[640px] rounded-3xl bg-white px-4 pb-5 pt-3 shadow-xl">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200" />

          <div className="mb-3 flex items-start gap-3">
            <div className="flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:#233F39]">
                Upgrade plan
              </p>
              <h2 className="text-[16px] font-extrabold text-gray-900">
                {pkg.name} — {billing === "yearly" ? "Yearly" : "Monthly"}
              </h2>
              <p className="mt-1 text-xs text-gray-500">{pkg.target}</p>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40"
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
              "bg-[color:#233F39] hover:bg-[#1b312d]",
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
    const pkg = activePkg;

    const activeListings = 0;
    const limit = pkg?.activeListingsLimit ?? null;
    const remainingSlots = limit === null ? null : Math.max(0, limit - activeListings);

    const boostsTotal = pkg?.monthlyBoostCredits ?? 0;
    const featuredTotal = pkg?.weeklyFeaturedCredits ?? 0;

    // ✅ prefer credits.*Remaining, fallback to legacy, else fallback to totals
    const boostsLeft =
      typeof sub?.credits?.boostCreditsRemaining === "number"
        ? sub.credits.boostCreditsRemaining
        : (typeof (sub as any)?.boostCreditsRemaining === "number"
          ? (sub as any).boostCreditsRemaining
          : boostsTotal);

    const featuredLeft =
      typeof sub?.credits?.featuredCreditsRemaining === "number"
        ? sub.credits.featuredCreditsRemaining
        : (typeof (sub as any)?.featuredCreditsRemaining === "number"
          ? (sub as any).featuredCreditsRemaining
          : featuredTotal);

    const nearLimit = typeof limit === "number" && limit > 0 ? activeListings / limit >= 0.8 : false;

    return {
      pkg,
      planName: pkg?.name ?? "Free",
      planStatus: sub?.status ?? "inactive",
      billingCycle: sub?.billingCycle ?? "monthly",
      activeListings,
      limit,
      remainingSlots,
      boostsLeft: Math.max(0, boostsLeft),
      featuredLeft: Math.max(0, featuredLeft),
      nearLimit,
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
    <div className={clsx("px-4 md:px-0 pt-3", isDesktop ? "pb-2" : "pb-3")}>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold" style={{ color: EKARI.text }}>
            Seller dashboard
          </h1>
          <p className="text-sm md:text-base" style={{ color: EKARI.dim }}>
            Your plan perks, limits and growth tools (boosts & featured slots).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2" style={{ borderColor: EKARI.hair }}>
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold border"
              style={{ background: pill.bg, color: pill.fg, borderColor: pill.ring }}
            >
              {computed.planName}
            </span>

            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClasses(computed.planStatus)}`}>
              {computed.planStatus}
            </span>

            <span className="text-[10px] text-gray-500">{computed.billingCycle}</span>
          </div>

        </div>
      </div>
    </div>
  );

  const TopCards = (
    <div className={clsx("grid gap-3", isDesktop ? "md:grid-cols-3" : "grid-cols-1")}>
      <Card
        title="Listings"
        value={
          computed.limit === null ? `${computed.activeListings} / Unlimited` : `${computed.activeListings} / ${computed.limit}`
        }
        hint={computed.remainingSlots === null ? "No listing limit" : `${computed.remainingSlots} slots left`}
      />
      <Card title="Boosts left (month)" value={`${computed.boostsLeft}`} hint="Used to rank higher" />
      <Card title="Featured left (week)" value={`${computed.featuredLeft}`} hint="Used for premium placement" />
    </div>
  );

  const List = (
    <div className="space-y-6">
      {computed.nearLimit && (
        <div className="rounded-2xl border bg-amber-50 px-4 py-3 text-sm" style={{ borderColor: "#FDE68A", color: "#92400E" }}>
          You’re close to your listings limit. Upgrade to get more slots.
        </div>
      )}

      <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: EKARI.hair }}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-extrabold" style={{ color: EKARI.text }}>
              Your plan perks
            </div>
            <div className="text-xs mt-1" style={{ color: EKARI.dim }}>
              Pulled directly from your current package configuration.
            </div>
          </div>

          <button
            type="button"
            onClick={() => (isMobile ? setPickerOpen(true) : document.getElementById("packages")?.scrollIntoView({ behavior: "smooth" }))}
            className="rounded-xl px-3 py-2 text-xs font-extrabold text-white"
            style={{ backgroundColor: EKARI.forest }}
          >
            Upgrade plan
          </button>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2 text-sm">
          <Perk
            label="Listings limit"
            value={computed.pkg?.activeListingsLimit === null ? "Unlimited" : String(computed.pkg?.activeListingsLimit ?? "—")}
          />
          <Perk label="Analytics" value={computed.pkg?.analyticsLevel ?? "—"} />
          <Perk label="Priority ranking" value={computed.pkg?.priorityRanking ? "Yes" : "No"} />
          <Perk label="Top-of-search bias" value={computed.pkg?.topOfSearch ? "Yes" : "No"} />
          <Perk label="Verified badge" value={computed.pkg?.verifiedBadge ? "Yes" : "No"} />
          <Perk label="Storefront" value={computed.pkg?.storefront ? "Yes" : "No"} />
        </div>

        {computed.pkg?.features?.length ? (
          <div className="mt-4">
            <div className="text-xs font-semibold text-gray-500">Included features</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {computed.pkg.features.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-bold border"
                  style={{ borderColor: EKARI.hair, color: EKARI.text, background: "#fff" }}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div id="packages" className="rounded-2xl border bg-white shadow-sm overflow-hidden" style={{ borderColor: EKARI.hair }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: EKARI.hair }}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-extrabold" style={{ color: EKARI.text }}>
                Available packages
              </h2>
              <p className="text-xs" style={{ color: EKARI.dim }}>
                Choose a tier that matches your growth stage.
              </p>
            </div>
            {/* ✅ Toggles in header */}
            <div className="hidden md:flex items-center gap-2">
              <BillingToggle value={billing} onChange={setBilling} />
              <CurrencyToggle value={currency} onChange={setCurrency} />
            </div>
            {isMobile ? (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="rounded-xl px-3 py-2 text-xs font-extrabold text-white"
                style={{ backgroundColor: EKARI.forest }}
              >
                Pick a plan
              </button>
            ) : (
              <div className="text-xs" style={{ color: EKARI.dim }}>
                {packages.length} available
              </div>
            )}
          </div>
        </div>

        <div className="p-4" style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)" }}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((p) => {
              const isCurrent = p.id === sub?.packageId;
              return (
                <PackageCard
                  key={p.id}
                  p={p}
                  isCurrent={isCurrent}
                  billing={billing}
                  currency={currency}
                  rate={effectiveRate}
                  onChoose={() => openCheckoutFor(p.id)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  const Empty = (
    <div className="p-4">
      <div className="max-w-md rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: EKARI.hair }}>
        <div className="text-lg font-extrabold" style={{ color: EKARI.text }}>
          Loading dashboard…
        </div>
        <p className="mt-2 text-sm" style={{ color: EKARI.dim }}>
          Please wait a moment.
        </p>
      </div>
    </div>
  );

  if (loading) {
    return isMobile ? (
      <div className="fixed min-h-screen inset-0 flex flex-col" style={{ backgroundColor: EKARI.sand }}>
        {Header}
        <div className="flex-1 overflow-y-auto">{Empty}</div>
      </div>
    ) : (
      <AppShell>
        <div className="min-h-screen w-full">
          {Header}
          {Empty}
        </div>
      </AppShell>
    );
  }

  const Content = (
    <>
      {TopCards}
      <div className={clsx(isDesktop ? "mt-2" : "mt-1")}>{List}</div>

      <MobilePlanPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        packages={packages}
        currentPackageId={currentPackageId}
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

      <PlanCheckoutDialogWeb
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        pkg={checkoutPkg}
        billing={billing}
        currency={currency}
        rate={effectiveRate}
      />
    </>
  );

  return isMobile ? (
    <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: EKARI.sand }}>
      {Header}
      <div className="flex-1 overflow-y-auto px-4 pb-6">{Content}</div>
    </div>
  ) : (
    <AppShell>
      <div className="p-6 space-y-6">
        {Header}
        {Content}
      </div>
    </AppShell>
  );
}

/* ===================== small ui ===================== */

function Card({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: EKARI.hair }}>
      <div className="text-xs font-semibold text-gray-500">{title}</div>
      <div className="mt-1 text-2xl font-extrabold" style={{ color: EKARI.text }}>
        {value}
      </div>
      <div className="mt-1 text-xs" style={{ color: EKARI.dim }}>
        {hint}
      </div>
    </div>
  );
}

function Perk({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2" style={{ borderColor: EKARI.hair }}>
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <span className="text-sm font-extrabold" style={{ color: EKARI.text }}>
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
          "group relative rounded-2xl border bg-white p-4 transition-all",
          "hover:-translate-y-0.5 hover:shadow-[0_18px_55px_rgba(15,23,42,0.12)]"
        )}
        style={{
          borderColor: isCurrent ? a.ring : EKARI.hair,
          boxShadow: isCurrent ? "0 16px 40px rgba(15,23,42,0.08)" : "0 10px 25px rgba(15,23,42,0.06)",
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
            className={clsx("w-full rounded-xl px-3 py-2.5 text-xs font-extrabold transition", "disabled:opacity-60")}
            style={{
              background: isCurrent ? "#fff" : a.accent,
              color: isCurrent ? EKARI.dim : "#fff",
              border: `1px solid ${isCurrent ? EKARI.hair : a.accent}`,
              boxShadow: isCurrent ? "none" : "0 14px 30px rgba(15,23,42,0.10)",
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
