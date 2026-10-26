import { useEffect, useState } from "react";
import { Camera, CheckCircle2, Circle, Crosshair, Download, Ruler, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { campaignUrl, uploadCampaignFile } from "@/lib/campaign";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getGps } from "@/lib/gps";
import { distanceMetres } from "@/lib/session-location";
import { downloadCsv } from "@/lib/csv";
import {
  AGE_GROUPS,
  AUDIT_SECTIONS,
  AUDIT_TOTAL_ITEMS,
  areaSqm,
  auditScore,
  indoorCapacity,
  outdoorCapacity,
  pottiesRequired,
  staffToiletsRequired,
} from "@/lib/infrastructure-audit";

type GpsFix = { latitude: number | null; longitude: number | null };
type PhotoEvidence = { path: string; captured_at: string; latitude: number | null; longitude: number | null };
type AuditDetails = { checked?: string[]; photos?: Record<string, PhotoEvidence | string>; gps?: GpsFix; size?: { indoor: { sqm: number; max_children: number }; outdoor: { sqm: number; max_children: number } }; bangasali?: { registration_number: string; children_by_age_group: Record<string, number> } };
type Row = { id: string; centre: string; subject: string; details: string; status: string; created_at: string };

const FEATURE = "infrastructure-audit";
const input = "w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm";

function Checklist({ section, checked, toggle }: { section: string; checked: string[]; toggle: (id: string) => void }) {
  const sec = AUDIT_SECTIONS.find((s) => s.key === section);
  if (!sec) return null;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {sec.items.map((it) => {
        const id = `${section}.${it.key}`;
        const on = checked.includes(id);
        return (
          <li key={id}>
            <Button variant="ghost" type="button" aria-pressed={on} onClick={() => toggle(id)} className="h-auto min-h-10 w-full justify-start whitespace-normal px-3 py-2.5 text-left">
              {on ? <CheckCircle2 className="size-4 shrink-0 text-primary" /> : <Circle className="size-4 shrink-0 text-muted-foreground" />}
              <span className="text-sm">{it.label}</span>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function PhotoSlots({ section, photos, onUpload, busy }: { section: string; photos: Record<string, PhotoEvidence>; onUpload: (key: string, f: File) => void; busy: string | null }) {
  const sec = AUDIT_SECTIONS.find((s) => s.key === section);
  if (!sec) return null;
  if (!sec.photos.length) return null;
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      {sec.photos.map((p) => {
        const key = `${section}.${p.key}`;
        const evidence = photos[key];
        const done = Boolean(evidence);
        return (
          <label key={key} className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed p-3 text-center text-xs ${done ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
            <Camera className="size-4" />
            {evidence ? <EvidenceImage evidence={evidence} label={p.label} /> : null}
            <span>{p.label}</span>
            <span className="text-[0.6rem]">{busy === key ? "Uploading…" : evidence ? (evidence.latitude !== null && evidence.longitude !== null ? "Photo saved · GPS & date recorded" : "Photo saved · date recorded, GPS unavailable") : "Add photo"}</span>
            <input aria-label={p.label} type="file" accept="image/*" capture="environment" className="hidden" disabled={busy !== null}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(key, f); e.target.value = ""; }} />
          </label>
        );
      })}
    </div>
  );
}

function EvidenceImage({ evidence, label }: { evidence: PhotoEvidence | string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const path = typeof evidence === "string" ? evidence : evidence.path;
  useEffect(() => {
    let active = true;
    void campaignUrl(path).then((value) => { if (active) setUrl(value); });
    return () => { active = false; };
  }, [path]);
  return <div className="w-full">
    {url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={label} className="aspect-video w-full rounded object-cover" /></a> : <p className="text-xs text-muted-foreground">Loading photo…</p>}
    {typeof evidence !== "string" ? <p className="mt-1 break-words text-xs text-muted-foreground">{new Date(evidence.captured_at).toLocaleString()} · {evidence.latitude !== null && evidence.longitude !== null ? `${evidence.latitude.toFixed(5)}, ${evidence.longitude.toFixed(5)}` : "GPS unavailable"}</p> : null}
  </div>;
}

export function InfrastructureAudit() {
  const [centre, setCentre] = useState("");
  const [gps, setGps] = useState<GpsFix>({ latitude: null, longitude: null });
  const [checked, setChecked] = useState<string[]>([]);
  const [photos, setPhotos] = useState<Record<string, PhotoEvidence>>({});
  const [photoBusy, setPhotoBusy] = useState<string | null>(null);
  const [indoor, setIndoor] = useState({ l: "", w: "" });
  const [outdoor, setOutdoor] = useState({ l: "", w: "" });
  const [counts, setCounts] = useState({ children: "", potties: "", staff: "", staffToilets: "" });
  const [tapA, setTapA] = useState<GpsFix | null>(null);
  const [tapB, setTapB] = useState<GpsFix | null>(null);
  const [reg, setReg] = useState({ number: "", ages: AGE_GROUPS.map(() => "") });
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const { user } = useAuth();
  const [gpsBusy, setGpsBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    const { data, error } = await supabase.from("ecd_records").select("id,centre,subject,details,status,created_at").eq("feature", FEATURE).order("created_at", { ascending: false });
    if (error) setMsg(error.message);
    else setRows(data ?? []);
  };

  const toggle = (id: string) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const score = auditScore(checked);

  const onUpload = async (key: string, file: File) => {
    if (!user) return setMsg("Sign in to upload photos.");
    setPhotoBusy(key); setMsg("");
    try {
      const fix = await getGps();
      const captured_at = new Date().toISOString();
      const path = await uploadCampaignFile(user.id, "infrastructure", file);
      setPhotos((p) => ({ ...p, [key]: { path, captured_at, ...fix } }));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Photo upload failed.");
    } finally {
      setPhotoBusy(null);
    }
  };

  const indoorSqm = areaSqm(Number(indoor.l) || 0, Number(indoor.w) || 0);
  const outdoorSqm = areaSqm(Number(outdoor.l) || 0, Number(outdoor.w) || 0);
  const basinDistance = tapA?.latitude != null && tapA.longitude != null && tapB?.latitude != null && tapB.longitude != null
    ? distanceMetres({ latitude: tapA.latitude, longitude: tapA.longitude }, { latitude: tapB.latitude, longitude: tapB.longitude })
    : null;

  const markTap = async (which: "a" | "b") => {
    const g = await getGps();
    if (g.latitude === null) return setMsg("GPS unavailable — allow location access and try again.");
    if (which === "a") setTapA(g); else setTapB(g);
  };

  const captureCentreGps = async () => {
    setGpsBusy(true);
    const fix = await getGps();
    setGps(fix); setGpsBusy(false);
    if (fix.latitude === null) setMsg("GPS unavailable — allow location access and try again.");
    else setChecked((c) => c.includes("zoning.gps_captured") ? c : [...c, "zoning.gps_captured"]);
  };

  const save = async () => {
    if (!centre.trim()) return setMsg("Enter the ECD centre name.");
    setBusy(true); setMsg("");
    const details = {
      checked,
      photos,
      gps,
      captured_at: new Date().toISOString(),
      size: {
        indoor: { length_m: Number(indoor.l) || 0, width_m: Number(indoor.w) || 0, sqm: indoorSqm, max_children: indoorCapacity(indoorSqm) },
        outdoor: { length_m: Number(outdoor.l) || 0, width_m: Number(outdoor.w) || 0, sqm: outdoorSqm, max_children: outdoorCapacity(outdoorSqm) },
      },
      toilets: {
        children: Number(counts.children) || 0, potties: Number(counts.potties) || 0, potties_required: pottiesRequired(Number(counts.children) || 0),
        staff: Number(counts.staff) || 0, staff_toilets: Number(counts.staffToilets) || 0, staff_toilets_required: staffToiletsRequired(Number(counts.staff) || 0),
        basin_distance_m: basinDistance,
      },
      bangasali: { registration_number: reg.number, children_by_age_group: Object.fromEntries(AGE_GROUPS.map((g, i) => [g, Number(reg.ages[i]) || 0])) },
    };
    const { error } = await supabase.from("ecd_records").insert({
      feature: FEATURE,
      centre,
      subject: `Infrastructure audit ${score}%`,
      details: JSON.stringify(details),
      status: score === 100 ? "done" : score >= 70 ? "in_progress" : "flagged",
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg("Audit saved.");
    await load();
  };

  const parse = (d: string) => { try { return JSON.parse(d) as AuditDetails; } catch { return {}; } };
  const num = (v: string, set: (s: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value.replace(/[^0-9.]/g, ""));

  return (
    <div>
      <div className="mb-4 border-y border-border py-3">
        <input className={`${input} mb-2`} aria-label="ECD centre" placeholder="ECD centre *" value={centre} onChange={(e) => setCentre(e.target.value)} />
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${score}%` }} /></div>
          <span className="font-display text-xl text-primary">{score}%</span>
        </div>
        <p className="mt-1 text-[0.65rem] text-muted-foreground">
          {checked.length} of {AUDIT_TOTAL_ITEMS} standards met · GPS: {gps.latitude !== null && gps.longitude !== null ? `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}` : "not recorded"}
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-2" disabled={gpsBusy} onClick={captureCentreGps}><MapPin />{gpsBusy ? "Locating…" : "Capture centre GPS"}</Button>
      </div>

      {AUDIT_SECTIONS.map((sec) => (
        <div key={sec.key} className="mb-5">
          <h3 className="mb-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">{sec.title}</h3>

          {sec.key === "size" ? (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground"><Ruler className="mr-1 inline size-3" />Measurements in metres</p>
              <div>
                <p className="mb-1 text-xs font-medium">Indoor (1.5 m² per child)</p>
                <div className="flex items-center gap-2">
                  <input className={input} inputMode="decimal" placeholder="Length (m)" value={indoor.l} onChange={num(indoor.l, (v) => setIndoor({ ...indoor, l: v }))} />
                  <span>×</span>
                  <input className={input} inputMode="decimal" placeholder="Width (m)" value={indoor.w} onChange={num(indoor.w, (v) => setIndoor({ ...indoor, w: v }))} />
                </div>
                {indoorSqm > 0 ? <p className="mt-1 text-xs text-primary">{indoorSqm.toFixed(1)} m² → maximum {indoorCapacity(indoorSqm)} children indoors</p> : null}
              </div>
              <div>
                <p className="mb-1 text-xs font-medium">Outdoor play area (2 m² per child)</p>
                <div className="flex items-center gap-2">
                  <input className={input} inputMode="decimal" placeholder="Length (m)" value={outdoor.l} onChange={num(outdoor.l, (v) => setOutdoor({ ...outdoor, l: v }))} />
                  <span>×</span>
                  <input className={input} inputMode="decimal" placeholder="Width (m)" value={outdoor.w} onChange={num(outdoor.w, (v) => setOutdoor({ ...outdoor, w: v }))} />
                </div>
                {outdoorSqm > 0 ? <p className="mt-1 text-xs text-primary">{outdoorSqm.toFixed(1)} m² → maximum {outdoorCapacity(outdoorSqm)} children outdoors</p> : null}
              </div>
            </div>
          ) : null}

          {sec.key === "toilets" ? (
            <div className="mb-2 space-y-3 rounded-lg border border-border p-3">
              <div className="grid grid-cols-2 gap-2">
                <input className={input} inputMode="numeric" placeholder="Children enrolled" value={counts.children} onChange={num(counts.children, (v) => setCounts({ ...counts, children: v }))} />
                <input className={input} inputMode="numeric" placeholder="Potties on site" value={counts.potties} onChange={num(counts.potties, (v) => setCounts({ ...counts, potties: v }))} />
                <input className={input} inputMode="numeric" placeholder="Staff members" value={counts.staff} onChange={num(counts.staff, (v) => setCounts({ ...counts, staff: v }))} />
                <input className={input} inputMode="numeric" placeholder="Staff toilets" value={counts.staffToilets} onChange={num(counts.staffToilets, (v) => setCounts({ ...counts, staffToilets: v }))} />
              </div>
              {Number(counts.children) > 0 ? (
                <p className={`text-xs ${Number(counts.potties) >= pottiesRequired(Number(counts.children)) ? "text-primary" : "text-destructive"}`}>
                  {counts.children} children need {pottiesRequired(Number(counts.children))} potties — you have {counts.potties || 0}
                </p>
              ) : null}
              {Number(counts.staff) > 0 ? (
                <p className={`text-xs ${Number(counts.staffToilets) >= staffToiletsRequired(Number(counts.staff)) ? "text-primary" : "text-destructive"}`}>
                  {counts.staff} staff need {staffToiletsRequired(Number(counts.staff))} staff toilets — you have {counts.staffToilets || 0}
                </p>
              ) : null}
              <div className="rounded-lg bg-muted/40 p-2">
                <p className="mb-1 text-xs font-medium"><Crosshair className="mr-1 inline size-3" />GPS tap A to B: toilet → hand wash basin</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" type="button" onClick={() => markTap("a")} className="h-auto flex-1 whitespace-normal">{tapA ? "✓ Point A (toilet)" : "Mark A: at toilet"}</Button>
                  <Button variant="outline" size="sm" type="button" onClick={() => markTap("b")} className="h-auto flex-1 whitespace-normal">{tapB ? "✓ Point B (basin)" : "Mark B: at basin"}</Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">GPS is approximate; confirm the 2 m requirement with a tape measure.</p>
                {basinDistance !== null ? (
                  <p className={`mt-1 text-xs ${basinDistance <= 2 ? "text-primary" : "text-destructive"}`}>
                    Distance: {basinDistance.toFixed(1)} m {basinDistance <= 2 ? "— within 2 m ✓" : "— too far (must be within 2 m)"}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {sec.key === "bangasali" ? (
            <div className="mb-2 space-y-2 rounded-lg border border-border p-3">
              <input className={input} placeholder="Centre registration number" value={reg.number} onChange={(e) => setReg({ ...reg, number: e.target.value })} />
              <p className="text-xs font-medium">Children per age group</p>
              <div className="grid grid-cols-2 gap-2">
                {AGE_GROUPS.map((g, i) => (
                  <label key={g} className="text-xs text-muted-foreground">
                    {g}
                    <input className={`${input} mt-0.5`} inputMode="numeric" value={reg.ages[i] ?? ""} onChange={num(reg.ages[i] ?? "", (v) => setReg({ ...reg, ages: reg.ages.map((a, j) => (j === i ? v : a)) }))} />
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {sec.items.length ? <Checklist section={sec.key} checked={checked} toggle={toggle} /> : null}
          <PhotoSlots section={sec.key} photos={photos} onUpload={onUpload} busy={photoBusy} />
        </div>
      ))}

      {msg ? <p role="status" className="mb-2 text-xs text-primary">{msg}</p> : null}
      <Button onClick={save} disabled={busy || photoBusy !== null} className="w-full">
        {busy ? "Saving…" : "Save infrastructure audit"}
      </Button>

      <div className="mt-8 mb-2 flex items-center justify-between">
        <h3 className="font-display text-lg">Past audits ({rows.length})</h3>
        {rows.length ? (
          <Button variant="ghost" onClick={() => downloadCsv("infrastructure-audits.csv", rows.map((r) => ({ date: r.created_at, centre: r.centre, summary: r.subject, status: r.status })))} className="text-xs text-primary">
            <Download className="size-3" /> Export
          </Button>
        ) : null}
      </div>
      <ul className="divide-y divide-border pb-8">
        {rows.map((r) => (
          <li key={r.id} className="py-3">
            <div className="flex justify-between"><p className="text-sm font-medium">{r.centre}</p><span className="text-sm text-primary">{auditScore(parse(r.details).checked ?? [])}%</span></div>
            <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()} · {r.status.replace("_", " ")}</p>
            <Button variant="link" size="sm" onClick={() => setExpanded(expanded === r.id ? null : r.id)} aria-expanded={expanded === r.id}>{expanded === r.id ? "Close audit" : "View audit"}</Button>
            {expanded === r.id ? <SavedAudit details={parse(r.details)} /> : null}
          </li>
        ))}
        {!rows.length ? <p className="py-4 text-xs text-muted-foreground">No infrastructure audits yet.</p> : null}
      </ul>
    </div>
  );
}

function SavedAudit({ details }: { details: AuditDetails }) {
  return <div className="space-y-3 border-t border-border pt-3">
    {details.bangasali?.registration_number ? <p className="text-sm">Registration: {details.bangasali.registration_number}</p> : null}
    {details.gps ? <p className="text-xs">Centre GPS: {details.gps.latitude ?? "unavailable"}, {details.gps.longitude ?? "unavailable"}</p> : null}
    {details.size ? <p className="text-xs">Indoor: {details.size.indoor.sqm} m² · {details.size.indoor.max_children} children. Outdoor: {details.size.outdoor.sqm} m² · {details.size.outdoor.max_children} children.</p> : null}
    {details.bangasali ? <dl className="grid grid-cols-2 gap-2 text-xs">{Object.entries(details.bangasali.children_by_age_group).map(([age, count]) => <div key={age}><dt>{age}</dt><dd>{count} children</dd></div>)}</dl> : null}
    {AUDIT_SECTIONS.map((section) => <div key={section.key}><h4 className="text-sm font-medium">{section.title}</h4><ul className="mt-1 space-y-1">{section.items.map((item) => <li className="flex gap-2 text-xs" key={item.key}>{details.checked?.includes(`${section.key}.${item.key}`) ? <CheckCircle2 className="size-3 shrink-0 text-primary" /> : <Circle className="size-3 shrink-0 text-muted-foreground" />}{item.label}</li>)}</ul></div>)}
    <div className="grid grid-cols-2 gap-3">{Object.entries(details.photos ?? {}).map(([key, evidence]) => <div key={key}><p className="mb-1 text-xs">{AUDIT_SECTIONS.flatMap((s) => s.photos.map((p) => ({ key: `${s.key}.${p.key}`, label: p.label }))).find((p) => p.key === key)?.label ?? key}</p><EvidenceImage evidence={evidence} label={key} /></div>)}</div>
  </div>;
}
