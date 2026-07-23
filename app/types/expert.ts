import { Timestamp } from "firebase/firestore";

export type ExpertProfileStatus =
    | "draft"
    | "active"
    | "paused"
    | "suspended";

export type ConsultationMethod =
    | "phone"
    | "whatsapp"
    | "video"
    | "physical";

export type ExpertFeeType = "fixed" | "starting_from" | "free";

export type ExpertLocation = {
    county: string;
    town: string;
    latitude: number | null;
    longitude: number | null;
    geohash?: string | null;
};

export type ExpertPricing = {
    currency: "KES";
    consultationFee: number;
    physicalVisitFeeFrom: number | null;
    feeType: ExpertFeeType;
    consultationDurationMinutes: number;
};

export type ExpertTerms = {
    summary: string;
    cancellationNoticeHours: number;
    cancellationPolicy: string;
    allowsRescheduling: boolean;
    paymentRequiredBeforeBooking: boolean;
};

export type ExpertAvailability = {
    timezone: string;
    scheduleConfigured: boolean;
};

export type ExpertRating = {
    average: number;
    count: number;
};

export type ExpertProfile = {
    uid: string;

    status: ExpertProfileStatus;
    isDiscoverable: boolean;
    acceptingBookings: boolean;

    headline: string;
    expertBio: string;

    specialties: string[];
    countiesServed: string[];
    languages: string[];
    consultationMethods: ConsultationMethod[];

    primaryLocation: ExpertLocation;

    pricing: ExpertPricing;
    terms: ExpertTerms;
    availability: ExpertAvailability;

    rating: ExpertRating;
    completedConsultations: number;

    createdAt?: Timestamp | null;
    updatedAt?: Timestamp | null;
    publishedAt?: Timestamp | null;

    suspendedAt?: Timestamp | null;
    suspendedReason?: string | null;
};