"use client";

import React, {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    getFunctions,
    httpsCallable,
} from "firebase/functions";

import {
    collection,
    doc,
    onSnapshot,
} from "firebase/firestore";

import {
    app,
    db,
} from "@/lib/firebase";

type TargetMode =
    | "me"
    | "selected_users"
    | "captured_source"
    | "all";

type EkariUser = {
    uid: string;
    displayName?: string | null;
    handle?: string | null;
    email?: string | null;
    photoURL?: string | null;
};

type BroadcastProgress = {
    status?: string;

    totalUsers?: number;
    processed?: number;

    notificationCount?: number;

    pushCount?: number;
    pushFailedCount?: number;

    emailQueued?: number;
    emailSkipped?: number;

    emailSentCount?: number;
    emailDeliverySkippedCount?: number;
    emailFailedCount?: number;

    failedCount?: number;

    error?: string | null;
};

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
};

export default function AdminNotificationsPage() {
    const [title, setTitle] =
        useState("");

    const [body, setBody] =
        useState("");

    const [sendPush, setSendPush] =
        useState(true);

    const [sendEmail, setSendEmail] =
        useState(false);

    /*
     * Safer default:
     * don't accidentally broadcast while testing.
     */
    const [target, setTarget] =
        useState<TargetMode>("me");

    const [sending, setSending] =
        useState(false);

    const [result, setResult] =
        useState<BroadcastProgress | null>(
            null
        );

    const [error, setError] =
        useState("");

    const [progress, setProgress] =
        useState<BroadcastProgress | null>(
            null
        );

    const [
        currentBroadcastId,
        setCurrentBroadcastId,
    ] = useState<string | null>(null);

    /*
     * User selector
     */
    const [users, setUsers] =
        useState<EkariUser[]>([]);

    const [
        loadingUsers,
        setLoadingUsers,
    ] = useState(true);

    const [
        userSearch,
        setUserSearch,
    ] = useState("");

    const [
        selectedUsers,
        setSelectedUsers,
    ] = useState<EkariUser[]>([]);

    /*
     * Load users for recipient search.
     */
    useEffect(() => {
        setLoadingUsers(true);

        const usersRef =
            collection(db, "users");

        const unsub = onSnapshot(
            usersRef,
            (snap) => {
                const items: EkariUser[] =
                    snap.docs.map(
                        (docSnap) => {
                            const data =
                                docSnap.data() as any;

                            return {
                                uid: docSnap.id,

                                displayName:
                                    data.displayName ??
                                    data.name ??
                                    null,

                                handle:
                                    data.handle ??
                                    null,

                                email:
                                    data.email ??
                                    null,

                                photoURL:
                                    data.photoURL ??
                                    null,
                            };
                        }
                    );

                setUsers(items);
                setLoadingUsers(false);
            },
            (err) => {
                console.error(
                    "Failed loading users",
                    err
                );

                setLoadingUsers(false);
            }
        );

        return () => unsub();
    }, []);

    /*
     * Partial search by:
     * - name
     * - handle
     * - email
     */
    const filteredUsers =
        useMemo(() => {
            const term =
                userSearch
                    .trim()
                    .toLowerCase();

            if (!term) {
                return [];
            }

            return users
                .filter((u) => {
                    /*
                     * Don't show users already selected.
                     */
                    if (
                        selectedUsers.some(
                            (selected) =>
                                selected.uid ===
                                u.uid
                        )
                    ) {
                        return false;
                    }

                    const name =
                        String(
                            u.displayName || ""
                        ).toLowerCase();

                    const handle =
                        String(
                            u.handle || ""
                        ).toLowerCase();

                    const email =
                        String(
                            u.email || ""
                        ).toLowerCase();

                    return (
                        name.includes(term) ||
                        handle.includes(term) ||
                        email.includes(term)
                    );
                })
                .slice(0, 15);
        }, [
            users,
            userSearch,
            selectedUsers,
        ]);

    function addSelectedUser(
        user: EkariUser
    ) {
        setSelectedUsers((prev) => {
            if (
                prev.some(
                    (item) =>
                        item.uid === user.uid
                )
            ) {
                return prev;
            }

            return [...prev, user];
        });

        setUserSearch("");
    }

    function removeSelectedUser(
        uid: string
    ) {
        setSelectedUsers((prev) =>
            prev.filter(
                (item) =>
                    item.uid !== uid
            )
        );
    }

    async function handleSend(
        e: React.FormEvent
    ) {
        e.preventDefault();

        setSending(true);
        setError("");
        setResult(null);
        setProgress(null);
        setCurrentBroadcastId(null);

        try {
            if (
                target ===
                "selected_users" &&
                selectedUsers.length === 0
            ) {
                throw new Error(
                    "Select at least one recipient."
                );
            }

            const fn = httpsCallable(
                getFunctions(app),
                "adminCreateBroadcastJob"
            );

            const res: any =
                await fn({
                    title:
                        title.trim(),

                    body:
                        body.trim(),

                    sendPush,
                    sendEmail,

                    target,

                    selectedUserIds:
                        target ===
                            "selected_users"
                            ? selectedUsers.map(
                                (u) =>
                                    u.uid
                            )
                            : [],
                });

            const broadcastId =
                String(
                    res?.data
                        ?.broadcastId ||
                    ""
                );

            if (!broadcastId) {
                throw new Error(
                    "Broadcast job ID was not returned."
                );
            }

            setCurrentBroadcastId(
                broadcastId
            );

            /*
             * Listen to this broadcast in realtime.
             *
             * Note:
             * We do NOT unsubscribe immediately when
             * broadcast status becomes "completed",
             * because email_jobs may still be sending.
             *
             * This lets emailSentCount continue updating.
             */
            const broadcastRef =
                doc(
                    db,
                    "adminBroadcasts",
                    broadcastId
                );

            const unsub =
                onSnapshot(
                    broadcastRef,
                    (snap) => {
                        if (
                            !snap.exists()
                        ) {
                            return;
                        }

                        const data =
                            snap.data() as BroadcastProgress;

                        setProgress(
                            data
                        );

                        /*
                         * The broadcast processor is done
                         * creating notifications / push /
                         * queueing emails.
                         *
                         * Email delivery can still continue
                         * after this.
                         */
                        if (
                            data.status ===
                            "completed"
                        ) {
                            setSending(
                                false
                            );

                            setResult(
                                data
                            );

                            /*
                             * Only stop listening immediately
                             * when email wasn't requested.
                             *
                             * If email was requested we keep
                             * listening so emailSentCount can
                             * move from 0 -> queued count.
                             */
                            if (
                                !sendEmail
                            ) {
                                unsub();
                            }
                        }

                        if (
                            data.status ===
                            "failed"
                        ) {
                            setSending(
                                false
                            );

                            setResult(
                                data
                            );

                            setError(
                                data.error ||
                                "Broadcast failed."
                            );

                            unsub();
                        }

                        /*
                         * Email processing is now fully
                         * accounted for.
                         */
                        if (
                            sendEmail &&
                            data.status ===
                            "completed"
                        ) {
                            const queued =
                                Number(
                                    data.emailQueued ||
                                    0
                                );

                            const sent =
                                Number(
                                    data.emailSentCount ||
                                    0
                                );

                            const skipped =
                                Number(
                                    data.emailDeliverySkippedCount ||
                                    0
                                );

                            const failed =
                                Number(
                                    data.emailFailedCount ||
                                    0
                                );

                            if (
                                queued > 0 &&
                                sent +
                                skipped +
                                failed >=
                                queued
                            ) {
                                unsub();
                            }
                        }
                    },
                    (snapshotError) => {
                        console.error(
                            snapshotError
                        );

                        setSending(
                            false
                        );

                        setError(
                            "Failed to monitor broadcast progress."
                        );
                    }
                );
        } catch (err: any) {
            console.error(err);

            setError(
                err?.message ||
                err?.details ||
                err?.code ||
                "Failed to create broadcast job."
            );

            setSending(false);
        }
    }

    const progressPercent =
        progress?.totalUsers &&
            progress.totalUsers > 0
            ? Math.round(
                ((progress.processed ||
                    0) /
                    progress.totalUsers) *
                100
            )
            : 0;

    const emailsCompletelyProcessed =
        Number(
            progress?.emailSentCount ||
            0
        ) +
        Number(
            progress
                ?.emailDeliverySkippedCount ||
            0
        ) +
        Number(
            progress?.emailFailedCount ||
            0
        );

    const emailDeliveryComplete =
        Number(
            progress?.emailQueued ||
            0
        ) > 0 &&
        emailsCompletelyProcessed >=
        Number(
            progress?.emailQueued ||
            0
        );

    const selectedUserValidation =
        target ===
        "selected_users" &&
        selectedUsers.length === 0;

    return (
        <div className="space-y-6">
            {/* HEADER */}
            <div>
                <h1
                    className="text-xl md:text-2xl font-extrabold"
                    style={{
                        color:
                            EKARI.text,
                    }}
                >
                    Send Notifications
                </h1>

                <p
                    className="text-sm mt-1"
                    style={{
                        color:
                            EKARI.dim,
                    }}
                >
                    Send in-app,
                    push notifications
                    and email to
                    Ekarihub users.
                </p>
            </div>

            <form
                onSubmit={
                    handleSend
                }
                className="rounded-2xl border bg-white p-4 md:p-5 space-y-5"
                style={{
                    borderColor:
                        EKARI.hair,
                }}
            >
                {/* TITLE */}
                <div>
                    <label
                        className="text-xs font-bold uppercase"
                        style={{
                            color:
                                EKARI.dim,
                        }}
                    >
                        Title
                    </label>

                    <input
                        value={title}
                        onChange={(
                            e
                        ) =>
                            setTitle(
                                e.target
                                    .value
                            )
                        }
                        className="mt-1 w-full rounded-xl border px-3 py-3 text-sm outline-none"
                        style={{
                            borderColor:
                                EKARI.hair,
                            color:
                                EKARI.text,
                        }}
                        placeholder="Example: New Ekarihub update"
                    />
                </div>

                {/* MESSAGE */}
                <div>
                    <label
                        className="text-xs font-bold uppercase"
                        style={{
                            color:
                                EKARI.dim,
                        }}
                    >
                        Message
                    </label>

                    <textarea
                        value={body}
                        onChange={(
                            e
                        ) =>
                            setBody(
                                e.target
                                    .value
                            )
                        }
                        rows={6}
                        className="mt-1 w-full rounded-xl border px-3 py-3 text-sm outline-none resize-y"
                        style={{
                            borderColor:
                                EKARI.hair,
                            color:
                                EKARI.text,
                        }}
                        placeholder="Write message to users..."
                    />
                </div>

                {/* TARGET */}
                <div>
                    <label
                        className="text-xs font-bold uppercase"
                        style={{
                            color:
                                EKARI.dim,
                        }}
                    >
                        Target
                        users
                    </label>

                    <select
                        value={
                            target
                        }
                        onChange={(
                            e
                        ) => {
                            const next =
                                e.target
                                    .value as TargetMode;

                            setTarget(
                                next
                            );

                            if (
                                next !==
                                "selected_users"
                            ) {
                                setUserSearch(
                                    ""
                                );
                            }
                        }}
                        className="mt-1 w-full rounded-xl border px-3 py-3 text-sm outline-none bg-white"
                        style={{
                            borderColor:
                                EKARI.hair,
                            color:
                                EKARI.text,
                        }}
                    >
                        <option value="me">
                            Test on
                            myself
                        </option>

                        <option value="selected_users">
                            Selected
                            users
                        </option>

                        <option value="captured_source">
                            Users with
                            captured
                            traffic source
                        </option>

                        <option value="all">
                            All users
                        </option>
                    </select>
                </div>

                {/* TEST MODE INFO */}
                {target ===
                    "me" && (
                        <div className="rounded-xl bg-blue-50 px-4 py-3">
                            <div className="text-sm font-bold text-blue-800">
                                Test
                                mode
                            </div>

                            <div className="mt-1 text-xs text-blue-700">
                                This
                                notification
                                will only
                                be sent
                                to your
                                own admin
                                account.
                                Use this
                                to verify
                                push and
                                email before
                                broadcasting.
                            </div>
                        </div>
                    )}

                {/* SELECTED USERS */}
                {target ===
                    "selected_users" && (
                        <div
                            className="rounded-2xl border p-4 space-y-3"
                            style={{
                                borderColor:
                                    EKARI.hair,
                            }}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div
                                        className="text-sm font-extrabold"
                                        style={{
                                            color:
                                                EKARI.text,
                                        }}
                                    >
                                        Select
                                        recipients
                                    </div>

                                    <div
                                        className="text-xs mt-1"
                                        style={{
                                            color:
                                                EKARI.dim,
                                        }}
                                    >
                                        Search
                                        by name,
                                        username
                                        or email.
                                    </div>
                                </div>

                                <div
                                    className="rounded-full px-3 py-1 text-xs font-bold"
                                    style={{
                                        backgroundColor:
                                            "#F1F5F9",
                                        color:
                                            EKARI.text,
                                    }}
                                >
                                    {
                                        selectedUsers.length
                                    }{" "}
                                    selected
                                </div>
                            </div>

                            <div className="relative">
                                <input
                                    type="text"
                                    value={
                                        userSearch
                                    }
                                    onChange={(
                                        e
                                    ) =>
                                        setUserSearch(
                                            e
                                                .target
                                                .value
                                        )
                                    }
                                    placeholder="Search name, username or email..."
                                    className="w-full rounded-xl border px-3 py-3 text-sm outline-none"
                                    style={{
                                        borderColor:
                                            EKARI.hair,
                                        color:
                                            EKARI.text,
                                    }}
                                />

                                {loadingUsers && (
                                    <div
                                        className="mt-2 text-xs"
                                        style={{
                                            color:
                                                EKARI.dim,
                                        }}
                                    >
                                        Loading
                                        users...
                                    </div>
                                )}
                            </div>

                            {/* SEARCH RESULTS */}
                            {userSearch.trim() &&
                                !loadingUsers && (
                                    <div
                                        className="rounded-xl border overflow-hidden max-h-80 overflow-y-auto"
                                        style={{
                                            borderColor:
                                                EKARI.hair,
                                        }}
                                    >
                                        {filteredUsers.length ===
                                            0 ? (
                                            <div
                                                className="px-4 py-4 text-sm"
                                                style={{
                                                    color:
                                                        EKARI.dim,
                                                }}
                                            >
                                                No
                                                matching
                                                users.
                                            </div>
                                        ) : (
                                            filteredUsers.map(
                                                (
                                                    u
                                                ) => (
                                                    <div
                                                        key={
                                                            u.uid
                                                        }
                                                        className="flex items-center justify-between gap-3 px-3 py-3 border-b last:border-b-0"
                                                        style={{
                                                            borderColor:
                                                                EKARI.hair,
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div
                                                                className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-sm font-extrabold"
                                                                style={{
                                                                    backgroundColor:
                                                                        "#F1F5F9",
                                                                    color:
                                                                        EKARI.forest,
                                                                }}
                                                            >
                                                                {String(
                                                                    u.displayName ||
                                                                    u.handle ||
                                                                    u.email ||
                                                                    "U"
                                                                )
                                                                    .charAt(
                                                                        0
                                                                    )
                                                                    .toUpperCase()}
                                                            </div>

                                                            <div className="min-w-0">
                                                                <div
                                                                    className="text-sm font-bold truncate"
                                                                    style={{
                                                                        color:
                                                                            EKARI.text,
                                                                    }}
                                                                >
                                                                    {u.displayName ||
                                                                        u.handle ||
                                                                        u.email ||
                                                                        "Unknown user"}
                                                                </div>

                                                                <div
                                                                    className="text-xs truncate"
                                                                    style={{
                                                                        color:
                                                                            EKARI.dim,
                                                                    }}
                                                                >
                                                                    {u.handle
                                                                        ? `@${u.handle}`
                                                                        : ""}

                                                                    {u.handle &&
                                                                        u.email
                                                                        ? " · "
                                                                        : ""}

                                                                    {u.email ||
                                                                        ""}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                addSelectedUser(
                                                                    u
                                                                )
                                                            }
                                                            className="shrink-0 rounded-lg px-3 py-2 text-xs font-bold text-white"
                                                            style={{
                                                                backgroundColor:
                                                                    EKARI.forest,
                                                            }}
                                                        >
                                                            Add
                                                        </button>
                                                    </div>
                                                )
                                            )
                                        )}
                                    </div>
                                )}

                            {/* SELECTED RECIPIENTS */}
                            {selectedUsers.length >
                                0 && (
                                    <div className="space-y-2 pt-2">
                                        <div
                                            className="text-xs font-bold uppercase"
                                            style={{
                                                color:
                                                    EKARI.dim,
                                            }}
                                        >
                                            Recipients
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {selectedUsers.map(
                                                (
                                                    u
                                                ) => (
                                                    <div
                                                        key={
                                                            u.uid
                                                        }
                                                        className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-2"
                                                        style={{
                                                            borderColor:
                                                                EKARI.hair,
                                                        }}
                                                    >
                                                        <div className="min-w-0 max-w-[220px]">
                                                            <div
                                                                className="text-xs font-bold truncate"
                                                                style={{
                                                                    color:
                                                                        EKARI.text,
                                                                }}
                                                            >
                                                                {u.displayName ||
                                                                    u.handle ||
                                                                    u.email}
                                                            </div>

                                                            {u.email && (
                                                                <div
                                                                    className="text-[10px] truncate"
                                                                    style={{
                                                                        color:
                                                                            EKARI.dim,
                                                                    }}
                                                                >
                                                                    {
                                                                        u.email
                                                                    }
                                                                </div>
                                                            )}
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                removeSelectedUser(
                                                                    u.uid
                                                                )
                                                            }
                                                            className="h-6 w-6 rounded-full flex items-center justify-center text-sm font-black text-red-600 hover:bg-red-50"
                                                            title="Remove recipient"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                )
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setSelectedUsers(
                                                    []
                                                )
                                            }
                                            className="text-xs font-bold text-red-600"
                                        >
                                            Clear
                                            all
                                        </button>
                                    </div>
                                )}
                        </div>
                    )}

                {/* CHANNELS */}
                <div>
                    <div
                        className="text-xs font-bold uppercase mb-2"
                        style={{
                            color:
                                EKARI.dim,
                        }}
                    >
                        Delivery
                        channels
                    </div>

                    <div className="flex flex-wrap gap-4">
                        <label
                            className="flex items-center gap-2 text-sm font-bold cursor-pointer"
                            style={{
                                color:
                                    EKARI.text,
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={
                                    sendPush
                                }
                                onChange={(
                                    e
                                ) =>
                                    setSendPush(
                                        e
                                            .target
                                            .checked
                                    )
                                }
                            />

                            Push
                            notification
                        </label>

                        <label
                            className="flex items-center gap-2 text-sm font-bold cursor-pointer"
                            style={{
                                color:
                                    EKARI.text,
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={
                                    sendEmail
                                }
                                onChange={(
                                    e
                                ) =>
                                    setSendEmail(
                                        e
                                            .target
                                            .checked
                                    )
                                }
                            />

                            Email
                        </label>
                    </div>
                </div>

                {/* WARNING FOR ALL */}
                {target ===
                    "all" && (
                        <div className="rounded-xl bg-amber-50 px-4 py-3">
                            <div className="text-sm font-bold text-amber-800">
                                All-user
                                broadcast
                            </div>

                            <div className="mt-1 text-xs text-amber-700">
                                This
                                message
                                will be
                                delivered
                                to every
                                matching
                                Ekarihub
                                user.
                                Test the
                                message on
                                yourself
                                first.
                            </div>
                        </div>
                    )}

                {/* ERROR */}
                {error && (
                    <div className="rounded-xl bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
                        {error}
                    </div>
                )}

                {/* PROGRESS */}
                {progress && (
                    <div
                        className="rounded-2xl border bg-white p-4 md:p-5"
                        style={{
                            borderColor:
                                EKARI.hair,
                        }}
                    >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div
                                    className="text-sm font-extrabold capitalize"
                                    style={{
                                        color:
                                            EKARI.text,
                                    }}
                                >
                                    Status:{" "}
                                    {progress.status ||
                                        "pending"}
                                </div>

                                <div
                                    className="text-xs mt-1"
                                    style={{
                                        color:
                                            EKARI.dim,
                                    }}
                                >
                                    Processed{" "}
                                    {progress.processed ||
                                        0}{" "}
                                    of{" "}
                                    {progress.totalUsers ||
                                        0}{" "}
                                    recipients
                                </div>
                            </div>

                            <div
                                className="text-lg font-extrabold"
                                style={{
                                    color:
                                        EKARI.forest,
                                }}
                            >
                                {
                                    progressPercent
                                }
                                %
                            </div>
                        </div>

                        <div className="mt-3 h-3 rounded-full bg-slate-100 overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                    width: `${progressPercent}%`,
                                    backgroundColor:
                                        EKARI.forest,
                                }}
                            />
                        </div>

                        {/* DELIVERY CARDS */}
                        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* IN APP */}
                            <div className="rounded-xl bg-slate-50 p-3">
                                <div
                                    className="text-[11px] font-bold uppercase"
                                    style={{
                                        color:
                                            EKARI.dim,
                                    }}
                                >
                                    In-app
                                </div>

                                <div
                                    className="mt-1 text-xl font-extrabold"
                                    style={{
                                        color:
                                            EKARI.text,
                                    }}
                                >
                                    {progress.notificationCount ||
                                        0}
                                </div>

                                <div
                                    className="mt-1 text-[11px]"
                                    style={{
                                        color:
                                            EKARI.dim,
                                    }}
                                >
                                    notifications
                                    created
                                </div>
                            </div>

                            {/* PUSH */}
                            <div className="rounded-xl bg-slate-50 p-3">
                                <div
                                    className="text-[11px] font-bold uppercase"
                                    style={{
                                        color:
                                            EKARI.dim,
                                    }}
                                >
                                    Push
                                </div>

                                <div
                                    className="mt-1 text-xl font-extrabold"
                                    style={{
                                        color:
                                            EKARI.text,
                                    }}
                                >
                                    {progress.pushCount ||
                                        0}
                                </div>

                                {(progress.pushFailedCount ||
                                    0) >
                                    0 && (
                                        <div className="mt-1 text-[11px] font-semibold text-red-600">
                                            {
                                                progress.pushFailedCount
                                            }{" "}
                                            failed
                                        </div>
                                    )}
                            </div>

                            {/* EMAIL QUEUE */}
                            <div className="rounded-xl bg-slate-50 p-3">
                                <div
                                    className="text-[11px] font-bold uppercase"
                                    style={{
                                        color:
                                            EKARI.dim,
                                    }}
                                >
                                    Email
                                    queued
                                </div>

                                <div
                                    className="mt-1 text-xl font-extrabold"
                                    style={{
                                        color:
                                            EKARI.text,
                                    }}
                                >
                                    {progress.emailQueued ||
                                        0}
                                </div>

                                {(progress.emailSkipped ||
                                    0) >
                                    0 && (
                                        <div className="mt-1 text-[11px] text-amber-700">
                                            {
                                                progress.emailSkipped
                                            }{" "}
                                            not
                                            queued
                                        </div>
                                    )}
                            </div>

                            {/* EMAIL SENT */}
                            <div className="rounded-xl bg-slate-50 p-3">
                                <div
                                    className="text-[11px] font-bold uppercase"
                                    style={{
                                        color:
                                            EKARI.dim,
                                    }}
                                >
                                    Email
                                    sent
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <span className="text-xl font-extrabold text-emerald-700">
                                        {progress.emailSentCount ||
                                            0}
                                    </span>

                                    {emailDeliveryComplete && (
                                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                            Complete
                                        </span>
                                    )}
                                </div>

                                {(progress.emailDeliverySkippedCount ||
                                    0) >
                                    0 && (
                                        <div className="mt-1 text-[11px] text-amber-700">
                                            {
                                                progress.emailDeliverySkippedCount
                                            }{" "}
                                            skipped
                                        </div>
                                    )}

                                {(progress.emailFailedCount ||
                                    0) >
                                    0 && (
                                        <div className="mt-1 text-[11px] font-semibold text-red-600">
                                            {
                                                progress.emailFailedCount
                                            }{" "}
                                            failed
                                        </div>
                                    )}
                            </div>
                        </div>

                        {sendEmail &&
                            Number(
                                progress.emailQueued ||
                                0
                            ) >
                            0 &&
                            !emailDeliveryComplete && (
                                <div className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700">
                                    Email
                                    delivery
                                    is still
                                    being
                                    processed.
                                    The
                                    delivery
                                    totals
                                    will
                                    update
                                    automatically.
                                </div>
                            )}

                        {(progress.failedCount ||
                            0) >
                            0 && (
                                <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                                    {
                                        progress.failedCount
                                    }{" "}
                                    broadcast
                                    delivery
                                    operation(s)
                                    failed.
                                </div>
                            )}

                        {currentBroadcastId && (
                            <div
                                className="mt-3 text-[11px] break-all"
                                style={{
                                    color:
                                        EKARI.dim,
                                }}
                            >
                                Job
                                ID:{" "}
                                {
                                    currentBroadcastId
                                }
                            </div>
                        )}
                    </div>
                )}

                {/* SUCCESS */}
                {result &&
                    result.status ===
                    "completed" && (
                        <div className="rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700">
                            Broadcast
                            processing
                            completed.
                            Recipients:{" "}
                            {result.totalUsers ||
                                0}
                            , in-app:{" "}
                            {result.notificationCount ||
                                0}
                            , push:{" "}
                            {result.pushCount ||
                                0}
                            , email
                            queued:{" "}
                            {result.emailQueued ||
                                0}
                            .
                        </div>
                    )}

                {/* SUBMIT */}
                <button
                    type="submit"
                    disabled={
                        sending ||
                        !title.trim() ||
                        !body.trim() ||
                        (!sendPush &&
                            !sendEmail) ||
                        selectedUserValidation
                    }
                    className="rounded-xl px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                        backgroundColor:
                            EKARI.forest,
                    }}
                >
                    {sending
                        ? "Sending..."
                        : target ===
                            "me"
                            ? "Send test notification"
                            : target ===
                                "selected_users"
                                ? `Send to ${selectedUsers.length} selected user${selectedUsers.length ===
                                    1
                                    ? ""
                                    : "s"
                                }`
                                : "Send notification"}
                </button>
            </form>
        </div>
    );
}