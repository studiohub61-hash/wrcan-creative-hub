import { useState, type FormEvent } from "react";
import { Camera, Save, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ATTENDANCE_ROLES, isAttendanceRole, profileStats, type AttendancePerson, type AttendanceEntry, type AttendanceRole } from "@/lib/attendance";

export function AttendanceProfileCard({ person, entries }: { person: AttendancePerson; entries: AttendanceEntry[] }) {
  const stats = profileStats(person, entries);
  return <article aria-label={`Profile card for ${person.name}`} className="rounded-lg border border-border bg-card p-4">
    <div className="flex items-center gap-3">{person.photo ? <img src={person.photo} alt={`${person.name} reference`} className="size-16 shrink-0 rounded-md object-cover" /> : <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-accent text-primary"><UserRound className="size-7" /></div>}<div className="min-w-0"><h3 className="break-words font-sans font-semibold">{person.name}</h3><p className="text-sm text-primary">{person.role}</p><p className="break-words text-xs text-muted-foreground">{person.site}</p></div></div>
    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Custom Hours · SAST</dt><dd>{person.startTime} – {person.endTime}</dd></div><div><dt className="text-xs text-muted-foreground">Attendance Count</dt><dd className="font-semibold">{stats.count}</dd></div><div><dt className="text-xs text-muted-foreground">Punctuality Rating</dt><dd className={stats.punctuality === "Late" ? "font-semibold text-destructive" : "font-semibold text-primary"}>{stats.punctuality ?? "Not clocked in yet"}</dd></div><div><dt className="text-xs text-muted-foreground">On-time clock-ins</dt><dd>{stats.onTime} / {stats.count}</dd></div></dl>
  </article>;
}

export function AttendanceRegistration({ onSave, people, entries, photo, onPhoto, onCamera, busy, loaded }: {
  onSave: (person: AttendancePerson) => boolean; people: AttendancePerson[]; entries: AttendanceEntry[]; photo: string;
  onPhoto: (photo: string) => void; onCamera: () => void; busy: boolean; loaded: boolean;
}) {
  const [role, setRole] = useState<AttendanceRole>("Teacher");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  async function upload(file: File | undefined) {
    if (!file) return;
    setError(""); setReading(true);
    try {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a JPG, PNG or WebP photo.");
      if (file.size > 10 * 1024 * 1024) throw new Error("Choose a photo smaller than 10 MB.");
      const image = await createImageBitmap(file);
      try {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 480 / Math.max(image.width, image.height));
        canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Photo could not be processed.");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        onPhoto(canvas.toDataURL("image/jpeg", 0.75));
      } finally { image.close(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Photo could not be loaded."); }
    finally { setReading(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    if (!["name", "identityNumber", "contact", "site"].every(key => value(key))) { setError("Complete all person details."); return; }
    if (!photo) { setError("Add a reference photo before saving."); return; }
    const startTime = value("startTime"); const endTime = value("endTime");
    if (startTime === endTime) { setError("Start and end times must be different."); return; }
    if (onSave({ id: crypto.randomUUID(), role, name: value("name"), identityNumber: value("identityNumber"), contact: value("contact"), site: value("site"), photo, startTime, endTime })) { form.reset(); onPhoto(""); }
  }
  return <section className="min-w-0">
    <h2 className="font-sans text-xl font-semibold">Register people</h2>
    <form onSubmit={submit} className="mt-5 space-y-4">
      <div><Label htmlFor="registration-role">Role</Label><Select value={role} onValueChange={v => { if (isAttendanceRole(v)) setRole(v); }}><SelectTrigger id="registration-role" className="mt-2 w-full bg-card"><SelectValue /></SelectTrigger><SelectContent className="attendance-theme">{ATTENDANCE_ROLES.map(r => <SelectItem value={r} key={r}>{r}</SelectItem>)}</SelectContent></Select></div>
      {[{ name: "name", label: "Full Name" }, { name: "identityNumber", label: "ID / Birth Cert Number" }, { name: "contact", label: "Phone / Guardian Contact" }, { name: "site", label: "Site / Farm Name" }].map(f => <div key={f.name}><Label htmlFor={`register-${f.name}`}>{f.label}</Label><Input required id={`register-${f.name}`} name={f.name} type={f.name === "contact" ? "tel" : "text"} maxLength={120} className="mt-2 bg-card" /></div>)}
      <fieldset><legend className="mb-2 text-sm font-medium">Admin Custom Shift Hours · Johannesburg</legend><div className="grid grid-cols-2 gap-3"><div><Label htmlFor="register-start">Start Time</Label><Input required id="register-start" name="startTime" type="time" defaultValue="08:00" className="mt-2 bg-card" /></div><div><Label htmlFor="register-end">End Time</Label><Input required id="register-end" name="endTime" type="time" defaultValue="16:00" className="mt-2 bg-card" /></div></div></fieldset>
      <div><Label htmlFor="register-photo">Reference Photo</Label><Input disabled={busy || reading} id="register-photo" type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 h-auto bg-card" onChange={e => void upload(e.target.files?.[0])} /><Button type="button" variant="outline" className="mt-3" disabled={busy || reading || !loaded} onClick={onCamera}><Camera /> Take reference photo</Button>{photo && <img src={photo} alt="Reference photo preview" className="mt-3 size-24 rounded-md object-cover" />}</div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="h-12 w-full" disabled={busy || reading || !loaded}><Save />{reading ? "Preparing photo…" : "Save Person"}</Button>
    </form>
    <div className="mt-8 space-y-3"><h2 className="font-sans text-xl font-semibold">Registered profiles <span className="text-sm text-muted-foreground">({people.length})</span></h2>{people.map(p => <AttendanceProfileCard key={p.id} person={p} entries={entries} />)}{!people.length && <p className="text-sm text-muted-foreground">No people registered yet.</p>}</div>
  </section>;
}