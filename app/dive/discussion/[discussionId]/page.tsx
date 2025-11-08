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
  IoArrowBack,
  IoChatbubblesOutline,
  IoClose,
  IoCreateOutline,
  IoEllipsisHorizontal,
  IoSend,
  IoTrashOutline,
} from "react-icons/io5";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

// Avoid static optimization since we read client-side
export const dynamic = "force-dynamic";

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
  hair: "#E5E7EB",
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

export default function DiscussionThreadPage() {
  const router = useRouter();
  const params = useParams() as Record<string, string | string[]>;
  const discussionId = Array.isArray(params?.discussionId)
    ? params.discussionId[0]
    : (params?.discussionId as string | undefined);

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
        if (!d?.photoURL && auth.currentUser?.photoURL) {
          setMePhotoURL(auth.currentUser.photoURL);
        } else if (d?.photoURL) {
          setMePhotoURL(d.photoURL);
        }
      } catch {
        setMeName(auth.currentUser?.displayName ?? null);
      }
    })();
  }, [uid, auth.currentUser]);

  // Initial load: discussion + first page of replies
  useEffect(() => {
    (async () => {
      setInitialLoading(true);
      try {
        if (!discussionId) return;

        // topic
        const snap = await getDoc(doc(db, "discussions", discussionId));
        if (snap.exists()) {
          const data = snap.data() as any;
          setDisc({ id: snap.id, title: data?.title ?? "", body: data?.body ?? "" });
        } else {
          setDisc(null);
        }

        // first replies page
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
        setReplies((prev) => [...prev, ...s.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Reply))]);
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
      const patch: Record<string, { name?: string | null; handle?: string | null; photoURL?: string | null }> = {};
      results.forEach((res, idx) => {
        const uid = missing[idx];
        if (res.status === "fulfilled" && res.value.exists()) {
          const d = res.value.data() as any;
          patch[uid] = { name: d?.name ?? null, handle: d?.handle ?? null, photoURL: d?.photoURL ?? null };
        } else {
          patch[uid] = {};
        }
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

  // Reply start (top-level)
  const startReplyToTop = useCallback(
    (parent: Reply) => {
      const handle = parent.userHandle ?? userCache[parent.authorId]?.handle ?? null;
      setReplyTarget({ parentId: parent.id, replyToId: parent.id, replyToHandle: handle || null });
      const mention = handle ? `@${handle.replace(/^@/, "")} ` : "";
      setText((t) => (mention && !t.startsWith(mention) ? mention + t : t));
    },
    [userCache]
  );

  // Reply start (child)
  const startReplyToChild = useCallback(
    (parent: Reply, child: Reply) => {
      const handle = child.userHandle ?? userCache[child.authorId]?.handle ?? null;
      setReplyTarget({ parentId: parent.id, replyToId: child.id, replyToHandle: handle || null });
      const mention = handle ? `@${handle.replace(/^@/, "")} ` : "";
      setText((t) => (mention && !t.startsWith(mention) ? mention + t : t));
    },
    [userCache]
  );

  // Posting a reply
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
        // denorm
        userName: meName ?? null,
        userHandle: meHandle ?? null,
        userPhotoURL: mePhotoURL ?? null,
      });

      // optimistic add
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
  }, [text, replyTarget, meName, meHandle, mePhotoURL, discussionId, router, auth.currentUser]);

  // Edit
  const startEdit = useCallback(
    (r: Reply) => {
      if (auth.currentUser?.uid !== r.authorId) return;
      setEditingId(r.id);
      setEditingText(r.body);
    },
    [auth.currentUser?.uid]
  );

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingText("");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !discussionId) return;
    const body = editingText.trim();
    if (!body) {
      alert("Answer cannot be empty.");
      return;
    }
    setSavingId(editingId);
    try {
      await updateDoc(doc(db, "discussions", discussionId, "replies", editingId), {
        body,
        updatedAt: serverTimestamp(),
      });
      setReplies((prev) =>
        prev.map((r) => (r.id === editingId ? { ...r, body, updatedAt: { toDate: () => new Date() } } : r))
      );
      setEditingId(null);
      setEditingText("");
    } catch (e: any) {
      alert(e?.message || "Save failed (rules?)");
    } finally {
      setSavingId(null);
    }
  }, [editingId, editingText, discussionId]);

  // Delete
  const requestDelete = useCallback(
    (r: Reply) => {
      if (auth.currentUser?.uid !== r.authorId) return;
      if (confirm("Delete answer? This cannot be undone.")) {
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
      }
    },
    [auth.currentUser?.uid, discussionId]
  );

  // UI Helpers
  const Avatar = ({ src, size = 34 }: { src?: string | null; size?: number }) => (
    <div className="relative rounded-full overflow-hidden bg-gray-200" style={{ width: size, height: size }}>
      <Image
        src={src || AVATAR_FALLBACK}
        alt="avatar"
        fill
        className="object-cover"
        sizes={`${size}px`}
      />
    </div>
  );

  const ReplyMeta = ({ ts, onReply }: { ts?: any; onReply: () => void }) => (
    <div className="mt-1 flex items-center gap-4">
      <span className="text-xs font-semibold" style={{ color: EKARI.dim }}>
        {timeAgoShort(ts)}
      </span>
      <button onClick={onReply} className="text-xs font-semibold" style={{ color: EKARI.dim }}>
        Comment
      </button>
    </div>
  );

  // Render a thread (top-level + its children)
  const Thread = ({ parent }: { parent: Reply }) => {
    const kids = childrenByParent[parent.id] || [];
    const isOwn = parent.authorId === uid;
    const isEditing = editingId === parent.id;

    const prof = userCache[parent.authorId] || {};
    const name = parent.userName ?? prof.name ?? null;
    const handle = parent.userHandle ?? prof.handle ?? null;
    const photo = parent.userPhotoURL ?? prof.photoURL ?? null;

    return (
      <div className="px-3 pt-2">
        {/* Top-level row */}
        <div className="flex items-start gap-3 pr-1 pb-2">
          <Avatar src={photo} size={34} />
          <div className="flex-1">
            {(name || handle) && (
              <div className="flex items-center gap-2 mb-1">
                {name && <span className="font-extrabold" style={{ color: EKARI.text }}>{name}</span>}
                {handle && <span className="font-bold" style={{ color: EKARI.dim }}>@{handle.replace(/^@/, "")}</span>}
              </div>
            )}

            {isEditing ? (
              <div className="bg-gray-100 rounded-xl px-3 py-2">
                <textarea
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  className="w-full bg-transparent outline-none text-[15px] leading-5"
                  placeholder="Edit your answer…"
                  maxLength={400}
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1.5 rounded-full border"
                    style={{ borderColor: EKARI.hair, color: EKARI.dim, backgroundColor: "#fff" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    className="px-4 py-1.5 rounded-full text-white"
                    style={{ backgroundColor: EKARI.gold, opacity: savingId === parent.id ? 0.7 : 1 }}
                    disabled={savingId === parent.id}
                  >
                    {savingId === parent.id ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-[16px] leading-5" style={{ color: EKARI.text }}>
                  {parent.body}
                </div>
                <ReplyMeta ts={parent.createdAt} onReply={() => startReplyToTop(parent)} />
              </>
            )}
          </div>

          <div className="pl-1 flex items-center">
            {isOwn ? (
              <div className="flex items-center">
                <button
                  onClick={() => startEdit(parent)}
                  className="p-1 mr-1"
                  title="Edit"
                  disabled={!!editingId && editingId !== parent.id}
                >
                  <IoCreateOutline size={18} color={EKARI.dim} />
                </button>
                <button onClick={() => requestDelete(parent)} className="p-1" title="Delete">
                  {deletingId === parent.id ? (
                    <span className="text-xs" style={{ color: EKARI.dim }}>…</span>
                  ) : (
                    <IoTrashOutline size={18} color={EKARI.dim} />
                  )}
                </button>
              </div>
            ) : (
              <button className="p-1" title="More">
                <IoEllipsisHorizontal size={18} color={EKARI.dim} />
              </button>
            )}
          </div>
        </div>

        {/* Children */}
        {kids.length > 0 && (
          <div className="ml-11 border-l" style={{ borderColor: EKARI.hair }}>
            <div className="pl-3 pb-2 space-y-2">
              {kids.map((child) => {
                const isChildOwn = child.authorId === uid;
                const isChildEditing = editingId === child.id;

                const cprof = userCache[child.authorId] || {};
                const cname = child.userName ?? cprof.name ?? null;
                const chandle = child.userHandle ?? cprof.handle ?? null;
                const cphoto = child.userPhotoURL ?? cprof.photoURL ?? null;

                return (
                  <div key={child.id} className="flex items-start gap-2">
                    <Avatar src={cphoto} size={26} />
                    <div className="flex-1">
                      {(cname || chandle) && (
                        <div className="flex items-center gap-2 mb-1">
                          {cname && <span className="font-extrabold" style={{ color: EKARI.text }}>{cname}</span>}
                          {chandle && <span className="font-bold" style={{ color: EKARI.dim }}>@{chandle.replace(/^@/, "")}</span>}
                        </div>
                      )}

                      {isChildEditing ? (
                        <div className="bg-gray-100 rounded-xl px-3 py-2">
                          <textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="w-full bg-transparent outline-none text-[15px] leading-5"
                            placeholder="Edit your answer…"
                            maxLength={400}
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <button
                              onClick={cancelEdit}
                              className="px-3 py-1.5 rounded-full border"
                              style={{ borderColor: EKARI.hair, color: EKARI.dim, backgroundColor: "#fff" }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={saveEdit}
                              className="px-4 py-1.5 rounded-full text-white"
                              style={{ backgroundColor: EKARI.gold, opacity: savingId === child.id ? 0.7 : 1 }}
                              disabled={savingId === child.id}
                            >
                              {savingId === child.id ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-[16px] leading-5" style={{ color: EKARI.text }}>
                            {child.replyToHandle ? (
                              <span className="font-bold" style={{ color: EKARI.dim }}>
                                @{child.replyToHandle.replace(/^@/, "")}{" "}
                              </span>
                            ) : null}
                            {child.body}
                          </div>
                          <div className="mt-1 flex items-center gap-4">
                            <span className="text-xs font-semibold" style={{ color: EKARI.dim }}>
                              {timeAgoShort(child.createdAt)}
                            </span>
                            <button
                              onClick={() => startReplyToChild(parent, child)}
                              className="text-xs font-semibold"
                              style={{ color: EKARI.dim }}
                            >
                              Comment
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {isChildOwn && (
                      <div className="pl-1 flex items-center">
                        <button
                          onClick={() => startEdit(child)}
                          className="p-1 mr-1"
                          title="Edit"
                          disabled={!!editingId && editingId !== child.id}
                        >
                          <IoCreateOutline size={18} color={EKARI.dim} />
                        </button>
                        <button onClick={() => requestDelete(child)} className="p-1" title="Delete">
                          {deletingId === child.id ? (
                            <span className="text-xs" style={{ color: EKARI.dim }}>…</span>
                          ) : (
                            <IoTrashOutline size={18} color={EKARI.dim} />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (initialLoading) {
    return (
      <AppShell>
        <div className="min-h-screen w-full flex items-center justify-center">
          <div className="animate-pulse text-sm text-gray-500"><BouncingBallLoader /></div>
        </div>
      </AppShell>
    );
  }

  if (!disc) {
    return (
      <AppShell>
        <div className="min-h-screen w-full flex items-center justify-center">
          <div className="text-gray-500">Discussion not found</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="h-12 border-b border-gray-200 px-3 flex items-center justify-between sticky top-0 bg-white z-10">
          <button
            onClick={() => router.back()}
            className="h-10 w-10 rounded-full flex items-center justify-center border border-gray-200"
            aria-label="Back"
            title="Back"
          >
            <IoArrowBack size={18} color={EKARI.text} />
          </button>
          <div className="text-[18px] font-black" style={{ color: EKARI.text }}>Discussion</div>
          <div className="w-10" />
        </div>

        {/* Topic card */}
        <div className="p-3">
          <div className="bg-white rounded-xl border p-3" style={{ borderColor: EKARI.hair }}>
            <div className="flex items-center gap-2">
              <IoChatbubblesOutline size={18} color={EKARI.forest} />
              <div className="font-extrabold text-[16px] leading-[22px]" style={{ color: EKARI.text }}>
                {disc.title}
              </div>
            </div>
            {!!disc.body && (
              <div className="mt-2" style={{ color: EKARI.text }}>
                {disc.body}
              </div>
            )}
          </div>
        </div>

        {/* Threads */}
        <div className="pb-36">
          {topLevel.map((parent) => (
            <Thread key={parent.id} parent={parent} />
          ))}

          <div className="px-3 py-3">
            {hasMore ? (
              <button
                onClick={loadMore}
                className="w-full h-10 rounded-lg border text-sm font-bold"
                style={{ borderColor: EKARI.hair, color: EKARI.text, backgroundColor: "#F8FAFC", opacity: paging ? 0.7 : 1 }}
                disabled={paging}
              >
                {paging ? "Loading…" : "Load more"}
              </button>
            ) : (
              <div className="text-center text-xs text-gray-400">No more answers</div>
            )}
          </div>
        </div>

        {/* Composer (fixed bottom) */}
        <div
          className={[
            "fixed bottom-0 right-0 bg-white border-t px-3 pt-2",
            // mobile: full width
            "left-0",
            // desktop+: leave space for the left rail (adjust widths to your rail)
            "md:left-[240px] lg:left-[260px] xl:left-[260px]",
            // keep it above page content but below any global nav if you have one
            "z-30",
          ].join(" ")}
          style={{
            borderColor: EKARI.hair,
            // nice on iOS notches
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          }}
        >
          {replyTarget && (
            <div className="mx-1 mb-2 rounded-full px-3 py-1.5 flex items-center gap-2" style={{ backgroundColor: "#F3F4F6" }}>
              <span className="text-xs font-bold" style={{ color: EKARI.dim }}>
                Commenting to {replyTarget.replyToHandle ? replyTarget.replyToHandle : "comment"}
              </span>
              <button onClick={() => setReplyTarget(null)} className="ml-auto p-1" title="Clear">
                <IoClose size={14} color={EKARI.dim} />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write an answer…"
              className="flex-1 min-h-[44px] max-h-[160px] rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: EKARI.hair, color: EKARI.text }}
            />
            <button
              onClick={postReply}
              disabled={!text.trim() || posting}
              className="h-11 w-11 rounded-full flex items-center justify-center text-white"
              style={{ backgroundColor: EKARI.gold, opacity: !text.trim() || posting ? 0.6 : 1 }}
              title="Send"
            >
              {posting ? <span className="text-xs">…</span> : <IoSend size={18} color="#fff" />}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
