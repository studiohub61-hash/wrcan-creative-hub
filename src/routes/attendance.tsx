import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, CameraOff, CheckCircle2, Clock3, GraduationCap, LogIn, LogOut, ShieldCheck, Users, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AttendanceRegistration, AttendanceProfileCard } from "@/components/AttendanceRegistration";
import { ATTENDANCE_KEY, PEOPLE_KEY, ATTENDANCE_ROLES, samplePeople, parsePeople, isAttendanceRole, punctualityAt, parseAttendance, type AttendancePerson, type AttendanceAction, type AttendanceEntry, type AttendanceRole } from "@/lib/attendance";

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
  const people = [...samplePeople(), ...registered];
  const person = people.find(p => p.role === role && p.id === selected);

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

  function savePerson(nextPerson: AttendancePerson) {
    try {
      const next = [nextPerson, ...parsePeople(localStorage.getItem(PEOPLE_KEY))];
      localStorage.setItem(PEOPLE_KEY, JSON.stringify(next));
      setRegistered(next); setRole(nextPerson.role); setSelected(nextPerson.id);
      setNotice({ error: false, text: `${nextPerson.name} registered. Their profile is ready in ${nextPerson.role} Mode.` });
      return true;
    } catch { setNotice({ error: true, text: "Person was not saved. Device storage is full or blocked; free some space and try again." }); return false; }
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
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = Math.round(320 * element.videoHeight / element.videoWidth);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not capture a photo. Please try again.");
      context.drawImage(element, 0, 0, canvas.width, canvas.height);
      const captured = canvas.toDataURL("image/jpeg", 0.65);
      if (reference) { setReferencePhoto(captured); stopCamera(); setNotice({ error: false, text: "Reference photo captured." }); return; }
      if (action && person) saveClock(action, captured);
    } catch (error) {
      if (!mounted.current) return;
      stopCamera();
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      const absent = error instanceof DOMException && (error.name === "NotFoundError" || error.name === "NotReadableError");
      setNotice({ error: true, text: denied ? "Camera permission was denied. Allow camera access in your browser and try again. No attendance was saved." : absent ? "No available camera was found. Connect a camera or close other apps using it, then try again. No attendance was saved." : error instanceof Error ? error.message : "Could not record attendance. Please try again." });
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  function saveClock(action: AttendanceAction, captured = "") {
    if (!person || !loaded) return;
    const now = new Date();
    const entry: AttendanceEntry = { id: crypto.randomUUID(), personId: person.id, name: person.name, role: person.role, action, timestamp: now.toISOString(), photo: captured || person.photo, ...(action === "In" ? { punctuality: punctualityAt(now, person.startTime, person.endTime) } : {}) };
    try {
      const next = [entry, ...parseAttendance(localStorage.getItem(ATTENDANCE_KEY))];
      localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(next)); setEntries(next);
      setNotice({ error: false, text: `${person.name} clocked ${action === "In" ? "in" : "out"}${entry.punctuality ? ` · ${entry.punctuality}` : ""}. Attendance saved on this device.` });
    } catch { setNotice({ error: true, text: "Attendance was not saved. Device storage is full or blocked; free some space and try again." }); }
  }

  function clock(action: AttendanceAction) {
    if (busy || !person || !loaded) return;
    if (active) void useCamera(action);
    else saveClock(action);
  }

  return <div className="attendance-theme min-h-screen bg-background">
    <header className="border-b border-border bg-card"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-5">
      <div className="flex gap-4"><Link to="/" className="inline-flex items-center gap-2 text-sm text-primary"><ArrowLeft className="size-4" /> Home</Link><Link to="/smartstart" className="text-sm text-primary">SmartStart</Link></div>
      <span className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" /> Device-only records</span>
    </div></header>
    <main className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-7 flex items-center gap-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"><Users className="size-6" /></div><div className="min-w-0"><h1 className="font-sans text-2xl font-bold sm:text-3xl">Registration &amp; Clock-In</h1><p className="mt-1 text-sm text-muted-foreground">SmartStart · Daily register · Johannesburg time</p></div></div>
      <Tabs value={tab} onValueChange={value => { if (busy) return; stopCamera(); setNotice(null); if (value === "register") { setTab(value); return; } if (isAttendanceRole(value)) { setTab(value); setRole(value); setSelected(people.find(p => p.role === value && p.id === selected)?.id ?? registered.find(p => p.role === value)?.id ?? people.find(p => p.role === value)?.id ?? ""); } }}>
        <TabsList className="mb-7 grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">{ATTENDANCE_ROLES.map(r => <TabsTrigger disabled={busy} key={r} value={r} className="min-h-12 whitespace-normal px-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{r} Mode</TabsTrigger>)}<TabsTrigger disabled={busy} value="register" className="min-h-12 whitespace-normal px-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">+ Register People</TabsTrigger></TabsList>
      </Tabs>
      {notice && <div role="alert" className={`mb-5 flex gap-2 rounded-md border p-3 text-sm ${notice.error ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-primary/30 bg-accent text-primary"}`}>{notice.error ? <AlertCircle className="size-4 shrink-0" /> : <CheckCircle2 className="size-4 shrink-0" />}<span>{notice.text}</span></div>}
      <div className="grid gap-7 md:grid-cols-[1fr_1.2fr]">
        {tab === "register" ? <AttendanceRegistration onSave={savePerson} people={registered} entries={entries} photo={referencePhoto} onPhoto={setReferencePhoto} onCamera={() => void useCamera(undefined, true)} busy={busy} loaded={loaded} /> :
        <section className="min-w-0 py-2">
          <h2 className="font-sans text-xl font-semibold">{role} register</h2>
          <div className="my-5"><label id="attendance-person" className="mb-2 block text-sm font-medium">{role} name</label>
            <Select value={selected} onValueChange={setSelected} disabled={busy || !people.some(p => p.role === role)}><SelectTrigger aria-labelledby="attendance-person" className="h-12 bg-card"><SelectValue placeholder="No people registered" /></SelectTrigger><SelectContent className="attendance-theme">{people.filter(p => p.role === role).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
          </div>
          {person && <AttendanceProfileCard person={person} entries={entries} />}
          <div className="flex items-center gap-2 border-y border-border py-4 text-sm"><Clock3 className="size-4 text-primary" /><span>Last activity: {entries.find(e => e.personId === person?.id || (!e.personId && e.role === role && e.name === person?.name))?.action ?? "Not recorded"}</span></div>
          <div className="mt-6 grid grid-cols-2 gap-3"><Button className="h-12" disabled={busy || !loaded || !person} onClick={() => clock("In")}><LogIn /> Clock In</Button><Button className="h-12" variant="secondary" disabled={busy || !loaded || !person} onClick={() => clock("Out")}><LogOut /> Clock Out</Button></div>
          {busy && <p role="status" className="mt-3 text-sm text-muted-foreground">Waiting for camera…</p>}
        </section>}
        <section className="overflow-hidden rounded-lg border border-border bg-card" aria-label="Camera widget">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><h2 className="flex items-center gap-2 font-sans text-sm font-semibold"><Camera className="size-4" /> Camera</h2><span className="text-xs text-muted-foreground">{active ? "Live" : "Off"}</span></div>
          <div className="relative aspect-[4/3] bg-muted"><video ref={video} muted playsInline aria-label="Live camera feed" className={`absolute inset-0 h-full w-full object-cover ${active ? "" : "invisible"}`} />{!active && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground"><Camera className="size-12" strokeWidth={1.25} /><span className="text-sm">{busy ? "Connecting camera…" : "Camera is off"}</span></div>}</div>
          <div className="flex justify-end px-4 py-3"><Button variant="outline" disabled={busy || !loaded} onClick={active ? stopCamera : () => void useCamera()}>{active ? <CameraOff /> : <Camera />}{active ? "Stop camera" : "Enable camera"}</Button></div>
        </section>
      </div>
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Records and photos stay on this device. Sample teacher and child names are included. Obtain consent before saving personal details or children's photos.</p>
      <section className="mt-10 border-t border-border pt-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="font-sans text-xl font-semibold">Attendance log</h2><span className="text-sm text-muted-foreground">{entries.length} records</span></div>
        <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr>{["Name", "Role", "Timestamp · SAST", "Action", "Punctuality", "Photo"].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{entries.map(e => <tr key={e.id} className="border-t border-border"><td className="px-4 py-3 font-medium">{e.name}</td><td className="px-4 py-3">{e.role}</td><td className="px-4 py-3">{new Date(e.timestamp).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</td><td className="px-4 py-3"><span className={`rounded px-2 py-1 text-xs font-medium ${e.action === "In" ? "bg-accent text-primary" : "bg-secondary text-secondary-foreground"}`}>{e.action}</span></td><td className={`px-4 py-3 ${e.punctuality === "Late" ? "text-destructive" : "text-primary"}`}>{e.punctuality ?? "—"}</td><td className="px-4 py-2">{e.photo ? <Button variant="ghost" className="h-12 w-16 p-0" aria-label={`View photo of ${e.name} clocked ${e.action.toLowerCase()}`} onClick={() => setPhoto(e)}><img src={e.photo} alt={`${e.name} attendance snapshot`} className="h-12 w-16 rounded object-cover" /></Button> : "—"}</td></tr>)}{!entries.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No attendance recorded yet.</td></tr>}</tbody></table></div>
      </section>
    </main>
    {photo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-5" onClick={() => setPhoto(null)}><section role="dialog" aria-modal="true" aria-label="Attendance photo" className="w-full max-w-md rounded-lg bg-card p-4" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === "Escape") setPhoto(null); }}><div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-sans font-semibold">{photo.name} · {photo.action}</h2><Button autoFocus size="icon" variant="ghost" aria-label="Close photo" onClick={() => setPhoto(null)}><X /></Button></div><img src={photo.photo} alt={`${photo.name} attendance snapshot`} className="w-full rounded" /><p className="mt-3 text-xs text-muted-foreground">{new Date(photo.timestamp).toLocaleString()}</p></section></div>}
  </div>;
}