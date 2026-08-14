"use client";

import {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    collection,
    doc,
    documentId,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    where,
} from "firebase/firestore";

import {
    usePathname,
    useRouter,
    useSearchParams,
} from "next/navigation";

import {
    IoBriefcaseOutline,
    IoChevronDown,
    IoClose,
    IoFilterOutline,
    IoLocationOutline,
    IoMenu,
    IoPeopleOutline,
    IoRefreshOutline,
    IoSearchOutline,
    IoShieldCheckmarkOutline,
    IoStarOutline,
    IoGridOutline,
} from "react-icons/io5";

import AppShell from "@/app/components/AppShell";
import { motion } from "framer-motion";
import ExpertDiscoveryRail from "@/app/components/experts/ExpertDiscoveryRail";
import ExpertCard from "@/app/components/experts/ExpertCard";

import { db } from "@/lib/firebase";
import { PublicExpert } from "../types/publicExpert";
import MobileBottomTabs from "../components/navigation/MobileBottomTabs";
import { useAuth } from "../hooks/useAuth";
import { EkariSideMenuSheet } from "../components/EkariSideMenuSheet";
import { useInboxTotalsWeb } from "@/hooks/useInboxTotalsWeb";
import { FALLBACK_EXPERT_SPECIALTIES } from "../constants/expertConstants";
import AppShellRightRail from "../components/AppShellRightRail";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    text: "#111827",
    subtext: "#6B7280",
    hair: "#E5E7EB",
    soft: "#F8FAFC",
    success: "#15803D",
    danger: "#B42318",
};

type SortOption =
    | "recommended"
    | "rating"
    | "consultations"
    | "price_low"
    | "price_high"
    | "newest";

type ExpertSpecialtyGroup = {
    id: string;
    title: string;
    items: string[];
    order: number;
    active: boolean;
};

function normalizeSearchText(
    value: unknown
): string {
    return String(value || "")
        .trim()
        .toLowerCase();
}

function normalizeArray(
    value: unknown
): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) =>
            String(item || "").trim()
        )
        .filter(Boolean);
}
function safeNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function uniqueStrings(values: string[]): string[] {
    return Array.from(
        new Map(
            values
                .map((value) => String(value || "").trim())
                .filter(Boolean)
                .map((value) => [value.toLowerCase(), value])
        ).values()
    );
}

function getExpertLocationValues(expert: PublicExpert): string[] {
    const profile = expert as any;
    const primaryLocation = profile.primaryLocation || {};
    const serviceAreas = Array.isArray(
        profile.serviceCoverage?.serviceAreas
    )
        ? profile.serviceCoverage.serviceAreas
        : [];

    return uniqueStrings([
        primaryLocation.label,
        primaryLocation.locality,
        primaryLocation.city,
        primaryLocation.region,
        primaryLocation.country,

        // Legacy compatibility
        primaryLocation.town,
        primaryLocation.county,

        ...serviceAreas.flatMap((area: any) => [
            area?.label,
            area?.city,
            area?.region,
            area?.country,
        ]),

        ...normalizeArray(profile.countiesServed),
    ]);
}

function useIsDesktop() {
    return useMediaQuery("(min-width: 1024px)");
}
function normalizePublicExpert(
    id: string,
    data: Record<string, any>
): PublicExpert {
    const rawPrimaryLocation = data.primaryLocation || {};

    const legacyLatitude = safeNumber(rawPrimaryLocation.latitude);
    const legacyLongitude = safeNumber(rawPrimaryLocation.longitude);

    const coordinateLatitude =
        safeNumber(rawPrimaryLocation.coordinates?.latitude) ??
        legacyLatitude;

    const coordinateLongitude =
        safeNumber(rawPrimaryLocation.coordinates?.longitude) ??
        legacyLongitude;

    const legacyCounty = String(
        rawPrimaryLocation.county || ""
    ).trim();

    const legacyTown = String(
        rawPrimaryLocation.town || ""
    ).trim();

    const primaryLocation = {
        placeId:
            String(rawPrimaryLocation.placeId || "") || null,

        label: String(
            rawPrimaryLocation.label ||
            [
                rawPrimaryLocation.city || legacyTown,
                rawPrimaryLocation.region || legacyCounty,
                rawPrimaryLocation.country,
            ]
                .filter(Boolean)
                .join(", ")
        ).trim(),

        countryCode: String(
            rawPrimaryLocation.countryCode || ""
        )
            .trim()
            .toUpperCase(),

        country: String(
            rawPrimaryLocation.country || ""
        ).trim(),

        region: String(
            rawPrimaryLocation.region || legacyCounty
        ).trim(),

        city: String(
            rawPrimaryLocation.city || legacyTown
        ).trim(),

        locality: String(
            rawPrimaryLocation.locality || ""
        ).trim(),

        coordinates:
            coordinateLatitude !== null &&
                coordinateLongitude !== null
                ? {
                    latitude: coordinateLatitude,
                    longitude: coordinateLongitude,
                    geohash:
                        rawPrimaryLocation.coordinates?.geohash ||
                        rawPrimaryLocation.geohash ||
                        null,
                }
                : null,

        timezone:
            String(rawPrimaryLocation.timezone || "") || null,
    };

    const rawServiceCoverage = data.serviceCoverage || {};

    const onlineCoverage =
        rawServiceCoverage.onlineCoverage === "local" ||
            rawServiceCoverage.onlineCoverage === "country" ||
            rawServiceCoverage.onlineCoverage === "worldwide"
            ? rawServiceCoverage.onlineCoverage
            : "worldwide";

    const serviceCoverage = {
        offersOnlineServices:
            rawServiceCoverage.offersOnlineServices !== false,

        offersPhysicalVisits:
            rawServiceCoverage.offersPhysicalVisits === true,

        onlineCoverage,

        serviceAreas: Array.isArray(
            rawServiceCoverage.serviceAreas
        )
            ? rawServiceCoverage.serviceAreas
            : [],
    };

    return {
        uid: String(data.uid || id),
        displayName: String(data.displayName || ""),
        firstName: String(data.firstName || ""),
        surname: String(data.surname || ""),
        handle: String(data.handle || ""),
        photoURL: String(data.photoURL || ""),
        headline: String(data.headline || ""),
        expertBio: String(data.expertBio || ""),

        verificationStatus: String(
            data.verificationStatus ||
            (data.verified ? "approved" : "none")
        ),

        verificationRole: String(data.verificationRole || ""),
        verificationType: String(data.verificationType || ""),
        organizationName: String(data.organizationName || ""),

        specialties: normalizeArray(data.specialties),
        countiesServed: normalizeArray(data.countiesServed),
        languages: normalizeArray(data.languages),
        consultationMethods: normalizeArray(
            data.consultationMethods
        ),

        primaryLocation,
        serviceCoverage,

        pricing: {
            currency:
                data.pricing?.currency === "USD" ? "USD" : "KES",

            consultationFee:
                Number(data.pricing?.consultationFee) || 0,

            physicalVisitFeeFrom:
                data.pricing?.physicalVisitFeeFrom === null ||
                    data.pricing?.physicalVisitFeeFrom === undefined
                    ? null
                    : Number(
                        data.pricing.physicalVisitFeeFrom
                    ) || 0,

            feeType: String(data.pricing?.feeType || "fixed"),

            consultationDurationMinutes:
                Number(
                    data.pricing?.consultationDurationMinutes
                ) || 45,
        },

        terms: {
            summary: String(data.terms?.summary || ""),
            cancellationNoticeHours:
                Number(data.terms?.cancellationNoticeHours) || 0,
            cancellationPolicy: String(
                data.terms?.cancellationPolicy || ""
            ),
            allowsRescheduling:
                data.terms?.allowsRescheduling !== false,
            paymentRequiredBeforeBooking:
                data.terms?.paymentRequiredBeforeBooking !== false,
        },

        acceptingBookings: data.acceptingBookings !== false,
        verified: data.verified === true,

        rating: {
            average: Number(data.rating?.average) || 0,
            count: Number(data.rating?.count) || 0,
        },

        completedConsultations:
            Number(data.completedConsultations) || 0,

        publishedAt: data.publishedAt || null,
        updatedAt: data.updatedAt || null,
    } as PublicExpert;
}

async function loadUserRatingStats(
    userIds: string[]
): Promise<Map<string, UserRatingStats>> {
    const ratingMap =
        new Map<string, UserRatingStats>();

    const cleanUserIds = Array.from(
        new Set(
            userIds
                .map((uid) =>
                    String(uid || "").trim()
                )
                .filter(Boolean)
        )
    );

    if (cleanUserIds.length === 0) {
        return ratingMap;
    }

    const userIdChunks = chunkArray(
        cleanUserIds,
        30
    );

    await Promise.all(
        userIdChunks.map(async (ids) => {
            const usersQuery = query(
                collection(db, "users"),
                where(
                    documentId(),
                    "in",
                    ids
                )
            );

            const userSnapshot =
                await getDocs(usersQuery);

            userSnapshot.docs.forEach(
                (userDocument) => {
                    const userData =
                        userDocument.data();

                    const average = Number(
                        userData
                            .sellerReviewStats
                            ?.avgRating
                    );

                    const count = Number(
                        userData
                            .sellerReviewStats
                            ?.reviewsCount
                    );

                    ratingMap.set(
                        userDocument.id,
                        {
                            average:
                                Number.isFinite(
                                    average
                                )
                                    ? Math.max(
                                        0,
                                        Math.min(
                                            5,
                                            average
                                        )
                                    )
                                    : 0,

                            count:
                                Number.isFinite(
                                    count
                                )
                                    ? Math.max(
                                        0,
                                        Math.floor(
                                            count
                                        )
                                    )
                                    : 0,
                        }
                    );
                }
            );
        })
    );

    return ratingMap;
}
function getTimestampMillis(
    value: any
): number {
    if (!value) {
        return 0;
    }

    if (
        typeof value.toMillis ===
        "function"
    ) {
        return value.toMillis();
    }

    if (
        typeof value.seconds ===
        "number"
    ) {
        return value.seconds * 1000;
    }

    return 0;
}
type UserRatingStats = {
    average: number;
    count: number;
};
function chunkArray<T>(
    values: T[],
    size: number
): T[][] {
    const chunks: T[][] = [];

    for (
        let index = 0;
        index < values.length;
        index += size
    ) {
        chunks.push(
            values.slice(index, index + size)
        );
    }

    return chunks;
}
function MarketplaceContent() {
    const router = useRouter();
    const pathname = usePathname();

    const searchParams =
        useSearchParams();

    const [experts, setExperts] = useState<
        PublicExpert[]
    >([]);

    const [specialtyGroups, setSpecialtyGroups] = useState<
        ExpertSpecialtyGroup[]
    >([]);

    const [specialtiesLoading, setSpecialtiesLoading] =
        useState(true);

    const [loading, setLoading] =
        useState(true);

    const [errorMessage, setErrorMessage] =
        useState<string | null>(null);

    const [filtersOpen, setFiltersOpen] =
        useState(false);

    const [search, setSearch] =
        useState(
            searchParams.get("search") || ""
        );

    const [county, setCounty] =
        useState(
            searchParams.get("county") || ""
        );

    const [specialty, setSpecialty] =
        useState(
            searchParams.get("specialty") ||
            ""
        );

    const [
        acceptingOnly,
        setAcceptingOnly,
    ] = useState(
        searchParams.get("accepting") ===
        "true"
    );

    const [sort, setSort] =
        useState<SortOption>(
            (searchParams.get(
                "sort"
            ) as SortOption) ||
            "recommended"
        );

    const loadExperts =
        useCallback(async () => {
            setLoading(true);
            setErrorMessage(null);

            try {
                /*
                 * updatedAt exists on every publicExpert
                 * created by the publishing function.
                 *
                 * We limit the first version to 200
                 * experts and filter the loaded results
                 * in the browser.
                 */
                const expertQuery = query(
                    collection(
                        db,
                        "publicExperts"
                    ),
                    orderBy("updatedAt", "desc"),
                    limit(200)
                );

                const snapshot =
                    await getDocs(expertQuery);

                const loadedExperts =
                    snapshot.docs.map(
                        (documentSnapshot) =>
                            normalizePublicExpert(
                                documentSnapshot.id,
                                documentSnapshot.data()
                            )
                    );

                const ratingMap =
                    await loadUserRatingStats(
                        loadedExperts.map(
                            (expert) => expert.uid
                        )
                    );

                const expertsWithProfileRatings =
                    loadedExperts.map((expert) => {
                        const profileRating =
                            ratingMap.get(expert.uid);

                        /*
                         * Use the existing user profile rating
                         * when available. Fall back to the rating
                         * copied into publicExperts for compatibility.
                         */
                        if (!profileRating) {
                            return expert;
                        }

                        return {
                            ...expert,

                            rating: {
                                average:
                                    profileRating.average,
                                count:
                                    profileRating.count,
                            },
                        };
                    });

                setExperts(expertsWithProfileRatings);


            } catch (error: any) {
                console.error(
                    "Failed to load public experts:",
                    error
                );

                setErrorMessage(
                    error?.message ||
                    "We could not load ekariExperts."
                );
            } finally {
                setLoading(false);
            }
        }, []);

    useEffect(() => {
        loadExperts();
    }, [loadExperts]);


    useEffect(() => {
        setSpecialtiesLoading(true);

        const specialtiesQuery = query(
            collection(db, "expert_specialty_groups"),
            orderBy("order", "asc")
        );

        const unsubscribe = onSnapshot(
            specialtiesQuery,
            (snapshot) => {
                const groups = snapshot.docs
                    .map((documentSnapshot) => {
                        const data = documentSnapshot.data();

                        return {
                            id: documentSnapshot.id,
                            title: String(data.title || "").trim(),
                            items: uniqueStrings(
                                normalizeArray(data.items)
                            ),
                            order: Number(data.order || 0),
                            active: data.active !== false,
                        };
                    })
                    .filter(
                        (group) =>
                            group.active && group.items.length > 0
                    );

                setSpecialtyGroups(groups);
                setSpecialtiesLoading(false);
            },
            (error) => {
                console.error(
                    "LOAD_EXPERT_SPECIALTIES_FAILED",
                    error
                );

                setSpecialtyGroups([]);
                setSpecialtiesLoading(false);
            }
        );

        return unsubscribe;
    }, []);

    const databaseSpecialties = useMemo(
        () =>
            uniqueStrings(
                specialtyGroups.flatMap((group) => group.items)
            ),
        [specialtyGroups]
    );

    const specialtyOptions = useMemo(() => {
        const source =
            databaseSpecialties.length > 0
                ? databaseSpecialties
                : [...FALLBACK_EXPERT_SPECIALTIES];

        return uniqueStrings([
            ...source,
            ...experts.flatMap((expert) => expert.specialties),
        ]);
    }, [databaseSpecialties, experts]);

    const locationOptions = useMemo(
        () =>
            uniqueStrings(
                experts.flatMap(getExpertLocationValues)
            ).sort((first, second) =>
                first.localeCompare(second)
            ),
        [experts]
    );

    useEffect(() => {
        if (!filtersOpen) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setFiltersOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [filtersOpen]);

    useEffect(() => {
        const parameters =
            new URLSearchParams();

        const cleanSearch =
            search.trim();

        if (cleanSearch) {
            parameters.set(
                "search",
                cleanSearch
            );
        }

        if (county) {
            parameters.set("county", county);
        }

        if (specialty) {
            parameters.set(
                "specialty",
                specialty
            );
        }

        if (acceptingOnly) {
            parameters.set(
                "accepting",
                "true"
            );
        }

        if (sort !== "recommended") {
            parameters.set("sort", sort);
        }

        const queryString =
            parameters.toString();

        router.replace(
            queryString
                ? `${pathname}?${queryString}`
                : pathname,
            {
                scroll: false,
            }
        );
    }, [
        acceptingOnly,
        county,
        pathname,
        router,
        search,
        sort,
        specialty,
    ]);

    const filteredExperts =
        useMemo(() => {
            const searchValue =
                normalizeSearchText(search);

            const selectedCounty =
                normalizeSearchText(county);

            const selectedSpecialty =
                normalizeSearchText(
                    specialty
                );

            const results = experts.filter(
                (expert) => {
                    if (
                        acceptingOnly &&
                        !expert.acceptingBookings
                    ) {
                        return false;
                    }

                    if (selectedCounty) {
                        const expertLocations =
                            getExpertLocationValues(expert).map(
                                normalizeSearchText
                            );

                        const matchesLocation =
                            expertLocations.some(
                                (location) =>
                                    location === selectedCounty ||
                                    location.includes(selectedCounty)
                            );

                        if (!matchesLocation) {
                            return false;
                        }
                    }

                    if (selectedSpecialty) {
                        const matchesSpecialty =
                            expert.specialties.some(
                                (item) =>
                                    normalizeSearchText(
                                        item
                                    ) ===
                                    selectedSpecialty
                            );

                        if (!matchesSpecialty) {
                            return false;
                        }
                    }

                    if (searchValue) {
                        const searchableText = [
                            expert.displayName,
                            expert.firstName,
                            expert.surname,
                            expert.handle,
                            expert.headline,
                            expert.expertBio,
                            expert.verificationRole,
                            expert.organizationName,
                            ...getExpertLocationValues(expert),
                            ...expert.specialties,
                            ...expert.languages,
                        ]
                            .join(" ")
                            .toLowerCase();

                        if (
                            !searchableText.includes(
                                searchValue
                            )
                        ) {
                            return false;
                        }
                    }

                    return true;
                }
            );

            return [...results].sort(
                (first, second) => {
                    if (
                        sort === "rating"
                    ) {
                        const ratingDifference =
                            second.rating.average -
                            first.rating.average;

                        if (
                            ratingDifference !== 0
                        ) {
                            return ratingDifference;
                        }

                        return (
                            second.rating.count -
                            first.rating.count
                        );
                    }

                    if (
                        sort ===
                        "consultations"
                    ) {
                        return (
                            second.completedConsultations -
                            first.completedConsultations
                        );
                    }

                    if (
                        sort === "price_low"
                    ) {
                        return (
                            first.pricing
                                .consultationFee -
                            second.pricing
                                .consultationFee
                        );
                    }

                    if (
                        sort === "price_high"
                    ) {
                        return (
                            second.pricing
                                .consultationFee -
                            first.pricing
                                .consultationFee
                        );
                    }

                    if (sort === "newest") {
                        return (
                            getTimestampMillis(
                                second.publishedAt
                            ) -
                            getTimestampMillis(
                                first.publishedAt
                            )
                        );
                    }

                    /*
                     * Recommended:
                     * 1. Accepting clients
                     * 2. Verified
                     * 3. Rating
                     * 4. Number of reviews
                     * 5. Completed consultations
                     */
                    const firstScore =
                        (first.acceptingBookings
                            ? 1000
                            : 0) +
                        (first.verified ? 500 : 0) +
                        first.rating.average *
                        100 +
                        Math.min(
                            first.rating.count,
                            100
                        ) *
                        5 +
                        Math.min(
                            first.completedConsultations,
                            200
                        );

                    const secondScore =
                        (second.acceptingBookings
                            ? 1000
                            : 0) +
                        (second.verified ? 500 : 0) +
                        second.rating.average *
                        100 +
                        Math.min(
                            second.rating.count,
                            100
                        ) *
                        5 +
                        Math.min(
                            second.completedConsultations,
                            200
                        );

                    return (
                        secondScore - firstScore
                    );
                }
            );
        }, [
            acceptingOnly,
            county,
            experts,
            search,
            sort,
            specialty,
        ]);

    const activeFilterCount =
        [
            county,
            specialty,
            acceptingOnly ? "yes" : "",
        ].filter(Boolean).length;

    const clearFilters = () => {
        setSearch("");
        setCounty("");
        setSpecialty("");
        setAcceptingOnly(false);
        setSort("recommended");
    }; const ringStyle: React.CSSProperties = {
        ["--tw-ring-color" as any]: EKARI.forest,
    };

    const [menuOpen, setMenuOpen] = useState(false);
    const { user, signOutUser } = useAuth();
    const profile = useUserProfile(user?.uid);
    const { unreadDM, notifTotal } = useInboxTotalsWeb(!!user?.uid, user?.uid);

    const handle = (profile as any)?.handle ?? null;
    const profileHref =
        handle && String(handle).trim().length > 0 ? `/${handle}` : "/getstarted";

    const expertStats = useMemo(() => {
        const verifiedCount = experts.filter(
            (expert) =>
                expert.verified ||
                expert.verificationStatus === "approved"
        ).length;

        const locations = new Set(
            experts
                .flatMap(getExpertLocationValues)
                .map((value) =>
                    String(value || "").trim().toLowerCase()
                )
                .filter(Boolean)
        );

        const ratedExperts = experts.filter(
            (expert) =>
                Number(expert.rating?.count || 0) > 0
        );

        const averageRating =
            ratedExperts.length > 0
                ? ratedExperts.reduce(
                    (total, expert) =>
                        total +
                        Number(
                            expert.rating?.average || 0
                        ),
                    0
                ) / ratedExperts.length
                : 0;

        return {
            verifiedCount,
            locations: locations.size,
            averageRating,
        };
    }, [experts]);

    const featuredExpert =
        filteredExperts[0] ??
        experts[0] ??
        null;

    const quickSpecialties = useMemo(
        () => specialtyOptions.slice(0, 5),
        [specialtyOptions]
    );
    return (
        <AppShellRightRail
            rightRail={
                <ExpertDiscoveryRail
                    experts={experts}
                    specialtyOptions={specialtyOptions}
                    featuredExpert={featuredExpert}
                    onSpecialtySelect={(value: any) => {
                        setSpecialty(value);
                        setSearch("");
                    }}
                />
            }
            rightRailClassName="border-l border-[#E4DED2] bg-[#F8F7F2]"
            handle={handle ?? undefined}
        >
            <main className="h-[100svh] w-full overflow-y-auto bg-[#F8F7F2] no-scrollbar">
                {/* HERO */}
                <motion.section
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                        duration: 0.3,
                        ease: "easeOut",
                    }}
                    className="relative overflow-hidden bg-[#173C2E]"
                >
                    <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/[0.035]" />
                    <div className="pointer-events-none absolute -bottom-24 right-20 h-52 w-52 rounded-full bg-[#c69258]/10" />

                    <div className="mx-auto max-w-[940px] px-5 pb-5 pt-5">
                        <div className="lg:hidden">
                            <button
                                onClick={() =>
                                    setMenuOpen(true)
                                }
                                className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 text-white"
                                aria-label="Open menu"
                            >
                                <IoMenu size={20} />
                            </button>
                        </div>

                        <div className="mt-2 flex items-start gap-6 lg:mt-0">
                            <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#c69258]">
                                    ekariExperts
                                </div>

                                <h1 className="mt-2 text-[28px] font-black tracking-[-0.035em] text-white">
                                    Find the right agricultural expert
                                </h1>

                                <p className="mt-1.5 max-w-2xl text-[13px] font-medium leading-5 text-white/55">
                                    Connect with verified agronomists,
                                    veterinarians, farm consultants and
                                    agricultural professionals.
                                </p>
                            </div>

                            <div className="hidden shrink-0 items-start gap-6 xl:flex">
                                <div className="text-center">
                                    <div className="text-[24px] font-black leading-none text-[#c69258]">
                                        {expertStats.verifiedCount}
                                    </div>
                                    <div className="mt-1 text-[10px] font-semibold text-white/40">
                                        verified experts
                                    </div>
                                </div>

                                <div className="text-center">
                                    <div className="text-[24px] font-black leading-none text-[#c69258]">
                                        {expertStats.locations}
                                    </div>
                                    <div className="mt-1 text-[10px] font-semibold text-white/40">
                                        service areas
                                    </div>
                                </div>

                                <div className="text-center">
                                    <div className="text-[24px] font-black leading-none text-[#c69258]">
                                        {expertStats.averageRating > 0
                                            ? expertStats.averageRating.toFixed(
                                                1
                                            )
                                            : "—"}
                                    </div>
                                    <div className="mt-1 text-[10px] font-semibold text-white/40">
                                        avg rating
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div
                            className={[
                                "mt-4 flex h-12 items-center rounded-[18px]",
                                "border border-white/15 bg-[#FBFAF6]",
                                "shadow-[0_12px_28px_rgba(0,0,0,0.12)]",
                                "transition-all duration-200",
                                "focus-within:shadow-[0_0_0_3px_rgba(243,154,34,0.13)]",
                            ].join(" ")}
                        >
                            <span className="grid w-12 shrink-0 place-items-center text-slate-400">
                                <IoSearchOutline size={20} />
                            </span>

                            <input
                                value={search}
                                onChange={(event) =>
                                    setSearch(
                                        event.target.value
                                    )
                                }
                                placeholder="Search by name, specialty, county or service…"
                                className="min-w-0 flex-1 bg-transparent px-1 text-[13px] font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                            />

                            {search ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setSearch("")
                                    }
                                    className="mr-2 grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-black/[0.04] hover:text-slate-600"
                                    aria-label="Clear search"
                                >
                                    <IoClose size={18} />
                                </button>
                            ) : null}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[10px] font-bold text-white/45">
                            <span className="inline-flex items-center gap-1.5">
                                <IoShieldCheckmarkOutline
                                    size={14}
                                    className="text-[#c69258]"
                                />
                                Verified profiles
                            </span>

                            <span className="inline-flex items-center gap-1.5">
                                <IoLocationOutline
                                    size={14}
                                    className="text-[#c69258]"
                                />
                                Experts across Kenya
                            </span>

                            <span className="inline-flex items-center gap-1.5">
                                <IoStarOutline
                                    size={14}
                                    className="text-[#c69258]"
                                />
                                Reviews and ratings
                            </span>
                        </div>
                    </div>
                </motion.section>

                {/* FILTER BAR */}
                <section className="sticky top-0 z-30 border-b border-[#E4DED2] bg-[#FBFAF6]/95 backdrop-blur-xl">
                    <div className="mx-auto flex max-w-[940px] items-center gap-2 overflow-x-auto px-5 py-3 no-scrollbar">
                        <button
                            type="button"
                            onClick={() => {
                                setSpecialty("");
                            }}
                            className={[
                                "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4",
                                "text-[12px] font-black transition-all duration-200",
                                !specialty
                                    ? "border-[#173C2E] bg-[#173C2E] text-white"
                                    : "border-[#D9D3C7] bg-white text-slate-600 hover:border-[#C7BFB1]",
                                "active:scale-[0.98]",
                            ].join(" ")}
                        >
                            <IoGridOutline size={15} />
                            All specialties
                        </button>

                        {quickSpecialties.map(
                            (item) => {
                                const active =
                                    specialty === item;

                                return (
                                    <button
                                        key={item}
                                        type="button"
                                        onClick={() =>
                                            setSpecialty(
                                                active
                                                    ? ""
                                                    : item
                                            )
                                        }
                                        className={[
                                            "h-10 shrink-0 rounded-full border px-4",
                                            "text-[12px] font-bold transition-all duration-200",
                                            active
                                                ? "border-[#173C2E] bg-[#173C2E] text-white"
                                                : "border-[#D9D3C7] bg-white text-slate-600 hover:border-[#C7BFB1] hover:bg-[#FFFDF8]",
                                            "active:scale-[0.98]",
                                        ].join(" ")}
                                    >
                                        {item}
                                    </button>
                                );
                            }
                        )}

                        <button
                            type="button"
                            onClick={() =>
                                setFiltersOpen(true)
                            }
                            className={[
                                "ml-auto inline-flex h-10 shrink-0 items-center gap-2 rounded-full",
                                "border border-[#D9D3C7] bg-white px-4",
                                "text-[12px] font-black text-slate-600",
                                "transition-all duration-200",
                                "hover:border-[#c69258]/55 hover:bg-[#FFF9F0]",
                                "active:scale-[0.98]",
                            ].join(" ")}
                        >
                            <IoFilterOutline size={15} />
                            Filter experts
                            {activeFilterCount > 0 ? (
                                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#c69258] px-1 text-[9px] text-white">
                                    {activeFilterCount}
                                </span>
                            ) : null}
                        </button>
                    </div>
                </section>

                {/* RESULTS */}
                <section className="mx-auto max-w-[940px] px-5 pb-24 pt-4">
                    <div className="mb-3 flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-[15px] font-black text-slate-800">
                                Agricultural experts
                            </h2>

                            <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                                {loading
                                    ? "Finding experts…"
                                    : `${filteredExperts.length} ${filteredExperts.length ===
                                        1
                                        ? "expert"
                                        : "experts"
                                    } found`}
                            </p>
                        </div>

                        <div className="relative">
                            <select
                                id="expert-sort"
                                value={sort}
                                onChange={(event) =>
                                    setSort(
                                        event.target
                                            .value as SortOption
                                    )
                                }
                                className={[
                                    "h-9 appearance-none rounded-full border border-[#D9D3C7]",
                                    "bg-white py-0 pl-3 pr-8",
                                    "text-[11px] font-bold text-slate-600 outline-none",
                                ].join(" ")}
                            >
                                <option value="recommended">
                                    Recommended
                                </option>
                                <option value="rating">
                                    Highest rated
                                </option>
                                <option value="consultations">
                                    Most consultations
                                </option>
                                <option value="price_low">
                                    Price: low to high
                                </option>
                                <option value="price_high">
                                    Price: high to low
                                </option>
                                <option value="newest">
                                    Newest profiles
                                </option>
                            </select>

                            <IoChevronDown
                                size={14}
                                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                        </div>
                    </div>

                    {activeFilterCount > 0 ? (
                        <div className="mb-3 flex flex-wrap items-center gap-1.5">
                            {county ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setCounty("")
                                    }
                                    className="inline-flex items-center gap-1 rounded-full border border-[#DDD8CC] bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500"
                                >
                                    {county}
                                    <IoClose size={12} />
                                </button>
                            ) : null}

                            {specialty ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setSpecialty("")
                                    }
                                    className="inline-flex items-center gap-1 rounded-full border border-[#DDD8CC] bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500"
                                >
                                    {specialty}
                                    <IoClose size={12} />
                                </button>
                            ) : null}

                            {acceptingOnly ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setAcceptingOnly(
                                            false
                                        )
                                    }
                                    className="inline-flex items-center gap-1 rounded-full border border-[#DDD8CC] bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500"
                                >
                                    Accepting clients
                                    <IoClose size={12} />
                                </button>
                            ) : null}

                            <button
                                type="button"
                                onClick={clearFilters}
                                className="ml-1 text-[10px] font-black text-[#E88712]"
                            >
                                Clear all
                            </button>
                        </div>
                    ) : null}

                    {errorMessage ? (
                        <div className="rounded-[18px] border border-rose-200 bg-rose-50 p-5">
                            <div className="font-black text-rose-800">
                                Experts could not be loaded
                            </div>

                            <p className="mt-1 text-sm text-rose-600">
                                {errorMessage}
                            </p>

                            <button
                                type="button"
                                onClick={loadExperts}
                                className="mt-3 inline-flex items-center gap-2 rounded-full bg-rose-700 px-4 py-2 text-xs font-black text-white"
                            >
                                <IoRefreshOutline size={15} />
                                Try again
                            </button>
                        </div>
                    ) : null}

                    {loading ? (
                        <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.2,
                                ease: "easeOut",
                            }}
                            className={[
                                "grid min-h-[280px] place-items-center",
                                "rounded-[20px]",
                                "border border-[#DDD8CC]",
                                "bg-[#FBFAF6]",
                                "px-6 py-10",
                                "shadow-[0_12px_30px_rgba(15,23,42,0.035)]",
                            ].join(" ")}
                        >
                            <div className="text-center">
                                <div className="flex justify-center">
                                    <BouncingBallLoader />
                                </div>

                                <p className="mt-5 text-[13px] font-black text-slate-900">
                                    Finding agricultural experts...
                                </p>

                                <p className="mx-auto mt-1.5 max-w-sm text-[10px] font-medium leading-5 text-slate-400">
                                    Loading verified experts, specialties and service areas.
                                </p>
                            </div>
                        </motion.div>
                    ) : null}

                    {!loading &&
                        !errorMessage &&
                        filteredExperts.length > 0 ? (
                        <motion.div
                            key={`${search}-${specialty}-${county}-${sort}-${acceptingOnly}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{
                                duration: 0.2,
                                ease: "easeOut",
                            }}
                            className="space-y-3"
                        >
                            {filteredExperts.map(
                                (expert) => (
                                    <ExpertCard
                                        key={expert.uid}
                                        expert={expert}
                                    />
                                )
                            )}
                        </motion.div>
                    ) : null}

                    {!loading &&
                        !errorMessage &&
                        filteredExperts.length === 0 ? (
                        <div className="rounded-[20px] border border-[#DDD8CC] bg-white px-6 py-14 text-center">
                            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#E8ECE8] text-[#173C2E]">
                                <IoPeopleOutline size={26} />
                            </div>

                            <h3 className="mt-4 text-lg font-black text-slate-800">
                                No experts found
                            </h3>

                            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-400">
                                Try another specialty,
                                location or search phrase.
                            </p>

                            <button
                                type="button"
                                onClick={clearFilters}
                                className="mt-4 rounded-full bg-[#173C2E] px-5 py-2.5 text-sm font-black text-white"
                            >
                                Clear filters
                            </button>
                        </div>
                    ) : null}
                </section>

                {filtersOpen ? (
                    <div
                        className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-5"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="expert-filter-title"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) {
                                setFiltersOpen(false);
                            }
                        }}
                    >
                        <div
                            className="max-h-[92vh] w-full overflow-hidden rounded-t-3xl border bg-white shadow-2xl sm:max-w-xl sm:rounded-3xl"
                            style={{ borderColor: EKARI.hair }}
                        >
                            <div className="flex items-center justify-between border-b px-5 py-4 sm:px-6"
                                style={{ borderColor: EKARI.hair }}
                            >
                                <div>
                                    <h2
                                        id="expert-filter-title"
                                        className="text-lg font-black"
                                        style={{ color: EKARI.text }}
                                    >
                                        Filter experts
                                    </h2>
                                    <p className="mt-1 text-xs" style={{ color: EKARI.subtext }}>
                                        Narrow results by location, specialty and availability.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setFiltersOpen(false)}
                                    className="grid h-10 w-10 place-items-center rounded-full border bg-white"
                                    style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                    aria-label="Close filters"
                                >
                                    <IoClose size={21} />
                                </button>
                            </div>

                            <div className="max-h-[calc(92vh-145px)] overflow-y-auto px-5 py-5 sm:px-6">
                                <div>
                                    <label
                                        className="text-xs font-black uppercase tracking-wide"
                                        style={{ color: EKARI.subtext }}
                                    >
                                        Service location
                                    </label>

                                    <div className="relative mt-2">
                                        <IoLocationOutline
                                            size={17}
                                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                                            color={EKARI.subtext}
                                        />

                                        <select
                                            value={county}
                                            onChange={(event) => setCounty(event.target.value)}
                                            className="w-full appearance-none rounded-2xl border bg-white py-3.5 pl-10 pr-9 text-sm font-semibold outline-none"
                                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                        >
                                            <option value="">All locations</option>
                                            {locationOptions.map((locationName) => (
                                                <option key={locationName} value={locationName}>
                                                    {locationName}
                                                </option>
                                            ))}
                                        </select>

                                        <IoChevronDown
                                            size={16}
                                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                                            color={EKARI.subtext}
                                        />
                                    </div>
                                </div>

                                <div className="mt-5">
                                    <label
                                        className="text-xs font-black uppercase tracking-wide"
                                        style={{ color: EKARI.subtext }}
                                    >
                                        Specialty
                                    </label>

                                    <div className="relative mt-2">
                                        <IoBriefcaseOutline
                                            size={17}
                                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                                            color={EKARI.subtext}
                                        />

                                        <select
                                            value={specialty}
                                            onChange={(event) => setSpecialty(event.target.value)}
                                            className="w-full appearance-none rounded-2xl border bg-white py-3.5 pl-10 pr-9 text-sm font-semibold outline-none"
                                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                        >
                                            <option value="">All specialties</option>
                                            {specialtiesLoading ? (
                                                <option value="" disabled>
                                                    Loading specialties…
                                                </option>
                                            ) : null}
                                            {specialtyOptions.map((item) => (
                                                <option key={item} value={item}>
                                                    {item}
                                                </option>
                                            ))}
                                        </select>

                                        <IoChevronDown
                                            size={16}
                                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                                            color={EKARI.subtext}
                                        />
                                    </div>
                                </div>

                                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border p-4">
                                    <input
                                        type="checkbox"
                                        checked={acceptingOnly}
                                        onChange={(event) => setAcceptingOnly(event.target.checked)}
                                        className="mt-0.5 h-4 w-4 accent-[#233F39]"
                                    />

                                    <span>
                                        <span
                                            className="block text-sm font-black"
                                            style={{ color: EKARI.text }}
                                        >
                                            Accepting clients
                                        </span>
                                        <span
                                            className="mt-1 block text-xs leading-5"
                                            style={{ color: EKARI.subtext }}
                                        >
                                            Show experts currently available for new consultations.
                                        </span>
                                    </span>
                                </label>

                                <div
                                    className="mt-5 rounded-2xl p-4"
                                    style={{ backgroundColor: "rgba(35,63,57,0.06)" }}
                                >
                                    <div
                                        className="flex items-center gap-2 text-xs font-black"
                                        style={{ color: EKARI.forest }}
                                    >
                                        <IoShieldCheckmarkOutline size={16} />
                                        Trusted profiles
                                    </div>
                                    <p className="mt-2 text-xs leading-5" style={{ color: EKARI.subtext }}>
                                        Verification badges identify experts whose identity or professional credentials have been reviewed by ekarihub.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 border-t bg-white px-5 py-4 sm:px-6"
                                style={{ borderColor: EKARI.hair }}
                            >
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="min-h-11 flex-1 rounded-xl border bg-white px-4 text-sm font-black"
                                    style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                >
                                    Clear
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFiltersOpen(false)}
                                    className="min-h-11 flex-[1.35] rounded-xl px-4 text-sm font-black text-white"
                                    style={{ backgroundColor: EKARI.forest }}
                                >
                                    Show {filteredExperts.length} {filteredExperts.length === 1 ? "expert" : "experts"}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}
                <EkariSideMenuSheet
                    open={menuOpen}
                    onClose={() => setMenuOpen(false)}
                    uid={user?.uid}
                    handle={(profile as any)?.handle ?? null}
                    photoURL={(profile as any)?.photoURL ?? null}
                    profileHref={profileHref}
                    unreadDM={user?.uid ? unreadDM ?? 0 : 0}
                    notifTotal={user?.uid ? notifTotal ?? 0 : 0}
                    onLogout={signOutUser}
                />
            </main>
        </AppShellRightRail>
    );
}
/* ---------- Profiles ---------- */
function useUserProfile(uid?: string) {
    const [profile, setProfile] = useState<{
        handle?: string;
        photoURL?: string;
        dataSaverVideos?: boolean;
        uid?: string;
    } | null>(null);

    useEffect(() => {
        if (!uid) {
            setProfile(null);
            return;
        }
        const ref = doc(db, "users", uid);
        const unsub = onSnapshot(ref, (snap) => {
            const data = snap.data() as any | undefined;
            if (!data) {
                setProfile(null);
                return;
            }
            setProfile({
                uid,
                handle: data?.handle,
                photoURL: data?.photoURL,
                dataSaverVideos: !!data?.dataSaverVideos,
            });
        });
        return () => unsub();
    }, [uid]);

    return profile;
}

export default function EkariExpertsClient() {
    const { user, signOutUser } = useAuth();
    const router = useRouter();
    const isDesktop = useIsDesktop();


    const goUpload = () => {
        if (!user?.uid) router.push("/getstarted?next=/studio/upload");
        else router.push("/studio/upload");
    };
    return <><MarketplaceContent />
        {!isDesktop && (<>
            <MobileBottomTabs
                onCreate={goUpload}
                theme="light"
                activeKey="experts"
            />

        </>)};
    </>
}

function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia(query);

        const updateMatch = () => {
            setMatches(mediaQuery.matches);
        };

        updateMatch();

        mediaQuery.addEventListener("change", updateMatch);

        return () => {
            mediaQuery.removeEventListener("change", updateMatch);
        };
    }, [query]);

    return matches;
}