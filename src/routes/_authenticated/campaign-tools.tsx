import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Camera, FileText, Lock, Mic, PenLine, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/Shell";
import { Field, RoseButton, areaClass, inputClass } from "@/components/EmpireUI";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getGps } from "@/lib/gps";
import { DOC_TYPES, INCIDENT_TYPES, MILESTONES, uploadCampaignFile } from "@/lib/campaign";

export const Route = createFileRoute("/_authenticated/campaign-tools")({
  head: () => ({
    meta: [
      { title: "Campaign Tools — WRCAN Evidence Machine" },
      { name: "description", content: "Log before/after evidence, documents, government visits, parent voice notes, milestones and confidential reports." },
      { property: "og:title", content: "Campaign Tools — WRCAN" },
      { property: "og:description", content: "Field tools for ECD mamas, coaches and parents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ToolsPage,
});

const TABS = [
  { id: "evidence", label: "Before/After", icon: Camera },
  { id: "docs", label: "Documents", icon: FileText },
  { id: "visit", label: "Gov visit", icon: PenLine },
  { id: "voice", label: "Voice", icon: Mic },
  { id: "milestone", label: "Milestones", icon: Sparkles },
  { id: "incident", label: "Report", icon: Lock },
] as const;
type Tab = (typeof TABS)[number]["id"];

const CENTRE_KEY = "wrcan-campaign-centre";

function ToolsPage() {
  const [tab, setTab] = useState<Tab>("evidence");
  const [centre, setCentre] = useState("");
  useEffect(() => { setCentre(localStorage.getItem(CENTRE_KEY) ?? ""); }, []);
  const saveCentre = (v: string) => { setCentre(v); localStorage.setItem(CENTRE_KEY, v); };

  return (
    <Shell title="Campaign tools" subtitle="Evidence machine">
      <Field label="ECD centre name"><input aria-label="Centre" className={inputClass} value={centre} onChange={(e) => saveCentre(e.target.value)} placeholder="e.g. Snake Park Creche" /></Field>
      <div className="my-4 grid grid-cols-3 gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[0.65rem] tracking-widest uppercase ${tab === id ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>
            <Icon className="size-4" />{label}
          </button>
        ))}
      </div>
      {!centre.trim() ? <p className="py-6 text-center text-sm text-muted-foreground">Enter the centre name first.</p> : (
        <div className="pb-8">
          {tab === "evidence" && <Evidence centre={centre.trim()} />}
          {tab === "docs" && <Documents centre={centre.trim()} />}
          {tab === "visit" && <Visit centre={centre.trim()} />}
          {tab === "voice" && <Voice centre={centre.trim()} />}
          {tab === "milestone" && <Milestones centre={centre.trim()} />}
          {tab === "incident" && <Incident centre={centre.trim()} />}
        </div>
      )}
      <p className="pb-6 text-center text-xs"><Link to="/campaign" className="text-primary underline">View public campaign dashboard</Link></p>
    </Shell>
  );
}

function useUid() { return useAuth().user?.id ?? ""; }

function PhotoInput({ label, onFile }: { label: string; onFile: (f: File | null) => void }) {
  return <Field label={label}><input type="file" accept="image/*" capture="environment" aria-label={label} className={inputClass} onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></Field>;
}

function Evidence({ centre }: { centre: string }) {
  const uid = useUid();
  const qc = useQueryClient();
  const [title, setTitle] = useState("Toilet cleaning");
  const [before, setBefore] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: open = [] } = useQuery({
    queryKey: ["evidence-open", uid],
    queryFn: async () => (await supabase.from("campaign_evidence").select("*").eq("user_id", uid).is("after_path", null).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: done = [] } = useQuery({
    queryKey: ["evidence-done", uid],
    queryFn: async () => (await supabase.from("campaign_evidence").select("*").eq("user_id", uid).not("after_path", "is", null).order("after_at", { ascending: false }).limit(10)).data ?? [],
  });
  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!before) { toast.error("Take a BEFORE photo"); return; }
    setBusy(true);
    try {
      const [path, gps] = await Promise.all([uploadCampaignFile(uid, "evidence", before), getGps()]);
      const { error } = await supabase.from("campaign_evidence").insert({ user_id: uid, centre, title, before_path: path, before_at: new Date().toISOString(), ...gps });
      if (error) throw error;
      toast.success("BEFORE logged. Add the AFTER photo when done.");
      setBefore(null); (e.target as HTMLFormElement).reset();
      void qc.invalidateQueries({ queryKey: ["evidence-open"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); } finally { setBusy(false); }
  };
  const finish = async (id: string, file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const path = await uploadCampaignFile(uid, "evidence", file);
      const { error } = await supabase.from("campaign_evidence").update({ after_path: path, after_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      toast.success("AFTER logged. Proof complete.");
      void qc.invalidateQueries({ queryKey: ["evidence-open"] });
      void qc.invalidateQueries({ queryKey: ["evidence-done"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); } finally { setBusy(false); }
  };
  const t = (s: string | null) => (s ? new Date(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");
  return (
    <div className="space-y-4">
      <form onSubmit={start} className="space-y-3">
        <h2 className="font-display text-xl">Mama log: BEFORE</h2>
        <Field label="Task"><input required className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <PhotoInput label="Before photo" onFile={setBefore} />
        <RoseButton disabled={busy} type="submit"><Camera className="size-4" />{busy ? "Saving…" : "Log BEFORE"}</RoseButton>
      </form>
      {open.length > 0 && <div><h3 className="mb-2 text-xs tracking-widest uppercase text-muted-foreground">Waiting for AFTER</h3>
        <ul className="divide-y divide-border">{open.map((r) => <li key={r.id} className="py-3 text-sm"><p>{r.title} · before {t(r.before_at)}</p><PhotoInput label="After photo" onFile={(f) => void finish(r.id, f)} /></li>)}</ul></div>}
      {done.length > 0 && <div><h3 className="mb-2 text-xs tracking-widest uppercase text-muted-foreground">Completed proofs</h3>
        <ul className="space-y-1 text-sm">{done.map((r) => <li key={r.id}>✓ {r.title}: BEFORE {t(r.before_at)} → AFTER {t(r.after_at)}</li>)}</ul></div>}
    </div>
  );
}

function Documents({ centre }: { centre: string }) {
  const uid = useUid();
  const [docType, setDocType] = useState("birth_certificate");
  const [status, setStatus] = useState("missing");
  const [subject, setSubject] = useState("");
  const [count, setCount] = useState("1");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Math.min(200, Math.max(1, Number(count) || 1));
    setBusy(true);
    const rows = Array.from({ length: n }, (_, i) => ({ user_id: uid, centre, doc_type: docType, status, subject: n > 1 ? `${subject || "child"} #${i + 1}` : subject || "child" }));
    const { error } = await supabase.from("campaign_documents").insert(rows);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${n} record${n > 1 ? "s" : ""} added to the wallet`);
    setSubject(""); setCount("1");
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <h2 className="font-display text-xl">Document wallet</h2>
      <p className="text-xs text-muted-foreground">Record missing or expired documents. Totals feed the demand statement on the public dashboard. No names are shown publicly.</p>
      <Field label="Document"><select className={inputClass} value={docType} onChange={(e) => setDocType(e.target.value)}>{Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="Status"><select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}><option value="missing">Missing</option><option value="expired">Expired</option><option value="valid">Valid</option></select></Field>
      <Field label="Child initials / reference (optional)"><input className={inputClass} value={subject} maxLength={40} onChange={(e) => setSubject(e.target.value)} /></Field>
      <Field label="How many children / items"><input type="number" min={1} max={200} className={inputClass} value={count} onChange={(e) => setCount(e.target.value)} /></Field>
      <RoseButton disabled={busy} type="submit">{busy ? "Saving…" : "Add to wallet"}</RoseButton>
    </form>
  );
}

function SignaturePad({ onChange }: { onChange: (data: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [(e.clientX - r.left) * (ref.current!.width / r.width), (e.clientY - r.top) * (ref.current!.height / r.height)] as const; };
  return (
    <div>
      <canvas ref={ref} width={600} height={200} aria-label="Signature pad" className="h-32 w-full touch-none rounded-lg border border-border bg-background"
        onPointerDown={(e) => { drawing.current = true; const c = ref.current!.getContext("2d")!; c.lineWidth = 3; c.lineCap = "round"; c.strokeStyle = getComputedStyle(ref.current!).color; const [x, y] = pos(e); c.beginPath(); c.moveTo(x, y); }}
        onPointerMove={(e) => { if (!drawing.current) return; const c = ref.current!.getContext("2d")!; const [x, y] = pos(e); c.lineTo(x, y); c.stroke(); }}
        onPointerUp={() => { drawing.current = false; onChange(ref.current!.toDataURL("image/png")); }} />
      <button type="button" className="mt-1 text-xs text-primary underline" onClick={() => { ref.current!.getContext("2d")!.clearRect(0, 0, 600, 200); onChange(null); }}>Clear signature</button>
    </div>
  );
}

function Visit({ centre }: { centre: string }) {
  const uid = useUid();
  const [name, setName] = useState("");
  const [dept, setDept] = useState("Department of Social Development");
  const [purpose, setPurpose] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [sig, setSig] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sig) { toast.error("The official must sign"); return; }
    if (!photo) { toast.error("Take a photo of the official on site"); return; }
    setBusy(true);
    try {
      const gps = await getGps(10000);
      if (gps.latitude === null) throw new Error("GPS is required. Allow location access and try again.");
      const path = await uploadCampaignFile(uid, "visits", photo);
      const { error } = await supabase.from("campaign_visits").insert({ user_id: uid, centre, official_name: name, department: dept, purpose, photo_path: path, signature: sig, ...gps });
      if (error) throw error;
      toast.success("Visit clocked in with GPS, photo and signature");
      setName(""); setPurpose(""); setPhoto(null); setSig(null); setKey((k) => k + 1);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); } finally { setBusy(false); }
  };
  return (
    <form key={key} onSubmit={submit} className="space-y-3">
      <h2 className="font-display text-xl">Government visit log</h2>
      <p className="text-xs text-muted-foreground">GPS + photo + signature. If no visit is logged for 30 days the dashboard turns RED.</p>
      <Field label="Official's name"><input required className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Department"><input required className={inputClass} value={dept} onChange={(e) => setDept(e.target.value)} /></Field>
      <Field label="Purpose of visit"><input className={inputClass} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></Field>
      <PhotoInput label="Photo of official on site" onFile={setPhoto} />
      <Field label="Official's signature"><SignaturePad onChange={setSig} /></Field>
      <RoseButton disabled={busy} type="submit"><PenLine className="size-4" />{busy ? "Saving…" : "Clock in visit"}</RoseButton>
    </form>
  );
}

function Voice({ centre }: { centre: string }) {
  const uid = useUid();
  const [lang, setLang] = useState("zulu");
  const [summary, setSummary] = useState("");
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [duration, setDuration] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); setBlob(new Blob(chunks, { type: mr.mimeType || "audio/webm" })); };
      mr.start(); setRec(mr); setBlob(null); setStartedAt(Date.now());
    } catch { toast.error("Microphone access is needed to record."); }
  };
  const stop = () => { rec?.stop(); setRec(null); setDuration(Date.now() - startedAt); };
  const send = async () => {
    if (!blob) return;
    setBusy(true);
    try {
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      const path = await uploadCampaignFile(uid, "voice", blob, ext);
      const { error } = await supabase.from("campaign_voice_notes").insert({ user_id: uid, centre, language: lang, summary: summary || null, audio_path: path, duration_ms: duration });
      if (error) throw error;
      toast.success("Voice note sent to the Coach Dashboard");
      setBlob(null); setSummary("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <h2 className="font-display text-xl">Parent voice button</h2>
      <Field label="Language"><select className={inputClass} value={lang} onChange={(e) => setLang(e.target.value)}><option value="zulu">isiZulu</option><option value="sotho">Sesotho</option><option value="xhosa">isiXhosa</option><option value="english">English</option><option value="other">Other</option></select></Field>
      <div className="flex justify-center py-4">
        {!rec ? <button type="button" onClick={() => void start()} aria-label="Start recording" className="flex size-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"><Mic className="size-10" /></button>
          : <button type="button" onClick={stop} aria-label="Stop recording" className="flex size-24 animate-pulse items-center justify-center rounded-full bg-destructive text-destructive-foreground"><Square className="size-10" /></button>}
      </div>
      <p className="text-center text-xs text-muted-foreground">{rec ? "Recording… tap to stop" : "Tap and speak, e.g. “My child had no meal for 3 days”"}</p>
      {blob && <>
        <audio controls src={URL.createObjectURL(blob)} className="w-full" />
        <Field label="Short summary (optional)"><input className={inputClass} value={summary} maxLength={200} onChange={(e) => setSummary(e.target.value)} /></Field>
        <RoseButton disabled={busy} onClick={() => void send()}>{busy ? "Sending…" : "Send voice note"}</RoseButton>
      </>}
    </div>
  );
}

function Milestones({ centre }: { centre: string }) {
  const uid = useUid();
  const [child, setChild] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const rows = MILESTONES.map((m) => ({ user_id: uid, centre, child_ref: child, milestone: m, achieved: !!checked[m] }));
    const { error } = await supabase.from("campaign_milestones").insert(rows);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Milestones recorded");
    setChild(""); setChecked({});
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <h2 className="font-display text-xl">Child development & milestones</h2>
      <p className="text-xs text-muted-foreground">Donor-facing. Only percentages are published; use initials, never full names.</p>
      <Field label="Child reference (initials or number)"><input required maxLength={20} className={inputClass} value={child} onChange={(e) => setChild(e.target.value)} /></Field>
      {MILESTONES.map((m) => <label key={m} className="flex items-center gap-3 text-sm"><input type="checkbox" className="accent-primary" checked={!!checked[m]} onChange={(e) => setChecked({ ...checked, [m]: e.target.checked })} />{m}</label>)}
      <RoseButton disabled={busy} type="submit">{busy ? "Saving…" : "Save assessment"}</RoseButton>
    </form>
  );
}

function Incident({ centre }: { centre: string }) {
  const uid = useUid();
  const [category, setCategory] = useState<string>(INCIDENT_TYPES[0]!);
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: mine = [], refetch } = useQuery({
    queryKey: ["my-incidents", uid],
    queryFn: async () => (await supabase.from("campaign_incidents").select("id, category, status, created_at").eq("reporter_id", uid).order("created_at", { ascending: false })).data ?? [],
  });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const path = file ? await uploadCampaignFile(uid, "incidents", file) : null;
      const { error } = await supabase.from("campaign_incidents").insert({ reporter_id: uid, centre, category, description: desc, evidence_path: path });
      if (error) throw error;
      toast.success("Report sent securely to social workers");
      setDesc(""); setFile(null); void refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <h2 className="flex items-center gap-2 font-display text-xl"><Lock className="size-5 text-primary" /> Confidential report</h2>
      <p className="text-xs text-muted-foreground">Only you and authorised social workers can see this. Files are stored privately and sent over an encrypted connection. If a child is in immediate danger call SAPS 10111 or Childline 116.</p>
      <Field label="Concern"><select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>{INCIDENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
      <Field label="What happened"><textarea required rows={4} className={areaClass} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
      <Field label="Photo or document (optional)"><input type="file" accept="image/*,application/pdf" className={inputClass} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
      <RoseButton disabled={busy} type="submit"><Lock className="size-4" />{busy ? "Sending…" : "Send secure report"}</RoseButton>
      {mine.length > 0 && <ul className="mt-4 space-y-1 text-xs">{mine.map((m) => <li key={m.id}>{new Date(m.created_at).toLocaleDateString()} · {m.category} · <b className="uppercase">{m.status}</b></li>)}</ul>}
    </form>
  );
}
