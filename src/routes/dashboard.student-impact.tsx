import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Flag, MessageCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COMPLIANCE, riskOf, stats, studentStore, useStudents, whatsappLink, type RiskLevel } from "@/lib/students";

export const Route = createFileRoute("/dashboard/student-impact")({
  head: () => ({ meta: [
    { title: "Student Impact Dashboard — WRCAN" },
    { name: "description", content: "Live student retention analytics with early-warning flags, placements and SETA/YES compliance." },
    { property: "og:title", content: "Student Impact Dashboard — WRCAN" },
    { property: "og:description", content: "Early warning, attendance, placement and compliance at a glance." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ImpactPage,
});

const riskStyle: Record<RiskLevel, string> = {
  Red: "bg-destructive/10 text-destructive",
  Amber: "bg-secondary text-secondary-foreground",
  OK: "bg-accent text-primary",
};

function ImpactPage() {
  const students = useStudents();
  const [now, setNow] = useState(() => new Date("2026-11-03T00:00:00Z"));
  useEffect(() => setNow(new Date()), []);
  const s = stats(students);
  const atRisk = students.filter((x) => riskOf(x, now) !== "OK").length;

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto max-w-5xl space-y-6">
        <nav className="flex flex-wrap items-center justify-between gap-2">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" /> Home</Link>
          <Button asChild size="sm" variant="outline"><Link to="/admin/student-management"><UserPlus className="size-4" /> Manage students</Link></Button>
        </nav>
        <header>
          <h1 className="font-display text-3xl text-primary">Student Retention &amp; Impact</h1>
          <p className="text-sm text-muted-foreground">Figures come straight from Student Data Management. At risk = attendance under 75% or no activity for more than 7 days.</p>
        </header>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card label="Enrolled students" value={s.total} />
          <Card label="Average attendance" value={`${s.avgAttendance}%`} />
          <Card label="Placed graduates" value={s.placed} />
          <Card label="At risk" value={atRisk} />
        </div>

        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 font-display text-lg text-primary">SETA / YES compliance</h2>
          <div className="space-y-2">
            {COMPLIANCE.map((c) => {
              const n = s.compliance[c]; const pct = s.total ? Math.round((n / s.total) * 100) : 0;
              return (
                <div key={c} className="text-sm">
                  <div className="flex justify-between"><span>{c}</span><span className="text-muted-foreground">{n} ({pct}%)</span></div>
                  <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr><th className="p-3">Student</th><th className="p-3">Attendance</th><th className="p-3">Last activity</th><th className="p-3">Placement</th><th className="p-3">Status</th><th className="p-3">Quick action</th></tr>
            </thead>
            <tbody className="divide-y">
              {students.map((x) => {
                const r = riskOf(x, now);
                return (
                  <tr key={x.id}>
                    <td className="p-3"><p className="font-medium">{x.name}</p><p className="text-xs text-muted-foreground">{x.cohort}</p></td>
                    <td className="p-3">{x.attendance}%</td>
                    <td className="p-3">{x.lastActivity}</td>
                    <td className="p-3">{x.placement}</td>
                    <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${riskStyle[r]}`}>{r === "OK" ? "On track" : `At Risk · ${r}`}</span>{x.flagged && <span className="ml-1 text-xs text-destructive">Flagged</span>}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {r !== "OK" && x.phone && (
                          <Button asChild size="sm" variant="outline"><a href={whatsappLink(x)} target="_blank" rel="noreferrer" onClick={() => studentStore.patch(x.id, { nudgedAt: new Date().toISOString() })}><MessageCircle className="size-4" /> {x.nudgedAt ? "Nudged" : "Nudge via WhatsApp"}</a></Button>
                        )}
                        <Button size="sm" variant={x.flagged ? "secondary" : "ghost"} onClick={() => studentStore.patch(x.id, { flagged: !x.flagged })}><Flag className="size-4" /> {x.flagged ? "Unflag" : "Flag for review"}</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!students.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No students — add some in Student Data Management.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="font-display text-2xl text-primary">{value}</p></div>;
}
