import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Download, HandCoins, HeartHandshake, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Shell } from "@/components/Shell";
import { LivePulse } from "@/components/LiveBadge";
import { timeAgo, useTick } from "@/lib/live-time";
import { Field, Plate, RoseButton, areaClass, inputClass } from "@/components/EmpireUI";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { downloadCsv } from "@/lib/csv";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/donors")({
  head: () => ({
    meta: [
      { title: "Donors Dashboard — Fund WRCAN Training in South Africa" },
      {
        name: "description",
        content:
          "Live WRCAN donors dashboard: track campaign goals, real-time donations, top donors, donor-type breakdown and pledge to fund accredited training for South African youth.",
      },
      { property: "og:title", content: "WRCAN Donors Dashboard — Live Impact" },
      {
        property: "og:description",
        content:
          "Real-time view of every campaign, donation and donor funding accredited training and job placement across South Africa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DonorsPage,
});

type Campaign = Tables<"donation_campaigns">;
type Donation = Tables<"donations">;

const DONOR_TYPES = ["individual", "company", "foundation", "government", "ngo"] as const;
const METHODS = ["EFT", "Card", "SnapScan", "Payroll giving", "In-kind"] as const;

const pledgeSchema = z.object({
  donor_name: z.string().trim().min(2, "Name is required").max(120),
  amount: z.number().positive("Amount must be greater than zero").max(100_000_000),
  contact_email: z.string().trim().email("Valid email required").max(160),
  contact_phone: z.string().trim().max(40).optional(),
  message: z.string().trim().max(400).optional(),
});

const rand = (n: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(n);

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Plate className="flex items-center gap-3">
      <span className="rose-metal flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
        <Icon className="h-5 w-5 text-primary-foreground" strokeWidth={1.7} />
      </span>
      <div className="min-w-0">
        <p className="text-[0.6rem] tracking-widest text-muted-foreground uppercase">{label}</p>
        <p className="font-display truncate text-lg font-semibold">{value}</p>
        {hint ? <p className="text-[0.6rem] text-muted-foreground">{hint}</p> : null}
      </div>
    </Plate>
  );
}

function DonorsPage() {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  useTick();

  const { data: campaigns = [] } = useQuery({
    queryKey: ["donation_campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("donation_campaigns")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
  });

  const { data: donations = [] } = useQuery({
    queryKey: ["donations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("donations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Donation[];
    },
  });

  // Realtime feed: every pledge lands here the moment it is recorded — no polling.
  useEffect(() => {
    const channel = supabase
      .channel("donations-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "donations" }, (payload) => {
        void qc.invalidateQueries({ queryKey: ["donations"] });
        const row = payload.new as Donation | undefined;
        if (payload.eventType === "INSERT" && row && row.donor_user_id !== user?.id) {
          toast.success(
            `New pledge: ${row.is_anonymous ? "Anonymous" : row.donor_name} · ${rand(Number(row.amount))}`,
          );
        }
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "donation_campaigns" },
        () => void qc.invalidateQueries({ queryKey: ["donation_campaigns"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc, user?.id]);

  const stats = useMemo(() => {
    const completed = donations.filter((d) => d.status === "completed");
    const raised = completed.reduce((s, d) => s + Number(d.amount), 0);
    const pledged = donations
      .filter((d) => d.status === "pending")
      .reduce((s, d) => s + Number(d.amount), 0);
    const goal = campaigns.reduce((s, c) => s + Number(c.goal_amount), 0);
    const beneficiaries = campaigns.reduce((s, c) => s + c.beneficiaries, 0);
    const donors = new Set(completed.map((d) => d.donor_name.toLowerCase())).size;
    const recurring = completed.filter((d) => d.is_recurring).length;
    const average = completed.length ? raised / completed.length : 0;

    const byType = DONOR_TYPES.map((t) => ({
      type: t,
      total: completed.filter((d) => d.donor_type === t).reduce((s, d) => s + Number(d.amount), 0),
    }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);

    const leaderboard = Object.values(
      completed.reduce<Record<string, { name: string; total: number; count: number }>>((acc, d) => {
        const name = d.is_anonymous ? "Anonymous donor" : d.donor_name;
        const key = name.toLowerCase();
        acc[key] = acc[key] ?? { name, total: 0, count: 0 };
        acc[key].total += Number(d.amount);
        acc[key].count += 1;
        return acc;
      }, {}),
    )
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const months: { label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date();
      d.setMonth(d.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const total = completed
        .filter((x) => {
          const c = new Date(x.created_at);
          return `${c.getFullYear()}-${c.getMonth()}` === key;
        })
        .reduce((s, x) => s + Number(x.amount), 0);
      months.push({ label: d.toLocaleString("en-ZA", { month: "short" }), total });
    }

    const perCampaign = campaigns.map((c) => ({
      campaign: c,
      raised: completed
        .filter((d) => d.campaign_id === c.id)
        .reduce((s, d) => s + Number(d.amount), 0),
    }));

    return {
      raised,
      pledged,
      goal,
      beneficiaries,
      donors,
      recurring,
      average,
      byType,
      leaderboard,
      months,
      perCampaign,
      maxType: Math.max(1, ...byType.map((b) => b.total)),
      maxMonth: Math.max(1, ...months.map((m) => m.total)),
    };
  }, [donations, campaigns]);

  // Pledge form
  const [form, setForm] = useState({
    donor_name: "",
    donor_type: "individual" as (typeof DONOR_TYPES)[number],
    amount: "",
    method: "EFT" as string,
    campaign_id: "",
    message: "",
    contact_email: "",
    contact_phone: "",
    company_registration: "",
    is_anonymous: false,
    is_recurring: false,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile && !form.donor_name) {
      setForm((f) => ({
        ...f,
        donor_name: profile.company_name || profile.full_name || "",
        contact_email: profile.email ?? "",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const submit = async () => {
    const parsed = pledgeSchema.safeParse({
      donor_name: form.donor_name,
      amount: Number(form.amount),
      contact_email: form.contact_email,
      contact_phone: form.contact_phone || undefined,
      message: form.message || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }

    setBusy(true);
    const { data, error } = await supabase
      .from("donations")
      .insert({
        campaign_id: form.campaign_id || null,
        donor_user_id: user?.id ?? null,
        donor_name: form.donor_name.trim(),
        donor_type: form.donor_type,
        amount: Number(form.amount),
        method: form.method,
        message: form.message.trim() || null,
        is_anonymous: form.is_anonymous,
        is_recurring: form.is_recurring,
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !data) {
      setBusy(false);
      toast.error(error?.message ?? "Could not record the pledge");
      return;
    }

    await supabase.from("donor_contacts").insert({
      donation_id: data.id,
      contact_name: form.donor_name.trim(),
      email: form.contact_email.trim(),
      phone: form.contact_phone.trim() || null,
      company_registration: form.company_registration.trim() || null,
    });

    setBusy(false);
    setForm((f) => ({ ...f, amount: "", message: "" }));
    void qc.invalidateQueries({ queryKey: ["donations"] });
    toast.success("Thank you — your pledge is recorded and our team will confirm it.");
  };

  const exportLog = () => {
    if (!donations.length) {
      toast.error("Nothing to export yet");
      return;
    }
    downloadCsv(
      `wrcan-donor-log-${new Date().toISOString().slice(0, 10)}.csv`,
      donations.map((d) => ({
        date: new Date(d.created_at).toISOString(),
        donor: d.is_anonymous ? "Anonymous" : d.donor_name,
        donor_type: d.donor_type,
        amount: d.amount,
        currency: d.currency,
        method: d.method,
        status: d.status,
        recurring: d.is_recurring,
        campaign: campaigns.find((c) => c.id === d.campaign_id)?.title ?? "General fund",
        message: d.message ?? "",
      })),
    );
  };

  const progress = stats.goal ? Math.min(100, Math.round((stats.raised / stats.goal) * 100)) : 0;

  return (
    <Shell title="Donors" subtitle="Live impact vault">
      <div className="space-y-4 pb-6">
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={HandCoins} label="Raised" value={rand(stats.raised)} hint={`${progress}% of goal`} />
          <StatCard icon={TrendingUp} label="Pledged" value={rand(stats.pledged)} hint="Awaiting confirmation" />
          <StatCard icon={Users} label="Donors" value={String(stats.donors)} hint={`${stats.recurring} recurring`} />
          <StatCard
            icon={HeartHandshake}
            label="Beneficiaries"
            value={String(stats.beneficiaries)}
            hint={`Avg gift ${rand(Math.round(stats.average))}`}
          />
        </div>

        <Plate className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Campaign progress</h2>
          {stats.perCampaign.map(({ campaign, raised }) => {
            const pct = Math.min(100, Math.round((raised / Number(campaign.goal_amount)) * 100));
            return (
              <div key={campaign.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium">{campaign.title}</p>
                  <span className="text-[0.6rem] tracking-widest text-primary uppercase">{pct}%</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="rose-metal h-full" style={{ width: `${pct}%` }} aria-hidden />
                </div>
                <p className="mt-1 text-[0.6rem] tracking-widest text-muted-foreground uppercase">
                  {rand(raised)} of {rand(Number(campaign.goal_amount))} · {campaign.category} ·{" "}
                  {campaign.beneficiaries} beneficiaries
                </p>
              </div>
            );
          })}
          {!stats.perCampaign.length ? (
            <p className="text-sm text-muted-foreground">No active campaigns yet.</p>
          ) : null}
        </Plate>

        <Plate className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Six-month trend</h2>
          <div className="flex h-32 items-end gap-2">
            {stats.months.map((m) => (
              <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="rose-metal w-full rounded-t-md"
                  style={{ height: `${Math.max(4, (m.total / stats.maxMonth) * 100)}%` }}
                  aria-hidden
                />
                <span className="text-[0.55rem] tracking-widest text-muted-foreground uppercase">
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        </Plate>

        <Plate className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Donor mix</h2>
          {stats.byType.map((b) => (
            <div key={b.type}>
              <div className="flex justify-between text-xs">
                <span className="tracking-widest text-muted-foreground uppercase">{b.type}</span>
                <span className="text-primary">{rand(b.total)}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="rose-metal h-full"
                  style={{ width: `${(b.total / stats.maxType) * 100}%` }}
                  aria-hidden
                />
              </div>
            </div>
          ))}
          {!stats.byType.length ? (
            <p className="text-sm text-muted-foreground">No confirmed donations yet.</p>
          ) : null}
        </Plate>

        <Plate className="space-y-2">
          <h2 className="font-display text-lg font-semibold">Top donors</h2>
          {stats.leaderboard.map((d, i) => (
            <div key={d.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">
                <span className="mr-2 text-primary">{i + 1}.</span>
                {d.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {rand(d.total)} · {d.count}×
              </span>
            </div>
          ))}
          {!stats.leaderboard.length ? (
            <p className="text-sm text-muted-foreground">Be the first name on this board.</p>
          ) : null}
        </Plate>

        <Plate className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Live donation feed</h2>
            <RoseButton variant="outline" className="px-4 py-2" onClick={exportLog}>
              <Download className="h-3.5 w-3.5" /> CSV
            </RoseButton>
          </div>
          <LivePulse>Live · last pledge {timeAgo(donations[0]?.created_at)}</LivePulse>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {donations.slice(0, 50).map((d) => (
              <div key={d.id} className="flex items-start justify-between gap-3 border-b border-border/60 pb-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {d.is_anonymous ? "Anonymous donor" : d.donor_name}
                  </p>
                  <p className="text-[0.6rem] tracking-widest text-muted-foreground uppercase">
                    {d.donor_type} · {d.method} · {new Date(d.created_at).toLocaleString("en-ZA")}
                  </p>
                  {d.message ? <p className="mt-1 text-xs text-muted-foreground">“{d.message}”</p> : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-primary">{rand(Number(d.amount))}</p>
                  <p className="text-[0.55rem] tracking-widest text-muted-foreground uppercase">
                    {d.status}
                    {d.is_recurring ? " · monthly" : ""}
                  </p>
                </div>
              </div>
            ))}
            {!donations.length ? (
              <p className="text-sm text-muted-foreground">No donations recorded yet.</p>
            ) : null}
          </div>
        </Plate>

        <Plate className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Donate or pledge</h2>

          <Field label="Donor / company name">
            <input
              className={inputClass}
              value={form.donor_name}
              maxLength={120}
              onChange={(e) => setForm({ ...form, donor_name: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Donor type">
              <select
                className={inputClass}
                value={form.donor_type}
                onChange={(e) =>
                  setForm({ ...form, donor_type: e.target.value as (typeof DONOR_TYPES)[number] })
                }
              >
                {DONOR_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount (ZAR)">
              <input
                className={inputClass}
                type="number"
                min={1}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Method">
              <select
                className={inputClass}
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Campaign">
              <select
                className={inputClass}
                value={form.campaign_id}
                onChange={(e) => setForm({ ...form, campaign_id: e.target.value })}
              >
                <option value="">General fund</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact email">
              <input
                className={inputClass}
                type="email"
                value={form.contact_email}
                maxLength={160}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              />
            </Field>
            <Field label="Contact phone">
              <input
                className={inputClass}
                value={form.contact_phone}
                maxLength={40}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
              />
            </Field>
          </div>

          {form.donor_type !== "individual" ? (
            <Field label="Company / NPO registration number">
              <input
                className={inputClass}
                value={form.company_registration}
                maxLength={60}
                onChange={(e) => setForm({ ...form, company_registration: e.target.value })}
              />
            </Field>
          ) : null}

          <Field label="Message (optional)">
            <textarea
              className={areaClass}
              rows={3}
              maxLength={400}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </Field>

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_anonymous}
                onChange={(e) => setForm({ ...form, is_anonymous: e.target.checked })}
              />
              Give anonymously
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_recurring}
                onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })}
              />
              Repeat monthly
            </label>
          </div>

          <RoseButton className="w-full" disabled={busy} onClick={submit}>
            {busy ? "Recording…" : "Confirm pledge"}
          </RoseButton>
          <p className="text-[0.6rem] tracking-widest text-muted-foreground uppercase">
            Contact details stay private and are visible to WRCAN administrators only.
          </p>
        </Plate>
      </div>
    </Shell>
  );
}
