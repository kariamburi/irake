import { Timestamp } from "firebase/firestore";

export type ConsultationMode =
    | "phone"
    | "whatsapp"
    | "video"
    | "in_person";

export interface ExpertAvailabilityDay {
    enabled: boolean;
    startTime: string;
    endTime: string;
}

export interface ExpertAvailability {
    monday: ExpertAvailabilityDay;
    tuesday: ExpertAvailabilityDay;
    wednesday: ExpertAvailabilityDay;
    thursday: ExpertAvailabilityDay;
    friday: ExpertAvailabilityDay;
    saturday: ExpertAvailabilityDay;
    sunday: ExpertAvailabilityDay;
}

export interface ExpertProfile {
    /**
     * The user has chosen to offer expert services.
     * Professional approval still comes from verification.status.
     */
    isEnabled: boolean;

    /**
     * Controls whether the expert appears in the public experts directory.
     */
    isVisible: boolean;

    professionalBio: string;
    specialties: string[];

    countiesServed: string[];
    languages: string[];

    whatsappNumber: string;

    consultationFeeKes: number;
    consultationDurationMinutes: number;

    consultationModes: ConsultationMode[];

    acceptsBookings: boolean;
    acceptsCalls: boolean;
    acceptsWhatsapp: boolean;
    acceptsOnlineConsultation: boolean;
    acceptsInPersonConsultation: boolean;

    availability: ExpertAvailability;

    avgRating: number;
    reviewsCount: number;
    consultationsCount: number;

    createdAt?: Timestamp | null;
    updatedAt?: Timestamp | null;
}