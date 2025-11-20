// app/admin/support-tickets/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  serverTimestamp,
  where,
  limit,
  Query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import {
  IoSearch,
  IoFilter,
  IoAlertCircleOutline,
  IoPricetagOutline,
  IoSettingsOutline,
  IoBulbOutline,
  IoChatbubblesOutline,
  IoMailOutline,
  IoTimeOutline,
  IoPersonCircleOutline,
} from "react-icons/io5";

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  hair: "#E5E7EB",
  text: "#0F172A",
  dim: "#6B7280",
  bgSoft: "#F3F4F6",
};

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

  assignedToUid?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
};

type AdminUser = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
};

const TOPICS = [
  { key: "billing", label: "Billing & Payments", icon: IoPricetagOutline },
  { key: "account", label: "Account & Login", icon: IoSettingsOutline },
  { key: "technical", label: "Technical Issue", icon: IoAlertCircleOutline },
  { key: "feature", label: "Feature Request", icon: IoBulbOutline },
] as const;

const STATUSES: Ticket["status"][] = ["open", "in_progress", "resolved", "closed"];
const PRIORITIES: Ticket["priority"][] = ["low", "normal", "high", "urgent"];
type ViewMode = "all" | "open" | "mine";

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
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${map[status]}`}>
      {text[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Ticket["priority"] }) {
  const map: Record<Ticket["priority"], string> = {
    low: "bg-emerald-50 text-emerald-700 border-emerald-200",
    normal: "bg-slate-50 text-slate-700 border-slate-200",
    high: "bg-amber-50 text-amber-700 border-amber-200",
    urgent: "bg-rose-50 text-rose-700 border-rose-200",
  };
  const text: Record<Ticket["priority"], string> = {
    low: "Low",
    normal: "Normal",
    high: "High",
    urgent: "Urgent",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${map[priority]}`}>
      {text[priority]}
    </span>
  );
}

function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white/90 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.04)] ${className}`}
      style={{ borderColor: EKARI.hair }}
    >
      {(title || subtitle) && (
        <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
          {title && (
            <div className="text-[15px] font-black" style={{ color: EKARI.text }}>
              {title}
            </div>
          )}
          {subtitle && (
            <div className="text-xs" style={{ color: EKARI.dim }}>
              {subtitle}
            </div>
          )}
        </div>
      )}
      <div className="px-5 pb-5 pt-1">{children}</div>
    </div>
  );
}

export default function AdminSupportTicketsPage() {
  const { user: authUser } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Ticket["status"]>("all");
  const [topicFilter, setTopicFilter] = useState<"all" | string>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Ticket["priority"]>("all");

  const [viewMode, setViewMode] = useState<ViewMode>("open");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [updatingAssigneeId, setUpdatingAssigneeId] = useState<string | null>(null);

  const [admins, setAdmins] = useState<AdminUser[]>([]);

  // admins
  useEffect(() => {
    const qAdmins = query(collection(db, "users"), where("isAdmin", "==", true));
    const unsub = onSnapshot(qAdmins, (snap) => {
      const arr: AdminUser[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          uid: d.id,
          displayName:
            data?.displayName ||
            (data?.firstName ? `${data.firstName} ${data.surname || ""}`.trim() : undefined),
          email: data?.email,
        };
      });
      setAdmins(arr);
    });
    return () => unsub();
  }, []);

  // tickets by viewMode
  useEffect(() => {
    const base = collection(db, "support_tickets");
    let qy: Query;

    if (viewMode === "all") {
      qy = query(base, orderBy("createdAt", "desc"), limit(200));
    } else if (viewMode === "open") {
      qy = query(
        base,
        where("status", "in", ["open", "in_progress"]),
        orderBy("createdAt", "desc"),
        limit(200)
      );
    } else {
      if (!authUser?.uid) {
        setTickets([]);
        setLoading(false);
        return;
      }
      qy = query(
        base,
        where("assignedToUid", "==", authUser.uid),
        where("status", "in", ["open", "in_progress"]),
        orderBy("createdAt", "desc"),
        limit(200)
      );
    }

    setLoading(true);
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const arr: Ticket[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setTickets(arr);
        setLoading(false);
        if (!selectedTicketId && arr.length > 0) {
          setSelectedTicketId(arr[0].id);
        }
      },
      () => setLoading(false)
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, authUser?.uid]);

  const selectedTicket = useMemo(
    () => tickets.find((t) => t.id === selectedTicketId) || null,
    [tickets, selectedTicketId]
  );

  const filteredTickets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (topicFilter !== "all" && (t as any).topic !== topicFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;

      if (!term) return true;

      const haystack = [
        t.subject,
        t.message,
        t.email,
        t.name,
        t.ticketNo,
        (t as any).topic,
        t.priority,
        t.status,
        t.assignedToName,
        t.assignedToEmail,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [tickets, search, statusFilter, topicFilter, priorityFilter]);

  const stats = useMemo(() => {
    const total = tickets.length;
    const byStatus = STATUSES.reduce(
      (acc, s) => ({
        ...acc,
        [s]: tickets.filter((t) => t.status === s).length,
      }),
      {} as Record<Ticket["status"], number>
    );
    return { total, byStatus };
  }, [tickets]);

  const handleChangeStatus = async (ticket: Ticket, newStatus: Ticket["status"]) => {
    if (ticket.status === newStatus) return;
    try {
      setUpdatingStatusId(ticket.id);
      await updateDoc(doc(db, "support_tickets", ticket.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      alert("Could not update status. Please try again.");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleAssign = async (ticket: Ticket, adminUid: string | "unassigned" | "me") => {
    try {
      setUpdatingAssigneeId(ticket.id);

      let payload: Partial<Ticket> = {
        updatedAt: serverTimestamp(),
      };

      if (adminUid === "unassigned") {
        payload.assignedToUid = null;
        payload.assignedToName = null;
        payload.assignedToEmail = null;
      } else {
        const uidToUse = adminUid === "me" ? authUser?.uid : adminUid;
        if (!uidToUse) {
          setUpdatingAssigneeId(null);
          return;
        }
        const admin =
          adminUid === "me"
            ? admins.find((a) => a.uid === authUser?.uid)
            : admins.find((a) => a.uid === adminUid);

        payload.assignedToUid = uidToUse;
        payload.assignedToName = admin?.displayName || "Admin";
        payload.assignedToEmail = admin?.email || undefined;
      }

      await updateDoc(doc(db, "support_tickets", ticket.id), payload as any);
    } catch (err) {
      console.error(err);
      alert("Could not update assignee. Please try again.");
    } finally {
      setUpdatingAssigneeId(null);
    }
  };

  const currentAdmin = useMemo(
    () => admins.find((a) => a.uid === authUser?.uid),
    [admins, authUser?.uid]
  );

  // ------------------ RENDER (inside AdminLayout container) ------------------

  return (
    <div className="space-y-4">
      {/* small heading inside content (big top title already comes from layout) */}
      <div className="mb-1">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: EKARI.dim }}
        >
          Admin · Support
        </p>
        <h1
          className="mt-1 text-xl md:text-2xl font-black tracking-tight"
          style={{ color: EKARI.text }}
        >
          Support tickets
        </h1>
        <p className="mt-1 text-xs md:text-sm" style={{ color: EKARI.dim }}>
          Route, assign and resolve tickets submitted from the public support page.
        </p>
      </div>

      {/* main white panel */}
      <div
        className="rounded-3xl border bg-white shadow-sm px-4 md:px-6 lg:px-8 py-5 md:py-7 space-y-5"
        style={{ borderColor: EKARI.hair }}
      >
        {/* header controls */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="hidden md:block" />

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
            {/* view mode (server-side filter) */}
            <div
              className="inline-flex rounded-full border bg-[#F9FAFB] p-1 shadow-sm"
              style={{ borderColor: EKARI.hair }}
            >
              {(["all", "open", "mine"] as ViewMode[]).map((mode) => {
                const active = viewMode === mode;
                const label =
                  mode === "all" ? "All" : mode === "open" ? "Open queue" : "My queue";
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`px-3 h-8 rounded-full text-xs font-semibold transition ${active ? "shadow-sm" : ""
                      }`}
                    style={{
                      background: active ? EKARI.forest : "transparent",
                      color: active ? "#FFFFFF" : EKARI.text,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* search */}
            <div
              className="flex items-center gap-2 rounded-2xl border bg-[#F9FAFB] px-3 h-11 shadow-sm w-full sm:w-64"
              style={{ borderColor: EKARI.hair }}
            >
              <IoSearch className="text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search in current view…"
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </div>
          </div>
        </header>

        {/* grey inner body */}
        <div
          className="rounded-2xl px-4 md:px-5 py-4 md:py-5 space-y-5"
          style={{ backgroundColor: EKARI.bgSoft }}
        >
          {/* stats */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div
              className="rounded-2xl border bg-white px-4 py-3 flex flex-col justify-between"
              style={{ borderColor: EKARI.hair }}
            >
              <div className="text-xs font-semibold" style={{ color: EKARI.dim }}>
                Tickets in view
              </div>
              <div className="mt-1 text-2xl font-black" style={{ color: EKARI.text }}>
                {stats.total}
              </div>
            </div>
            <div
              className="rounded-2xl border bg-white px-4 py-3 flex flex-col justify-between"
              style={{ borderColor: EKARI.hair }}
            >
              <div className="text-xs font-semibold" style={{ color: EKARI.dim }}>
                Open
              </div>
              <div className="mt-1 text-lg font-black text-emerald-700">
                {stats.byStatus.open ?? 0}
              </div>
            </div>
            <div
              className="rounded-2xl border bg-white px-4 py-3 flex flex-col justify-between"
              style={{ borderColor: EKARI.hair }}
            >
              <div className="text-xs font-semibold" style={{ color: EKARI.dim }}>
                In progress
              </div>
              <div className="mt-1 text-lg font-black text-amber-700">
                {stats.byStatus.in_progress ?? 0}
              </div>
            </div>
            <div
              className="rounded-2xl border bg-white px-4 py-3 flex flex-col justify-between"
              style={{ borderColor: EKARI.hair }}
            >
              <div className="text-xs font-semibold" style={{ color: EKARI.dim }}>
                Resolved
              </div>
              <div className="mt-1 text-lg font-black text-blue-700">
                {stats.byStatus.resolved ?? 0}
              </div>
            </div>
          </section>

          {/* queue + details */}
          <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-5">
            {/* left: queue */}
            <Card
              title="Ticket queue"
              subtitle={
                <span className="inline-flex items-center gap-1 text-[11px]">
                  <IoFilter />
                  View mode is server-side · filters are local
                </span>
              }
            >
              {/* local filters */}
              <div className="mb-4 flex flex-wrap gap-2 items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="h-9 rounded-full border text-xs px-3 bg-white outline-none"
                    style={{ borderColor: EKARI.hair, color: EKARI.text }}
                  >
                    <option value="all">Status · All</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>

                  <select
                    value={topicFilter}
                    onChange={(e) => setTopicFilter(e.target.value as any)}
                    className="h-9 rounded-full border text-xs px-3 bg-white outline-none"
                    style={{ borderColor: EKARI.hair, color: EKARI.text }}
                  >
                    <option value="all">Topic · All</option>
                    {TOPICS.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value as any)}
                    className="h-9 rounded-full border text-xs px-3 bg-white outline-none"
                    style={{ borderColor: EKARI.hair, color: EKARI.text }}
                  >
                    <option value="all">Priority · All</option>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* table */}
              <div
                className="rounded-2xl border overflow-hidden bg-white/80"
                style={{ borderColor: EKARI.hair }}
              >
                <div
                  className="hidden md:grid grid-cols-[minmax(0,3fr)_minmax(0,2.2fr)_minmax(0,1.9fr)_minmax(0,1.3fr)] gap-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: EKARI.dim }}
                >
                  <div>Ticket</div>
                  <div>Customer</div>
                  <div>Assignment / Priority / Status</div>
                  <div>Created</div>
                </div>

                {loading ? (
                  <div className="py-8 text-center text-sm" style={{ color: EKARI.dim }}>
                    Loading tickets…
                  </div>
                ) : filteredTickets.length === 0 ? (
                  <div className="py-8 text-center text-sm" style={{ color: EKARI.dim }}>
                    No tickets match your filters.
                  </div>
                ) : (
                  <ul className="divide-y" style={{ borderColor: EKARI.hair }}>
                    {filteredTickets.map((t) => {
                      const topicMeta = TOPICS.find((x) => x.key === (t as any).topic);
                      const active = selectedTicketId === t.id;

                      return (
                        <li
                          key={t.id}
                          onClick={() => setSelectedTicketId(t.id)}
                          className={`px-4 py-3 cursor-pointer transition ${active ? "bg-emerald-50/40" : "hover:bg-slate-50/60"
                            }`}
                        >
                          {/* desktop row */}
                          <div className="hidden md:grid grid-cols-[minmax(0,3fr)_minmax(0,2.2fr)_minmax(0,1.9fr)_minmax(0,1.3fr)] gap-3 items-center">
                            <div>
                              <div className="flex items-center gap-2">
                                <div
                                  className="font-semibold text-sm"
                                  style={{ color: EKARI.text }}
                                >
                                  {t.subject || "(no subject)"}
                                </div>
                                {topicMeta && (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full bg-slate-50 border px-2 py-0.5 text-[10px] font-semibold"
                                    style={{
                                      borderColor: EKARI.hair,
                                      color: EKARI.dim,
                                    }}
                                  >
                                    <topicMeta.icon className="text-[11px]" />
                                    {topicMeta.label}
                                  </span>
                                )}
                              </div>
                              {t.ticketNo && (
                                <div
                                  className="mt-0.5 text-[11px]"
                                  style={{ color: EKARI.dim }}
                                >
                                  {t.ticketNo}
                                </div>
                              )}
                            </div>

                            <div className="text-xs">
                              <div
                                className="font-semibold"
                                style={{ color: EKARI.text }}
                              >
                                {t.name || "Unknown user"}
                              </div>
                              <div
                                className="text-[11px]"
                                style={{ color: EKARI.dim }}
                              >
                                {t.email || "No email"}
                              </div>
                            </div>

                            <div className="flex flex-col gap-1 text-xs">
                              <div className="flex items-center gap-2">
                                <IoPersonCircleOutline className="text-base text-slate-400" />
                                <span style={{ color: EKARI.text }}>
                                  {t.assignedToName || "Unassigned"}
                                </span>
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                <PriorityBadge priority={t.priority || "normal"} />
                                <StatusBadge status={t.status || "open"} />
                              </div>
                            </div>

                            <div className="text-xs" style={{ color: EKARI.dim }}>
                              <div>{prettyDate(t.createdAt)}</div>
                              {t.updatedAt && (
                                <div className="flex items-center gap-1 mt-0.5 text-[11px]">
                                  <IoTimeOutline />
                                  <span>Updated {prettyDate(t.updatedAt)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* mobile row */}
                          <div className="md:hidden flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-2">
                              <div
                                className="font-semibold text-sm"
                                style={{ color: EKARI.text }}
                              >
                                {t.subject || "(no subject)"}
                              </div>
                              <PriorityBadge priority={t.priority || "normal"} />
                            </div>
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <div className="truncate" style={{ color: EKARI.dim }}>
                                {t.name || "Unknown"} · {topicMeta?.label ?? "General"}
                              </div>
                              <StatusBadge status={t.status || "open"} />
                            </div>
                            <div
                              className="flex items-center justify-between text-[11px]"
                              style={{ color: EKARI.dim }}
                            >
                              <span>{t.ticketNo || ""}</span>
                              <span>{prettyDate(t.createdAt)}</span>
                            </div>
                            <div
                              className="flex items-center gap-1 text-[11px]"
                              style={{ color: EKARI.dim }}
                            >
                              <IoPersonCircleOutline />
                              <span>{t.assignedToName || "Unassigned"}</span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Card>

            {/* right: details */}
            <Card
              title="Ticket details"
              subtitle={
                selectedTicket ? (
                  <span
                    className="text-[11px] font-mono"
                    style={{ color: EKARI.dim }}
                  >
                    {selectedTicket.ticketNo || selectedTicket.id}
                  </span>
                ) : null
              }
            >
              {!selectedTicket ? (
                <div className="py-6 text-sm" style={{ color: EKARI.dim }}>
                  Select a ticket from the queue to view full details, assign it, and
                  update its status.
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div
                      className="text-xs font-semibold"
                      style={{ color: EKARI.dim }}
                    >
                      Subject
                    </div>
                    <div
                      className="mt-1 text-sm font-bold"
                      style={{ color: EKARI.text }}
                    >
                      {selectedTicket.subject || "(no subject)"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <div
                        className="font-semibold"
                        style={{ color: EKARI.dim }}
                      >
                        Customer
                      </div>
                      <div
                        className="font-semibold"
                        style={{ color: EKARI.text }}
                      >
                        {selectedTicket.name || "Unknown user"}
                      </div>
                      <div style={{ color: EKARI.dim }}>
                        {selectedTicket.email || "No email"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div
                        className="font-semibold"
                        style={{ color: EKARI.dim }}
                      >
                        Meta
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <PriorityBadge
                          priority={selectedTicket.priority || "normal"}
                        />
                        <StatusBadge status={selectedTicket.status || "open"} />
                      </div>
                      <div
                        className="text-[11px]"
                        style={{ color: EKARI.dim }}
                      >
                        Created: {prettyDate(selectedTicket.createdAt)}
                        <br />
                        Updated:{" "}
                        {selectedTicket.updatedAt
                          ? prettyDate(selectedTicket.updatedAt)
                          : "—"}
                      </div>
                    </div>
                  </div>

                  {/* assignment */}
                  <div className="space-y-2 text-xs">
                    <div
                      className="font-semibold"
                      style={{ color: EKARI.dim }}
                    >
                      Assigned to
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <div
                        className="inline-flex items-center gap-2 rounded-full border bg-slate-50/60 px-3 py-1"
                        style={{ borderColor: EKARI.hair }}
                      >
                        <IoPersonCircleOutline className="text-base text-slate-400" />
                        <div className="flex flex-col leading-tight">
                          <span
                            className="font-semibold"
                            style={{ color: EKARI.text }}
                          >
                            {selectedTicket.assignedToName || "Unassigned"}
                          </span>
                          {selectedTicket.assignedToEmail && (
                            <span
                              className="text-[10px]"
                              style={{ color: EKARI.dim }}
                            >
                              {selectedTicket.assignedToEmail}
                            </span>
                          )}
                        </div>
                      </div>

                      <select
                        disabled={updatingAssigneeId === selectedTicket.id}
                        value={
                          selectedTicket.assignedToUid
                            ? selectedTicket.assignedToUid
                            : "unassigned"
                        }
                        onChange={(e) =>
                          handleAssign(selectedTicket, e.target.value as any)
                        }
                        className="h-8 rounded-full border bg-white px-3 text-[11px] outline-none"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                      >
                        <option value="unassigned">Unassigned</option>
                        {currentAdmin && (
                          <option value="me">
                            Assign to me (
                            {currentAdmin.displayName || "Me"})
                          </option>
                        )}
                        {admins.map((a) => (
                          <option key={a.uid} value={a.uid}>
                            {a.displayName || a.email || a.uid}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* status */}
                  <div className="space-y-2">
                    <div
                      className="text-xs font-semibold"
                      style={{ color: EKARI.dim }}
                    >
                      Update status
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {STATUSES.map((s) => {
                        const active = selectedTicket.status === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            disabled={updatingStatusId === selectedTicket.id}
                            onClick={() => handleChangeStatus(selectedTicket, s)}
                            className={`h-8 px-3 rounded-full text-xs font-semibold border transition ${active ? "text-white" : ""
                              }`}
                            style={{
                              borderColor: active ? EKARI.forest : EKARI.hair,
                              background: active ? EKARI.forest : "#FFFFFF",
                              color: active ? "#FFFFFF" : EKARI.text,
                            }}
                          >
                            {s === "open"
                              ? "Open"
                              : s === "in_progress"
                                ? "In progress"
                                : s === "resolved"
                                  ? "Resolved"
                                  : "Closed"}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* message */}
                  <div>
                    <div
                      className="text-xs font-semibold mb-1"
                      style={{ color: EKARI.dim }}
                    >
                      Message
                    </div>
                    <div
                      className="rounded-2xl border bg-white px-3 py-2 text-sm whitespace-pre-wrap"
                      style={{ borderColor: EKARI.hair, color: EKARI.text }}
                    >
                      {selectedTicket.message}
                    </div>
                  </div>

                  {/* attachments */}
                  {!!selectedTicket.attachments?.length && (
                    <div>
                      <div
                        className="text-xs font-semibold mb-1"
                        style={{ color: EKARI.dim }}
                      >
                        Attachments
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedTicket.attachments.map((a) => (
                          <a
                            key={a.url}
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs underline rounded-full px-3 py-1 border bg-white hover:bg-slate-50 transition"
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                          >
                            {a.name}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* reply */}
                  <div className="pt-2 border-t" style={{ borderColor: EKARI.hair }}>
                    <div
                      className="text-xs font-semibold mb-2"
                      style={{ color: EKARI.dim }}
                    >
                      Reply to customer
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {selectedTicket.email && (
                        <a
                          href={`mailto:${selectedTicket.email}?subject=${encodeURIComponent(
                            `[EkariHub Support] ${selectedTicket.subject || selectedTicket.ticketNo || ""
                            }`
                          )}`}
                          className="inline-flex items-center gap-1 rounded-full border px-3 py-1 hover:bg-slate-50 transition"
                          style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        >
                          <IoMailOutline className="text-sm" />
                          Email
                        </a>
                      )}
                      <span
                        className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] bg-slate-50/60"
                        style={{ borderColor: EKARI.hair, color: EKARI.dim }}
                      >
                        <IoChatbubblesOutline className="text-sm" />
                        Reply via in-app chat (future)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
