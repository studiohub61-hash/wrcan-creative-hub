import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { Shell } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { findEcdFeature } from "@/lib/ecd";
import { downloadCsv } from "@/lib/csv";
import { InfrastructureAudit } from "@/components/InfrastructureAudit";

export const Route = createFileRoute("/_authenticated/ecd/$feature")({
  head: ({ params }) => ({ meta: [
    { title: params.feature === "infrastructure" ? "WR Care Infrastructure Audit — SmartStart" : "ECD Compliance Record — SmartStart" },
    { name: "description", content: "Capture and track ECD compliance records for SmartStart centres." },
    { property: "og:title", content: "ECD Compliance Record — SmartStart" },
    { property: "og:description", content: "DBE & SmartStart ECD compliance records." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: FeaturePage,
});

type Row = { id: string; centre: string; subject: string; details: string; status: string; created_at: string };
const STATUSES = ["open", "in_progress", "done", "flagged"] as const;

function FeaturePage() {
  const { feature } = Route.useParams();
  if (feature === "infrastructure") return <Shell title="WR Care Infrastructure Audit" subtitle="DBE · Bana Pele / Registration"><Link to="/smartstart" className="mb-4 inline-flex items-center gap-1 text-xs text-primary"><ArrowLeft className="size-3" /> SmartStart</Link><InfrastructureAudit /></Shell>;
  return <RecordPage feature={feature} />;
}

function RecordPage({ feature }: { feature: string }) {
  const f = findEcdFeature(feature);
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({ centre: "", subject: "", details: "", status: "open" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    const { data, error } = await supabase.from("ecd_records").select("id,centre,subject,details,status,created_at").eq("feature", feature).order("created_at", { ascending: false });
    if (error) setErr(error.message); else setRows(data ?? []);
  };
  useEffect(() => { void load(); }, [feature]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!f) return <Shell title="Not found"><Link to="/smartstart" className="text-primary">Back to SmartStart</Link></Shell>;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim()) return;
    setBusy(true); setErr("");
    const { error } = await supabase.from("ecd_records").insert({ feature, ...form });
    setBusy(false);
    if (error) return setErr(error.message);
    setForm({ ...form, subject: "", details: "" });
    void load();
  };
  const setStatus = async (id: string, status: string) => { await supabase.from("ecd_records").update({ status }).eq("id", id); void load(); };
  const remove = async (id: string) => { await supabase.from("ecd_records").delete().eq("id", id); void load(); };

  const input = "w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm";
  return (
    <Shell title={f.title} subtitle={f.section}>
      <Link to="/smartstart" className="mb-4 inline-flex items-center gap-1 text-xs text-primary"><ArrowLeft className="size-3" /> SmartStart</Link>
      <form onSubmit={save} className="space-y-2 rounded-xl border border-border p-4">
        <p className="text-xs text-muted-foreground">{f.hint}</p>
        <input className={input} placeholder="ECD centre" value={form.centre} onChange={(e) => setForm({ ...form, centre: e.target.value })} />
        <input className={input} placeholder="Child, staff member or item *" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        <textarea className={input} rows={3} placeholder="Details" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
        <select className={input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        {err ? <p className="text-xs text-destructive">{err}</p> : null}
        <button disabled={busy} className="w-full rounded-full bg-primary py-2 text-sm text-primary-foreground disabled:opacity-50">{busy ? "Saving…" : "Save record"}</button>
      </form>
      <div className="mt-6 mb-2 flex items-center justify-between">
        <h3 className="font-display text-lg">Records ({rows.length})</h3>
        {rows.length ? <button onClick={() => downloadCsv(`${feature}-records.csv`, rows)} className="inline-flex items-center gap-1 text-xs text-primary"><Download className="size-3" /> Export</button> : null}
      </div>
      <ul className="divide-y divide-border pb-8">
        {rows.map((r) => (
          <li key={r.id} className="py-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.subject}</p>
                <p className="text-xs text-muted-foreground">{r.centre ? `${r.centre} · ` : ""}{new Date(r.created_at).toLocaleDateString()}</p>
                {r.details ? <p className="mt-1 text-xs">{r.details}</p> : null}
              </div>
              <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} className="rounded border border-border bg-background px-1 text-xs">
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
              <button aria-label="Delete" onClick={() => remove(r.id)}><Trash2 className="size-4 text-muted-foreground" /></button>
            </div>
          </li>
        ))}
        {!rows.length ? <p className="py-4 text-xs text-muted-foreground">No records yet.</p> : null}
      </ul>
    </Shell>
  );
}
