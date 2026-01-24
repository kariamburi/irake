"use client";

import * as React from "react";

type Props = {
    open: boolean;
    title?: string;
    message: string;
    onUpgrade: () => void;
    onClose: () => void;
};

export function ListingLimitDialogSimple({
    open,
    title = "Listing limit reached",
    message,
    onUpgrade,
    onClose,
}: Props) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[9999]">
            {/* backdrop */}
            <button
                aria-label="Close dialog"
                onClick={onClose}
                className="absolute inset-0 bg-black/40"
            />

            {/* card */}
            <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-xl">
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                    {message}
                </p>

                <div className="mt-5 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                    >
                        OK
                    </button>

                    <button
                        onClick={() => {
                            onUpgrade();
                            onClose();
                        }}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:opacity-95"
                    >
                        Upgrade plan
                    </button>
                </div>
            </div>
        </div>
    );
}
