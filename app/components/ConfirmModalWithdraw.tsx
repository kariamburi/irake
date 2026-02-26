"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";

type ConfirmModalProps = {
    open: boolean;
    title?: string;
    message?: string;

    children?: React.ReactNode;

    confirmText?: string;
    cancelText?: string | null;
    confirmDisabled?: boolean;

    onConfirm: () => void;
    onCancel: () => void;
};

export function ConfirmModalWithdraw({
    open,
    title = "Are you sure?",
    message = "",
    children,
    confirmText = "Yes, continue",
    cancelText = "Cancel",
    confirmDisabled = false,
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    const [mounted, setMounted] = useState(false);

    // ✅ Hook 1
    useEffect(() => setMounted(true), []);

    // ✅ Hook 2 (always called, but does nothing unless open)
    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onCancel]);

    const hasCancel = !!cancelText;
    const confirmWidth = hasCancel ? "w-1/2" : "w-full";

    // ✅ After hooks: safe to return early
    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {open && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center px-2 sm:px-4"
                    aria-live="assertive"
                >
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onCancel}
                    />

                    {/* Dialog */}
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="confirm-title"
                        aria-describedby="confirm-desc"
                        className="
              relative z-[101]
              w-[96vw] sm:w-full sm:max-w-2xl
              h-[90vh] max-h-[90vh]
              rounded-3xl border bg-white shadow-xl
              flex flex-col overflow-hidden
            "
                        style={{ borderColor: "#E5E7EB" }}
                        initial={{ opacity: 0, scale: 0.97, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 6 }}
                        transition={{ type: "spring", stiffness: 240, damping: 22, mass: 0.7 }}
                    >
                        {/* Header */}
                        <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: "#E5E7EB" }}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h2
                                        id="confirm-title"
                                        className="text-base sm:text-lg font-black text-[#0F172A] truncate"
                                    >
                                        {title}
                                    </h2>

                                    {message ? (
                                        <p
                                            id="confirm-desc"
                                            className="mt-1 text-xs sm:text-sm text-[#6B7280] whitespace-pre-line"
                                        >
                                            {message}
                                        </p>
                                    ) : (
                                        <p id="confirm-desc" className="sr-only">
                                            Confirm action
                                        </p>
                                    )}
                                </div>

                                {/* Close */}
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-extrabold hover:bg-slate-50"
                                    style={{ borderColor: "#E5E7EB", color: "#0F172A" }}
                                    aria-label="Close"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Body (scrollable) */}
                        <div className="flex-1 overflow-y-auto px-5 py-4">{children ? children : null}</div>

                        {/* Footer */}
                        <div className="px-5 py-4 border-t bg-white" style={{ borderColor: "#E5E7EB" }}>
                            <div className="flex gap-2">
                                {cancelText ? (
                                    <button
                                        type="button"
                                        onClick={onCancel}
                                        className="w-1/2 rounded-2xl border px-4 py-2.5 text-sm font-extrabold hover:bg-slate-50"
                                        style={{ borderColor: "#E5E7EB", color: "#0F172A", background: "#fff" }}
                                    >
                                        {cancelText}
                                    </button>
                                ) : null}

                                <button
                                    type="button"
                                    onClick={onConfirm}
                                    disabled={confirmDisabled}
                                    className={`${confirmWidth} rounded-2xl px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-60 disabled:cursor-not-allowed`}
                                    style={{ background: "#C79257" }}
                                >
                                    {confirmText}
                                </button>
                            </div>

                            <p className="mt-2 text-[11px] text-slate-400">
                                Tip: Press <span className="font-semibold">Esc</span> to close
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}