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
  createdBy: string;
  email?: string;
  name?: string;
  attachments?: { name: string; url: string }[];
  ticketNo?: string;
};

const EKARI = {
  forest: "#173C2E",
  leaf: "#214C3A",
  gold: "#F39A22",
  page: "#F8F7F2",
  surface: "#FBFAF6",
  hair: "#DDD8CC",
  text: "#0F172A",
  dim: "#64748B",
  bg: "#F8F7F2",
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

  const textMap: Record<Ticket["status"], string> = {
    open: "Open",
    in_progress: "In progress",
    resolved: "Resolved",
    closed: "Closed",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-1 text-[8px] font-black ${map[status]}`}
    >
      {textMap[status]}
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[9px] font-black text-slate-700">
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="mt-1.5 h-11 w-full rounded-[13px] border border-[#DDD8CC] bg-white px-3 text-[10px] font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#173C2E]/45 focus:ring-4 focus:ring-[#173C2E]/5"
    />
  );
}

function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      {...props}
      className="mt-1.5 min-h-[144px] w-full resize-y rounded-[13px] border border-[#DDD8CC] bg-white px-3 py-2.5 text-[10px] font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#173C2E]/45 focus:ring-4 focus:ring-[#173C2E]/5"
    />
  );
}

function ContactCard() {
  return (
    <div className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4">
      <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
        Contact us
      </div>

      <a
        href="mailto:support@ekarihub.com"
        className="mt-3 flex items-center gap-3 rounded-[13px] border border-[#E5E0D6] bg-white p-3 transition hover:bg-[#F3F1EB]"
      >
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#E8ECE8] text-[#173C2E]">
          <IoMailOutline size={15} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-black text-slate-700">
            Email support
          </div>

          <div className="mt-0.5 truncate text-[8px] font-semibold text-slate-400">
            support@ekarihub.com
          </div>
        </div>

        <IoChevronForward className="text-slate-300" size={13} />
      </a>

      <div className="mt-4 text-[9px] font-black text-slate-700">
        We help with
      </div>

      <ul className="mt-2 space-y-1.5 text-[8px] font-medium leading-4 text-slate-400">
        <li>• Account issues and login</li>
        <li>• Account deletion</li>
        <li>• Reporting objectionable content</li>
        <li>• Blocking abusive users</li>
        <li>• Payments and billing</li>
        <li>• Technical support</li>
      </ul>
    </div>
  );
}

function ResponseTimeCard() {
  return (
    <div className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4">
      <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
        Response time
      </div>

      <div className="mt-3 rounded-[13px] border border-[#E5E0D6] bg-white p-3">
        <div className="text-[8px] font-medium text-slate-400">
          Email and support tickets
        </div>

        <div className="mt-1 text-[14px] font-black tracking-[-0.02em] text-slate-800">
          Within 24 hours
        </div>
      </div>
    </div>
  );
}

export default function SupportPage() {
  const auth = getAuth();
  const router = useRouter();
  const user = auth.currentUser || undefined;

  const [profile, setProfile] = useState<{ name?: string; email?: string } | null>(
    null
  );

  useEffect(() => {
    (async () => {
      if (!user?.uid) {
        setProfile({
          name: user?.displayName || "",
          email: user?.email || "",
        });
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
        setProfile({
          name: user?.displayName || "",
          email: user?.email || "",
        });
      }
    })();
  }, [user?.uid]);

  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState<(typeof TOPICS)[number]["key"]>("technical");
  const [priority, setPriority] = useState<Ticket["priority"]>("normal");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string>("");

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

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    setFiles(list.slice(0, 3));
  };

  const canSubmit = subject.trim().length >= 4 && message.trim().length >= 10;

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

      const ticketNo = "EK-" + docRef.id.slice(0, 6).toUpperCase();

      await updateDoc(doc(db, "support_tickets", docRef.id), {
        ticketNo,
      });

      if (files.length) {
        const uploaded: { name: string; url: string }[] = [];

        for (const f of files) {
          const fileRef = sRef(
            storage,
            `support_attachments/${user.uid}/${docRef.id}/${Date.now()}-${f.name}`
          );

          await uploadBytes(fileRef, f);

          const url = await getDownloadURL(fileRef);

          uploaded.push({
            name: f.name,
            url,
          });
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
      setSuccessMsg(
        err?.message || "Could not submit your ticket. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      className="min-h-[100svh] w-full max-w-full overflow-x-clip bg-[#F8F7F2] touch-pan-y"
      style={{
        WebkitOverflowScrolling: "touch",
        touchAction: "pan-y",
      }}
    >
      <Topbar />

      {/* =========================================================
          FULL-WIDTH SUPPORT HERO
      ========================================================= */}
      <section className="relative overflow-hidden border-b border-[#DDD8CC] bg-[#173C2E] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.75) 18px 19px)",
          }}
        />

        <div className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full bg-white/[0.035]" />
        <div className="pointer-events-none absolute -bottom-24 left-[32%] h-64 w-64 rounded-full bg-[#F39A22]/[0.08]" />

        <div className="relative mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-7 md:py-14 lg:px-8">
          <div className="max-w-[820px]">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/70">
                <IoMailOutline size={12} className="text-[#F39A22]" />
                Support
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/70">
                <IoDocumentTextOutline size={12} className="text-[#F39A22]" />
                Help center
              </span>
            </div>

            <div className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-[#F39A22]">
              We&apos;re here to help
            </div>

            <h1 className="mt-1 max-w-4xl text-[32px] font-black leading-[1.04] tracking-[-0.045em] sm:text-[40px] lg:text-[50px]">
              How can we help?
            </h1>

            <p className="mt-4 max-w-3xl text-[11px] font-medium leading-5 text-white/60 sm:text-[12px] md:leading-6">
              Get help with your ekarihub account, payments, content reports,
              blocking users, account deletion and technical issues.
            </p>

            <div className="mt-6 max-w-[640px]">
              <div className="flex h-12 items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.08] px-3 backdrop-blur-sm">
                <IoSearch className="shrink-0 text-white/55" size={16} />

                <input
                  placeholder="Search help articles (coming soon)"
                  className="min-w-0 flex-1 bg-transparent text-[10px] font-semibold text-white outline-none placeholder:text-white/35"
                />
              </div>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {TOPICS.map(({ key, label, icon: Icon }) => (
                <Link
                  key={key}
                  href={`/support/${key}`}
                  className="group flex items-center gap-3 rounded-[14px] border border-white/10 bg-white/[0.06] p-3 transition hover:bg-white/[0.11]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-white/10 text-[#F39A22]">
                    <Icon size={15} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-[9px] font-black text-white">
                      {label}
                    </span>

                    <span className="mt-0.5 block text-[7px] font-medium text-white/40">
                      Guides & troubleshooting
                    </span>
                  </span>

                  <IoChevronForward
                    size={12}
                    className="shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          SUPPORT WORKSPACE
      ========================================================= */}
      <section className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 md:py-8 lg:px-8">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:gap-8">
          {/* MAIN COLUMN */}
          <div className="min-w-0 space-y-5">
            {/* SUBMIT TICKET */}
            <section className="rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-5 shadow-[0_8px_24px_rgba(15,23,42,0.035)] sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
                    Support request
                  </div>

                  <h2 className="mt-1 text-[18px] font-black tracking-[-0.03em] text-slate-900">
                    Submit a ticket
                  </h2>

                  <p className="mt-1 text-[9px] font-medium leading-4 text-slate-400">
                    Give us enough detail to reproduce or understand the issue.
                  </p>
                </div>

                <div className="inline-flex w-fit items-center gap-1.5 rounded-[11px] bg-[#E8ECE8] px-3 py-2 text-[8px] font-black text-[#173C2E]">
                  <IoDocumentTextOutline size={12} />
                  Screenshots/logs help
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
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

                  <div className="mt-1.5 flex h-11 items-center rounded-[13px] border border-[#DDD8CC] bg-white px-2">
                    <select
                      value={topic}
                      onChange={(e) => setTopic(e.target.value as any)}
                      className="w-full bg-transparent px-2 text-[10px] font-semibold text-slate-700 outline-none"
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
                          className={[
                            "h-9 rounded-[11px] border px-3 text-[8px] font-black transition",
                            active
                              ? "border-[#173C2E] bg-[#173C2E] text-white"
                              : "border-[#DDD8CC] bg-white text-slate-500 hover:bg-[#F3F1EB]",
                          ].join(" ")}
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

                  <div className="mt-1.5 text-[8px] font-medium leading-4 text-slate-400">
                    Tip: include what happened, what you expected, steps to
                    reproduce, device/browser and any screenshots or logs.
                  </div>
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>Attachments</FieldLabel>

                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.txt,.log"
                    onChange={onPickFiles}
                    className="mt-1.5 h-11 w-full rounded-[13px] border border-[#DDD8CC] bg-white px-3 text-[9px] font-semibold text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-[#E8ECE8] file:px-3 file:py-1.5 file:text-[8px] file:font-black file:text-[#173C2E]"
                  />

                  {files.length > 0 ? (
                    <div className="mt-1.5 text-[8px] font-semibold text-slate-400">
                      {files.length} file(s) selected (max 3)
                    </div>
                  ) : null}
                </div>
              </div>

              {!!successMsg ? (
                <div className="mt-4 rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[9px] font-black text-emerald-700">
                  {successMsg}
                </div>
              ) : null}

              <div className="mt-5 flex flex-col gap-3 border-t border-[#E8E3D8] pt-4 sm:flex-row sm:items-center">
                {!user?.uid ? (
                  <div className="text-[8px] font-semibold text-slate-400 sm:mr-auto">
                    You must be logged in to submit a ticket.
                  </div>
                ) : (
                  <div className="sm:mr-auto" />
                )}

                <button
                  onClick={submitTicket}
                  disabled={submitting || (!!user?.uid && !canSubmit)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] bg-[#173C2E] px-5 text-[9px] font-black text-white transition hover:bg-[#214C3A] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <IoSend size={13} />

                  {submitting
                    ? "Submitting…"
                    : user?.uid
                      ? "Submit ticket"
                      : "Login to submit ticket"}
                </button>
              </div>
            </section>

            {/* RECENT TICKETS */}
            <section className="overflow-hidden rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
              <div className="flex items-center justify-between gap-3 border-b border-[#E8E3D8] px-5 py-4 sm:px-6">
                <div>
                  <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
                    Support history
                  </div>

                  <h2 className="mt-1 text-[15px] font-black text-slate-900">
                    My recent tickets
                  </h2>
                </div>

                <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#F3F1EB] px-2.5 py-1.5 text-[8px] font-black text-slate-400">
                  <IoCalendarOutline size={11} />
                  Last 10
                </span>
              </div>

              {user?.uid ? (
                tickets.length === 0 ? (
                  <div className="px-5 py-8 text-center text-[9px] font-semibold text-slate-400">
                    No tickets yet.
                  </div>
                ) : (
                  <ul>
                    {tickets.map((t) => (
                      <li
                        key={t.id}
                        className="border-b border-[#E8E3D8] px-5 py-4 last:border-b-0 sm:px-6"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[10px] font-black text-slate-800">
                              {t.subject}
                            </div>

                            <div className="mt-1 text-[8px] font-medium text-slate-400">
                              {TOPICS.find((x) => x.key === (t as any).topic)
                                ?.label || "General"}{" "}
                              · {prettyDate(t.createdAt)}
                            </div>

                            {t.message ? (
                              <div className="mt-2 line-clamp-2 text-[9px] font-medium leading-4 text-slate-500">
                                {t.message}
                              </div>
                            ) : null}

                            {!!t.attachments?.length ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {t.attachments.map((a) => (
                                  <a
                                    key={a.url}
                                    href={a.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[8px] font-black text-[#173C2E] underline underline-offset-2"
                                  >
                                    {a.name}
                                  </a>
                                ))}
                              </div>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <StatusBadge status={t.status || "open"} />

                            {t.ticketNo ? (
                              <span className="text-[8px] font-black text-slate-400">
                                {t.ticketNo}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <div className="px-5 py-8 text-center text-[9px] font-semibold text-slate-400">
                  Sign in to view and submit your support tickets.
                </div>
              )}
            </section>
          </div>

          {/* RIGHT RAIL */}
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-5 lg:self-start">
            <ContactCard />
            <ResponseTimeCard />

            <div className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4">
              <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
                Quick links
              </div>

              <div className="mt-3 space-y-1.5">
                <Link
                  href="/delete-account"
                  className="flex items-center gap-3 rounded-[12px] px-2.5 py-2.5 transition hover:bg-[#F3F1EB]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#E8ECE8] text-[#173C2E]">
                    <IoSettingsOutline size={14} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-[8px] font-black text-slate-700">
                      Delete account
                    </span>
                    <span className="mt-0.5 block text-[7px] font-medium text-slate-400">
                      Account removal information
                    </span>
                  </span>

                  <IoChevronForward size={12} className="text-slate-300" />
                </Link>

                <Link
                  href="/privacy"
                  className="flex items-center gap-3 rounded-[12px] px-2.5 py-2.5 transition hover:bg-[#F3F1EB]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#E8ECE8] text-[#173C2E]">
                    <IoDocumentTextOutline size={14} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-[8px] font-black text-slate-700">
                      Privacy policy
                    </span>
                    <span className="mt-0.5 block text-[7px] font-medium text-slate-400">
                      Learn how data is handled
                    </span>
                  </span>

                  <IoChevronForward size={12} className="text-slate-300" />
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <Footer />
    </main>
  );
}