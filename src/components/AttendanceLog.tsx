import { memo, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadCsv } from "@/lib/csv";
import type { AttendanceEntry } from "@/lib/attendance";

const timestamp = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", dateStyle: "medium", timeStyle: "short" });
export const AttendanceLog = memo(function AttendanceLog({ entries, onPhoto }: { entries: AttendanceEntry[]; onPhoto: (entry: AttendanceEntry) => void }) {
  const [search, setSearch] = useState("");
  const [count, setCount] = useState(30);
  const filtered = useMemo(() => entries.filter(e => `${e.name} ${e.role} ${e.action} ${e.punctuality ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())), [entries, search]);
  return <section className="mt-10 border-t border-border pt-6">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="font-sans text-xl font-semibold">Attendance log</h2><span className="text-sm text-muted-foreground">{entries.length} records</span><Button variant="outline" disabled={!filtered.length} onClick={() => downloadCsv("wrcan-attendance.csv", filtered.map(e => ({ Name: /^[=+@-]/.test(e.name) ? `'${e.name}` : e.name, Role: e.role, "Timestamp · SAST": timestamp.format(new Date(e.timestamp)), Action: e.action, Punctuality: e.punctuality ?? "", "Participant ID": e.personId ?? "" })))}><Download /> Export CSV</Button></div>
    <Input aria-label="Search attendance log" placeholder="Search name, role or punctuality" value={search} onChange={e => { setSearch(e.target.value); setCount(30); }} className="mb-4" />
    <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr>{["Name", "Role", "Timestamp · SAST", "Action", "Punctuality", "Photo"].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{filtered.slice(0, count).map(e => <tr key={e.id} className="border-t border-border"><td className="px-4 py-3 font-medium">{e.name}</td><td className="px-4 py-3">{e.role}</td><td className="px-4 py-3">{timestamp.format(new Date(e.timestamp))}</td><td className="px-4 py-3"><span className={`rounded px-2 py-1 text-xs font-medium ${e.action === "In" ? "bg-accent text-primary" : "bg-secondary text-secondary-foreground"}`}>{e.action}</span></td><td className={`px-4 py-3 ${e.punctuality === "Late" ? "text-destructive" : "text-primary"}`}>{e.punctuality ?? "—"}</td><td className="px-4 py-2">{e.photo ? <Button variant="ghost" className="h-12 w-16 p-0" aria-label={`View photo of ${e.name} clocked ${e.action.toLowerCase()}`} onClick={() => onPhoto(e)}><img loading="lazy" decoding="async" src={e.photo} alt={`${e.name} attendance snapshot`} className="h-12 w-16 rounded object-cover" /></Button> : "—"}</td></tr>)}{!filtered.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">{entries.length ? "No matching records." : "No attendance recorded yet."}</td></tr>}</tbody></table></div>
    {filtered.length > count && <Button variant="outline" className="mt-4" onClick={() => setCount(n => n + 30)}>Show more records</Button>}
  </section>;
});