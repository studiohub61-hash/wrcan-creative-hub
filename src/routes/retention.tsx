import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, GraduationCap, University, TrendingUp, Calculator, ShieldCheck, MapPin, Camera, Download, CheckCircle2, AlertTriangle, Clock3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/wrcan-logo.png";
import { RETENTION_DEMO, STUDENTS, calculateRetention, filterStudents, donorReport, type Risk } from "@/lib/retention";

export const Route = createFileRoute("/retention")({
  head: () => ({ meta: [
    { title: "Student Retention & Impact — WRCAN" },
    { name: "description", content: "WRCAN sample student retention dashboard with risk monitoring, a transparent cost-saving calculator and donor reporting." },
    { property: "og:title", content: "Student Retention & Impact — WRCAN" },
    { property: "og:description", content: "Explore sample cohort retention, modelled savings and intervention evidence." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: RetentionPage,
});

const money = (n: number) => `R${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
const fieldClass = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const riskClass = (risk: Risk) => risk === "On track" ? "bg-accent text-primary" : risk === "At risk" ? "bg-secondary text-secondary-foreground" : risk === "Dropout alert" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground";
type Evidence = { id: string; student: string; note: string; timestamp: string; gps: string; photo: string };

function RetentionPage() {
  const [national, setNational] = useState(RETENTION_DEMO.nationalRetention);
  const [cost, setCost] = useState(RETENTION_DEMO.costPerDropout);
  const [risk, setRisk] = useState("All");
  const [query, setQuery] = useState("");
  const [student, setStudent] = useState("ST-001");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState("");
  const [gps, setGps] = useState("Not captured");
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState("");
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [fileKey, setFileKey] = useState(0);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);
  useEffect(() => () => { evidence.forEach(e => URL.revokeObjectURL(e.photo)); }, [evidence]);
  const result = calculateRetention(30, 28, national, cost);
  const filtered = filterStudents(risk, query);

  function captureLocation() {
    if (!navigator.geolocation) { setNotice("Location is unavailable in this browser."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      setGps(`${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)} (±${Math.round(position.coords.accuracy)}m) · ${new Date(position.timestamp).toISOString()}`);
      setLocating(false);
    }, () => { setNotice("Location was not captured. Check browser permission or save without GPS."); setLocating(false); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  }
  function saveEvidence(event: FormEvent) {
    event.preventDefault();
    if (!photo || !note.trim()) return;
    // A fresh URL keeps the submitted photo separate from the form's cleanup lifecycle.
    fetch(photo).then(response => response.blob()).then(blob => {
      setEvidence(current => [{ id: crypto.randomUUID(), student, note: note.trim(), timestamp: new Date().toISOString(), gps, photo: URL.createObjectURL(blob) }, ...current]);
      setPhoto(""); setNote(""); setGps("Not captured"); setFileKey(v => v + 1);
      setNotice("Intervention added to this session. It is not uploaded and clears when this page closes.");
    }).catch(() => setNotice("The photo could not be read. Please select it again."));
  }
  function exportReport() {
    const url = URL.createObjectURL(new Blob([donorReport(30, 28, national, cost, evidence)], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "wrcan-retention-sample-report.csv"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Sample donor report downloaded. Photos are not included.");
  }

  return <div className="retention-theme min-h-screen bg-background">
    <header className="bg-primary text-primary-foreground"><div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
      <Button asChild variant="ghost" className="mb-5 px-0 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"><Link to="/"><ArrowLeft /> Home</Link></Button>
      <div className="flex items-center gap-4"><img src={logo} alt="WRCAN" className="h-16 w-16 shrink-0 object-contain" /><div className="min-w-0"><p className="mb-1 text-xs font-semibold uppercase">Cohort 2026 · Sample dashboard</p><h1 className="font-sans text-3xl font-bold sm:text-4xl">WRCAN Student Retention</h1><p className="mt-2 text-sm text-primary-foreground/80">Student progress & intervention impact</p></div></div>
    </div></header>
    <main className="mx-auto max-w-6xl space-y-8 px-5 py-7 sm:px-8">
      <p className="flex items-start gap-2 border-b border-border pb-4 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0" /> Sample figures, not verified impact. Benchmark and dropout cost are reference assumptions, not validated national statistics.</p>
      <section aria-label="Cohort summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { icon: GraduationCap, value: "50", label: "Matriculants 2026", detail: "Baseline cohort" },
          { icon: GraduationCap, value: "35", label: "Bachelor pass eligible", detail: "70% of matriculants" },
          { icon: University, value: "30", label: "University enrolled", detail: "60% of baseline cohort" },
          { icon: TrendingUp, value: "28", label: "Active students", detail: `${result.retention.toFixed(1)}% retention · +${(result.retention - national).toFixed(1)} pp vs benchmark` },
        ].map(({ icon: Icon, value, label, detail }) => <article key={label} className="rounded-lg border border-border bg-card p-4"><Icon className="mb-3 size-7 text-primary" /><p className="text-3xl font-bold">{value}</p><h2 className="mt-1 font-sans text-sm font-bold">{label}</h2><p className="mt-2 text-xs text-muted-foreground">{detail}</p></article>)}
      </section>

      <section className="border-y border-border py-6" aria-labelledby="calculator-title">
        <h2 id="calculator-title" className="flex items-center gap-2 font-sans text-xl font-bold"><Calculator className="text-primary" /> Cost-saving calculator</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm">National retention benchmark (%)<input className={`${fieldClass} mt-1`} type="number" min="0" max="100" value={national} onChange={e => setNational(Math.min(100, Math.max(0, Number(e.target.value))))} /></label><label className="text-sm">Cost per dropout (ZAR)<input className={`${fieldClass} mt-1`} type="number" min="0" max="10000000" value={cost} onChange={e => setCost(Math.min(10000000, Math.max(0, Number(e.target.value))))} /></label></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[{ label: "Without intervention", value: result.baselineLoss, text: `${result.expectedDropouts.toFixed(1)} expected dropouts`, tone: "text-destructive" }, { label: "With WRCAN cohort", value: result.actualLoss, text: "2 students no longer active", tone: "text-secondary-foreground" }, { label: "Modelled net saving", value: result.savings, text: "Difference in estimated losses", tone: "text-primary" }].map(item => <article key={item.label} className="rounded-lg border border-border bg-card p-4"><h3 className="font-sans text-sm font-semibold">{item.label}</h3><p className={`my-2 break-words text-2xl font-bold ${item.tone}`}>{money(item.value)}</p><p className="text-xs text-muted-foreground">{item.text}</p></article>)}
        </div><p className="mt-3 text-xs text-muted-foreground">Enrolled × dropout rate × cost per dropout. Net saving is an estimate, not an audited result.</p>
      </section>

      <section aria-labelledby="risk-title"><h2 id="risk-title" className="flex items-center gap-2 font-sans text-xl font-bold"><ShieldCheck className="text-primary" /> Risk status</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{(["On track", "At risk", "Dropout alert", "Withdrawn"] as Risk[]).map(status => <Button key={status} variant="outline" aria-pressed={risk === status} onClick={() => setRisk(risk === status ? "All" : status)} className={`h-auto min-h-24 flex-col gap-1 whitespace-normal border-2 ${riskClass(status)} ${risk === status ? "border-primary" : "border-transparent"}`}><span className="text-2xl font-bold">{filterStudents(status, "").length}</span><span>{status}</span></Button>)}</div>
        <div className="mt-5 flex flex-wrap gap-3"><label className="min-w-0 flex-1"><span className="sr-only">Search student or province</span><input className={fieldClass} placeholder="Search student ID or province" value={query} onChange={e => setQuery(e.target.value)} /></label><Button variant="outline" onClick={() => { setRisk("All"); setQuery(""); }}>All students</Button></div>
        <p className="my-3 text-xs text-muted-foreground">{filtered.length} of 30 enrolled students · 28 active includes at-risk and alert students</p>
        <div className="max-h-72 overflow-auto rounded-lg border border-border"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-muted"><tr><th className="p-3">Student</th><th className="p-3">Province</th><th className="p-3">Status</th></tr></thead><tbody>{filtered.map(s => <tr key={s.id} className="border-t border-border bg-card"><td className="p-3 font-medium">{s.id}</td><td className="p-3">{s.province}</td><td className="p-3"><span className={`inline-block rounded px-2 py-1 text-xs ${riskClass(s.risk)}`}>{s.risk}</span></td></tr>)}</tbody></table>{!filtered.length && <p className="p-6 text-sm text-muted-foreground">No matching students.</p>}</div>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section><h2 className="flex items-center gap-2 font-sans text-xl font-bold"><MapPin className="text-primary" /> South Africa distribution</h2><div className="mt-5 space-y-4">{["Gauteng", "Limpopo", "KwaZulu-Natal"].map(province => <div key={province}><div className="mb-2 flex justify-between text-sm"><span>{province}</span><strong>{STUDENTS.filter(s => s.province === province).length} students</strong></div><div className="flex h-3 gap-0.5 overflow-hidden rounded-sm">{STUDENTS.filter(s => s.province === province).map(s => <span title={`${s.id}: ${s.risk}`} key={s.id} className={`flex-1 ${s.risk === "On track" ? "bg-primary" : s.risk === "At risk" ? "bg-secondary" : s.risk === "Dropout alert" ? "bg-destructive" : "bg-muted"}`} />)}</div></div>)}</div></section>
        <section><h2 className="flex items-center gap-2 font-sans text-xl font-bold"><Clock3 className="text-primary" /> 3-year journey</h2><ol className="ml-3 mt-5 space-y-5 border-l-2 border-border pl-5">{[{ title: "Matric · 2026", text: "50 matriculants · 35 bachelor-pass eligible" }, { title: "University · 2027–2028", text: "30 enrolled · ongoing mentoring and support" }, { title: "Graduation · 2029", text: "28 projected graduates · projection, not guaranteed" }].map(item => <li key={item.title}><h3 className="font-sans text-base font-bold text-primary">{item.title}</h3><p className="mt-1 text-sm text-muted-foreground">{item.text}</p></li>)}</ol></section>
      </div>

      <section className="border-t border-border pt-6"><h2 className="flex items-center gap-2 font-sans text-xl font-bold"><CheckCircle2 className="text-primary" /> Proof of intervention</h2><p className="mt-2 text-xs text-muted-foreground">Session-only evidence · upload only consented photos · nothing is sent to Cloud</p>
        <form onSubmit={saveEvidence} className="mt-5 grid gap-4 md:grid-cols-2"><div className="space-y-4"><label className="block text-sm">Student<select className={`${fieldClass} mt-1`} value={student} onChange={e => setStudent(e.target.value)}>{STUDENTS.map(s => <option key={s.id}>{s.id}</option>)}</select></label><label className="block text-sm">Intervention notes<textarea required maxLength={1000} className={`${fieldClass} mt-1 min-h-24`} value={note} onChange={e => setNote(e.target.value)} placeholder="Mentor check-in, tutoring support…" /></label><Button type="button" variant="outline" disabled={locating} onClick={captureLocation}><MapPin />{locating ? "Capturing location…" : "Capture GPS"}</Button><p className="break-words text-xs text-muted-foreground">{gps}</p></div>
          <div><label className="block text-sm"><span className="mb-2 flex items-center gap-2"><Camera className="size-4 text-primary" /> Photo evidence</span><input key={fileKey} type="file" accept="image/jpeg,image/png,image/webp" className={`${fieldClass} text-xs`} onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { setNotice("Choose a JPG, PNG or WebP photo smaller than 5 MB."); setPhoto(""); return; } setPhoto(URL.createObjectURL(file)); setNotice(""); }} /></label>{photo ? <img src={photo} alt="Selected intervention evidence" className="mt-3 h-44 w-full rounded-lg object-contain bg-muted" /> : <div className="mt-3 flex h-44 items-center justify-center rounded-lg border border-dashed border-border bg-muted"><Camera className="size-9 text-muted-foreground" /></div>}<Button type="submit" disabled={!photo || !note.trim()} className="mt-3 w-full"><CheckCircle2 /> Add intervention</Button></div>
        </form>
        {evidence.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2">{evidence.map(e => <article key={e.id} className="rounded-lg border border-border bg-card p-3"><div className="flex justify-between gap-2"><h3 className="font-sans font-bold">{e.student}</h3><Button variant="ghost" size="icon" aria-label={`Remove intervention ${e.student}`} onClick={() => setEvidence(current => current.filter(item => item.id !== e.id))}><X /></Button></div><img src={e.photo} alt={`Intervention for ${e.student}`} className="my-2 h-36 w-full object-contain" /><p className="break-words text-sm">{e.note}</p><p className="mt-2 break-words text-xs text-muted-foreground">{e.timestamp}<br />GPS: {e.gps}</p></article>)}</div>}
      </section>
      {notice && <p role="status" className="flex items-start gap-2 rounded-md border border-border bg-muted p-3 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{notice}</p>}
      <div className="border-t border-border pt-6"><Button size="lg" onClick={exportReport} className="h-auto w-full whitespace-normal py-3 sm:w-auto"><Download /> Generate sample donor report</Button><p className="mt-3 text-xs text-muted-foreground">CSV · cohort risk, calculator assumptions and intervention notes · excludes photo files</p></div>
    </main><footer className="border-t border-border px-5 py-5 text-center text-xs text-muted-foreground">WRCAN · South Africa · Sample impact dashboard</footer>
  </div>;
}