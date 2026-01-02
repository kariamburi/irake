export type VerificationStatus = "none" | "pending" | "approved" | "rejected";
export type VerificationType = "individual" | "business" | "company";

export type VerificationBadgeSource = {
    verificationStatus?: VerificationStatus;
    verificationType?: VerificationType;
    verificationRoleLabel?: string;
    verificationOrganizationName?: string;
};

export function getVerificationBadgeText(v?: VerificationBadgeSource) {
    const status = (v?.verificationStatus ?? "none") as VerificationStatus;
    if (status !== "approved") return null;

    const type = (v?.verificationType ?? "individual") as VerificationType;
    const roleLabel = v?.verificationRoleLabel;
    const orgName = v?.verificationOrganizationName;

    const base =
        type === "business"
            ? "Verified Business"
            : type === "company"
                ? "Verified Company"
                : "Verified";

    const detail =
        type === "individual" ? roleLabel : (orgName || roleLabel);

    return detail ? `${base} • ${detail}` : base;
}
