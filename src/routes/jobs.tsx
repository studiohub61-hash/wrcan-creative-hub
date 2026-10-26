import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Briefcase, MapPin } from "lucide-react";
import { Shell } from "@/components/Shell";
import { CardSkeletonList } from "@/components/Skeleton";
import { MatchRing, Plate, inputClass } from "@/components/EmpireUI";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { matchJob, scoreBand } from "@/lib/matching";
import { LiveJobsFeed } from "@/components/LiveJobsFeed";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

async function fetchActiveJobs() {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export const Route = createFileRoute("/jobs")({
  // Prefetched on link hover, so opening Vacancies shows content straight away.
  loader: ({ context }) =>
    context.queryClient.prefetchQuery({ queryKey: ["jobs"], queryFn: fetchActiveJobs }),
  head: () => ({
    meta: [
      { title: "Auto-Matched Jobs & Catering Vacancies — WRCAN App" },
      {
        name: "description",
        content:
          "Browse recruitment and catering vacancies across South Africa, auto-matched to your age, academic qualifications, skills and experience.",
      },
      { property: "og:title", content: "Auto-Matched Jobs & Catering Vacancies — WRCAN App" },
      {
        property: "og:description",
        content:
          "WRCAN scores every vacancy against your registration profile so you only apply where you fit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JobsPage,
});

const CATEGORIES = ["All", "Catering", "Recruitment", "Security", "Cleaning", "Promotions"];

function JobsPage() {
  const { profile } = useAuth();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: fetchActiveJobs,
    placeholderData: keepPreviousData,
  });

  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("jobs-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => {
        void qc.invalidateQueries({ queryKey: ["jobs"] });
      })
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [qc]);

  const ranked = useMemo(() => {
    const term = q.trim().toLowerCase();
    return jobs
      .filter((j) => (cat === "All" ? true : j.category.toLowerCase() === cat.toLowerCase()))
      .filter(
        (j) =>
          !term ||
          j.title.toLowerCase().includes(term) ||
          j.company.toLowerCase().includes(term) ||
          (j.city ?? "").toLowerCase().includes(term) ||
          (j.required_skills ?? []).some((s) => s.toLowerCase().includes(term)),
      )
      .map((job) => ({ job, match: matchJob(profile, job) }))
      .sort((a, b) => b.match.score - a.match.score);
  }, [jobs, q, cat, profile]);

  return (
    <Shell title="Vacancies" subtitle="Auto-matched to your dossier">
      <div className="space-y-3 pb-6">
        <input
          className={inputClass}
          placeholder="Search role, company, town or skill"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`rounded-full px-4 py-1.5 text-[0.65rem] font-semibold tracking-widest uppercase transition-colors ${
                cat === c
                  ? "rose-metal"
                  : "border border-border bg-card/70 text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {!profile ? (
          <Plate>
            <p className="text-sm text-muted-foreground">
              <Link to="/profile" className="text-primary underline">
                Complete your registration
              </Link>{" "}
              to unlock personal match scores on every vacancy.
            </p>
          </Plate>
        ) : null}

        {isLoading ? <CardSkeletonList count={3} /> : null}

        {ranked.map(({ job, match }) => (
          <Link key={job.id} to="/jobs/$jobId" params={{ jobId: job.id }} className="block">
            <Plate className="flex items-start gap-3">
              <MatchRing score={match.score} />
              <div className="min-w-0 flex-1">
                <h2 className="font-display truncate text-base font-semibold">{job.title}</h2>
                <p className="truncate text-xs text-muted-foreground">
                  {job.company} · {job.employment_type}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {[job.city, job.province].filter(Boolean).join(", ") || "South Africa"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-accent/50 px-2 py-0.5 text-[0.6rem] tracking-widest text-primary uppercase">
                    {scoreBand(match.score)}
                  </span>
                  {job.salary_min ? (
                    <span className="text-[0.65rem] text-muted-foreground">
                      R{job.salary_min.toLocaleString()}
                      {job.salary_max ? ` – R${job.salary_max.toLocaleString()}` : "+"}
                    </span>
                  ) : null}
                  {job.disability_friendly ? (
                    <span className="text-[0.6rem] tracking-widest text-primary uppercase">
                      Inclusive
                    </span>
                  ) : null}
                </div>
              </div>
              <Briefcase className="h-4 w-4 shrink-0 text-primary/70" />
            </Plate>
          </Link>
        ))}

        {!isLoading && ranked.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No vacancies match that search yet.
          </p>
        ) : null}

        <div className="deco-rule my-4" />
        <LiveJobsFeed term={q} />
      </div>
    </Shell>
  );
}
