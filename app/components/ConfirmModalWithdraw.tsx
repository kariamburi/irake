"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";

type ConfirmModalProps = {
    open: boolean;
    title?: string;
    message?: string;

    /** Optional extra UI (forms, selects, etc.) */
    children?: React.ReactNode;

    confirmText?: string;
    cancelText?: string | null; // null hides cancel
    confirmDisabled?: boolean;

    onConfirm: () => void;
    onCancel: () => void;
};

export function ConfirmModalWithdraw({
    open,
    title = "Are you sure?",
    message = "This action cannot be undone.",
    children,
    confirmText = "Yes, continue",
    cancelText = null,
    confirmDisabled = false,
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    const hasCancel = !!cancelText;
    const confirmWidth = hasCancel ? "w-1/2" : "w-full";

    return createPortal(
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center" aria-live="assertive">
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
                        className="relative z-[101] w-[92vw] max-w-md rounded-2xl border bg-white p-5 shadow-xl"
                        style={{ borderColor: "#E5E7EB" }}
                        initial={{ opacity: 0, scale: 0.96, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 6 }}
                        transition={{ type: "spring", stiffness: 240, damping: 22, mass: 0.7 }}
                    >
                        <div className="mb-3">
                            <h2 id="confirm-title" className="text-lg font-black text-[#0F172A]">
                                {title}
                            </h2>
                            <p id="confirm-desc" className="mt-1 text-sm text-[#6B7280] whitespace-pre-line">
                                {message}
                            </p>
                        </div>

                        {/* Extra content (forms/selects) */}
                        {children ? <div className="mt-3">{children}</div> : null}

                        <div className="mt-4 flex gap-2">
                            {cancelText ? (
                                <button
                                    onClick={onCancel}
                                    className="w-1/2 rounded-xl border px-4 py-2.5 text-sm font-bold"
                                    style={{ borderColor: "#E5E7EB", color: "#0F172A", background: "#fff" }}
                                >
                                    {cancelText}
                                </button>
                            ) : null}

                            <button
                                onClick={onConfirm}
                                disabled={confirmDisabled}
                                className={`${confirmWidth} rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 disabled:cursor-not-allowed`}
                                style={{ background: "#C79257" }}
                            >
                                {confirmText}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}