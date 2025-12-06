// app/admin/usermangement/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/hooks/useAuth";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { httpsCallable, getFunctions } from "firebase/functions";
import { db, app } from "@/lib/firebase";
import Image from "next/image";
import { IoSearchOutline } from "react-icons/io5";
import {
  IoShieldCheckmarkOutline,
  IoWarningOutline,
} from "react-icons/io5";
import { ConfirmModal } from "@/app/components/ConfirmModal";
import Link from "next/link";

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
  hair: "#E5E7EB",
};

type EkariUser = {
  uid: string;
  displayName?: string | null;
  handle?: string | null;
  email?: string | null;
  photoURL?: string | null;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  createdAt?: any;
  verificationStatus?: string | null;
};

export default function UserManagementPage() {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Admins
  const [admins, setAdmins] = useState<EkariUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);

  // All users
  const [users, setUsers] = useState<EkariUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Search & errors
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<EkariUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [updatingRoleFor, setUpdatingRoleFor] = useState<string | null>(null);

  // Confirm modal for role changes
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  } | null>(null);

  // 🔹 Pagination for ALL USERS table
  const [pageSize, setPageSize] = useState<number>(50); // default 50
  const [currentPage, setCurrentPage] = useState<number>(1);

  const functions = getFunctions(app);
  const setUserAdminFn = httpsCallable(functions, "setUserAdmin");

  // Determine if current user is SUPER ADMIN
  useEffect(() => {
    let cancelled = false;
    async function checkSuperAdmin() {
      if (!user) {
        setIsSuperAdmin(false);
        return;
      }
      const tokenResult = await user.getIdTokenResult();
      const claims = tokenResult.claims as any;
      if (!cancelled) {
        setIsSuperAdmin(!!claims.superAdmin);
      }
    }
    checkSuperAdmin();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Subscribe to current admins list
  useEffect(() => {
    setLoadingAdmins(true);
    const usersRef = collection(db, "users");
    const qAdmins = query(
      usersRef,
      where("isAdmin", "==", true),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      qAdmins,
      (snap) => {
        const items: EkariUser[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            uid: docSnap.id,
            displayName: data.displayName ?? data.name ?? null,
            handle: data.handle ?? null,
            email: data.email ?? null,
            photoURL: data.photoURL ?? null,
            isAdmin: !!data.isAdmin,
            isSuperAdmin: !!data.isSuperAdmin,
            createdAt: data.createdAt ?? null,
            verificationStatus: data.verification?.status ?? null,
          };
        });
        setAdmins(items);
        setLoadingAdmins(false);
      },
      (err) => {
        console.error("Failed to load admins", err);
        setLoadingAdmins(false);
        setError("Failed to load admin list. Please try again.");
      }
    );

    return () => unsub();
  }, []);

  // Subscribe to ALL users list
  useEffect(() => {
    setLoadingUsers(true);
    const usersRef = collection(db, "users");
    const qUsers = query(usersRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      qUsers,
      (snap) => {
        const list: EkariUser[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            uid: docSnap.id,
            displayName: data.displayName ?? data.name ?? null,
            handle: data.handle ?? null,
            email: data.email ?? null,
            photoURL: data.photoURL ?? null,
            isAdmin: !!data.isAdmin,
            isSuperAdmin: !!data.isSuperAdmin,
            createdAt: data.createdAt ?? null,
            verificationStatus: data.verification?.status ?? null,
          };
        });
        setUsers(list);
        setLoadingUsers(false);
      },
      (err) => {
        console.error("Failed to load users", err);
        setLoadingUsers(false);
        setError("Failed to load user list. Please try again.");
      }
    );

    return () => unsub();
  }, []);

  const myUid = user?.uid;

  // 🔹 Pagination derived values
  const totalUsers = users.length;

  const totalPages = useMemo(() => {
    if (totalUsers === 0) return 1;
    return Math.ceil(totalUsers / pageSize);
  }, [totalUsers, pageSize]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return users.slice(start, end);
  }, [users, currentPage, pageSize]);

  // Reset to page 1 when pageSize changes
  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  // Clamp currentPage if totalUsers shrinks
  useEffect(() => {
    const maxPage = totalUsers === 0 ? 1 : Math.ceil(totalUsers / pageSize);
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [totalUsers, pageSize, currentPage]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSearchResults(null);

    const term = searchTerm.trim();
    if (!term) return;
    setSearching(true);

    try {
      const usersRef = collection(db, "users");
      // 1st: search by email
      let q1 = query(usersRef, where("email", "==", term));
      let snap = await getDocs(q1);
      let results: EkariUser[] = snap.docs.map((docSnap) => {
        const data = docSnap.data() as any;
        return {
          uid: docSnap.id,
          displayName: data.displayName ?? data.name ?? null,
          handle: data.handle ?? null,
          email: data.email ?? null,
          photoURL: data.photoURL ?? null,
          isAdmin: !!data.isAdmin,
          isSuperAdmin: !!data.isSuperAdmin,
          createdAt: data.createdAt ?? null,
          verificationStatus: data.verification?.status ?? null,
        };
      });

      // If none, try search by handle
      if (!results.length) {
        const q2 = query(usersRef, where("handle", "==", term));
        const snap2 = await getDocs(q2);
        results = snap2.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            uid: docSnap.id,
            displayName: data.displayName ?? data.name ?? null,
            handle: data.handle ?? null,
            email: data.email ?? null,
            photoURL: data.photoURL ?? null,
            isAdmin: !!data.isAdmin,
            isSuperAdmin: !!data.isSuperAdmin,
            createdAt: data.createdAt ?? null,
            verificationStatus: data.verification?.status ?? null,
          };
        });
      }

      if (!results.length) {
        setError("No user found with that email or handle.");
      }
      setSearchResults(results);
    } catch (err) {
      console.error("Search failed", err);
      setError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleToggleAdmin = async (target: EkariUser, makeAdmin: boolean) => {
    if (!user) return;
    setError(null);

    // Prevent demoting yourself from UI
    if (!makeAdmin && target.uid === myUid) {
      setError("You cannot revoke your own admin role from here.");
      return;
    }

    const actionLabel = makeAdmin ? "grant admin to" : "revoke admin from";
    const targetLabel =
      target.displayName || target.email || target.handle || target.uid;

    setConfirmConfig({
      title: makeAdmin ? "Grant admin access" : "Revoke admin access",
      message: `Are you sure you want to ${actionLabel} ${targetLabel}?`,
      confirmText: makeAdmin ? "Grant admin" : "Revoke admin",
      cancelText: "Cancel",
      onConfirm: async () => {
        setConfirmConfig(null);
        try {
          setUpdatingRoleFor(target.uid);
          await setUserAdminFn({
            targetUid: target.uid,
            makeAdmin,
          });
        } catch (err: any) {
          console.error("setUserAdmin error", err);
          const msg =
            err?.message ||
            "Failed to update admin role. Please check Cloud Function logs.";
          setError(msg);
        } finally {
          setUpdatingRoleFor(null);
        }
      },
    });
  };

  const cannotManage = !isSuperAdmin;
  const pageTitle = "User management";

  // For "showing X–Y of Z"
  const startIndex =
    totalUsers === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex =
    totalUsers === 0
      ? 0
      : Math.min(currentPage * pageSize, totalUsers);

  return (
    <>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1
              className="text-xl md:text-2xl font-extrabold"
              style={{ color: EKARI.text }}
            >
              {pageTitle}
            </h1>
            <p className="text-sm" style={{ color: EKARI.dim }}>
              View ekarihub staff and manage who has admin access. You can
              also see all members who have joined the platform.
            </p>
          </div>

          {user && (
            <div className="flex flex-col items-start md:items-end gap-1">
              <div className="flex items-center gap-2">
                <div className="relative w-9 h-9 rounded-full overflow-hidden bg-gray-200">
                  <Image
                    src={user.photoURL || "/avatar-placeholder.png"}
                    alt={user.displayName || "avatar"}
                    fill
                    sizes="36px"
                  />
                </div>
                <div className="flex flex-col">
                  <span
                    className="text-sm font-semibold max-w-[200px] truncate"
                    style={{ color: EKARI.text }}
                  >
                    {user.displayName || user.email || "Admin user"}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide px-2 py-[2px] rounded-full"
                    style={{
                      backgroundColor: EKARI.gold,
                      color: EKARI.sand,
                    }}
                  >
                    <IoShieldCheckmarkOutline size={12} />
                    {isSuperAdmin ? "Super admin" : "Admin"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* INFO BANNER FOR NON-SUPER ADMINS */}
        {cannotManage && (
          <div
            className="flex items-start gap-2 rounded-xl px-3 py-2 text-sm"
            style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
          >
            <IoWarningOutline size={18} className="mt-[2px]" />
            <div>
              <div className="font-semibold">Limited access</div>
              <div className="text-xs mt-0.5">
                You are an admin. Only super admins can promote or revoke
                other admins. You can still view the ekarihub staff list and
                all members.
              </div>
            </div>
          </div>
        )}

        {/* ERROR MESSAGE */}
        {error && (
          <div
            className="rounded-xl px-3 py-2 text-sm"
            style={{ backgroundColor: "#FEE2E2", color: "#991B1B" }}
          >
            {error}
          </div>
        )}

        {/* CURRENT ADMINS LIST */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2
              className="text-sm font-semibold uppercase tracking-wide"
              style={{ color: EKARI.dim }}
            >
              Ekarihub staff (admins)
            </h2>
            <span
              className="text-xs px-2 py-[2px] rounded-full"
              style={{ backgroundColor: EKARI.hair, color: EKARI.dim }}
            >
              {loadingAdmins ? "Loading…" : `${admins.length} admins`}
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border text-sm bg-white">
            <div
              className="grid grid-cols-12 px-3 py-2 border-b text-[11px] font-semibold uppercase tracking-wide"
              style={{ borderColor: EKARI.hair, color: EKARI.dim }}
            >
              <div className="col-span-4">Staff</div>
              <div className="col-span-3">Email</div>
              <div className="col-span-2">Role</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>

            {loadingAdmins && (
              <div
                className="px-4 py-6 text-center text-xs"
                style={{ color: EKARI.dim }}
              >
                Loading admins…
              </div>
            )}

            {!loadingAdmins && admins.length === 0 && (
              <div
                className="px-4 py-6 text-center text-xs"
                style={{ color: EKARI.dim }}
              >
                No admins found yet.
              </div>
            )}

            {!loadingAdmins &&
              admins.map((u) => {
                const isMe = u.uid === myUid;
                const canRevoke = isSuperAdmin && !u.isSuperAdmin && !isMe;

                return (
                  <div
                    key={u.uid}
                    className="grid grid-cols-12 px-3 py-2 items-center border-t last:border-b"
                    style={{ borderColor: EKARI.hair }}
                  >
                    {/* Staff */}
                    <div className="col-span-4 flex items-center gap-2">
                      <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-200 shrink-0">
                        <Image
                          src={u.photoURL || "/avatar-placeholder.png"}
                          alt={u.displayName || "staff"}
                          fill
                          sizes="32px"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span
                          className="text-sm font-semibold"
                          style={{ color: EKARI.text }}
                        >
                          {u.displayName || u.email || "Unknown user"}
                          {isMe && (
                            <span className="ml-1 text-[10px] font-normal text-gray-500">
                              (You)
                            </span>
                          )}
                        </span>
                        {u.handle && (
                          <span
                            className="text-xs"
                            style={{ color: EKARI.dim }}
                          >
                            {u.handle}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Email */}
                    <div
                      className="col-span-3 text-xs truncate"
                      style={{ color: EKARI.text }}
                    >
                      {u.email || "—"}
                    </div>

                    {/* Role */}
                    <div className="col-span-2">
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-[2px] rounded-full"
                        style={{
                          backgroundColor: u.isSuperAdmin
                            ? EKARI.forest
                            : EKARI.hair,
                          color: u.isSuperAdmin ? EKARI.sand : EKARI.text,
                        }}
                      >
                        <IoShieldCheckmarkOutline size={12} />
                        {u.isSuperAdmin ? "Super admin" : "Admin"}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="col-span-3 flex justify-end">
                      {u.isSuperAdmin ? (
                        <span
                          className="text-[11px]"
                          style={{ color: EKARI.dim }}
                        >
                          Primary owner
                        </span>
                      ) : (
                        <button
                          disabled={!canRevoke || updatingRoleFor === u.uid}
                          onClick={() => handleToggleAdmin(u, false)}
                          className={[
                            "text-xs font-semibold px-3 py-1 rounded-full border transition",
                            canRevoke
                              ? "hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                              : "opacity-50 cursor-not-allowed",
                          ].join(" ")}
                          style={{
                            borderColor: "#FCA5A5",
                            color: "#B91C1C",
                            backgroundColor: "#FEF2F2",
                          }}
                        >
                          {updatingRoleFor === u.uid
                            ? "Updating…"
                            : "Revoke admin"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        {/* SEARCH & PROMOTE */}
        <section className="space-y-3">
          <h2
            className="text-sm font-semibold uppercase tracking-wide"
            style={{ color: EKARI.dim }}
          >
            Search &amp; promote user
          </h2>

          <form
            onSubmit={handleSearch}
            className="flex flex-col md:flex-row gap-2 md:items-center"
          >
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <IoSearchOutline size={16} style={{ color: EKARI.dim }} />
              </span>
              <input
                className="w-full pl-9 pr-3 py-2 rounded-full border text-sm outline-none focus:ring-2"
                style={{
                  borderColor: EKARI.hair,
                  color: EKARI.text,
                  boxShadow: "0 0 0 0 rgba(0,0,0,0)",
                }}
                placeholder="Search by email or handle (exact match)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={!searchTerm.trim() || searching}
              className="inline-flex items-center justify-center px-4 py-2 rounded-full text-sm font-semibold transition"
              style={{
                backgroundColor: EKARI.forest,
                color: EKARI.sand,
                opacity: !searchTerm.trim() || searching ? 0.6 : 1,
              }}
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </form>

          {searchResults && (
            <div className="mt-2 space-y-2">
              {searchResults.length === 0 && (
                <div className="text-xs" style={{ color: EKARI.dim }}>
                  No users found.
                </div>
              )}

              {searchResults.map((u) => {
                const isMe = u.uid === myUid;
                const alreadyAdmin = !!u.isAdmin;
                const canMakeAdmin =
                  isSuperAdmin && !alreadyAdmin;

                return (
                  <div
                    key={u.uid}
                    className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 bg-white"
                    style={{ borderColor: EKARI.hair }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative w-9 h-9 rounded-full overflow-hidden bg-gray-200 shrink-0">
                        <Image
                          src={u.photoURL || "/avatar-placeholder.png"}
                          alt={u.displayName || "user"}
                          fill
                          sizes="36px"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span
                          className="text-sm font-semibold"
                          style={{ color: EKARI.text }}
                        >
                          {u.displayName || u.email || "Unknown user"}
                          {isMe && (
                            <span className="ml-1 text-[10px] font-normal text-gray-500">
                              (You)
                            </span>
                          )}
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: EKARI.dim }}
                        >
                          {u.handle ? `${u.handle}` : u.email || "No email"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {alreadyAdmin && (
                        <span
                          className="text-[11px] font-semibold px-2 py-[2px] rounded-full"
                          style={{
                            backgroundColor: EKARI.hair,
                            color: EKARI.text,
                          }}
                        >
                          Already admin
                        </span>
                      )}

                      {!alreadyAdmin && (
                        <button
                          type="button"
                          disabled={
                            !canMakeAdmin || updatingRoleFor === u.uid
                          }
                          onClick={() => handleToggleAdmin(u, true)}
                          className={[
                            "text-xs font-semibold px-3 py-1 rounded-full border transition",
                            canMakeAdmin
                              ? "hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700"
                              : "opacity-50 cursor-not-allowed",
                          ].join(" ")}
                          style={{
                            borderColor: "#6EE7B7",
                            color: "#065F46",
                            backgroundColor: "#ECFDF5",
                          }}
                        >
                          {updatingRoleFor === u.uid
                            ? "Updating…"
                            : "Make admin"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ALL USERS SECTION WITH PAGINATION */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2
              className="text-sm font-semibold uppercase tracking-wide"
              style={{ color: EKARI.dim }}
            >
              All members on ekarihub
            </h2>
            <span
              className="text-xs px-2 py-[2px] rounded-full"
              style={{ backgroundColor: EKARI.hair, color: EKARI.dim }}
            >
              {loadingUsers
                ? "Loading…"
                : `${totalUsers} user${totalUsers === 1 ? "" : "s"}`}
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white text-sm">
            <div
              className="grid grid-cols-12 px-3 py-2 border-b text-[11px] font-semibold uppercase tracking-wide"
              style={{ borderColor: EKARI.hair, color: EKARI.dim }}
            >
              <div className="col-span-3">Member</div>
              <div className="col-span-3">Email</div>
              <div className="col-span-2">Joined</div>
              <div className="col-span-2">Role</div>
              <div className="col-span-2 text-right">Profile</div>
            </div>

            {loadingUsers && (
              <div
                className="px-4 py-6 text-center text-xs"
                style={{ color: EKARI.dim }}
              >
                Loading members…
              </div>
            )}

            {!loadingUsers && users.length === 0 && (
              <div
                className="px-4 py-6 text-center text-xs"
                style={{ color: EKARI.dim }}
              >
                No members found yet.
              </div>
            )}

            {!loadingUsers &&
              paginatedUsers.map((u) => {
                const joined =
                  u.createdAt?.toDate &&
                    typeof u.createdAt.toDate === "function"
                    ? u.createdAt.toDate().toLocaleDateString()
                    : "—";

                const roleLabel = u.isSuperAdmin
                  ? "Super admin"
                  : u.isAdmin
                    ? "Admin"
                    : "Member";

                const verificationBadge =
                  u.verificationStatus === "approved"
                    ? "Verified"
                    : u.verificationStatus === "pending"
                      ? "Pending"
                      : "";

                return (
                  <div
                    key={u.uid}
                    className="grid grid-cols-12 px-3 py-2 items-center border-t last:border-b"
                    style={{ borderColor: EKARI.hair }}
                  >
                    {/* Member */}
                    <div className="col-span-3 flex items-center gap-2 overflow-hidden">
                      <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-200 shrink-0">
                        <Image
                          src={u.photoURL || "/avatar-placeholder.png"}
                          alt={u.displayName || "member"}
                          fill
                          sizes="32px"
                        />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span
                          className="text-sm font-semibold truncate"
                          style={{ color: EKARI.text }}
                        >
                          {u.displayName || u.email || "Unknown user"}
                        </span>
                        <div className="flex flex-wrap items-center gap-1">
                          {u.handle && (
                            <span
                              className="text-[11px] truncate"
                              style={{ color: EKARI.dim }}
                            >
                              {u.handle}
                            </span>
                          )}
                          {verificationBadge && (
                            <span className="text-[10px] px-2 py-[1px] rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                              {verificationBadge}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Email */}
                    <div
                      className="col-span-3 text-xs truncate"
                      style={{ color: EKARI.text }}
                    >
                      {u.email || "—"}
                    </div>

                    {/* Joined */}
                    <div
                      className="col-span-2 text-xs"
                      style={{ color: EKARI.dim }}
                    >
                      {joined}
                    </div>

                    {/* Role */}
                    <div className="col-span-2">
                      <span
                        className="text-[11px]"
                        style={{ color: EKARI.dim }}
                      >
                        {roleLabel}
                      </span>
                    </div>

                    {/* Profile link */}
                    <div className="col-span-2 flex justify-end">
                      {u.handle ? (
                        <Link
                          href={`/${u.handle}`}
                          className="text-[11px] font-semibold px-3 py-1 rounded-full border hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700"
                          style={{
                            borderColor: "#6EE7B7",
                            color: "#065F46",
                          }}
                        >
                          View profile
                        </Link>
                      ) : (
                        <span
                          className="text-[11px] text-slate-400"
                          title="No public handle set"
                        >
                          No handle
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

            {/* 🔹 Pagination footer */}
            {!loadingUsers && users.length > 0 && (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-3 py-3 text-[11px] md:text-xs" style={{ color: EKARI.dim }}>
                <div>
                  Showing{" "}
                  <span className="font-semibold" style={{ color: EKARI.text }}>
                    {startIndex}
                  </span>{" "}
                  –{" "}
                  <span className="font-semibold" style={{ color: EKARI.text }}>
                    {endIndex}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold" style={{ color: EKARI.text }}>
                    {totalUsers}
                  </span>{" "}
                  users
                </div>

                <div className="flex flex-wrap items-center gap-3 justify-between md:justify-end">
                  <div className="flex items-center gap-1">
                    <span>Rows per page</span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="border rounded-full bg-white px-2 py-1 text-[11px] outline-none"
                      style={{ borderColor: EKARI.hair, color: EKARI.text }}
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((p) => Math.max(1, p - 1))
                      }
                      disabled={currentPage === 1}
                      className="px-2 py-1 rounded-full border text-[11px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                      style={{ borderColor: EKARI.hair, color: EKARI.text }}
                    >
                      Previous
                    </button>
                    <span>
                      Page{" "}
                      <span className="font-semibold" style={{ color: EKARI.text }}>
                        {currentPage}
                      </span>{" "}
                      of {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((p) =>
                          Math.min(totalPages, p + 1)
                        )
                      }
                      disabled={currentPage >= totalPages || totalUsers === 0}
                      className="px-2 py-1 rounded-full border text-[11px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                      style={{ borderColor: EKARI.hair, color: EKARI.text }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Confirm modal for admin role changes */}
      <ConfirmModal
        open={!!confirmConfig}
        title={confirmConfig?.title || ""}
        message={confirmConfig?.message || ""}
        confirmText={confirmConfig?.confirmText || "Confirm"}
        cancelText={confirmConfig?.cancelText || "Cancel"}
        onConfirm={() => {
          if (confirmConfig?.onConfirm) {
            confirmConfig.onConfirm();
          } else {
            setConfirmConfig(null);
          }
        }}
        onCancel={() => setConfirmConfig(null)}
      />
    </>
  );
}
