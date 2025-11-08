"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IoChatbubblesOutline, IoCallOutline, IoMailOutline, IoSend, IoSearch, IoChevronForward, IoAlertCircleOutline, IoPricetagOutline, IoSettingsOutline, IoBulbOutline, IoCalendarOutline, IoDocumentTextOutline } from "react-icons/io5";
import { getAuth } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  onSnapshot,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref as sRef,
  uploadBytes,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import AppShell from "@/app/components/AppShell";

type Ticket = {
  id: string;
  subject: string;
  topic: string;
  priority: "low" | "normal" | "high" | "urgent";
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  createdAt?: any;
  updatedAt?: any;
  createdBy: string; // uid
  email?: string;
  name?: string;
  attachments?: { name: string; url: string }[];
  ticketNo?: string; // friendly short code
};

const TOPICS = [
  { key: "billing", label: "Billing & Payments", icon: IoPricetagOutline },
  { key: "account", label: "Account & Login", icon: IoSettingsOutline },
  { key: "technical", label: "Technical Issue", icon: IoAlertCircleOutline },
  { key: "feature", label: "Feature Request", icon: IoBulbOutline },
] as const;

const PRIORITIES: Ticket["priority"][] = ["low", "normal", "high", "urgent"];

function prettyDate(ts: any) {
  if (!ts) return "";
  const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  return d.toLocaleString();
}

function StatusBadge({ status }: { status: Ticket["status"] }) {
  const map: Record<Ticket["status"], string> = {
    open: "bg-emerald-50 text-emerald-700 border-emerald-200",
    in_progress: "bg-amber-50 text-amber-700 border-amber-200",
    resolved: "bg-blue-50 text-blue-700 border-blue-200",
    closed: "bg-slate-50 text-slate-600 border-slate-200",
  };
  const text: Record<Ticket["status"], string> = {
    open: "Open",
    in_progress: "In progress",
    resolved: "Resolved",
    closed: "Closed",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${map[status]}`}>
      {text[status]}
    </span>
  );
}

export default function SupportPage() {
  const auth = getAuth();
  const router = useRouter();
  const user = auth.currentUser || undefined;

  // Prefill profile basics if available
  const [profile, setProfile] = useState<{ name?: string; email?: string } | null>(null);
  useEffect(() => {
    let unsub: any;
    (async () => {
      if (!user?.uid) return setProfile({ name: user?.displayName || "", email: user?.email || "" });
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const d = snap.exists() ? (snap.data() as any) : {};
        setProfile({
          name: d?.firstName ? `${d.firstName} ${d.surname || ""}`.trim() : (user.displayName || ""),
          email: d?.email || user.email || "",
        });
      } catch {
        setProfile({ name: user?.displayName || "", email: user?.email || "" });
      }
    })();
    return () => unsub && unsub();
  }, [user?.uid]);

  // Form state
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState<(typeof TOPICS)[number]["key"]>("technical");
  const [priority, setPriority] = useState<Ticket["priority"]>("normal");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string>("");

  // Ticket list
  const [tickets, setTickets] = useState<Ticket[]>([]);
  useEffect(() => {
    if (!user?.uid) return;
    const qy = query(
      collection(db, "support_tickets"),
      where("createdBy", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(10)
    );
    const unsub = onSnapshot(qy, (snap) => {
      const arr: Ticket[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setTickets(arr);
    });
    return () => unsub();
  }, [user?.uid]);

  // Handle file pick
  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    setFiles(list.slice(0, 3)); // cap at 3
  };

  const canSubmit = subject.trim().length >= 4 && message.trim().length >= 10;

  // Submit ticket
  const submitTicket = async () => {
    if (!user?.uid) {
      router.push("/login?next=/support");
      return;
    }
    if (!canSubmit) return;

    setSubmitting(true);
    setSuccessMsg("");
    try {
      // Create base ticket first
      const base = {
        subject: subject.trim(),
        topic,
        priority,
        message: message.trim(),
        status: "open" as Ticket["status"],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
        name: profile?.name || "",
        email: profile?.email || "",
        attachments: [] as { name: string; url: string }[],
      };
      const docRef = await addDoc(collection(db, "support_tickets"), base);

      // Friendly ticket number (e.g., EK-ABC123)
      const ticketNo = "EK-" + docRef.id.slice(0, 6).toUpperCase();
      await updateDoc(doc(db, "support_tickets", docRef.id), { ticketNo });

      // Upload attachments if any
      if (files.length) {
        const uploaded: { name: string; url: string }[] = [];
        for (const f of files) {
          const ref = sRef(storage, `support_attachments/${user.uid}/${docRef.id}/${Date.now()}-${f.name}`);
          await uploadBytes(ref, f);
          const url = await getDownloadURL(ref);
          uploaded.push({ name: f.name, url });
        }
        await updateDoc(doc(db, "support_tickets", docRef.id), {
          attachments: uploaded,
          updatedAt: serverTimestamp(),
        });
      }

      // Reset form
      setSubject("");
      setMessage("");
      setFiles([]);
      setTopic("technical");
      setPriority("normal");
      setSuccessMsg(`Ticket submitted! Reference: ${ticketNo}`);
    } catch (err: any) {
      setSuccessMsg(err?.message || "Could not submit your ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="w-full">
        {/* Header */}
        <div className="h-14 border-b border-gray-200 px-4 flex items-center">
          <div className="font-black text-slate-900 text-[18px]">Support</div>
        </div>

        {/* Hero / Search */}
        <div className="px-4 py-6 border-b border-gray-200 bg-white">
          <div className="max-w-5xl">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900">How can we help?</h1>
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 h-12 max-w-2xl">
              <IoSearch className="text-slate-500" />
              <input
                placeholder="Search help articles (coming soon)"
                className="flex-1 bg-transparent outline-none"
              />
            </div>

            {/* Quick categories */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {TOPICS.map(({ key, label, icon: Icon }) => (
                <Link key={key} href={`/support/${key}`} className="group rounded-xl border border-gray-200 bg-white p-3 hover:shadow-sm transition">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#233F39] text-white flex items-center justify-center">
                      <Icon />
                    </div>
                    <div className="font-extrabold text-[15px] text-slate-900">{label}</div>
                  </div>
                  <div className="mt-2 text-sm text-slate-500">Guides & troubleshooting</div>
                  <div className="mt-2 text-xs text-slate-400 inline-flex items-center gap-1">
                    Browse <IoChevronForward />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Contact + SLA cards */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="font-black text-slate-900 mb-3">Contact us</div>
              <div className="space-y-3">
                <Link href="/bonga" className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
                  <div className="w-9 h-9 rounded-full bg-[#233F39] text-white flex items-center justify-center">
                    <IoChatbubblesOutline />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-900">Live chat</div>
                    <div className="text-sm text-slate-500">Get help from our team in chat</div>
                  </div>
                  <IoChevronForward className="text-slate-400" />
                </Link>

                <a href="mailto:support@ekarihub.com" className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
                  <div className="w-9 h-9 rounded-full bg-[#C79257] text-white flex items-center justify-center">
                    <IoMailOutline />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-900">Email</div>
                    <div className="text-sm text-slate-500">support@ekarihub.com</div>
                  </div>
                  <IoChevronForward className="text-slate-400" />
                </a>

                <a href="tel:+254700000000" className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
                  <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center">
                    <IoCallOutline />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-900">Phone</div>
                    <div className="text-sm text-slate-500">Mon–Fri 9am–5pm EAT</div>
                  </div>
                  <IoChevronForward className="text-slate-400" />
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="font-black text-slate-900 mb-3">Typical response times</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-200 p-3">
                  <div className="text-xs text-slate-500">Chat</div>
                  <div className="mt-1 text-lg font-black text-slate-900">~5–15 min</div>
                </div>
                <div className="rounded-xl border border-gray-200 p-3">
                  <div className="text-xs text-slate-500">Email</div>
                  <div className="mt-1 text-lg font-black text-slate-900">~4–8 hrs</div>
                </div>
              </div>
            </div>
          </div>

          {/* Middle/Right: Ticket form & recent tickets */}
          <div className="lg:col-span-2 space-y-6">
            {/* Submit a ticket */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="font-black text-slate-900">Submit a ticket</div>
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <IoDocumentTextOutline /> Please include screenshots/logs if possible
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold">Subject</label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Short summary"
                    className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold">Topic</label>
                  <div className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-2 flex items-center">
                    <select
                      value={topic}
                      onChange={(e) => setTopic(e.target.value as any)}
                      className="w-full bg-transparent outline-none px-2"
                    >
                      {TOPICS.map(t => (
                        <option key={t.key} value={t.key}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold">Priority</label>
                  <div className="mt-1 flex gap-2">
                    {PRIORITIES.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`h-9 px-3 rounded-full border text-sm font-bold ${priority === p ? "bg-[#233F39] text-white border-[#233F39]" : "bg-white border-gray-200"
                          }`}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold">Attachments</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.txt,.log"
                    onChange={onPickFiles}
                    className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                  />
                  {files.length > 0 && (
                    <div className="mt-1 text-xs text-slate-500">{files.length} file(s) selected (max 3)</div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-semibold">Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe the issue in detail…"
                    className="mt-1 h-36 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                  />
                </div>
              </div>

              {!!successMsg && (
                <div className="mt-3 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  {successMsg}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  onClick={submitTicket}
                  disabled={!canSubmit || submitting}
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-[#C79257] text-white font-extrabold disabled:opacity-60"
                >
                  <IoSend />
                  {submitting ? "Submitting…" : "Submit ticket"}
                </button>
              </div>
            </div>

            {/* My recent tickets */}
            <div className="rounded-2xl border border-gray-200 bg-white">
              <div className="p-4 flex items-center justify-between border-b">
                <div className="font-black text-slate-900">My recent tickets</div>
                <div className="text-xs text-slate-500 flex items-center gap-1"><IoCalendarOutline /> last 10</div>
              </div>
              {user?.uid ? (
                tickets.length === 0 ? (
                  <div className="p-6 text-slate-500 text-sm">No tickets yet.</div>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {tickets.map(t => (
                      <li key={t.id} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900">{t.subject}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {TOPICS.find(x => x.key === (t as any).topic)?.label || "General"} · {prettyDate(t.createdAt)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <StatusBadge status={t.status || "open"} />
                            {t.ticketNo && <span className="text-xs font-bold text-slate-500">{t.ticketNo}</span>}
                          </div>
                        </div>
                        {t.message && (
                          <div className="mt-1 text-sm text-slate-700 line-clamp-2">{t.message}</div>
                        )}
                        {!!t.attachments?.length && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {t.attachments.map(a => (
                              <a
                                key={a.url}
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs underline text-slate-600 hover:text-slate-900"
                              >
                                {a.name}
                              </a>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <div className="p-6 text-slate-500 text-sm">
                  Sign in to view your tickets.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
