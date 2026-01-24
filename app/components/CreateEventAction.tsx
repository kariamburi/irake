"use client";

import React, { useCallback, useState } from "react";
import { IoAdd } from "react-icons/io5";

// IMPORTANT: import these from where they live after refactor
// If you keep them in the same file for now, you can temporarily pass them as props instead.
import { BottomSheet } from "./primitives/BottomSheet"; // <- adjust path
import { EventForm } from "./forms/EventForm"; // <- adjust path

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    hair: "#E5E7EB",
    text: "#0F172A",
};

export function CreateEventAction({
    compact,
    label = "Create Event",
    buttonClassName = "",
}: {
    compact?: boolean;
    label?: string;
    buttonClassName?: string;
}) {
    const [open, setOpen] = useState(false);
    const [footer, setFooter] = useState<React.ReactNode>(null);

    const provideFooter = useCallback((node: React.ReactNode) => setFooter(node), []);

    const ringStyle = { ["--tw-ring-color" as any]: EKARI.forest } as React.CSSProperties;

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className={
                    buttonClassName ||
                    `inline-flex items-center gap-2 rounded-full ${compact ? "px-3 py-2 text-xs" : "px-4 py-2 text-sm"
                    } font-black transition focus:ring-2 border bg-white/70 hover:bg-white`
                }
                style={{
                    borderColor: "rgba(199,146,87,0.60)",
                    color: EKARI.text,
                    ...ringStyle,
                }}
            >
                <IoAdd size={compact ? 16 : 18} style={{ color: EKARI.gold }} />
                <span>{label}</span>
            </button>

            <BottomSheet
                open={open}
                onClose={() => {
                    setOpen(false);
                    setFooter(null);
                }}
                title="Create Event"
                footer={footer}
            >
                <EventForm
                    onDone={() => {
                        setOpen(false);
                        setFooter(null);
                    }}
                    provideFooter={provideFooter}
                />
            </BottomSheet>
        </>
    );
}
