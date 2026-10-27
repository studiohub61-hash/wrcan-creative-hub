import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ClipboardList,
  Download,
  Flag,
  MapPin,
  X,
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { downloadCsv } from "@/lib/csv";
import {
  BRONZE_SILVER_ITEMS,
  COACHES,
  ECD_LIST,
  PROGRAM_DAYS,
  REVIEW_KEY,
  SEED_EVIDENCE,
  TRACKER_ITEMS,
  applyFilters,
  applyReviews,
  coachDailyRows,
  daysInProgram,
  daysLeft,
  evidenceAt,
  formatGps,
  kpiStats,
  managerWeeklyRows,
  parseReviews,
  qualityByCategory,
  redFlags,
  tasksToday,
  trackerMet,
  trackerProgress,
  type Evidence,
  type EvidenceCategory,
  type Filters,
  type Review,
  type ReviewStatus,
  type WardMode,
} from "@/lib/ward50";

export const Route = createFileRoute("/ward50")({
  head: () => ({
    meta: [
      { title: "Ward 50 Dashboard — WRCAN SmartStart" },
      {
        name: "description",
        content:
          "Coach and manager dashboard for the Ward 50 Snake Park ECD pilot: evidence review, Bronze-to-Silver tracker, 60-day countdown and CSV exports.",
      },
      { property: "og:title", content: "Ward 50 Dashboard — WRCAN SmartStart" },
      {
        property: "og:description",
        content:
          "Field evidence review, compliance tracking and exports for the Snake Park ECD pilot.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Ward50,
});

const CATEGORIES: EvidenceCategory[] = ["Morning Alert", "Attendance", "Nutrition", "Infrastructure"];

const STATUS_STYLES: Record<string, string> = {
  pending: "border-amber-500/50 text-amber-600 dark:text-amber-400",
  approved: "border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
  rejected: "border-red-500/50 text-red-600 dark:text-red-400",
  needs_work: "border-orange-500/50 text-orange-600 dark:text-orange-400",
};

function loadReviews(): Record<string, Review> {
  try {
    return parseReviews(window.localStorage.getItem(REVIEW_KEY));
  } catch {
    return {};
  }
}

function Ward50() {
  const [mode, setMode] = useState<WardMode>("manager");
  const [coachId, setCoachId] = useState(COACHES[0]!.id);
  const [reviews, setReviews] = useState<Record<string, Review>>(loadReviews);
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [filters, setFilters] = useState<Filters>({ ecdId: "", category: "", status: "", from: "", to: "" });
  const now = Date.now();

  const evidence = useMemo(() => applyReviews(SEED_EVIDENCE, reviews), [reviews]);

  const coachEcds = useMemo(() => ECD_LIST.filter((e) => e.coachId === coachId), [coachId]);
  const visibleEcds = mode === "coach" ? coachEcds : ECD_LIST;
  const visibleEvidence = useMemo(
    () => (mode === "coach" ? evidence.filter((ev) => ev.coachId === coachId) : evidence),
    [mode, evidence, coachId],
  );

  const kpis = kpiStats(visibleEcds, visibleEvidence);
  const flags = redFlags(visibleEcds, visibleEvidence, now);
  const quality = qualityByCategory(visibleEvidence);
  const filtered = applyFilters(visibleEvidence, filters, now);
  const coach = COACHES.find((c) => c.id === coachId)!;
  const tasks = tasksToday(coachId, ECD_LIST, evidence);

  function review(id: string, status: ReviewStatus) {
    if (status !== "approved" && commentFor !== id) {
      setCommentFor(id);
      setCommentText("");
      return;
    }
    const comment = status === "approved" ? "" : commentText.trim();
    const next = { ...reviews, [id]: { status, comment } };
    setReviews(next);
    window.localStorage.setItem(REVIEW_KEY, JSON.stringify(next));
    setCommentFor(null);
    setCommentText("");
  }

  function exportCoachDaily() {
    downloadCsv(
      `ward50-coach-daily-${new Date(now).toISOString().slice(0, 10)}.csv`,
      coachDailyRows(filtered, ECD_LIST),
    );
  }

  function exportManagerWeekly() {
    downloadCsv(
      `ward50-manager-weekly-${new Date(now).toISOString().slice(0, 10)}.csv`,
      managerWeeklyRows(ECD_LIST, evidence, now),
    );
  }

  return (
    <Shell title="Ward 50 Dashboard" subtitle="Snake Park Pilot · Coach & Manager">
      {/* Mode toggle */}
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-border p-1">
        {(["coach", "manager"] as WardMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-lg py-2 text-xs font-semibold tracking-widest uppercase transition-colors ${
              mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {m === "coach" ? "Coach · Field" : "Manager · Office"}
          </button>
        ))}
      </div>

      {mode === "coach" ? (
        <>
          {/* Coach picker + status */}
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {COACHES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCoachId(c.id)}
                className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs ${
                  c.id === coachId ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                <span className="block font-semibold">{c.name}</span>
                <span className="text-muted-foreground">
                  {c.ecds} ECDs · 🔋 {c.battery}% · {c.gpsLive ? "GPS live" : "GPS off"}
                </span>
              </button>
            ))}
          </div>

          {/* Tasks today */}
          <div className="mb-5 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Assigned", value: tasks.assigned },
              { label: "Not submitted", value: tasks.notSubmitted },
              { label: "Flagged", value: tasks.flagged },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border py-3">
                <p className="font-display text-2xl text-primary">{s.value}</p>
                <p className="text-[0.6rem] tracking-widest text-muted-foreground uppercase">{s.label}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Manager KPIs */}
          <div className="mb-5 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {[
              { label: "ECDs in ward", value: kpis.total },
              { label: "Evidence compliance", value: `${kpis.compliance}%` },
              { label: "Avg days (Silver)", value: kpis.avgDays },
              { label: "Silver ready", value: kpis.readyGold },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border py-3">
                <p className="font-display text-2xl text-primary">{s.value}</p>
                <p className="text-[0.6rem] tracking-widest text-muted-foreground uppercase">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Quality by category */}
          <h2 className="mb-2 font-display text-xl text-primary">Evidence quality</h2>
          <div className="mb-5 divide-y divide-border rounded-xl border border-border">
            {quality.map((q) => (
              <div key={q.category} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-28 text-sm">{q.category}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${q.percent}%` }} />
                </div>
                <span className="w-16 text-right text-xs text-muted-foreground">
                  {q.percent}% · {q.count}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Red flags */}
      {flags.length > 0 ? (
        <div className="mb-5 rounded-xl border border-red-500/40 bg-red-500/5 p-3">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
            <AlertTriangle className="size-4" /> Red flags — no visit in 3+ days
          </h2>
          <ul className="space-y-1 text-xs">
            {flags.map(({ ecd, daysSince }) => (
              <li key={ecd.id} className="flex justify-between gap-2">
                <span>{ecd.name}</span>
                <span className="text-muted-foreground">
                  {daysSince === null ? "no evidence yet" : `${daysSince} days since last evidence`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Evidence feed */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-xl text-primary">Evidence feed</h2>
        <button
          onClick={exportCoachDaily}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-primary"
        >
          <Download className="size-3.5" /> Coach daily CSV
        </button>
      </div>

      {/* Filters */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <select
          value={filters.ecdId}
          onChange={(e) => setFilters({ ...filters, ecdId: e.target.value })}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
        >
          <option value="">All ECDs</option>
          {visibleEcds.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
        >
          <option value="">All statuses</option>
          {["pending", "approved", "rejected", "needs_work"].map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
          aria-label="From date"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
          aria-label="To date"
        />
      </div>

      <div className="mb-6 space-y-3">
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-border p-4 text-center text-xs text-muted-foreground">
            No evidence matches these filters.
          </p>
        ) : (
          filtered.map((ev) => {
            const ecd = ECD_LIST.find((e) => e.id === ev.ecdId);
            const evCoach = COACHES.find((c) => c.id === ev.coachId);
            return (
              <article key={ev.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{ecd?.name}</p>
                    <p className="text-[0.65rem] text-muted-foreground">
                      {ev.category} · {evCoach?.name} · {new Date(ev.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold tracking-widest uppercase ${STATUS_STYLES[ev.status]}`}
                  >
                    {ev.status.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-2 text-sm">{ev.text}</p>
                <p className="mt-1 flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                  <MapPin className="size-3" /> {formatGps(ev.gps)}
                </p>
                {ev.comment ? (
                  <p className="mt-2 rounded-lg bg-muted px-2 py-1.5 text-xs italic">“{ev.comment}”</p>
                ) : null}

                {commentFor === ev.id ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Coach comment (required for reject / needs work)"
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => review(ev.id, "rejected")}
                        disabled={!commentText.trim()}
                        className="flex-1 rounded-lg border border-red-500/50 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-40 dark:text-red-400"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => review(ev.id, "needs_work")}
                        disabled={!commentText.trim()}
                        className="flex-1 rounded-lg border border-orange-500/50 py-1.5 text-xs font-semibold text-orange-600 disabled:opacity-40 dark:text-orange-400"
                      >
                        Needs work
                      </button>
                      <button
                        onClick={() => setCommentFor(null)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => review(ev.id, "approved")}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-500/50 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                    >
                      <Check className="size-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => review(ev.id, "rejected")}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-red-500/50 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400"
                    >
                      <X className="size-3.5" /> Reject
                    </button>
                    <button
                      onClick={() => review(ev.id, "needs_work")}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-orange-500/50 py-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400"
                    >
                      <Flag className="size-3.5" /> Needs work
                    </button>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Bronze → Silver tracker */}
      <h2 className="mb-2 flex items-center gap-2 font-display text-xl text-primary">
        <ClipboardList className="size-5" /> Bronze → Silver tracker
      </h2>
      <div className="mb-6 space-y-3">
        {visibleEcds.map((ecd) => {
          const met = trackerMet(ecd, evidence);
          const progress = trackerProgress(ecd, evidence);
          return (
            <details key={ecd.id} className="rounded-xl border border-border">
              <summary className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{ecd.name}</p>
                  <p className="text-[0.65rem] text-muted-foreground">
                    {ecd.tier} · day {daysInProgram(ecd)} of {PROGRAM_DAYS} · {daysLeft(ecd)} left
                  </p>
                </div>
                <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                </div>
                <span className="w-10 text-right text-xs font-semibold text-primary">{progress}%</span>
              </summary>
              <ul className="grid grid-cols-1 gap-1 border-t border-border px-3 py-2 sm:grid-cols-2">
                {BRONZE_SILVER_ITEMS.map((item, i) => (
                  <li key={item} className="flex items-center gap-2 text-xs">
                    <span
                      className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                        met.includes(i)
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {met.includes(i) ? <Check className="size-2.5" /> : i + 1}
                    </span>
                    <span className={met.includes(i) ? "" : "text-muted-foreground"}>{item}</span>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>

      {/* 60-day countdown table (manager) */}
      {mode === "manager" ? (
        <>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-xl text-primary">60-day countdown</h2>
            <button
              onClick={exportManagerWeekly}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-primary"
            >
              <Download className="size-3.5" /> Manager weekly CSV
            </button>
          </div>
          <div className="mb-6 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">ECD</th>
                  <th className="px-3 py-2 font-medium">Coach</th>
                  <th className="px-3 py-2 font-medium">Tier</th>
                  <th className="px-3 py-2 text-right font-medium">Day</th>
                  <th className="px-3 py-2 text-right font-medium">Left</th>
                  <th className="px-3 py-2 text-right font-medium">Tracker</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ECD_LIST.map((ecd) => (
                  <tr key={ecd.id}>
                    <td className="px-3 py-2 font-medium">{ecd.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {COACHES.find((c) => c.id === ecd.coachId)?.name}
                    </td>
                    <td className="px-3 py-2">{ecd.tier}</td>
                    <td className="px-3 py-2 text-right">{daysInProgram(ecd)}</td>
                    <td className="px-3 py-2 text-right">{daysLeft(ecd)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-primary">
                      {trackerProgress(ecd, evidence)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <p className="pb-4 text-center text-[0.65rem] text-muted-foreground">
        Demo data for the Ward 50 Snake Park pilot · review decisions save on this device only ·{" "}
        {TRACKER_ITEMS} tracker items · {COACHES.length} coaches · {ECD_LIST.length} ECDs · seed{" "}
        {evidenceAt(SEED_EVIDENCE[0]!, now).slice(0, 10)}
      </p>
    </Shell>
  );
}
