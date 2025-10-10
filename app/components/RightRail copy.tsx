"use client";
import React from "react";

const EKARI = { hair: "#E5E7EB", text: "#111827", subtext: "#6B7280" };

export default function RightRail() {
    return (
        <aside
            className="hidden lg:flex sticky top-0 h-screen w-[320px] shrink-0 border-l"
            style={{ borderColor: EKARI.hair }}
        >
            <div className="p-4 w-full">
                <h3 className="font-extrabold mb-3" style={{ color: EKARI.text }}>
                    Suggested accounts
                </h3>
                <div className="space-y-2">
                    {["@dairy.coop", "@machinery.ke", "@horti.africa"].map((h) => (
                        <div key={h} className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-gray-200" />
                            <div>
                                <div className="text-sm font-bold" style={{ color: EKARI.text }}>
                                    {h}
                                </div>
                                <div className="text-xs" style={{ color: EKARI.subtext }}>
                                    Follows you
                                </div>
                            </div>
                            <button
                                className="ml-auto rounded-full border px-3 py-1 text-xs font-bold hover:bg-gray-50"
                                style={{ borderColor: EKARI.hair }}
                            >
                                Follow
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
}
