"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";

export type UserProfile = {
  uid: string;
  handle?: string;
  photoURL?: string;
  dataSaverVideos?: boolean;

  isSuspended?: boolean;
  suspendedReason?: string | null;
  suspendedAt?: any;
};

type Ctx = {
  profile: UserProfile | null;
  loading: boolean;
};

const UserProfileContext = createContext<Ctx | null>(null);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // avoid double-subscribe in React StrictMode dev
  const activeUidRef = useRef<string | null>(null);

  useEffect(() => {
    // while auth is loading: don't subscribe yet
    if (authLoading) {
      setLoading(true);
      return;
    }

    // signed out
    if (!uid) {
      activeUidRef.current = null;
      setProfile(null);
      setLoading(false);
      return;
    }

    // already subscribed for this uid
    if (activeUidRef.current === uid) return;

    activeUidRef.current = uid;
    setLoading(true);

    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = (snap.data() as any) || null;

        console.log("[UserProfile] raw:", data?.isSuspended, data?.suspendedReason);

        if (!data) {
          setProfile(null);
        } else {
          const mapped = {
            uid,
            handle: data?.handle,
            photoURL: data?.photoURL,
            dataSaverVideos: !!data?.dataSaverVideos,
            isSuspended: data?.isSuspended === true,
            suspendedReason: data?.suspendedReason ?? null,
            suspendedAt: data?.suspendedAt ?? null,
          };

          console.log("[UserProfile] mapped:", mapped.isSuspended, mapped.suspendedReason);

          setProfile(mapped);
        }

        setLoading(false);
      },
      (err) => {
        console.error("[UserProfile] snapshot error:", err);
        setProfile(null);
        setLoading(false);
      }
    );

    return () => {
      unsub();
      activeUidRef.current = null;
    };
  }, [uid, authLoading]);

  const value = useMemo(() => ({ profile, loading }), [profile, loading]);

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
}

export function useUserProfile() {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error("useUserProfile must be used inside <UserProfileProvider />");
  return ctx;
}
