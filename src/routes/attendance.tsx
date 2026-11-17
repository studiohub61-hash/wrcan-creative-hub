import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, CameraOff, CheckCircle2, Clock3, GraduationCap, LogIn, LogOut, ShieldCheck, Users, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { NotificationBell, LiveSiteActivity } from "@/components/LiveActivity";
import { useRealtime } from "@/hooks/useRealtime";
import { AttendanceLog } from "@/components/AttendanceLog";
import { capturePhoto } from "@/lib/attendance-photo";
import { AttendanceRegistration, AttendanceProfileCard } from "@/components/AttendanceRegistration";
import { ATTENDANCE_KEY, PEOPLE_KEY, ATTENDANCE_ROLES, samplePeople, parsePeople, clockActionError, latestAttendance, isAttendanceRole, punctualityAt, parseAttendance, type AttendancePerson, type AttendanceAction, type AttendanceEntry, type AttendanceRole } from "@/lib/attendance";

export const Route = createFileRoute("/attendance")({
  head: () => ({ meta: [
    { title: "Registration & Clock-In — WRCAN SmartStart" },
    { name: "description", content: "Register teachers, children, parents and farmers with custom shifts, reference photos and device-local punctuality records." },
    { property: "og:title", content: "Registration & Clock-In — WRCAN SmartStart" },
    { property: "og:description", content: "Manage registrations, clock-ins and custom shift attendance for your site or farm." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: AttendancePage,
});

function AttendancePage() {
  const [role, setRole] = useState<AttendanceRole>("Teacher");
  const [tab, setTab] = useState<AttendanceRole | "register">("Teacher");
  const [registered, setRegistered] = useState<AttendancePerson[]>([]);
  const [referencePhoto, setReferencePhoto] = useState("");
  const [selected, setSelected] = useState("teacher-1");
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [photo, setPhoto] = useState<AttendanceEntry | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(false);
  const lock = useRef(false);
  const rt = useRealtime();
  const allRegistered = useMemo(() => {
    const rows = new Map(registered.map(p => [p.id, p]));
    for (const p of rt.participants) if (isAttendanceRole(p.role)) {
      const local = rows.get(p.id);
      rows.set(p.id, { id: p.id, name: p.name, role: p.role, identityNumber: local?.identityNumber ?? "", contact: local?.contact ?? "", site: p.site, photo: p.photo_data, startTime: p.start_time, endTime: p.end_time });
    }
    return [...rows.values()];
  }, [registered, rt.participants]);
  const allEntries = useMemo(() => {
    const rows = new Map(entries.map(e => [e.id, e]));
    for (const l of rt.logs) if (isAttendanceRole(l.role)) rows.set(l.id, { id: l.id, personId: l.participant_id, name: l.name, role: l.role, action: l.action === "Out" ? "Out" : "In", timestamp: l.created_at, photo: l.photo_data, ...(l.punctuality === "Late" || l.punctuality === "On Time" ? { punctuality: l.punctuality } : {}) });
    return [...rows.values()].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  }, [entries, rt.logs]);
  const people = useMemo(() => [...new Map([...samplePeople(), ...allRegistered].map(p => [p.id, p])).values()], [allRegistered]);
  const person = people.find(p => p.role === role && p.id === selected);
  const lastActivity = useMemo(() => person ? latestAttendance(person, allEntries) : undefined, [person, allEntries]);

  useEffect(() => {
    mounted.current = true;
    try { setEntries(parseAttendance(localStorage.getItem(ATTENDANCE_KEY))); setRegistered(parsePeople(localStorage.getItem(PEOPLE_KEY))); }
    catch { setNotice({ error: true, text: "Saved attendance could not be read. New records cannot be saved until device storage is available." }); return () => { mounted.current = false; }; }
    setLoaded(true);
    const sync = (event: StorageEvent) => {
      try {
        if (event.key === ATTENDANCE_KEY || event.key === null) setEntries(parseAttendance(localStorage.getItem(ATTENDANCE_KEY)));
        if (event.key === PEOPLE_KEY || event.key === null) setRegistered(parsePeople(localStorage.getItem(PEOPLE_KEY)));
      } catch { setNotice({ error: true, text: "Saved records could not be refreshed." }); }
    };
    window.addEventListener("storage", sync);
    return () => { mounted.current = false; window.removeEventListener("storage", sync); stream.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  async function savePerson(nextPerson: AttendancePerson) {
    try {
      const next = [nextPerson, ...parsePeople(localStorage.getItem(PEOPLE_KEY))];
      localStorage.setItem(PEOPLE_KEY, JSON.stringify(next));

      setRegistered(next); setRole(nextPerson.role); setSelected(nextPerson.id);
      setNotice({ error: false, text: `${nextPerson.name} registered. Their profile is ready in ${nextPerson.role} Mode.` });
      if (rt.live) {
        try {
          const synced = await rt.register({ id: nextPerson.id, name: nextPerson.name, role: nextPerson.role, site: nextPerson.site, start_time: nextPerson.startTime, end_time: nextPerson.endTime, photo_data: nextPerson.photo });
          setNotice({ error: !synced, text: synced ? `${nextPerson.name} registered and synced to every team phone.` : "Registered on this device only. Cloud sync failed; check your connection." });
        } catch { setNotice({ error: true, text: "Registered on this device only. Cloud sync failed; check your connection." }); }
      }
      return true;
    } catch { setNotice({ error: true, text: "Person was not saved. Device storage is full or blocked; free some space and try again." }); return false; }
  }

  async function deletePerson(target: AttendancePerson) {
    try {
      const people = parsePeople(localStorage.getItem(PEOPLE_KEY)).filter(p => p.id !== target.id);
      const logs = parseAttendance(localStorage.getItem(ATTENDANCE_KEY)).filter(e => e.personId !== target.id);
      localStorage.setItem(PEOPLE_KEY, JSON.stringify(people)); localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(logs));
      setRegistered(people); setEntries(logs);
    } catch { /* device copy unavailable; cloud delete still runs */ }
    if (selected === target.id) setSelected("");
    const ok = rt.live ? await rt.remove(target.id) : true;
    setNotice({ error: !ok, text: ok ? `${target.name} and their clock-ins were deleted.` : `${target.name} could not be deleted from the cloud. Check your connection and try again.` });
  }

  function stopCamera() {
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setActive(false);
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is unavailable. Open this page in a secure browser with camera support.");
    if (!stream.current || !stream.current.getVideoTracks().some(t => t.readyState === "live")) {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      if (!mounted.current) { media.getTracks().forEach(t => t.stop()); return null; }
      stream.current = media;
    }
    const element = video.current;
    if (!element) throw new Error("Camera preview is not ready. Please try again.");
    element.srcObject = stream.current;
    await element.play();
    for (let i = 0; i < 80 && element.readyState < 2; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!mounted.current) return null;
    }
    if (element.readyState < 2 || !element.videoWidth) throw new Error("Camera did not provide an image. Please try again.");
    if (mounted.current) setActive(true);
    return element;
  }

  async function useCamera(action?: AttendanceAction, reference = false) {
    if (lock.current || (!person && action) || !loaded) return;
    lock.current = true; setBusy(true); setNotice(null);
    try {
      const element = await startCamera();
      if (!element || !mounted.current || (!action && !reference)) return;
      const captured = capturePhoto(element, element.videoWidth, element.videoHeight);
      if (reference) { setReferencePhoto(captured); stopCamera(); setNotice({ error: false, text: "Reference photo captured." }); return; }
      if (action && person) { await saveClock(action, captured); stopCamera(); }
    } catch (error) {
      if (!mounted.current) return;
      stopCamera();
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      const absent = error instanceof DOMException && (error.name === "NotFoundError" || error.name === "NotReadableError");
      setNotice({ error: true, text: denied ? "Camera permission was denied. Allow camera access in your browser and try again. No attendance was saved." : absent ? "No available camera was found. Connect a camera or close other apps using it, then try again. No attendance was saved." : error instanceof Error ? error.message : "Could not record attendance. Please try again." });
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  async function saveClock(action: AttendanceAction, captured = "") {
    if (!person || !loaded) return;
    const invalid = clockActionError(person, allEntries, action);
    if (invalid) { setNotice({ error: true, text: invalid }); return; }
    const now = new Date();
    const entry: AttendanceEntry = { id: crypto.randomUUID(), personId: person.id, name: person.name, role: person.role, action, timestamp: now.toISOString(), photo: captured || person.photo, ...(action === "In" ? { punctuality: punctualityAt(now, person.startTime, person.endTime) } : {}) };
    try {
      const next = [entry, ...parseAttendance(localStorage.getItem(ATTENDANCE_KEY))];
      localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(next)); setEntries(next);
      setNotice({ error: false, text: `${person.name} clocked ${action === "In" ? "in" : "out"}${entry.punctuality ? ` · ${entry.punctuality}` : ""}. Saved on this device.` });
      if (rt.live) {
        try {
          const registered = await rt.register({ id: person.id, name: person.name, role: person.role, site: person.site, start_time: person.startTime, end_time: person.endTime, photo_data: person.photo });
          const synced = registered && await rt.logClock({ id: entry.id, participant_id: person.id, name: person.name, role: person.role, action, punctuality: entry.punctuality ?? null, photo_data: entry.photo, created_at: entry.timestamp });
          if (mounted.current) setNotice({ error: !synced, text: synced ? `${person.name} clocked ${action === "In" ? "in" : "out"}${entry.punctuality ? ` · ${entry.punctuality}` : ""}. Synced to every team phone.` : "Attendance saved on this device only. Cloud sync failed; check your connection." });
        } catch { if (mounted.current) setNotice({ error: true, text: "Attendance saved on this device only. Cloud sync failed; check your connection." }); }
      }
    } catch { setNotice({ error: true, text: "Attendance was not saved. Device storage is full or blocked; free some space and try again." }); }
  }

  async function clock(action: AttendanceAction) {
    if (lock.current || busy || !person || !loaded) return;
    const invalid = clockActionError(person, allEntries, action);
    if (invalid) { setNotice({ error: true, text: invalid }); return; }
    if (active) { await useCamera(action); return; }
    lock.current = true; setBusy(true);
    try { await saveClock(action); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  useEffect(() => {
    const pause = () => { if (document.hidden) stopCamera(); };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, []);

  return <div className="attendance-theme min-h-screen bg-background">
    <header className="border-b border-border bg-card"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-5">
      <div className="flex gap-4"><Link to="/" className="inline-flex items-center gap-2 text-sm text-primary"><ArrowLeft className="size-4" /> Home</Link><Link to="/smartstart" className="text-sm text-primary">SmartStart</Link></div>
      <div className="flex items-center gap-3"><span className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" /> {rt.live ? "Live sync on" : "Device-only records"}</span><NotificationBell /></div>
    </div></header>
    <main className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-7 flex items-center gap-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"><Users className="size-6" /></div><div className="min-w-0"><h1 className="font-sans text-2xl font-bold sm:text-3xl">Registration &amp; Clock-In</h1><p className="mt-1 text-sm text-muted-foreground">SmartStart · Daily register · Johannesburg time</p></div></div>
      <Tabs value={tab} onValueChange={value => { if (busy) return; stopCamera(); setNotice(null); if (value === "register") { setTab(value); return; } if (isAttendanceRole(value)) { setTab(value); setRole(value); setSelected(people.find(p => p.role === value && p.id === selected)?.id ?? allRegistered.find(p => p.role === value)?.id ?? people.find(p => p.role === value)?.id ?? ""); } }}>
        <TabsList className="mb-7 grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">{ATTENDANCE_ROLES.map(r => <TabsTrigger disabled={busy} key={r} value={r} className="min-h-12 whitespace-normal px-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{r} Mode</TabsTrigger>)}<TabsTrigger disabled={busy} value="register" className="min-h-12 whitespace-normal px-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">+ Register People</TabsTrigger></TabsList>
      </Tabs>
      {notice && <div role="alert" className={`mb-5 flex gap-2 rounded-md border p-3 text-sm ${notice.error ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-primary/30 bg-accent text-primary"}`}>{notice.error ? <AlertCircle className="size-4 shrink-0" /> : <CheckCircle2 className="size-4 shrink-0" />}<span>{notice.text}</span></div>}
      <div className="grid gap-7 md:grid-cols-[1fr_1.2fr]">
        {tab === "register" ? <AttendanceRegistration onSave={savePerson} onDelete={p => void deletePerson(p)} people={allRegistered} entries={allEntries} photo={referencePhoto} onPhoto={setReferencePhoto} onCamera={() => void useCamera(undefined, true)} busy={busy} loaded={loaded} /> :
        <section className="min-w-0 py-2">
          <h2 className="font-sans text-xl font-semibold">{role} register</h2>
          <div className="my-5"><label id="attendance-person" className="mb-2 block text-sm font-medium">{role} name</label>
            <Select value={selected} onValueChange={setSelected} disabled={busy || !people.some(p => p.role === role)}><SelectTrigger aria-labelledby="attendance-person" className="h-12 bg-card"><SelectValue placeholder="No people registered" /></SelectTrigger><SelectContent className="attendance-theme">{people.filter(p => p.role === role).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
          </div>
          {person && <AttendanceProfileCard person={person} entries={allEntries} />}
          <div className="flex items-center gap-2 border-y border-border py-4 text-sm"><Clock3 className="size-4 text-primary" /><span>Last activity: {lastActivity?.action ?? "Not recorded"}</span></div>
          <div className="mt-6 grid grid-cols-2 gap-3"><Button className="h-12" disabled={busy || !loaded || !person} onClick={() => clock("In")}><LogIn /> Clock In</Button><Button className="h-12" variant="secondary" disabled={busy || !loaded || !person} onClick={() => clock("Out")}><LogOut /> Clock Out</Button></div>
          {busy && <p role="status" className="mt-3 text-sm text-muted-foreground">Saving attendance…</p>}
        </section>}
        <section className="self-start overflow-hidden rounded-lg border border-border bg-card" aria-label="Camera widget">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><h2 className="flex items-center gap-2 font-sans text-sm font-semibold"><Camera className="size-4" /> Camera</h2><span className="text-xs text-muted-foreground">{active ? "Live" : "Off"}</span></div>
          <div className="relative aspect-[4/3] bg-muted"><video ref={video} muted playsInline aria-label="Live camera feed" className={`absolute inset-0 h-full w-full object-cover ${active ? "" : "invisible"}`} />{!active && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground"><Camera className="size-12" strokeWidth={1.25} /><span className="text-sm">{busy ? "Connecting camera…" : "Camera is off"}</span></div>}</div>
          <div className="flex justify-end px-4 py-3"><Button variant="outline" disabled={busy || !loaded} onClick={active ? stopCamera : () => void useCamera()}>{active ? <CameraOff /> : <Camera />}{active ? "Stop camera" : "Enable camera"}</Button></div>
        </section>
      </div>
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Signed-out records stay on this device. Signed-in records are shared live with every signed-in team phone. Sample teacher and child names are included. Obtain consent before saving personal details or children's photos.</p>
      <div className="mt-8"><LiveSiteActivity /></div>
      <AttendanceLog entries={allEntries} onPhoto={setPhoto} />
    </main>
    {photo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-5" onClick={() => setPhoto(null)}><section role="dialog" aria-modal="true" aria-label="Attendance photo" className="w-full max-w-md rounded-lg bg-card p-4" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === "Escape") setPhoto(null); }}><div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-sans font-semibold">{photo.name} · {photo.action}</h2><Button autoFocus size="icon" variant="ghost" aria-label="Close photo" onClick={() => setPhoto(null)}><X /></Button></div><img src={photo.photo} alt={`${photo.name} attendance snapshot`} className="w-full rounded" /><p className="mt-3 text-xs text-muted-foreground">{new Date(photo.timestamp).toLocaleString()}</p></section></div>}
  </div>;
}