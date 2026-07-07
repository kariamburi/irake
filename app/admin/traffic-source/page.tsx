"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
  hair: "#E5E7EB",
};

type UserRow = {
  uid: string;
  name?: string | null;
  email?: string | null;
  handle?: string | null;
  trafficSource?: string | null;
  referralSource?: string | null;
  referralSourceLabel?: string | null;
  createdAt?: any;
};

const LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  google: "Google",
  friend: "Friend / Referral",
  field_agent: "Field agent",
  event: "Event / Training",
  other: "Other",
  unknown: "Unknown / Not captured",
};

const CHART_COLORS: Record<string, string> = {
  facebook: "#1877F2",
  instagram: "#E1306C",
  tiktok: "#111827",
  whatsapp: "#25D366",
  google: "#4285F4",
  friend: "#8B5CF6",
  field_agent: "#F59E0B",
  event: "#06B6D4",
  other: "#64748B",
  unknown: "#CBD5E1",
};

export default function TrafficSourcePage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qUsers = query(collection(db, "users"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      qUsers,
      (snap) => {
        const rows: UserRow[] = snap.docs.map((d) => {
          const data = d.data() as any;

          return {
            uid: d.id,
            name:
              data.displayName ||
              `${data.firstName ?? ""} ${data.surname ?? ""}`.trim() ||
              data.name ||
              null,
            email: data.email ?? null,
            handle: data.handle ?? null,
            trafficSource: data.trafficSource ?? null,
            referralSource: data.referralSource ?? null,
            referralSourceLabel: data.referralSourceLabel ?? null,
            createdAt: data.createdAt ?? null,
          };
        });

        setUsers(rows);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load traffic sources", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    const map = new Map<string, number>();

    users.forEach((u) => {
      const key = u.trafficSource || u.referralSource || "unknown";
      map.set(key, (map.get(key) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([key, count]) => ({
        key,
        label: LABELS[key] || key,
        count,
        percent: users.length ? Math.round((count / users.length) * 100) : 0,
        color: CHART_COLORS[key] || EKARI.forest,
      }))
      .sort((a, b) => b.count - a.count);
  }, [users]);

  const capturedCount = users.filter((u) => u.trafficSource || u.referralSource).length;
  const maxCount = Math.max(...stats.map((s) => s.count), 1);

  const donutGradient = stats.length
    ? stats
      .reduce(
        (acc, s) => {
          const start = acc.total;
          const end = start + s.percent;
          acc.parts.push(`${s.color} ${start}% ${end}%`);
          acc.total = end;
          return acc;
        },
        { total: 0, parts: [] as string[] }
      )
      .parts.join(", ")
    : "#E5E7EB 0% 100%";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-extrabold" style={{ color: EKARI.text }}>
          Traffic Source Analytics
        </h1>
        <p className="text-sm" style={{ color: EKARI.dim }}>
          See where users discovered ekarihub during onboarding.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
          <div className="text-xs font-bold uppercase" style={{ color: EKARI.dim }}>
            Total users
          </div>
          <div className="mt-1 text-2xl font-black" style={{ color: EKARI.text }}>
            {loading ? "…" : users.length}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
          <div className="text-xs font-bold uppercase" style={{ color: EKARI.dim }}>
            Captured source
          </div>
          <div className="mt-1 text-2xl font-black" style={{ color: EKARI.text }}>
            {loading ? "…" : capturedCount}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
          <div className="text-xs font-bold uppercase" style={{ color: EKARI.dim }}>
            Top source
          </div>
          <div className="mt-1 text-lg font-black" style={{ color: EKARI.text }}>
            {loading ? "…" : stats[0]?.label || "—"}
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 rounded-2xl border bg-white p-5" style={{ borderColor: EKARI.hair }}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold" style={{ color: EKARI.text }}>
              Source share
            </h2>
            <span className="text-xs font-bold" style={{ color: EKARI.dim }}>
              Donut view
            </span>
          </div>

          <div className="mt-5 flex flex-col items-center">
            <div
              className="relative h-48 w-48 rounded-full"
              style={{
                background: `conic-gradient(${donutGradient})`,
              }}
            >
              <div className="absolute inset-8 rounded-full bg-white flex flex-col items-center justify-center">
                <span className="text-2xl font-black" style={{ color: EKARI.text }}>
                  {users.length}
                </span>
                <span className="text-xs font-bold" style={{ color: EKARI.dim }}>
                  users
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2 w-full">
              {stats.slice(0, 6).map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="font-bold truncate" style={{ color: EKARI.text }}>
                      {s.label}
                    </span>
                  </div>
                  <span className="font-bold" style={{ color: EKARI.dim }}>
                    {s.percent}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 rounded-2xl border bg-white overflow-hidden" style={{ borderColor: EKARI.hair }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: EKARI.hair }}>
            <h2 className="text-sm font-extrabold" style={{ color: EKARI.text }}>
              Source comparison
            </h2>
          </div>

          {loading ? (
            <div className="p-6 text-sm" style={{ color: EKARI.dim }}>
              Loading traffic sources…
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {stats.map((s) => (
                <div key={s.key}>
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <div className="font-bold text-sm" style={{ color: EKARI.text }}>
                      {s.label}
                    </div>
                    <div className="text-xs font-bold" style={{ color: EKARI.dim }}>
                      {s.count} users • {s.percent}%
                    </div>
                  </div>

                  <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(4, (s.count / maxCount) * 100)}%`,
                        backgroundColor: s.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-white overflow-hidden" style={{ borderColor: EKARI.hair }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: EKARI.hair }}>
          <h2 className="text-sm font-extrabold" style={{ color: EKARI.text }}>
            Recent joined users
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b" style={{ borderColor: EKARI.hair, color: EKARI.dim }}>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2">Joined</th>
              </tr>
            </thead>

            <tbody>
              {users.slice(0, 100).map((u) => {
                const key = u.trafficSource || u.referralSource || "unknown";
                const joined = u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : "—";

                return (
                  <tr key={u.uid} className="border-b" style={{ borderColor: EKARI.hair }}>
                    <td className="px-4 py-2 font-semibold" style={{ color: EKARI.text }}>
                      {u.name || u.handle || "Unknown user"}
                    </td>
                    <td className="px-4 py-2" style={{ color: EKARI.dim }}>
                      {u.email || "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className="rounded-full px-2 py-1 text-xs font-bold"
                        style={{
                          backgroundColor: `${CHART_COLORS[key] || EKARI.forest}18`,
                          color: CHART_COLORS[key] || EKARI.forest,
                        }}
                      >
                        {u.referralSourceLabel || LABELS[key] || key}
                      </span>
                    </td>
                    <td className="px-4 py-2" style={{ color: EKARI.dim }}>
                      {joined}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}