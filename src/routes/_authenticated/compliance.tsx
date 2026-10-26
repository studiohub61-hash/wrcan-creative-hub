import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Camera, CheckCircle2, Circle, Download } from "lucide-react";
import { Shell } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv } from "@/lib/csv";
import { COMPLIANCE_SECTIONS, COMPLIANCE_TOTAL, complianceScore } from "@/lib/compliance";

export const Route = createFileRoute("/_authenticated/compliance")({
  head: () => ({ meta: [
    { title: "DBE Compliance Checklist — SmartStart" },
    { name: "description", content: "Nine-section DBE compliance and safety checklist for ECD centres, with scores and saved audits." },
    { property: "og:title", content: "DBE Compliance Checklist — SmartStart" },
    { property: "og:description", content: "Safe, clean, compliant, child-focused ECD centres." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CompliancePage,
});

type Row = { id: string; centre: string; details: string; status: string; created_at: string };
const FEATURE = "dbe-checklist";

function CompliancePage() {
  const [centre, setCentre] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const { data } = await supabase.from("ecd_records").select("id,centre,details,status,created_at").eq("feature", FEATURE).order("created_at", { ascending: false });
    setRows(data ?? []);
  };
  useEffect(() => { void load(); }, []);

  const toggle = (id: string) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const score = complianceScore(checked);

  const save = async () => {
    if (!centre.trim()) return setMsg("Enter the ECD centre name.");
    setBusy(true); setMsg("");
    const missing = COMPLIANCE_SECTIONS.flatMap((s) => s.items.map((it, i) => ({ id: `${s.key}-${i}`, label: `${s.title}: ${it}` }))).filter((x) => !checked.includes(x.id));
    const { error } = await supabase.from("ecd_records").insert({
      feature: FEATURE, centre, subject: `Compliance audit ${score}%`,
      details: JSON.stringify({ checked, missing: missing.map((m) => m.label) }),
      status: score === 100 ? "done" : score >= 70 ? "in_progress" : "flagged",
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg("Audit saved."); setChecked([]); void load();
  };

  const parse = (d: string) => { try { return JSON.parse(d) as { checked: string[]; missing: string[] }; } catch { return { checked: [], missing: [] }; } };

  return (
    <Shell title="DBE Compliance" subtitle="Safe · Clean · Compliant · Child-focused">
      <Link to="/smartstart" className="mb-4 inline-flex items-center gap-1 text-xs text-primary"><ArrowLeft className="size-3" /> SmartStart</Link>
      <div className="sticky top-0 z-10 mb-4 rounded-xl border border-border bg-card p-3">
        <input className="mb-2 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" placeholder="ECD centre *" value={centre} onChange={(e) => setCentre(e.target.value)} />
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${score}%` }} /></div>
          <span className="font-display text-xl text-primary">{score}%</span>
        </div>
        <p className="mt-1 text-[0.65rem] text-muted-foreground">{checked.length} of {COMPLIANCE_TOTAL} standards met</p>
      </div>

      {COMPLIANCE_SECTIONS.map((s, si) => {
        const done = s.items.filter((_, i) => checked.includes(`${s.key}-${i}`)).length;
        return (
          <div key={s.key} className="mb-4">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{si + 1}. {s.title}</h3>
              <span className="text-xs text-primary">{done}/{s.items.length}</span>
            </div>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {s.items.map((it, i) => {
                const id = `${s.key}-${i}`; const on = checked.includes(id);
                return (
                  <li key={id}>
                    <button type="button" onClick={() => toggle(id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                      {on ? <CheckCircle2 className="size-4 shrink-0 text-primary" /> : <Circle className="size-4 shrink-0 text-muted-foreground" />}
                      <span className="text-sm">{it}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {s.key === "health" ? (
              <Link to="/campaign-tools" className="mt-2 inline-flex items-center gap-1 text-xs text-primary"><Camera className="size-3" /> Take before & after photo proof</Link>
            ) : null}
          </div>
        );
      })}

      {msg ? <p className="mb-2 text-xs text-primary">{msg}</p> : null}
      <button onClick={save} disabled={busy} className="w-full rounded-full bg-primary py-2.5 text-sm text-primary-foreground disabled:opacity-50">{busy ? "Saving…" : "Save audit"}</button>

      <div className="mt-8 mb-2 flex items-center justify-between">
        <h3 className="font-display text-lg">Past audits ({rows.length})</h3>
        {rows.length ? <button onClick={() => downloadCsv("dbe-compliance-audits.csv", rows.map((r) => ({ date: r.created_at, centre: r.centre, score: complianceScore(parse(r.details).checked), missing: parse(r.details).missing })))} className="inline-flex items-center gap-1 text-xs text-primary"><Download className="size-3" /> Export</button> : null}
      </div>
      <ul className="divide-y divide-border pb-8">
        {rows.map((r) => { const d = parse(r.details); return (
          <li key={r.id} className="py-3">
            <div className="flex justify-between"><p className="text-sm font-medium">{r.centre}</p><span className="text-sm text-primary">{complianceScore(d.checked)}%</span></div>
            <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
            {d.missing.length ? <details className="mt-1 text-xs"><summary className="cursor-pointer text-destructive">{d.missing.length} gaps</summary><ul className="mt-1 list-disc pl-4">{d.missing.map((m) => <li key={m}>{m}</li>)}</ul></details> : null}
          </li>
        ); })}
        {!rows.length ? <p className="py-4 text-xs text-muted-foreground">No audits yet.</p> : null}
      </ul>
    </Shell>
  );
}
