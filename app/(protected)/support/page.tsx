// app/support/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IoMailOutline,
  IoSend,
  IoSearch,
  IoChevronForward,
  IoAlertCircleOutline,
  IoPricetagOutline,
  IoSettingsOutline,
  IoBulbOutline,
  IoCalendarOutline,
  IoDocumentTextOutline,
  IoArrowBack,
} from "react-icons/io5";
import { getAuth } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref as sRef, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Topbar } from "@/app/components/Topbar";
import { Footer } from "@/app/components/Footer";

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
  ticketNo?: string;
};

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  hair: "#E5E7EB",
  text: "#0F172A",
  dim: "#6B7280",
  bg: "#FFFFFF",
};

const TOPICS = [
  {
    key: "billing",
    label: "Billing & Payments",
    icon: IoPricetagOutline,
    color: "#FFF7ED",
  },
  {
    key: "account",
    label: "Account & Login",
    icon: IoSettingsOutline,
    color: "#EFF6FF",
  },
  {
    key: "technical",
    label: "Technical Issue",
    icon: IoAlertCircleOutline,
    color: "#EEFDF3",
  },
  {
    key: "feature",
    label: "Feature Request",
    icon: IoBulbOutline,
    color: "#F5F3FF",
  },
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
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${map[status]}`}
    >
      {text[status]}
    </span>
  );
}

/** Small UI helpers */
function Card({
  title,
  children,
  footer,
  className = "",
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white/90 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.04)] ${className}`}
      style={{ borderColor: EKARI.hair }}
    >
      {title ? (
        <div
          className="px-5 pt-5 text-[15px] font-black"
          style={{ color: EKARI.text }}
        >
          {title}
        </div>
      ) : null}
      <div className="px-5 py-4">{children}</div>
      {footer ? <div className="px-5 pb-5">{footer}</div> : null}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-sm font-semibold" style={{ color: EKARI.text }}>
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="mt-1 h-11 w-full rounded-xl border px-3 bg-gray-50/70 outline-none focus:bg-white focus:border-gray-300 transition"
      style={{ borderColor: EKARI.hair }}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="mt-1 w-full rounded-xl border px-3 py-2 bg-gray-50/70 outline-none focus:bg-white focus:border-gray-300 transition"
      style={{ borderColor: EKARI.hair, minHeight: 144 }}
    />
  );
}

export default function SupportPage() {
  const auth = getAuth();
  const router = useRouter();
  const user = auth.currentUser || undefined;

  // Prefill profile basics if available
  const [profile, setProfile] = useState<{ name?: string; email?: string } | null>(
    null
  );
  useEffect(() => {
    (async () => {
      if (!user?.uid) {
        setProfile({ name: user?.displayName || "", email: user?.email || "" });
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const d = snap.exists() ? (snap.data() as any) : {};
        setProfile({
          name: d?.firstName
            ? `${d.firstName} ${d.surname || ""}`.trim()
            : user.displayName || "",
          email: d?.email || user.email || "",
        });
      } catch {
        setProfile({ name: user?.displayName || "", email: user?.email || "" });
      }
    })();
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
      const arr: Ticket[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
      setTickets(arr);
    });
    return () => unsub();
  }, [user?.uid]);

  // File pick
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

      // friendly number
      const ticketNo = "EK-" + docRef.id.slice(0, 6).toUpperCase();
      await updateDoc(doc(db, "support_tickets", docRef.id), { ticketNo });

      if (files.length) {
        const uploaded: { name: string; url: string }[] = [];
        for (const f of files) {
          const ref = sRef(
            storage,
            `support_attachments/${user.uid}/${docRef.id}/${Date.now()}-${f.name}`
          );
          await uploadBytes(ref, f);
          const url = await getDownloadURL(ref);
          uploaded.push({ name: f.name, url });
        }
        await updateDoc(doc(db, "support_tickets", docRef.id), {
          attachments: uploaded,
          updatedAt: serverTimestamp(),
        });
      }

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

  const heroBg = useMemo(
    () =>
      `radial-gradient(1200px 400px at 20% -10%, #C7925715, transparent 60%),
       radial-gradient(1200px 400px at 80% -20%, #233F3915, transparent 60%),
       ${EKARI.bg}`,
    []
  );

  return (
    <main className="min-h-screen bg-white scroll-smooth">
      <Topbar />

      {/* Mobile helper header (nice on small screens) */}
      <div className="md:hidden mx-auto max-w-6xl px-5 pt-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm font-semibold"
          style={{ color: EKARI.dim }}
        >
          <IoArrowBack />
          Back
        </button>
      </div>

      {/* Hero */}
      <section className="relative" style={{ background: heroBg }}>
        <div className="mx-auto max-w-6xl px-5 py-6 md:py-12">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold" style={{ color: EKARI.dim }}>
              Support
            </span>
          </div>

          <h1
            className="mt-3 text-3xl md:text-4xl font-black tracking-tight"
            style={{ color: EKARI.text }}
          >
            How can we help?
          </h1>

          <div className="mt-4 flex items-center gap-2 rounded-2xl border h-12 max-w-2xl bg-white/80 backdrop-blur-sm px-3 shadow-sm">
            <IoSearch className="text-slate-500" />
            <input
              placeholder="Search help articles (coming soon)"
              className="flex-1 bg-transparent outline-none"
            />
          </div>

          {/* Quick tiles */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TOPICS.map(({ key, label, icon: Icon, color }) => (
              <Link
                key={key}
                href={`/support/${key}`}
                className="group rounded-2xl border p-4 hover:shadow-md transition bg-white/90 backdrop-blur-sm"
                style={{ borderColor: EKARI.hair }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: color }}
                  >
                    <Icon className="text-slate-700" />
                  </div>
                  <div
                    className="font-extrabold text-[15px]"
                    style={{ color: EKARI.text }}
                  >
                    {label}
                  </div>
                </div>
                <div className="mt-2 text-sm" style={{ color: EKARI.dim }}>
                  Guides & troubleshooting
                </div>
                <div className="mt-2 text-xs inline-flex items-center gap-1 text-slate-400 group-hover:text-slate-600">
                  Browse <IoChevronForward />
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: EKARI.hair }} />
      </section>

      {/* Main content (adapted order for mobile) */}
      <section className="mx-auto max-w-6xl px-5 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-8">
          {/* ✅ MOBILE: show Contact first */}
          <aside className="space-y-6 lg:hidden">
            <Card title="Contact us">
              <div className="space-y-3">
                <a
                  href="mailto:support@ekarihub.com"
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition border"
                  style={{ borderColor: EKARI.hair }}
                >
                  <div className="w-9 h-9 rounded-full bg-[#C79257] text-white grid place-items-center">
                    <IoMailOutline />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold" style={{ color: EKARI.text }}>
                      Email
                    </div>
                    <div className="text-sm" style={{ color: EKARI.dim }}>
                      support@ekarihub.com
                    </div>
                  </div>
                  <IoChevronForward className="text-slate-400" />
                </a>
              </div>
            </Card>

            <Card title="Typical response times">
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-xl border p-3 bg-white/70"
                  style={{ borderColor: EKARI.hair }}
                >
                  <div className="text-xs" style={{ color: EKARI.dim }}>
                    Email
                  </div>
                  <div className="mt-1 text-lg font-black" style={{ color: EKARI.text }}>
                    ~4–8 hrs
                  </div>
                </div>
              </div>
            </Card>
          </aside>

          {/* Left: Ticket form + tickets */}
          <div className="space-y-6">
            <Card
              title={
                <div className="flex items-center justify-between gap-3">
                  <span>Submit a ticket</span>
                  <span
                    className="hidden sm:flex text-xs font-normal items-center gap-2"
                    style={{ color: EKARI.dim }}
                  >
                    <IoDocumentTextOutline /> Include screenshots/logs if possible
                  </span>
                </div>
              }
              footer={
                <div className="mt-1 flex flex-col sm:flex-row sm:justify-end gap-2">
                  <button
                    onClick={submitTicket}
                    disabled={!canSubmit || submitting}
                    className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl font-extrabold text-white disabled:opacity-60"
                    style={{ background: EKARI.gold }}
                  >
                    <IoSend />
                    {submitting ? "Submitting…" : "Submit ticket"}
                  </button>
                </div>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Subject</FieldLabel>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Short summary"
                  />
                </div>

                <div>
                  <FieldLabel>Topic</FieldLabel>
                  <div
                    className="mt-1 h-11 w-full rounded-xl border bg-gray-50/70 px-2 flex items-center focus-within:bg-white transition"
                    style={{ borderColor: EKARI.hair }}
                  >
                    <select
                      value={topic}
                      onChange={(e) => setTopic(e.target.value as any)}
                      className="w-full bg-transparent outline-none px-2"
                    >
                      {TOPICS.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>Priority</FieldLabel>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PRIORITIES.map((p) => {
                      const active = priority === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={`h-9 px-3 rounded-full border text-sm font-bold transition ${active ? "text-white" : "bg-white"
                            }`}
                          style={{
                            borderColor: active ? EKARI.forest : EKARI.hair,
                            background: active ? EKARI.forest : "#fff",
                          }}
                        >
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>Message</FieldLabel>
                  <TextArea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe the issue in detail…"
                  />
                  <div className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                    Tip: What happened, what you expected, steps to reproduce, device/browser,
                    screenshots/logs.
                  </div>
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>Attachments</FieldLabel>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.txt,.log"
                    onChange={onPickFiles}
                    className="mt-1 h-11 w-full rounded-xl border px-3 bg-gray-50/70 outline-none focus:bg-white focus:border-gray-300 transition"
                    style={{ borderColor: EKARI.hair }}
                  />
                  {files.length > 0 && (
                    <div className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                      {files.length} file(s) selected (max 3)
                    </div>
                  )}
                </div>
              </div>

              {!!successMsg && (
                <div className="mt-4 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  {successMsg}
                </div>
              )}
            </Card>

            <Card
              title={
                <div className="flex items-center justify-between">
                  <span>My recent tickets</span>
                  <span
                    className="text-xs font-normal flex items-center gap-1"
                    style={{ color: EKARI.dim }}
                  >
                    <IoCalendarOutline /> last 10
                  </span>
                </div>
              }
            >
              {user?.uid ? (
                tickets.length === 0 ? (
                  <div className="p-4 text-sm" style={{ color: EKARI.dim }}>
                    No tickets yet.
                  </div>
                ) : (
                  <ul className="divide-y" style={{ borderColor: EKARI.hair }}>
                    {tickets.map((t) => (
                      <li key={t.id} className="py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold truncate" style={{ color: EKARI.text }}>
                              {t.subject}
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: EKARI.dim }}>
                              {TOPICS.find((x) => x.key === (t as any).topic)?.label ||
                                "General"}{" "}
                              · {prettyDate(t.createdAt)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <StatusBadge status={t.status || "open"} />
                            {t.ticketNo && (
                              <span className="hidden sm:inline text-xs font-bold" style={{ color: EKARI.dim }}>
                                {t.ticketNo}
                              </span>
                            )}
                          </div>
                        </div>

                        {t.message && (
                          <div className="mt-1 text-sm text-slate-700 line-clamp-2">
                            {t.message}
                          </div>
                        )}

                        {!!t.attachments?.length && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {t.attachments.map((a) => (
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

                        {/* mobile ticket number */}
                        {t.ticketNo && (
                          <div className="sm:hidden mt-2 text-xs font-bold" style={{ color: EKARI.dim }}>
                            {t.ticketNo}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <div className="p-4 text-sm" style={{ color: EKARI.dim }}>
                  Sign in to view your tickets.
                </div>
              )}
            </Card>
          </div>

          {/* ✅ DESKTOP: Contact on the right */}
          <aside className="space-y-6 hidden lg:block">
            <Card title="Contact us">
              <div className="space-y-3">
                <a
                  href="mailto:support@ekarihub.com"
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition border"
                  style={{ borderColor: EKARI.hair }}
                >
                  <div className="w-9 h-9 rounded-full bg-[#C79257] text-white grid place-items-center">
                    <IoMailOutline />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold" style={{ color: EKARI.text }}>
                      Email
                    </div>
                    <div className="text-sm" style={{ color: EKARI.dim }}>
                      support@ekarihub.com
                    </div>
                  </div>
                  <IoChevronForward className="text-slate-400" />
                </a>
              </div>
            </Card>

            <Card title="Typical response times">
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-xl border p-3 bg-white/70"
                  style={{ borderColor: EKARI.hair }}
                >
                  <div className="text-xs" style={{ color: EKARI.dim }}>
                    Email
                  </div>
                  <div className="mt-1 text-lg font-black" style={{ color: EKARI.text }}>
                    ~4–8 hrs
                  </div>
                </div>
              </div>
            </Card>
          </aside>
        </div>
      </section>

      <Footer />
    </main>
  );
}
