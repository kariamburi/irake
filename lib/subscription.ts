import { Timestamp } from "firebase/firestore";

export type AnalyticsLevel = "none" | "basic" | "advanced";

export type Entitlements = {
    activeListingsLimit: number | null; // null = unlimited
    priorityRanking: boolean;
    topOfSearch: boolean;
    verifiedBadge: boolean;
    storefront: boolean;
    analyticsLevel: AnalyticsLevel;
    monthlyBoostCredits: number;
    weeklyFeaturedCredits: number;
};

export type SellerSubscription = {
    status?: "active" | "expired" | "none";
    packageId?: string;
    billingCycle?: "monthly" | "yearly";
    currentPeriodEnd?: Timestamp | null;
    entitlements?: Partial<Entitlements> | null;
};

export function isSubActive(sub: SellerSubscription | null | undefined) {
    if (!sub) return false;
    if (sub.status !== "active") return false;
    const end = sub.currentPeriodEnd?.toMillis?.() ?? 0;
    return end > Date.now();
}

export function getEntitlements(sub: SellerSubscription | null | undefined): Entitlements {
    const e = (sub?.entitlements || {}) as Partial<Entitlements>;

    return {
        activeListingsLimit: typeof e.activeListingsLimit === "number" ? e.activeListingsLimit : null,
        priorityRanking: !!e.priorityRanking,
        topOfSearch: !!e.topOfSearch,
        verifiedBadge: !!e.verifiedBadge,
        storefront: !!e.storefront,
        analyticsLevel: (e.analyticsLevel as AnalyticsLevel) || "none",
        monthlyBoostCredits: typeof e.monthlyBoostCredits === "number" ? e.monthlyBoostCredits : 0,
        weeklyFeaturedCredits: typeof e.weeklyFeaturedCredits === "number" ? e.weeklyFeaturedCredits : 0,
    };
}
