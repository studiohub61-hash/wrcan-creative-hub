import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, BarChart3, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { COMPLIANCE, PLACEMENTS, studentStore, useStudents, type Student } from "@/lib/students";

export const Route = createFileRoute("/admin/student-management")({
  head: () => ({ meta: [
    { title: "Student Data Management — WRCAN" },
    { name: "description", content: "Add, edit and remove WRCAN student records that feed the Student Impact Dashboard." },
    { property: "og:title", content: "Student Data Management — WRCAN" },
    { property: "og:description", content: "Admin data entry for student attendance, progress, placement and compliance." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: AdminPage,
});

const field = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const blank = (): Student => ({ id: "", name: "", phone: "", email: "", cohort: "", attendance: 100, pace: 0, lastActivity: new Date().toISOString().slice(0, 10), placement: "Unplaced", compliance: "Document Pending", sponsor: "" });

function AdminPage() {
  const students = useStudents();
  const [form, setForm] = useState<Student>(blank);
  const set = <K extends keyof Student>(k: K, v: Student[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Student name is required"); return; }
    const editing = !!form.id;
    studentStore.upsert({ ...form, id: form.id || `s${Date.now()}`, attendance: clamp(form.attendance), pace: clamp(form.pace) });
    toast.success(editing ? "Student updated" : "Student added");
    setForm(blank());
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto max-w-4xl space-y-6">
        <nav className="flex flex-wrap items-center justify-between gap-2">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" /> Home</Link>
          <Button asChild size="sm"><Link to="/dashboard/student-impact"><BarChart3 className="size-4" /> Impact Dashboard</Link></Button>
        </nav>
        <header>
          <h1 className="font-display text-3xl text-primary">Student Data Management</h1>
          <p className="text-sm text-muted-foreground">Records save on this device and update the Impact Dashboard instantly.</p>
        </header>

        <form onSubmit={submit} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
          <L label="Student full name"><input className={field} value={form.name} onChange={(e) => set("name", e.target.value)} required /></L>
          <L label="Contact number"><input className={field} type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></L>
          <L label="Email"><input className={field} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></L>
          <L label="Active cohort / course"><input className={field} value={form.cohort} onChange={(e) => set("cohort", e.target.value)} /></L>
          <L label="Attendance rate (%)"><input className={field} type="number" min={0} max={100} value={form.attendance} onChange={(e) => set("attendance", Number(e.target.value))} /></L>
          <L label="Progress pace (%)"><input className={field} type="number" min={0} max={100} value={form.pace} onChange={(e) => set("pace", Number(e.target.value))} /></L>
          <L label="Last activity date"><input className={field} type="date" value={form.lastActivity} onChange={(e) => set("lastActivity", e.target.value)} required /></L>
          <L label="Job placement status"><select className={field} value={form.placement} onChange={(e) => set("placement", e.target.value as Student["placement"])}>{PLACEMENTS.map((p) => <option key={p}>{p}</option>)}</select></L>
          <L label="SETA/YES compliance"><select className={field} value={form.compliance} onChange={(e) => set("compliance", e.target.value as Student["compliance"])}>{COMPLIANCE.map((p) => <option key={p}>{p}</option>)}</select></L>
          <L label="Sponsor / donor name"><input className={field} value={form.sponsor} onChange={(e) => set("sponsor", e.target.value)} /></L>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit">{form.id ? "Save changes" : "Add student"}</Button>
            {form.id && <Button type="button" variant="outline" onClick={() => setForm(blank())}>Cancel</Button>}
          </div>
        </form>

        <section className="rounded-lg border bg-card">
          <h2 className="border-b px-4 py-3 font-display text-lg text-primary">Action / Update list ({students.length})</h2>
          <ul className="divide-y">
            {students.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.cohort || "No cohort"} · {s.attendance}% attendance · {s.placement} · {s.compliance}</p>
                </div>
                <Button size="sm" variant="outline" aria-label={`Edit ${s.name}`} onClick={() => { setForm(s); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil className="size-4" /> Edit</Button>
                <Button size="sm" variant="destructive" aria-label={`Delete ${s.name}`} onClick={() => { if (confirm(`Delete ${s.name}?`)) { studentStore.remove(s.id); toast.success("Student deleted"); } }}><Trash2 className="size-4" /> Delete</Button>
              </li>
            ))}
            {!students.length && <li className="px-4 py-6 text-center text-sm text-muted-foreground">No students yet.</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}

const clamp = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1 text-xs font-medium text-muted-foreground"><span>{label}</span>{children}</label>;
}
