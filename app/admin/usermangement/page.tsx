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
import { IoShieldCheckmarkOutline, IoWarningOutline } from "react-icons/io5";

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
};

export default function UserManagementPage() {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [admins, setAdmins] = useState<EkariUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<EkariUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [updatingRoleFor, setUpdatingRoleFor] = useState<string | null>(null);

  // Cloud Function to set admin role
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
    const q = query(
      usersRef,
      where("isAdmin", "==", true),
      orderBy("createdAt", "desc") // optional, if you have createdAt
    );

    const unsub = onSnapshot(
      q,
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

  const myUid = user?.uid;

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
    const confirmMsg = `Are you sure you want to ${actionLabel} ${target.displayName || target.email || target.handle || target.uid}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setUpdatingRoleFor(target.uid);
      await setUserAdminFn({
        targetUid: target.uid,
        makeAdmin,
      });
      // onSnapshot will reflect changes; nothing else to do
    } catch (err: any) {
      console.error("setUserAdmin error", err);
      const msg =
        err?.message ||
        "Failed to update admin role. Please check Cloud Function logs.";
      setError(msg);
    } finally {
      setUpdatingRoleFor(null);
    }
  };

  const cannotManage = !isSuperAdmin;

  const pageTitle = "User management";

  return (
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
            View ekarihub staff and manage who has admin access.
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
              You are an admin. Only super admins can promote or revoke other
              admins. You can still view the ekarihub staff list below.
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
            <div className="px-4 py-6 text-center text-xs" style={{ color: EKARI.dim }}>
              Loading admins…
            </div>
          )}

          {!loadingAdmins && admins.length === 0 && (
            <div className="px-4 py-6 text-center text-xs" style={{ color: EKARI.dim }}>
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
                      <span className="text-sm font-semibold" style={{ color: EKARI.text }}>
                        {u.displayName || u.email || "Unknown user"}
                        {isMe && (
                          <span className="ml-1 text-[10px] font-normal text-gray-500">
                            (You)
                          </span>
                        )}
                      </span>
                      {u.handle && (
                        <span className="text-xs" style={{ color: EKARI.dim }}>
                          {u.handle}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  <div className="col-span-3 text-xs truncate" style={{ color: EKARI.text }}>
                    {u.email || "—"}
                  </div>

                  {/* Role */}
                  <div className="col-span-2">
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-[2px] rounded-full"
                      style={{
                        backgroundColor: u.isSuperAdmin ? EKARI.forest : EKARI.hair,
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
                      <span className="text-[11px]" style={{ color: EKARI.dim }}>
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
                        {updatingRoleFor === u.uid ? "Updating…" : "Revoke admin"}
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
                isSuperAdmin && !alreadyAdmin; // only super admin can promote

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
                      <span className="text-xs" style={{ color: EKARI.dim }}>
                        {u.handle ? `@${u.handle}` : u.email || "No email"}
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
                        disabled={!canMakeAdmin || updatingRoleFor === u.uid}
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
    </div>
  );
}
