import type { Timestamp } from "firebase/firestore";

export type PublicExpertLocation = {
    county: string;
    town: string;
    latitude: number | null;
    longitude: number | null;
    geohash: string | null;
};

export type PublicExpertPricing = {
    currency: "KES";
    consultationFee: number;
    physicalVisitFeeFrom: number | null;
    feeType: "fixed" | "starting_from" | "free" | string;
    consultationDurationMinutes: number;
};

export type PublicExpertTerms = {
    summary: string;
    cancellationNoticeHours: number;
    cancellationPolicy: string;
    allowsRescheduling: boolean;
    paymentRequiredBeforeBooking: boolean;
};

export type PublicExpertRating = {
    average: number;
    count: number;
};

export type PublicExpert = {
    uid: string;

    displayName: string;
    firstName: string;
    surname: string;
    handle: string;
    photoURL: string;

    headline: string;
    expertBio: string;

    verificationRole: string;
    verificationType: string;
    organizationName: string;

    specialties: string[];
    countiesServed: string[];
    languages: string[];
    consultationMethods: string[];

    primaryLocation: PublicExpertLocation;
    pricing: PublicExpertPricing;
    terms: PublicExpertTerms;

    acceptingBookings: boolean;
    verified: boolean;

    rating: PublicExpertRating;
    completedConsultations: number;

    publishedAt?: Timestamp | null;
    updatedAt?: Timestamp | null;
};