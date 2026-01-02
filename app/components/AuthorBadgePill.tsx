// AuthorBadgePill.tsx
import React from "react";

export type AuthorBadge = {
    verificationStatus?: "approved" | "pending" | "rejected" | "none";
    verificationType?: "individual" | "business" | "company" | "organization";
    verificationRoleLabel?: string | null;
    verificationOrganizationName?: string | null;
};

export function AuthorBadgePill({ badge }: { badge?: AuthorBadge }) {
    if (!badge) return null;

    // only show when approved
    const verified = badge.verificationStatus === "approved";
    if (!verified) return null;

    const role =
        (badge.verificationRoleLabel?.trim() || "") ||
        // fallback: show type if role missing
        (badge.verificationType ? badge.verificationType : "Verified");

    const org = badge.verificationOrganizationName?.trim() || "";

    return (
        <span
            className="ml-2 inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[10px] font-extrabold bg-[#C79257] text-black"
            title={org ? `${role} • ${org}` : role}
        >
            ✓
            <span className="leading-none truncate max-w-[140px]">{role}</span>
            {org ? <span className="opacity-80">•</span> : null}
            {org ? <span className="opacity-80 truncate max-w-[120px]">{org}</span> : null}
        </span>
    );
}
