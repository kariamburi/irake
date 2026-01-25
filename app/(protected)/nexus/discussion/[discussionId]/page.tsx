// app/nexus/discussion/[discussionId]/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "@/lib/firebase";
import {
  IoArrowRedo,
  IoChatbubblesOutline,
  IoClose,
  IoCreateOutline,
  IoEllipsisHorizontal,
  IoSend,
  IoTrashOutline,
  IoSparklesOutline,
  IoTimeOutline,
} from "react-icons/io5";
import { ArrowLeft } from "lucide-react";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import clsx from "clsx";
import { getCachedDiscussion } from "@/lib/discussionCache";
import OpenInAppBanner from "@/app/components/OpenInAppBanner";

// Avoid static optimization since we read client-side
export const dynamic = "force-dynamic";

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
  hair: "#E5E7EB",
  sub: "#5C6B66",
};

type DiscussionItem = {
  id: string;
  title: string;
  body?: string;
};

type Reply = {
  id: string;
  body: string;
  authorId: string;
  createdAt?: any;
  updatedAt?: any;
  parentId?: string | null;
  replyToId?: string | null;
  replyToHandle?: string | null;
  userName?: string | null;
  userHandle?: string | null;
  userPhotoURL?: string | null;
};

type ReplyTarget =
  | {
    parentId: string | null;
    replyToId?: string | null;
    replyToHandle?: string | null;
  }
  | null;

const AVATAR_FALLBACK = "/avatar-placeholder.png";
const PAGE_SIZE = 50;

/* ---------------- responsive helpers ---------------- */
function useMediaQuery(queryStr: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(queryStr);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [queryStr]);
  return matches;
}
function useIsDesktop() {
  return useMediaQuery("(min-width: 1024px)");
}
function useIsMobile() {
  return useMediaQuery("(max-width: 1023px)");
}

/* ---------------- tiny helpers ---------------- */
function cn(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

function hexToRgba(hex: string, alpha: number) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/* ---------------- premium surface ---------------- */
function PremiumSurface({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border bg-white/80 backdrop-blur-xl",
        "shadow-[0_18px_60px_rgba(15,23,42,0.10)]",
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}

export default function DiscussionThreadPage() {
  const router = useRouter();
  const params = useParams() as Record<string, string | string[]>;

  // Support both [discussionid] and [discussionId]
  const discussionIdRaw =
    (params?.discussionid as any) ??
    (params?.discussionId as any) ??
    (params?.discussionID as any);

  const discussionId = Array.isArray(discussionIdRaw)
    ? discussionIdRaw[0]
    : (discussionIdRaw as string | undefined);

  const isDesktop = useIsDesktop();
  const isMobile = useIsMobile();

  const auth = getAuth();

  // Auth & my denorm
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [meName, setMeName] = useState<string | null>(null);
  const [meHandle, setMeHandle] = useState<string | null>(null);
  const [mePhotoURL, setMePhotoURL] = useState<string | null>(null);

  // Thread
  const [disc, setDisc] = useState<DiscussionItem | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // Replies + paging
  const [replies, setReplies] = useState<Reply[]>([]);
  const [paging, setPaging] = useState(false);
  const lastSnapRef = useRef<any>(null);
  const [hasMore, setHasMore] = useState(false);

  // Composer / edit states
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Cache for authors (to backfill older replies that lack denorm)
  const [userCache, setUserCache] = useState<
    Record<string, { name?: string | null; handle?: string | null; photoURL?: string | null }>
  >({});

  const webUrl =
    typeof window !== "undefined"
      ? window.location.href
      : discussionId
        ? `https://ekarihub.com/nexus/discussion/${encodeURIComponent(discussionId)}`
        : "https://ekarihub.com/nexus";

  const appUrl = discussionId
    ? `ekarihub:///nexus/discussion/${encodeURIComponent(discussionId)}`
    : "ekarihub:///nexus";

  const ringStyle: React.CSSProperties = {
    ["--tw-ring-color" as any]: EKARI.forest,
  };

  const premiumBg = useMemo<React.CSSProperties>(
    () => ({
      background:
        "radial-gradient(900px circle at 10% 0%, rgba(199,146,87,0.22), rgba(255,255,255,0) 55%), radial-gradient(900px circle at 90% 20%, rgba(35,63,57,0.16), rgba(255,255,255,0) 60%), linear-gradient(180deg, rgba(255,255,255,1), rgba(255,255,255,1))",
    }),
    []
  );

  const goBack = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push("/nexus");
  }, [router]);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setMePhotoURL(user?.photoURL ?? null);
    });
    return unsub;
  }, [auth]);

  // Load my public profile for denorm
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const s = await getDoc(doc(db, "users", uid));
        const d = s.data() as any;
        setMeName(d?.name ?? auth.currentUser?.displayName ?? null);
        setMeHandle(d?.handle ?? null);

        if (!d?.photoURL && auth.currentUser?.photoURL) setMePhotoURL(auth.currentUser.photoURL);
        else if (d?.photoURL) setMePhotoURL(d.photoURL);
      } catch {
        setMeName(auth.currentUser?.displayName ?? null);
      }
    })();
  }, [uid, auth]);

  // Initial load: discussion + first page of replies
  useEffect(() => {
    (async () => {
      setInitialLoading(true);
      try {
        if (!discussionId) return;

        // 1) hydrate from cache instantly (no fetch)
        const cached = getCachedDiscussion(discussionId);
        if (cached) {
          setDisc({
            id: cached.id,
            title: cached.title ?? "",
            body: (cached as any)?.body ?? "",
          });
        }

        // 2) fallback fetch
        const snap = await getDoc(doc(db, "discussions", discussionId));
        if (snap.exists()) {
          const data = snap.data() as any;
          setDisc({ id: snap.id, title: data?.title ?? "", body: data?.body ?? "" });
        } else {
          setDisc(null);
        }

        // replies page fetch
        const qRef = query(
          collection(db, "discussions", discussionId, "replies"),
          orderBy("createdAt", "asc"),
          limit(PAGE_SIZE)
        );
        const s = await getDocs(qRef);
        const items = s.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Reply));
        setReplies(items);
        lastSnapRef.current = s.docs.length ? s.docs[s.docs.length - 1] : null;
        setHasMore(!!lastSnapRef.current);
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [discussionId]);

  const shareDiscussion = useCallback(async () => {
    if (!disc || !discussionId) return;

    const url =
      typeof window !== "undefined"
        ? window.location.href
        : `https://ekarihub.com/nexus/discussion/${encodeURIComponent(discussionId)}`;

    const message = `${disc.title}${disc.body ? "\n\n" + disc.body.slice(0, 140) : ""}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: disc.title || "Discussion",
          text: message,
          url,
        });
      } else {
        await navigator.clipboard.writeText(`${message}\n${url}`);
        alert("Link copied to clipboard");
      }
    } catch {
      // ignore
    }
  }, [disc, discussionId]);

  // Load more replies
  const loadMore = useCallback(async () => {
    if (paging || !hasMore || !lastSnapRef.current || !discussionId) return;
    setPaging(true);
    try {
      const qRef = query(
        collection(db, "discussions", discussionId, "replies"),
        orderBy("createdAt", "asc"),
        startAfter(lastSnapRef.current),
        limit(PAGE_SIZE)
      );
      const s = await getDocs(qRef);
      if (!s.empty) {
        setReplies((prev) => [
          ...prev,
          ...s.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Reply)),
        ]);
        lastSnapRef.current = s.docs[s.docs.length - 1];
        setHasMore(true);
      } else {
        lastSnapRef.current = null;
        setHasMore(false);
      }
    } finally {
      setPaging(false);
    }
  }, [paging, hasMore, discussionId]);

  // Group by parentId (top-level + children)
  const { topLevel, childrenByParent } = useMemo(() => {
    const top = replies.filter((r) => !r.parentId);
    const map: Record<string, Reply[]> = {};
    replies.forEach((r) => {
      if (r.parentId) {
        if (!map[r.parentId]) map[r.parentId] = [];
        map[r.parentId].push(r);
      }
    });
    return { topLevel: top, childrenByParent: map };
  }, [replies]);

  // Backfill missing author denorm
  useEffect(() => {
    const missing = Array.from(
      new Set(
        replies
          .filter((r) => !r.userName || !r.userHandle || !r.userPhotoURL)
          .map((r) => r.authorId)
          .filter((x) => x && !userCache[x])
      )
    );
    if (!missing.length) return;

    (async () => {
      const results = await Promise.allSettled(missing.map((u) => getDoc(doc(db, "users", u))));
      const patch: Record<string, { name?: string | null; handle?: string | null; photoURL?: string | null }> =
        {};
      results.forEach((res, idx) => {
        const u = missing[idx];
        if (res.status === "fulfilled" && res.value.exists()) {
          const d = res.value.data() as any;
          patch[u] = { name: d?.name ?? null, handle: d?.handle ?? null, photoURL: d?.photoURL ?? null };
        } else patch[u] = {};
      });
      setUserCache((prev) => ({ ...prev, ...patch }));
    })();
  }, [replies, userCache]);

  // Helpers
  const timeAgoShort = (ts: any) => {
    const d = typeof ts?.toDate === "function" ? ts.toDate() : null;
    if (!d) return "";
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const dy = Math.floor(h / 24);
    if (dy < 7) return `${dy}d`;
    const w = Math.floor(dy / 7);
    if (w < 5) return `${w}w`;
    const mo = Math.floor(dy / 30);
    if (mo < 12) return `${mo}mo`;
    const y = Math.floor(dy / 365);
    return `${y}y`;
  };

  const startReplyToTop = useCallback(
    (parent: Reply) => {
      const handle = parent.userHandle ?? userCache[parent.authorId]?.handle ?? null;
      setReplyTarget({ parentId: parent.id, replyToId: parent.id, replyToHandle: handle || null });
      const mention = handle ? `@${handle.replace(/^@/, "")} ` : "";
      setText((t) => (mention && !t.startsWith(mention) ? mention + t : t));
    },
    [userCache]
  );

  const startReplyToChild = useCallback(
    (parent: Reply, child: Reply) => {
      const handle = child.userHandle ?? userCache[child.authorId]?.handle ?? null;
      setReplyTarget({ parentId: parent.id, replyToId: child.id, replyToHandle: handle || null });
      const mention = handle ? `@${handle.replace(/^@/, "")} ` : "";
      setText((t) => (mention && !t.startsWith(mention) ? mention + t : t));
    },
    [userCache]
  );

  const postReply = useCallback(async () => {
    const body = text.trim();
    if (!body || !discussionId) return;

    const user = auth.currentUser;
    if (!user) {
      alert("Sign in required");
      router.push("/login");
      return;
    }

    try {
      setPosting(true);
      const repliesCol = collection(db, "discussions", discussionId, "replies");
      const newDoc = await addDoc(repliesCol, {
        body,
        authorId: user.uid,
        createdAt: serverTimestamp(),
        parentId: replyTarget?.parentId ?? null,
        replyToId: replyTarget?.replyToId ?? null,
        replyToHandle: replyTarget?.replyToHandle ?? null,
        userName: meName ?? null,
        userHandle: meHandle ?? null,
        userPhotoURL: mePhotoURL ?? null,
      });

      setReplies((prev) => [
        ...prev,
        {
          id: newDoc.id,
          body,
          authorId: user.uid,
          parentId: replyTarget?.parentId ?? null,
          replyToId: replyTarget?.replyToId ?? null,
          replyToHandle: replyTarget?.replyToHandle ?? null,
          userName: meName ?? null,
          userHandle: meHandle ?? null,
          userPhotoURL: mePhotoURL ?? null,
          createdAt: { toDate: () => new Date() },
        },
      ]);

      setText("");
      setReplyTarget(null);
    } catch (e: any) {
      alert(e?.message || "Failed to post");
    } finally {
      setPosting(false);
    }
  }, [text, replyTarget, meName, meHandle, mePhotoURL, discussionId, router, auth]);

  const startEdit = useCallback(
    (r: Reply) => {
      if (auth.currentUser?.uid !== r.authorId) return;
      setEditingId(r.id);
      setEditingText(r.body);
    },
    [auth]
  );

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingText("");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !discussionId) return;
    const body = editingText.trim();
    if (!body) return alert("Answer cannot be empty.");

    setSavingId(editingId);
    try {
      await updateDoc(doc(db, "discussions", discussionId, "replies", editingId), {
        body,
        updatedAt: serverTimestamp(),
      });
      setReplies((prev) =>
        prev.map((r) =>
          r.id === editingId ? { ...r, body, updatedAt: { toDate: () => new Date() } } : r
        )
      );
      setEditingId(null);
      setEditingText("");
    } catch (e: any) {
      alert(e?.message || "Save failed (rules?)");
    } finally {
      setSavingId(null);
    }
  }, [editingId, editingText, discussionId]);

  const requestDelete = useCallback(
    (r: Reply) => {
      if (auth.currentUser?.uid !== r.authorId) return;
      if (!confirm("Delete answer? This cannot be undone.")) return;

      (async () => {
        try {
          setDeletingId(r.id);
          await deleteDoc(doc(db, "discussions", discussionId!, "replies", r.id));
          setReplies((prev) => prev.filter((x) => x.id !== r.id));
        } catch (e: any) {
          alert(e?.message || "Delete failed");
        } finally {
          setDeletingId(null);
        }
      })();
    },
    [auth, discussionId]
  );

  // UI bits
  const Avatar = ({ src, size = 34 }: { src?: string | null; size?: number }) => (
    <div className="relative rounded-full overflow-hidden bg-gray-200" style={{ width: size, height: size }}>
      <Image src={src || AVATAR_FALLBACK} alt="avatar" fill className="object-cover" sizes={`${size}px`} />
    </div>
  );

  const Thread = ({ parent }: { parent: Reply }) => {
    const kids = childrenByParent[parent.id] || [];
    const isOwn = parent.authorId === uid;
    const isEditing = editingId === parent.id;

    const prof = userCache[parent.authorId] || {};
    const name = parent.userName ?? prof.name ?? null;
    const handle = parent.userHandle ?? prof.handle ?? null;
    const photo = parent.userPhotoURL ?? prof.photoURL ?? null;

    return (
      <div className={clsx(isDesktop ? "px-4 pt-3" : "px-3 pt-2")}>
        <PremiumSurface
          className="p-4"
          style={{
            borderColor: "rgba(199,146,87,0.18)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.78))",
          }}
        >
          <div className="flex items-start gap-3 pr-1 pb-2">
            <Avatar src={photo} size={34} />

            <div className="flex-1 min-w-0">
              {(name || handle) && (
                <div className="flex items-center gap-2 mb-1 min-w-0">
                  {name && (
                    <span className="font-extrabold truncate" style={{ color: EKARI.text }}>
                      {name}
                    </span>
                  )}
                  {handle && (
                    <span className="font-bold truncate" style={{ color: EKARI.dim }}>
                      @{handle.replace(/^@/, "")}
                    </span>
                  )}
                  <span
                    className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold border"
                    style={{
                      borderColor: "rgba(199,146,87,0.16)",
                      color: EKARI.sub,
                      background: "rgba(255,255,255,0.65)",
                    }}
                    title="Time"
                  >
                    <IoTimeOutline size={14} style={{ color: EKARI.forest }} />
                    {timeAgoShort(parent.createdAt) || "—"}
                  </span>
                </div>
              )}

              {isEditing ? (
                <div
                  className="rounded-2xl px-3 py-2 border"
                  style={{
                    borderColor: "rgba(199,146,87,0.18)",
                    background:
                      "linear-gradient(135deg, rgba(199,146,87,0.08), rgba(35,63,57,0.04))",
                  }}
                >
                  <textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className="w-full bg-transparent outline-none text-[14px] font-semibold leading-6"
                    placeholder="Edit your answer…"
                    maxLength={400}
                    style={{ color: EKARI.text }}
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1.5 rounded-full border bg-white/80 hover:bg-white focus:outline-none focus:ring-2 active:scale-[0.98]"
                      style={{ borderColor: "rgba(199,146,87,0.18)", color: EKARI.dim, ...ringStyle }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      className="px-4 py-1.5 rounded-full font-black focus:outline-none focus:ring-2 active:scale-[0.98]"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(35,63,57,1), rgba(199,146,87,0.55))",
                        color: "#fff",
                        opacity: savingId === parent.id ? 0.7 : 1,
                        ...ringStyle,
                      }}
                      disabled={savingId === parent.id}
                    >
                      {savingId === parent.id ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-[14px] font-semibold leading-6" style={{ color: EKARI.text }}>
                    {parent.body}
                  </div>

                  <div className="mt-2 flex items-center gap-3">
                    <button
                      onClick={() => startReplyToTop(parent)}
                      className="text-xs font-extrabold px-3 py-1.5 rounded-full border bg-white/70 hover:bg-white transition focus:outline-none focus:ring-2 active:scale-[0.98]"
                      style={{
                        borderColor: "rgba(199,146,87,0.16)",
                        color: EKARI.text,
                        ...ringStyle,
                      }}
                    >
                      Comment
                    </button>

                    {parent.updatedAt ? (
                      <span className="text-xs font-semibold" style={{ color: EKARI.dim }}>
                        edited
                      </span>
                    ) : null}
                  </div>
                </>
              )}
            </div>

            <div className="pl-1 flex items-center">
              {isOwn ? (
                <div className="flex items-center">
                  <button
                    onClick={() => startEdit(parent)}
                    className="h-9 w-9 rounded-2xl border bg-white/70 hover:bg-white grid place-items-center mr-2 transition focus:outline-none focus:ring-2 active:scale-[0.98]"
                    style={{ borderColor: "rgba(199,146,87,0.16)", ...ringStyle }}
                    title="Edit"
                    disabled={!!editingId && editingId !== parent.id}
                  >
                    <IoCreateOutline size={18} color={EKARI.dim} />
                  </button>

                  <button
                    onClick={() => requestDelete(parent)}
                    className="h-9 w-9 rounded-2xl border bg-white/70 hover:bg-white grid place-items-center transition focus:outline-none focus:ring-2 active:scale-[0.98]"
                    style={{ borderColor: "rgba(199,146,87,0.16)", ...ringStyle }}
                    title="Delete"
                  >
                    {deletingId === parent.id ? (
                      <span className="text-xs font-black" style={{ color: EKARI.dim }}>
                        …
                      </span>
                    ) : (
                      <IoTrashOutline size={18} color={EKARI.dim} />
                    )}
                  </button>
                </div>
              ) : (
                <button
                  className="h-9 w-9 rounded-2xl border bg-white/70 hover:bg-white grid place-items-center transition focus:outline-none focus:ring-2 active:scale-[0.98]"
                  style={{ borderColor: "rgba(199,146,87,0.16)", ...ringStyle }}
                  title="More"
                >
                  <IoEllipsisHorizontal size={18} color={EKARI.dim} />
                </button>
              )}
            </div>
          </div>

          {kids.length > 0 && (
            <div
              className="mt-3 rounded-2xl border overflow-hidden"
              style={{
                borderColor: "rgba(199,146,87,0.16)",
                background:
                  "linear-gradient(135deg, rgba(199,146,87,0.06), rgba(35,63,57,0.03))",
              }}
            >
              <div
                className="h-[2px]"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(199,146,87,0.85), rgba(35,63,57,0.85))",
                }}
              />
              <div className="p-3 space-y-3">
                {kids.map((child) => {
                  const isChildOwn = child.authorId === uid;
                  const isChildEditing = editingId === child.id;

                  const cprof = userCache[child.authorId] || {};
                  const cname = child.userName ?? cprof.name ?? null;
                  const chandle = child.userHandle ?? cprof.handle ?? null;
                  const cphoto = child.userPhotoURL ?? cprof.photoURL ?? null;

                  return (
                    <div
                      key={child.id}
                      className="rounded-2xl border p-3 bg-white/70"
                      style={{ borderColor: "rgba(199,146,87,0.16)" }}
                    >
                      <div className="flex items-start gap-2">
                        <Avatar src={cphoto} size={26} />

                        <div className="flex-1 min-w-0">
                          {(cname || chandle) && (
                            <div className="flex items-center gap-2 mb-1 min-w-0">
                              {cname && (
                                <span className="font-extrabold truncate" style={{ color: EKARI.text }}>
                                  {cname}
                                </span>
                              )}
                              {chandle && (
                                <span className="font-bold truncate" style={{ color: EKARI.dim }}>
                                  @{chandle.replace(/^@/, "")}
                                </span>
                              )}

                              <span
                                className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold border"
                                style={{
                                  borderColor: "rgba(199,146,87,0.16)",
                                  color: EKARI.sub,
                                  background: "rgba(255,255,255,0.65)",
                                }}
                              >
                                <IoTimeOutline size={14} style={{ color: EKARI.forest }} />
                                {timeAgoShort(child.createdAt) || "—"}
                              </span>
                            </div>
                          )}

                          {isChildEditing ? (
                            <div
                              className="rounded-2xl px-3 py-2 border"
                              style={{
                                borderColor: "rgba(199,146,87,0.18)",
                                background:
                                  "linear-gradient(135deg, rgba(199,146,87,0.08), rgba(35,63,57,0.04))",
                              }}
                            >
                              <textarea
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                className="w-full bg-transparent outline-none text-[14px] font-semibold leading-6"
                                placeholder="Edit your answer…"
                                maxLength={400}
                                style={{ color: EKARI.text }}
                              />
                              <div className="mt-2 flex justify-end gap-2">
                                <button
                                  onClick={cancelEdit}
                                  className="px-3 py-1.5 rounded-full border bg-white/80 hover:bg-white focus:outline-none focus:ring-2 active:scale-[0.98]"
                                  style={{
                                    borderColor: "rgba(199,146,87,0.18)",
                                    color: EKARI.dim,
                                    ...ringStyle,
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={saveEdit}
                                  className="px-4 py-1.5 rounded-full font-black focus:outline-none focus:ring-2 active:scale-[0.98]"
                                  style={{
                                    background:
                                      "linear-gradient(135deg, rgba(35,63,57,1), rgba(199,146,87,0.55))",
                                    color: "#fff",
                                    opacity: savingId === child.id ? 0.7 : 1,
                                    ...ringStyle,
                                  }}
                                  disabled={savingId === child.id}
                                >
                                  {savingId === child.id ? "Saving…" : "Save"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="text-[14px] font-semibold leading-6" style={{ color: EKARI.text }}>
                                {child.replyToHandle ? (
                                  <span className="font-extrabold" style={{ color: EKARI.dim }}>
                                    @{child.replyToHandle.replace(/^@/, "")}{" "}
                                  </span>
                                ) : null}
                                {child.body}
                              </div>

                              <div className="mt-2 flex items-center gap-3">
                                <button
                                  onClick={() => startReplyToChild(parent, child)}
                                  className="text-xs font-extrabold px-3 py-1.5 rounded-full border bg-white/70 hover:bg-white transition focus:outline-none focus:ring-2 active:scale-[0.98]"
                                  style={{
                                    borderColor: "rgba(199,146,87,0.16)",
                                    color: EKARI.text,
                                    ...ringStyle,
                                  }}
                                >
                                  Comment
                                </button>

                                {child.updatedAt ? (
                                  <span className="text-xs font-semibold" style={{ color: EKARI.dim }}>
                                    edited
                                  </span>
                                ) : null}
                              </div>
                            </>
                          )}
                        </div>

                        {isChildOwn && (
                          <div className="pl-1 flex items-center">
                            <button
                              onClick={() => startEdit(child)}
                              className="h-9 w-9 rounded-2xl border bg-white/70 hover:bg-white grid place-items-center mr-2 transition focus:outline-none focus:ring-2 active:scale-[0.98]"
                              style={{ borderColor: "rgba(199,146,87,0.16)", ...ringStyle }}
                              title="Edit"
                              disabled={!!editingId && editingId !== child.id}
                            >
                              <IoCreateOutline size={18} color={EKARI.dim} />
                            </button>

                            <button
                              onClick={() => requestDelete(child)}
                              className="h-9 w-9 rounded-2xl border bg-white/70 hover:bg-white grid place-items-center transition focus:outline-none focus:ring-2 active:scale-[0.98]"
                              style={{ borderColor: "rgba(199,146,87,0.16)", ...ringStyle }}
                              title="Delete"
                            >
                              {deletingId === child.id ? (
                                <span className="text-xs font-black" style={{ color: EKARI.dim }}>
                                  …
                                </span>
                              ) : (
                                <IoTrashOutline size={18} color={EKARI.dim} />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </PremiumSurface>
      </div>
    );
  };

  /* ---------- Premium Header ---------- */
  const Header = (
    <div
      className="sticky w-full top-0 z-50"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.82))",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(199,146,87,0.18)",
      }}
    >
      <div className={cn(isDesktop ? "px-4 max-w-[1180px] mx-auto" : "px-3")}>
        <div className="h-[72px] flex items-center justify-between gap-3">
          <button
            onClick={goBack}
            className="h-11 w-11 rounded-2xl border bg-white/80 backdrop-blur-xl shadow-sm grid place-items-center transition hover:bg-white focus:outline-none focus:ring-2 active:scale-[0.98]"
            style={{ borderColor: "rgba(199,146,87,0.22)", ...ringStyle }}
            aria-label="Go back"
          >
            <ArrowLeft size={18} style={{ color: EKARI.text }} />
          </button>

          <div className="flex-1 min-w-0">
            <div className="font-black text-[18px] leading-none truncate" style={{ color: EKARI.text }}>
              Discussion
            </div>
            <div className="text-[12px] mt-1 truncate font-semibold" style={{ color: EKARI.dim }}>
              {disc?.title ?? ""}
            </div>
          </div>

          <button
            onClick={shareDiscussion}
            className="h-11 px-4 rounded-full border bg-white/80 backdrop-blur-xl shadow-sm flex items-center gap-2 transition hover:bg-white focus:outline-none focus:ring-2 active:scale-[0.98]"
            style={{ borderColor: "rgba(199,146,87,0.22)", ...ringStyle }}
            aria-label="Share discussion"
            title="Share"
          >
            <IoArrowRedo size={18} color={EKARI.text} />
            <span className={cn(isMobile ? "hidden" : "inline")} style={{ color: EKARI.text, fontWeight: 800 }}>
              Share
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  /* ---------- Premium Topic Card ---------- */
  const TopicCard = (
    <div className={cn(isDesktop ? "px-4 pt-4 max-w-[1180px] mx-auto" : "px-3 pt-3")}>
      <PremiumSurface
        className="p-4"
        style={{
          borderColor: "rgba(199,146,87,0.22)",
          background:
            "linear-gradient(135deg, rgba(199,146,87,0.10), rgba(35,63,57,0.05)), linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.78))",
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className="h-11 w-11 rounded-2xl grid place-items-center border shrink-0"
            style={{
              borderColor: "rgba(199,146,87,0.18)",
              background: "linear-gradient(135deg, rgba(35,63,57,1), rgba(199,146,87,0.45))",
            }}
          >
            <IoChatbubblesOutline size={18} color="#fff" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="font-black text-[16px] leading-[22px] line-clamp-2" style={{ color: EKARI.text }}>
              {disc?.title}
            </div>

            {!!disc?.body && (
              <div className="mt-2 text-[14px] leading-6 font-semibold" style={{ color: EKARI.sub }}>
                {disc.body}
              </div>
            )}

            <div className="mt-3 flex items-center gap-2 text-[12px] font-semibold" style={{ color: EKARI.dim }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: hexToRgba(EKARI.gold, 0.85) }} />
              Answers appear instantly • Be kind • Stay helpful
              <span
                className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold border"
                style={{
                  borderColor: "rgba(199,146,87,0.16)",
                  color: EKARI.text,
                  background: "rgba(255,255,255,0.65)",
                }}
                title="Premium"
              >
                <IoSparklesOutline size={14} style={{ color: EKARI.forest }} />
                ekari Nexus
              </span>
            </div>
          </div>
        </div>
      </PremiumSurface>
    </div>
  );

  /* ---------- Premium Composer ---------- */
  const Composer = (
    <div
      className="fixed bottom-0 z-30"
      style={{
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        ...(isDesktop
          ? ({
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(900px, calc(100vw - 32px))",
          } as React.CSSProperties)
          : ({ left: 0, right: 0 } as React.CSSProperties)),
      }}
    >
      <div className={cn(isDesktop ? "px-4 pb-3" : "px-3 pb-3")}>
        <PremiumSurface
          className="p-3"
          style={{
            borderColor: "rgba(199,146,87,0.22)",
            background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.84))",
          }}
        >
          {replyTarget && (
            <div
              className="mb-2 rounded-full px-3 py-1.5 flex items-center gap-2 border"
              style={{
                borderColor: "rgba(199,146,87,0.18)",
                background: "linear-gradient(135deg, rgba(199,146,87,0.10), rgba(35,63,57,0.05))",
              }}
            >
              <span className="text-xs font-extrabold truncate" style={{ color: EKARI.text }}>
                Commenting to {replyTarget.replyToHandle ? replyTarget.replyToHandle : "comment"}
              </span>
              <button onClick={() => setReplyTarget(null)} className="ml-auto p-1" title="Clear">
                <IoClose size={14} color={EKARI.dim} />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <div
              className="flex-1 rounded-2xl border px-3 py-2 focus-within:ring-2"
              style={{
                borderColor: "rgba(199,146,87,0.18)",
                background: "linear-gradient(135deg, rgba(199,146,87,0.08), rgba(35,63,57,0.04))",
                ...ringStyle,
              }}
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write an answer…"
                className="w-full bg-transparent outline-none text-[14px] font-semibold min-h-[44px] max-h-[160px]"
                style={{ color: EKARI.text }}
              />
            </div>

            <button
              onClick={postReply}
              disabled={!text.trim() || posting}
              className="h-11 w-11 rounded-2xl grid place-items-center shadow-lg focus:outline-none focus:ring-2 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, rgba(199,146,87,1), rgba(35,63,57,0.65))",
                opacity: !text.trim() || posting ? 0.6 : 1,
                ...ringStyle,
              }}
              title="Send"
              aria-label="Send"
            >
              {posting ? (
                <span className="text-xs font-black" style={{ color: "#111827" }}>
                  …
                </span>
              ) : (
                <IoSend size={18} color="#111827" />
              )}
            </button>
          </div>
        </PremiumSurface>
      </div>
    </div>
  );

  const Content = (
    <>
      {!disc ? (
        <div className="py-16 flex items-center justify-center" style={{ color: EKARI.dim }}>
          Discussion not found
        </div>
      ) : (
        <>
          {TopicCard}

          {/* Thread list */}
          <div className={clsx(isDesktop ? "max-w-[1180px] mx-auto" : "")}>
            <div
              style={{
                paddingBottom: "calc(170px + env(safe-area-inset-bottom))",
              }}
            >
              {topLevel.map((parent) => (
                <Thread key={parent.id} parent={parent} />
              ))}

              <div className={clsx(isDesktop ? "px-4 py-5" : "px-3 py-4")}>
                {hasMore ? (
                  <button
                    onClick={loadMore}
                    className="rounded-2xl border px-4 py-3 text-sm font-extrabold bg-white/80 backdrop-blur-xl hover:bg-white transition focus:outline-none focus:ring-2 active:scale-[0.99]"
                    style={{
                      borderColor: "rgba(199,146,87,0.18)",
                      color: EKARI.text,
                      ...ringStyle,
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.78))",
                      opacity: paging ? 0.7 : 1,
                    }}
                    disabled={paging}
                  >
                    {paging ? "Loading…" : "Load more"}
                  </button>
                ) : (
                  <div className="text-center text-xs font-semibold" style={{ color: "#94A3B8" }}>
                    No more answers
                  </div>
                )}
              </div>

              {isMobile && <div style={{ height: "env(safe-area-inset-bottom)" }} />}
            </div>
          </div>

          {Composer}
        </>
      )}
    </>
  );

  if (initialLoading) {
    return (
      <>
        {isMobile ? (
          <div className="min-h-screen w-full flex items-center justify-center" style={premiumBg}>
            <BouncingBallLoader />
          </div>
        ) : (
          <AppShell>
            <div className="min-h-screen w-full flex items-center justify-center" style={premiumBg}>
              <BouncingBallLoader />
            </div>
          </AppShell>
        )}
      </>
    );
  }

  // MOBILE: fixed inset like /bonga, NO bottom tabs, just header + content + composer
  if (isMobile) {
    return (
      <div className="fixed inset-0 flex flex-col" style={premiumBg}>
        <OpenInAppBanner
          webUrl={webUrl}
          appUrl={appUrl}
          title="Open this discussion in ekarihub"
          subtitle="Faster loading, messaging, and full features."
          playStoreUrl="https://play.google.com/store/apps/details?id=com.ekarihub.app"
          appStoreUrl="https://apps.apple.com"
        />

        {Header}
        <div className="flex-1 overflow-y-auto overscroll-contain">{Content}</div>
      </div>
    );
  }

  // DESKTOP: AppShell + max width container like /bonga desktop
  return (
    <AppShell>
      <div className="min-h-screen w-full" style={premiumBg}>
        {Header}
        {Content}
      </div>
    </AppShell>
  );
}
